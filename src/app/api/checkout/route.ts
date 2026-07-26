import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { createConsentRecord } from "@/lib/legal/documents";
import { createOrderCreatedNotificationEvent } from "@/lib/notification/events";
import {
  createOrderFromCart,
  normalizeRecipientPhone,
  validateCheckoutCart,
  validateShippingDetails,
  type CartLineItem,
} from "@/lib/order/checkout";
import { createPaymentRequestForOrder } from "@/lib/payment/manualBankTransfer";
import { mapPublicCatalogItem, type PublicCatalogItem } from "@/lib/catalog/publicCatalog";

type CheckoutRequestBody = {
  cart: CartLineItem[];
  recipientName: string;
  recipientPhone: string;
  shippingMethod: "address" | "seven_eleven" | "family_mart";
  shippingAddress?: string;
  shippingStoreInfo?: string;
  legalVersionIds?: string[];
  idempotencyKey: string;
};

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const body = (await request.json()) as Partial<CheckoutRequestBody>;
    const cart = body.cart ?? [];

    const idempotencyKey = body.idempotencyKey?.trim() ?? "";
    if (cart.length === 0 || !idempotencyKey || idempotencyKey.length > 80) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
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

    const catalogSnapshot = await db.collection("productsPublic").get();
    const catalog = catalogSnapshot.docs
      .map((snapshot) => mapPublicCatalogItem(snapshot.data()))
      .filter((item): item is PublicCatalogItem => item !== null);
    const cartCheck = validateCheckoutCart(cart, catalog);
    if (!cartCheck.ok) {
      return NextResponse.json({ error: "validation_error", details: { cart: cartCheck.error } }, { status: 400 });
    }

    const timestamp = new Date().toISOString();
    const normalizedKey = idempotencyKey.replace(/^order_/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const orderId = `order_${normalizedKey}`;
    const checkoutResult = await db.runTransaction(async (transaction) => {
      const orderRef = db.collection("orders").doc(orderId);
      const existing = await transaction.get(orderRef);

      if (existing.exists) {
        const existingOrder = existing.data() as { memberUid?: string };
        if (existingOrder.memberUid !== claims.uid) {
          throw new Error("idempotency_conflict");
        }
        return { orderId, paymentRequestId: `pr_${orderId}`, alreadyExists: true };
      }

      const result = createOrderFromCart(
        {
          orderId,
          memberUid: claims.uid,
          createdAt: timestamp,
          recipientName: shippingCheck.value.recipientName,
          recipientPhone: normalizeRecipientPhone(shippingCheck.value.recipientPhone),
          shippingMethod: body.shippingMethod ?? "address",
          ...(shippingCheck.value.shippingAddress ? { shippingAddress: shippingCheck.value.shippingAddress } : {}),
          ...(shippingCheck.value.shippingStoreInfo ? { shippingStoreInfo: shippingCheck.value.shippingStoreInfo } : {}),
        },
        cart,
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
      });
      const notificationEvent = createOrderCreatedNotificationEvent({
        id: `notif_${orderId}`,
        memberUid: result.order.memberUid,
        orderId: result.order.id,
        paymentRequestId: paymentRequest.id,
        createdAt: timestamp,
      });

      transaction.set(orderRef, {
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

      return { orderId: result.order.id, paymentRequestId: paymentRequest.id, alreadyExists: false };
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
