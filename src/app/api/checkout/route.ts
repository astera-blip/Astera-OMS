import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import {
  createConsentRecord,
  currentLegalVersionIds,
} from "@/lib/legal/documents";
import { createOrderCreatedNotificationEvent } from "@/lib/notification/events";
import { attemptNotificationDelivery } from "@/lib/notification/delivery";
import {
  createOrderNumber,
  createOrderFromCart,
  groupCartItemsByCampaign,
  normalizeRecipientPhone,
  validateCheckoutCart,
  validateShippingDetails,
  type CartLineItem,
} from "@/lib/order/checkout";
import { createPaymentRequestForOrder } from "@/lib/payment/manualBankTransfer";
import { mapPublicCatalogItem } from "@/lib/catalog/publicCatalog";

type CheckoutRequestBody = {
  cart: CartLineItem[];
  recipientName: string;
  recipientPhone: string;
      shippingMethod: "address" | "seven_eleven" | "family_mart";
  shippingAddress?: string;
  shippingStoreInfo?: string;
  legalVersionIds?: string[];
  acceptedLegalTerms: boolean;
  acceptedSupplementRule: boolean;
  idempotencyKey: string;
};

type CheckoutOrderResult = {
  orderId: string;
  orderNumber: string;
  paymentRequestId: string;
  totalTwd: number;
};

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const recipientEmail = typeof claims.email === "string" ? claims.email : "";
    const body = (await request.json()) as Partial<CheckoutRequestBody>;
    const cart = body.cart ?? [];

    const idempotencyKey = body.idempotencyKey?.trim() ?? "";
    if (cart.length === 0 || !idempotencyKey || idempotencyKey.length > 80) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    if (body.acceptedLegalTerms !== true || body.acceptedSupplementRule !== true) {
      return NextResponse.json(
        {
          error: "validation_error",
          details: { consent: "請先同意下單條款、隱私權政策與二補規則。" },
        },
        { status: 400 },
      );
    }
    const requiredLegalVersionIds = currentLegalVersionIds();
    const submittedLegalVersionIds = [...new Set(body.legalVersionIds ?? [])].sort();
    if (
      submittedLegalVersionIds.length !== requiredLegalVersionIds.length
      || !requiredLegalVersionIds.every((id) => submittedLegalVersionIds.includes(id))
    ) {
      return NextResponse.json(
        {
          error: "validation_error",
          details: { consent: "條款或隱私權政策版本已更新，請重新確認後再下單。" },
        },
        { status: 400 },
      );
    }

    const shippingCheck = validateShippingDetails({
      recipientName: body.recipientName ?? "",
      recipientPhone: body.recipientPhone ?? "",
      shippingMethod: body.shippingMethod ?? "seven_eleven",
    });

    if (!shippingCheck.ok) {
      return NextResponse.json({ error: "validation_error", details: shippingCheck.errors }, { status: 400 });
    }

    const db = getAdminFirestore();
    const memberSnapshot = await db.collection("members").doc(claims.uid).get();
    const member = memberSnapshot.data() as {
      displayName?: unknown;
      communityId?: unknown;
      mobilePhone?: unknown;
    } | undefined;
    if (
      !memberSnapshot.exists
      || typeof member?.displayName !== "string"
      || !member.displayName.trim()
      || typeof member.communityId !== "string"
      || !member.communityId.trim()
      || typeof member.mobilePhone !== "string"
      || !/^09\d{8}$/.test(member.mobilePhone)
    ) {
      return NextResponse.json({ error: "member_profile_incomplete" }, { status: 400 });
    }
    const privateNoteSnapshot = await db.collection("memberPrivateNotes").doc(claims.uid).get();
    if (privateNoteSnapshot.data()?.riskState === "blacklisted") {
      return NextResponse.json({ error: "member_blacklisted" }, { status: 403 });
    }

    const [catalogSnapshot, variantSnapshot] = await Promise.all([
      db.collection("productsPublic").get(),
      db.collection("productVariants").get(),
    ]);
    const variantSkuById = new Map(
      variantSnapshot.docs.map((snapshot) => [
        snapshot.id,
        String((snapshot.data() as { sku?: string }).sku ?? ""),
      ]),
    );
    const catalog = catalogSnapshot.docs.flatMap((snapshot) => {
      const item = mapPublicCatalogItem(snapshot.data());

      return item
        ? [{
            ...item,
            variants: item.variants.map((variant) => ({
              ...variant,
              sku: variantSkuById.get(variant.id) ?? "",
            })),
          }]
        : [];
    });
    const cartCheck = validateCheckoutCart(cart, catalog);
    if (!cartCheck.ok) {
      return NextResponse.json({ error: "validation_error", details: { cart: cartCheck.error } }, { status: 400 });
    }

    const timestamp = new Date().toISOString();
    const normalizedKey = idempotencyKey.replace(/^order_/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const checkoutGroupId = `checkout_${normalizedKey}`;
    const attemptRef = db.collection("checkoutAttempts").doc(checkoutGroupId);
    const cartGroups = groupCartItemsByCampaign(cart);
    const checkoutResult = await db.runTransaction(async (transaction) => {
      const existingAttempt = await transaction.get(attemptRef);
      if (existingAttempt.exists) {
        const manifest = existingAttempt.data() as {
          memberUid?: string;
          orders?: CheckoutOrderResult[];
        };
        if (manifest.memberUid !== claims.uid) {
          throw new Error("idempotency_conflict");
        }
        const orders = manifest.orders ?? [];
        return {
          orderId: orders[0]?.orderId,
          orders,
          alreadyExists: true,
          notificationEventIds: [] as string[],
        };
      }

      const firstOrderId = `order_${normalizedKey}_1`;
      const firstOrderRef = db.collection("orders").doc(firstOrderId);
      const existing = await transaction.get(firstOrderRef);

      if (existing.exists) {
        const existingOrder = existing.data() as {
          memberUid?: string;
          checkoutGroupId?: string;
          orderNumber?: string;
          totalTwd?: number;
        };
        if (existingOrder.memberUid !== claims.uid) {
          throw new Error("idempotency_conflict");
        }
        const existingOrdersSnapshot = await transaction.get(
          db.collection("orders").where("checkoutGroupId", "==", checkoutGroupId),
        );
        const orders = existingOrdersSnapshot.docs
          .map((document) => {
            const order = document.data() as {
              orderNumber?: string;
              totalTwd?: number;
            };
            return {
              orderId: document.id,
              orderNumber: order.orderNumber ?? document.id,
              paymentRequestId: `pr_${document.id}`,
              totalTwd: order.totalTwd ?? 0,
            };
          })
          .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
        transaction.set(attemptRef, {
          memberUid: claims.uid,
          checkoutGroupId,
          orders,
          createdAt: FieldValue.serverTimestamp(),
        });
        return {
          orderId: orders[0]?.orderId ?? firstOrderId,
          orders,
          alreadyExists: true,
          notificationEventIds: [] as string[],
        };
      }

      const orderDate = new Date(timestamp);
      const yyyymmdd = timestamp.slice(0, 10).replaceAll("-", "");
      const sequenceRef = db.collection("siteSettings").doc(`order-sequence-${yyyymmdd}`);
      const sequenceSnapshot = await transaction.get(sequenceRef);
      const nextSequence = Number(sequenceSnapshot.data()?.nextOrderSequence ?? 1);
      const results = cartGroups.map((group, index) => {
        const orderId = `order_${normalizedKey}_${index + 1}`;
        const result = createOrderFromCart(
          {
            orderId,
            orderNumber: createOrderNumber(orderDate, nextSequence + index),
            checkoutGroupId,
            memberUid: claims.uid,
            createdAt: timestamp,
            recipientName: shippingCheck.value.recipientName,
            recipientPhone: normalizeRecipientPhone(shippingCheck.value.recipientPhone),
            shippingMethod: body.shippingMethod ?? "seven_eleven",
          },
          group.items,
          catalog,
        );
        const paymentRequest = createPaymentRequestForOrder(result, {
          paymentRequestId: `pr_${orderId}`,
          createdAt: timestamp,
        });
        const consentRecord = createConsentRecord({
          memberUid: result.order.memberUid,
          orderId: result.order.id,
          acceptedAt: timestamp,
          acceptedSupplementRule: true,
        });
        const notificationEvent = createOrderCreatedNotificationEvent({
          id: `notif_${orderId}`,
          memberUid: result.order.memberUid,
          recipientEmail,
          orderId: result.order.id,
          orderNumber: result.order.orderNumber,
          paymentRequestId: paymentRequest.id,
          createdAt: timestamp,
        });

        return { result, paymentRequest, consentRecord, notificationEvent };
      });

      results.forEach(({ result, paymentRequest, consentRecord, notificationEvent }) => {
        transaction.set(db.collection("orders").doc(result.order.id), {
          ...result.order,
          createdAt: FieldValue.serverTimestamp(),
        });
        for (const item of result.items) {
          transaction.set(db.collection("orderItems").doc(item.id), {
            ...item,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        transaction.set(db.collection("paymentRequests").doc(paymentRequest.id), {
          ...paymentRequest,
          createdAt: FieldValue.serverTimestamp(),
        });
        transaction.set(db.collection("consentRecords").doc(consentRecord.id), consentRecord);
        transaction.set(db.collection("notificationEvents").doc(notificationEvent.id), {
          ...notificationEvent,
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      transaction.set(sequenceRef, {
        nextOrderSequence: nextSequence + results.length,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      }, { merge: true });

      const orders: CheckoutOrderResult[] = results.map(({ result, paymentRequest }) => ({
        orderId: result.order.id,
        orderNumber: result.order.orderNumber ?? result.order.id,
        paymentRequestId: paymentRequest.id,
        totalTwd: result.order.totalTwd,
      }));
      transaction.set(attemptRef, {
        memberUid: claims.uid,
        checkoutGroupId,
        orders,
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        orderId: results[0]?.result.order.id,
        orders,
        alreadyExists: false,
        notificationEventIds: results.map(({ notificationEvent }) => notificationEvent.id),
      };
    });

    await Promise.allSettled(
      checkoutResult.notificationEventIds.map((eventId) =>
        attemptNotificationDelivery(db, eventId)),
    );
    return NextResponse.json({
      ok: true,
      orderId: checkoutResult.orderId,
      orders: checkoutResult.orders,
      alreadyExists: checkoutResult.alreadyExists,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_token"
        ? 401
        : message === "idempotency_conflict"
          ? 409
          : message === "member_profile_incomplete"
            ? 400
          : 500;
    return NextResponse.json(
      { error: status === 500 ? "internal_error" : message },
      { status },
    );
  }
}
