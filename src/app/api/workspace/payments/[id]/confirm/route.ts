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
      reason?: string;
    };

    const reason = body.reason?.trim() ?? "";

    if (!reason) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const result = await db.runTransaction(async (transaction) => {
      const paymentRef = db.collection("payments").doc(id);
      const paymentSnapshot = await transaction.get(paymentRef);
      if (!paymentSnapshot.exists) {
        throw new Error("not_found");
      }

      const pendingPayment = paymentSnapshot.data() as NonNullable<Parameters<typeof confirmBankTransfer>[0]["payment"]>;
      if (pendingPayment.status !== "pendingReview") {
        throw new Error("invalid_payment");
      }

      const requestRef = db.collection("paymentRequests").doc(pendingPayment.paymentRequestId);
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists) {
        throw new Error("not_found");
      }

      const paymentRequest = requestSnapshot.data() as Parameters<typeof confirmBankTransfer>[0]["paymentRequest"];
      if (paymentRequest.status === "paid" || paymentRequest.status === "cancelled") {
        throw new Error("invalid_payment_request");
      }

      const orderRef = db.collection("orders").doc(paymentRequest.orderId);
      const memberRef = db.collection("members").doc(paymentRequest.memberUid);
      const [orderSnapshot, itemsSnapshot, memberSnapshot] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(db.collection("orderItems").where("orderId", "==", paymentRequest.orderId)),
        transaction.get(memberRef),
      ]);
      if (!orderSnapshot.exists) {
        throw new Error("order_not_found");
      }
      const member = memberSnapshot.data() as { email?: string } | undefined;
      if (!member?.email) {
        throw new Error("member_email_not_found");
      }

      const orderBundle = {
        order: orderSnapshot.data(),
        items: itemsSnapshot.docs.map((snapshot) => snapshot.data()),
      } as Parameters<typeof confirmBankTransfer>[0]["orderBundle"];

      const confirmation = confirmBankTransfer({
        orderBundle,
        paymentRequest,
        payment: pendingPayment,
        receivedAmountTwd: pendingPayment.receivedAmountTwd,
        receivedAt: pendingPayment.receivedAt,
        confirmedBy: claims.uid,
        reason,
      });
      const notificationEvent = createPaymentConfirmedNotificationEvent({
        id: `notif_${confirmation.payment.id}`,
        memberUid: confirmation.paymentRequest.memberUid,
        recipientEmail: member.email,
        orderId: confirmation.paymentRequest.orderId,
        orderNumber: confirmation.orderBundle.order.orderNumber,
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
        unallocatedAmountTwd: confirmation.paymentRequest.unallocatedAmountTwd ?? 0,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
      transaction.update(paymentRef, {
        ...confirmation.payment,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
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
        : message === "not_found" || message === "order_not_found" || message === "member_email_not_found"
          ? 404
            : message === "invalid_payment_request" || message === "invalid_payment"
            ? 400
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
