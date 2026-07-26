import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { confirmBankTransfer } from "@/lib/payment/manualBankTransfer";
import { createPaymentConfirmedNotificationEvent } from "@/lib/notification/events";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as {
      receivedAmountTwd?: number;
      receivedAt?: string;
      reason?: string;
    };

    const receivedAmountTwd = body.receivedAmountTwd;
    const receivedAt = body.receivedAt?.trim() ?? "";
    const reason = body.reason?.trim() ?? "";

    if (!receivedAmountTwd || !receivedAt || !reason) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const result = await db.runTransaction(async (transaction) => {
      const requestRef = db.collection("paymentRequests").doc(id);
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists) {
        throw new Error("not_found");
      }

      const paymentRequest = requestSnapshot.data() as Parameters<typeof confirmBankTransfer>[0]["paymentRequest"];
      if (paymentRequest.status === "paid" || paymentRequest.status === "cancelled") {
        throw new Error("invalid_payment_request");
      }

      const orderRef = db.collection("orders").doc(paymentRequest.orderId);
      const [orderSnapshot, itemsSnapshot] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(db.collection("orderItems").where("orderId", "==", paymentRequest.orderId)),
      ]);
      if (!orderSnapshot.exists) {
        throw new Error("order_not_found");
      }

      const orderBundle = {
        order: orderSnapshot.data(),
        items: itemsSnapshot.docs.map((snapshot) => snapshot.data()),
      } as Parameters<typeof confirmBankTransfer>[0]["orderBundle"];

      const confirmation = confirmBankTransfer({
        orderBundle,
        paymentRequest,
        receivedAmountTwd,
        receivedAt,
        confirmedBy: claims.uid,
        reason,
      });
      const notificationEvent = createPaymentConfirmedNotificationEvent({
        id: `notif_${confirmation.payment.id}`,
        memberUid: confirmation.paymentRequest.memberUid,
        orderId: confirmation.paymentRequest.orderId,
        paymentRequestId: confirmation.paymentRequest.id,
        paymentId: confirmation.payment.id,
        createdAt: confirmation.payment.createdAt,
      });

      transaction.update(orderRef, {
        status: confirmation.orderBundle.order.status,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
      for (const item of confirmation.orderBundle.items) {
        transaction.update(db.collection("orderItems").doc(item.id), {
          status: item.status,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: item.updatedBy,
        });
      }
      transaction.update(requestRef, {
        status: confirmation.paymentRequest.status,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
      transaction.set(db.collection("payments").doc(confirmation.payment.id), {
        ...confirmation.payment,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection("paymentAllocations").doc(confirmation.allocation.id), {
        ...confirmation.allocation,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection("auditLogs").doc(confirmation.auditLog.id), {
        ...confirmation.auditLog,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection("notificationEvents").doc(notificationEvent.id), {
        ...notificationEvent,
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        paymentId: confirmation.payment.id,
        paymentRequestStatus: confirmation.paymentRequest.status,
        orderStatus: confirmation.orderBundle.order.status,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_token"
        ? 401
        : message === "not_found" || message === "order_not_found"
          ? 404
          : message === "invalid_payment_request"
            ? 400
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
