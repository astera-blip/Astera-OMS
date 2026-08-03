import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { applyCancellationReview, reviewCancellationRequest } from "@/lib/order/cancellation";
import type { OrderItemRecord, OrderRecord } from "@/lib/order/checkout";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";
import { deletedRefundVaultFields } from "@/lib/payment/refundAccountVault";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: "approved" | "rejected";
      reviewNote?: string;
      refundAmountTwd?: number;
      refundCompletedAt?: string;
      refundReference?: string;
    };

    const reviewStatus = body.status;
    const reviewNote = body.reviewNote?.trim() ?? "";
    const refundAmountTwd = body.refundAmountTwd;
    const refundCompletedAt = body.refundCompletedAt?.trim() ?? "";
    const refundReference = body.refundReference?.trim() ?? "";

    if (!reviewStatus || !reviewNote) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    if (
      reviewStatus === "approved"
      && (
        typeof refundAmountTwd !== "number"
        || !Number.isInteger(refundAmountTwd)
        || refundAmountTwd <= 0
        || !refundCompletedAt
        || !refundReference
      )
    ) {
      return NextResponse.json({ error: "missing_refund_metadata" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const result = await db.runTransaction(async (transaction) => {
      const requestRef = db.collection("cancellationRequests").doc(id);
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists) {
        throw new Error("not_found");
      }

      const requestRecord = requestSnapshot.data() as Parameters<typeof reviewCancellationRequest>[0];
      if (requestRecord.status !== "pending") {
        throw new Error("already_reviewed");
      }

      const reviewed = reviewCancellationRequest(requestRecord, {
        status: reviewStatus,
        reviewedAt: new Date().toISOString(),
        reviewedBy: claims.uid,
        reviewNote,
      });
      const reviewedWithRefundMetadata = {
        ...reviewed,
        ...(reviewStatus === "approved"
          ? {
              refundAmountTwd,
              refundCompletedAt,
              refundReference,
            }
          : {}),
      };

      const orderRef = db.collection("orders").doc(reviewed.orderId);
      const [orderSnapshot, itemsSnapshot, paymentRequestsSnapshot] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(db.collection("orderItems").where("orderId", "==", reviewed.orderId)),
        transaction.get(db.collection("paymentRequests").where("orderId", "==", reviewed.orderId)),
      ]);
      if (!orderSnapshot.exists) {
        throw new Error("order_not_found");
      }

      const order = orderSnapshot.data() as OrderRecord;
      const targetItemIds = new Set(reviewed.orderItemIds);
      const items = itemsSnapshot.docs.map((snapshot) => snapshot.data() as OrderItemRecord);
      const paymentRequests = paymentRequestsSnapshot.docs.map((snapshot) => snapshot.data() as LocalPaymentRequest);
      const reviewedBundle = applyCancellationReview(order, items, paymentRequests, reviewed, {
        status: reviewStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: claims.uid,
        ...(typeof refundAmountTwd === "number" ? { refundAmountTwd } : {}),
        ...(refundCompletedAt ? { refundCompletedAt } : {}),
        ...(refundReference ? { refundReference } : {}),
      });

      transaction.set(requestRef, {
        ...reviewedWithRefundMetadata,
        ...(reviewedBundle.order.status === "refunded" ? deletedRefundVaultFields() : {}),
      });
      for (const snapshot of itemsSnapshot.docs) {
        const item = snapshot.data() as OrderItemRecord;
        if (!targetItemIds.has(snapshot.id)) {
          continue;
        }

        transaction.update(snapshot.ref, {
          status: reviewedBundle.items.find((nextItem) => nextItem.id === item.id)?.status ?? item.status,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: claims.uid,
        });
      }

      transaction.update(orderRef, {
        status: reviewedBundle.order.status,
        totalTwd: reviewedBundle.order.totalTwd,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });

      for (const paymentSnapshot of paymentRequestsSnapshot.docs) {
        const nextPaymentRequest = reviewedBundle.paymentRequests.find(
          (paymentRequest) => paymentRequest.id === paymentSnapshot.id,
        );
        transaction.update(paymentSnapshot.ref, {
          amountTwd: nextPaymentRequest?.amountTwd ?? paymentSnapshot.data().amountTwd,
          status: nextPaymentRequest?.status ?? paymentSnapshot.data().status,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: claims.uid,
        });
      }
      if (reviewedBundle.adjustment) {
        transaction.set(db.collection("paymentAllocations").doc(reviewedBundle.adjustment.id), {
          ...reviewedBundle.adjustment,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      transaction.set(db.collection("auditLogs").doc(`audit_${reviewed.id}_${reviewStatus}`), {
        id: `audit_${reviewed.id}_${reviewStatus}`,
        action: "order.status.updated",
        actorUid: claims.uid,
        targetType: "order",
        targetId: reviewed.orderId,
        reason: reviewNote,
        createdAt: FieldValue.serverTimestamp(),
      });
      if (reviewedBundle.auditLog) {
        transaction.set(db.collection("auditLogs").doc(reviewedBundle.auditLog.id), {
          ...reviewedBundle.auditLog,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      return {
        status: reviewed.status,
        orderStatus: reviewedBundle.order.status,
        amountTwd: reviewedBundle.order.totalTwd,
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
          : message === "already_reviewed"
            ? 409
            : message === "invalid_items"
              ? 400
            : 500;
    return NextResponse.json(
      { error: status === 500 ? "internal_error" : message },
      { status },
    );
  }
}
