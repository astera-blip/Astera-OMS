import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { createConsentRecord } from "@/lib/legal/documents";
import { createOrderCreatedNotificationEvent } from "@/lib/notification/events";
import {
  createOrderFromCart,
  normalizeRecipientPhone,
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

    if (!body.cart?.length || !body.idempotencyKey) {
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
    const catalogSnapshot = await db.collection("productsPublic").get();
    const catalog = catalogSnapshot.docs
      .map((snapshot) => mapPublicCatalogItem(snapshot.data()))
      .filter((item): item is PublicCatalogItem => item !== null);

    const timestamp = new Date().toISOString();
    const orderId = `order_${body.idempotencyKey}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const existing = await db.collection("orders").doc(orderId).get();

    if (existing.exists) {
      return NextResponse.json({ ok: true, orderId, alreadyExists: true });
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
      body.cart,
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

    const batch = db.batch();
    batch.set(db.collection("orders").doc(result.order.id), {
      ...result.order,
      createdAt: FieldValue.serverTimestamp(),
    });
    for (const item of result.items) {
      batch.set(db.collection("orderItems").doc(item.id), {
        ...item,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    batch.set(db.collection("paymentRequests").doc(paymentRequest.id), {
      ...paymentRequest,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("consentRecords").doc(consentRecord.id), consentRecord);
    batch.set(db.collection("notificationEvents").doc(notificationEvent.id), {
      ...notificationEvent,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({ ok: true, orderId: result.order.id, paymentRequestId: paymentRequest.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
