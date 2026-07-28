import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import {
  applyDirectUnpaidCancellation,
  createCancellationRequest,
  markCancellationRequested,
  splitCancellationItems,
} from "@/lib/order/cancellation";
import type { OrderItemRecord, OrderRecord } from "@/lib/order/checkout";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";

type CancellationRequestBody = {
  orderId?: string;
  orderItemIds?: string[];
  reason?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const body = (await request.json()) as CancellationRequestBody;
    const orderId = body.orderId?.trim() ?? "";
    const reason = body.reason?.trim() ?? "";
    const orderItemIds = [...new Set(body.orderItemIds ?? [])].filter(Boolean);
    const idempotencyKey = body.idempotencyKey?.trim() ?? "";

    if (!orderId || orderItemIds.length === 0 || !reason || !idempotencyKey) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const timestamp = new Date().toISOString();
    const requestId = `cancel_${idempotencyKey}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const result = await db.runTransaction(async (transaction) => {
      const requestRef = db.collection("cancellationRequests").doc(requestId);
      const existingRequest = await transaction.get(requestRef);
      if (existingRequest.exists) {
        return { requestId, alreadyExists: true };
      }

      const orderRef = db.collection("orders").doc(orderId);
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) {
        throw new Error("order_not_found");
      }

      const order = orderSnapshot.data() as OrderRecord;
      if (order.memberUid !== claims.uid) {
        throw new Error("forbidden");
      }

      const [allItemsSnapshot, paymentRequestsSnapshot] = await Promise.all([
        transaction.get(db.collection("orderItems").where("orderId", "==", orderId)),
        transaction.get(db.collection("paymentRequests").where("orderId", "==", orderId)),
      ]);
      const allItems = allItemsSnapshot.docs.map((snapshot) => snapshot.data() as OrderItemRecord);
      const selectedItems = allItems.filter((item) => orderItemIds.includes(item.id));
      if (selectedItems.length !== orderItemIds.length) {
        throw new Error("item_not_found");
      }

      if (selectedItems.some((item) => item.orderId !== orderId || item.memberUid !== claims.uid)) {
        throw new Error("invalid_items");
      }

      const pendingSnapshot = await transaction.get(
        db
          .collection("cancellationRequests")
          .where("orderId", "==", orderId)
          .where("memberUid", "==", claims.uid)
          .where("status", "==", "pending"),
      );
      const selectedItemSet = new Set(orderItemIds);
      const hasDuplicatePendingItem = pendingSnapshot.docs.some((snapshot) => {
        const pending = snapshot.data() as { orderItemIds?: string[] };
        return (pending.orderItemIds ?? []).some((itemId) => selectedItemSet.has(itemId));
      });
      if (hasDuplicatePendingItem) {
        throw new Error("duplicate_pending_request");
      }

      const split = splitCancellationItems(allItems, orderItemIds);
      const paymentRequests = paymentRequestsSnapshot.docs.map((snapshot) => snapshot.data() as LocalPaymentRequest);
      const directCancellation = split.unpaidItems.length > 0
        ? applyDirectUnpaidCancellation(order, allItems, paymentRequests, {
            orderItemIds: split.unpaidItems.map((item) => item.id),
            updatedAt: timestamp,
            updatedBy: claims.uid,
          })
        : null;
      const paidCancellationRequest = split.paidItems.length > 0
        ? createCancellationRequest({
            id: requestId,
            orderId,
            orderItemIds: split.paidItems.map((item) => item.id),
            memberUid: claims.uid,
            reason,
            createdAt: timestamp,
            createdBy: claims.uid,
          })
        : null;
      const requestedItems = paidCancellationRequest
        ? markCancellationRequested(directCancellation?.items ?? allItems, paidCancellationRequest, {
            updatedAt: timestamp,
            updatedBy: claims.uid,
          })
        : directCancellation?.items ?? allItems;

      if (paidCancellationRequest) {
        transaction.set(requestRef, {
          ...paidCancellationRequest,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      for (const snapshot of allItemsSnapshot.docs) {
        const nextItem = requestedItems.find((item) => item.id === snapshot.id);
        if (!nextItem || nextItem.status === (snapshot.data() as OrderItemRecord).status) {
          continue;
        }
        transaction.update(snapshot.ref, {
          status: nextItem.status,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: claims.uid,
        });
      }
      if (directCancellation) {
        transaction.update(orderRef, {
          status: directCancellation.order.status,
          totalTwd: directCancellation.order.totalTwd,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: claims.uid,
        });
        for (const paymentSnapshot of paymentRequestsSnapshot.docs) {
          const nextPaymentRequest = directCancellation.paymentRequests.find(
            (paymentRequest) => paymentRequest.id === paymentSnapshot.id,
          );
          transaction.update(paymentSnapshot.ref, {
            amountTwd: nextPaymentRequest?.amountTwd ?? paymentSnapshot.data().amountTwd,
            status: nextPaymentRequest?.status ?? paymentSnapshot.data().status,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: claims.uid,
          });
        }
      }
      transaction.set(db.collection("auditLogs").doc(`audit_${requestId}`), {
        id: `audit_${requestId}`,
        action: "order.status.updated",
        actorUid: claims.uid,
        targetType: "order",
        targetId: orderId,
        reason: paidCancellationRequest
          ? `cancellation requested: ${reason}`
          : `direct cancellation: ${reason}`,
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        requestId: paidCancellationRequest?.id ?? null,
        directlyCancelledItemIds: split.unpaidItems.map((item) => item.id),
        pendingReviewItemIds: split.paidItems.map((item) => item.id),
        alreadyExists: false,
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
          : message.endsWith("_not_found")
            ? 404
            : message === "invalid_items" || message === "duplicate_pending_request"
              ? 400
              : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
