import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { createConsentRecord } from "@/lib/legal/documents";
import { createOrderCreatedNotificationEvent } from "@/lib/notification/events";
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

    const shippingCheck = validateShippingDetails({
      recipientName: body.recipientName ?? "",
      recipientPhone: body.recipientPhone ?? "",
      shippingMethod: body.shippingMethod ?? "address",
      shippingAddress: body.shippingAddress,
      shippingStoreInfo: body.shippingStoreInfo,
    });

    if (!shippingCheck.ok) {
      return NextResponse.json({ error: "validation_error", details: shippingCheck.errors }, { status: 400 });
    }

    const db = getAdminFirestore();
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
    const cartGroups = groupCartItemsByCampaign(cart);
    const checkoutResult = await db.runTransaction(async (transaction) => {
      const firstOrderId = `order_${normalizedKey}_1`;
      const firstOrderRef = db.collection("orders").doc(firstOrderId);
      const existing = await transaction.get(firstOrderRef);

      if (existing.exists) {
        const existingOrder = existing.data() as { memberUid?: string; checkoutGroupId?: string };
        if (existingOrder.memberUid !== claims.uid) {
          throw new Error("idempotency_conflict");
        }
        return {
          orderId: firstOrderId,
          orders: [{ orderId: firstOrderId, orderNumber: existingOrder.checkoutGroupId ?? firstOrderId }],
          alreadyExists: true,
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
            shippingMethod: body.shippingMethod ?? "address",
            ...(shippingCheck.value.shippingAddress ? { shippingAddress: shippingCheck.value.shippingAddress } : {}),
            ...(shippingCheck.value.shippingStoreInfo ? { shippingStoreInfo: shippingCheck.value.shippingStoreInfo } : {}),
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

      return {
        orderId: results[0]?.result.order.id,
        orders: results.map(({ result, paymentRequest }) => ({
          orderId: result.order.id,
          orderNumber: result.order.orderNumber,
          paymentRequestId: paymentRequest.id,
          totalTwd: result.order.totalTwd,
        })),
        alreadyExists: false,
      };
    });

    return NextResponse.json({ ok: true, ...checkoutResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_token"
        ? 401
        : message === "idempotency_conflict"
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
