import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { reverseConfirmedPayment } from "@/lib/payment/manualBankTransfer";
import type { OrderItemRecord, OrderRecord } from "@/lib/order/checkout";
import type { LocalPayment, LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as { reason?: string };
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

      const payment = paymentSnapshot.data() as LocalPayment;
      const requestRef = db.collection("paymentRequests").doc(payment.paymentRequestId);
      const allocationRef = db.collection("paymentAllocations").doc(`alloc_${payment.id}`);
      const [requestSnapshot, allocationSnapshot] = await Promise.all([
        transaction.get(requestRef),
        transaction.get(allocationRef),
      ]);
      if (!requestSnapshot.exists) {
        throw new Error("request_not_found");
      }
      const paymentRequest = requestSnapshot.data() as LocalPaymentRequest;
      const orderRef = db.collection("orders").doc(paymentRequest.orderId);
      const [orderSnapshot, itemsSnapshot] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(db.collection("orderItems").where("orderId", "==", paymentRequest.orderId)),
      ]);
      if (!orderSnapshot.exists) {
        throw new Error("order_not_found");
      }

      const reversedAt = new Date().toISOString();
      const reversal = reverseConfirmedPayment({
        orderBundle: {
          order: orderSnapshot.data() as OrderRecord,
          items: itemsSnapshot.docs.map((snapshot) => snapshot.data() as OrderItemRecord),
        },
        paymentRequest,
        payment,
        allocatedAmountTwd: allocationSnapshot.exists
          ? Number(allocationSnapshot.data()?.amountTwd ?? 0)
          : undefined,
        reversedAt,
        reversedBy: claims.uid,
        reason,
      });

      transaction.update(paymentRef, {
        status: reversal.payment.status,
        adminNote: reversal.payment.adminNote,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
      transaction.update(requestRef, {
        status: reversal.paymentRequest.status,
        allocatedAmountTwd: reversal.paymentRequest.allocatedAmountTwd ?? 0,
        unallocatedAmountTwd: reversal.paymentRequest.unallocatedAmountTwd ?? 0,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
      transaction.update(orderRef, {
        status: reversal.orderBundle.order.status,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
      for (const item of reversal.orderBundle.items) {
        transaction.update(db.collection("orderItems").doc(item.id), {
          status: item.status,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: claims.uid,
        });
      }
      transaction.set(db.collection("paymentAllocations").doc(reversal.adjustment.id), {
        ...reversal.adjustment,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection("auditLogs").doc(reversal.auditLog.id), {
        ...reversal.auditLog,
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        paymentId: reversal.payment.id,
        paymentStatus: reversal.payment.status,
        paymentRequestStatus: reversal.paymentRequest.status,
        orderStatus: reversal.orderBundle.order.status,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_token"
        ? 401
        : message === "forbidden"
          ? 403
          : message.endsWith("_not_found") || message === "not_found"
            ? 404
            : message === "invalid_payment"
              ? 409
              : 500;

    return NextResponse.json(
      { error: status === 500 ? "internal_error" : message },
      { status },
    );
  }
}
