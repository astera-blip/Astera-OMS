import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import {
  applyDirectUnpaidCancellation,
  createCancellationRequest,
  markCancellationRequested,
  splitCancellationItems,
  verifyRefundAccountForPayment,
} from "@/lib/order/cancellation";
import { normalizeAccountNumber, normalizeBankCode } from "@/lib/payment/accountIdentity";
import type { OrderItemRecord, OrderRecord } from "@/lib/order/checkout";
import type { LocalPayment, LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";
import { CloudKmsMac } from "@/lib/security/cloudKmsMac";
import { storeRefundAccount } from "@/lib/payment/refundAccountVault";

type CancellationRequestBody = {
  orderId?: string;
  orderItemIds?: string[];
  reason?: string;
  idempotencyKey?: string;
  targetPaymentId?: string;
  refundBankCode?: string;
  refundAccountNumberFull?: string;
};

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const body = (await request.json()) as CancellationRequestBody;
    const orderId = body.orderId?.trim() ?? "";
    const reason = body.reason?.trim() ?? "";
    const orderItemIds = [...new Set(body.orderItemIds ?? [])].filter(Boolean);
    const idempotencyKey = body.idempotencyKey?.trim() ?? "";
    const targetPaymentId = body.targetPaymentId?.trim() ?? "";
    const refundBankCodeInput = body.refundBankCode;
    const refundAccountNumberInput = body.refundAccountNumberFull;

    if (!orderId || orderItemIds.length === 0 || !reason || !idempotencyKey) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const timestamp = new Date().toISOString();
    const requestId = `cancel_${idempotencyKey}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const requestIp = getRequestIp(request);
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
      let verifiedRefundAccount: { bankCode: string; accountNumberFull: string; accountNumberLast5: string } | undefined;
      if (split.paidItems.length > 0) {
        if (!targetPaymentId || refundBankCodeInput === undefined || refundAccountNumberInput === undefined) {
          throw new Error("refund_account_required");
        }
        const refundBankCode = normalizeBankCode(refundBankCodeInput);
        const refundAccountNumberFull = normalizeAccountNumber(refundAccountNumberInput);
        const targetPaymentSnapshot = await transaction.get(
          db.collection("payments").doc(targetPaymentId),
        );
        if (!targetPaymentSnapshot.exists) {
          throw new Error("payment_not_found");
        }
        const targetPayment = targetPaymentSnapshot.data() as LocalPayment;
        const targetPaymentRequestSnapshot = await transaction.get(
          db.collection("paymentRequests").doc(targetPayment.paymentRequestId),
        );
        if (!targetPaymentRequestSnapshot.exists) {
          throw new Error("payment_request_not_found");
        }
        const targetPaymentRequest = targetPaymentRequestSnapshot.data() as LocalPaymentRequest;
        if (
          targetPayment.memberUid !== claims.uid
          || targetPayment.status !== "confirmed"
          || targetPaymentRequest.memberUid !== claims.uid
          || targetPaymentRequest.orderId !== orderId
        ) {
          throw new Error("forbidden");
        }

        const verification = await verifyRefundAccountForPayment({
          refundBankCode,
          refundAccountNumberFull,
          payment: targetPayment,
          macClient: new CloudKmsMac(),
        });
        if (verification !== "match") {
          const rateLimited = await recordRefundVerificationFailure({
            transaction,
            db,
            requestId,
            memberUid: claims.uid,
            requestIp,
            orderId,
            verification,
          });
          return {
            error: rateLimited
              ? "refund_account_rate_limited"
              : verification === "needsReverification"
                ? "refund_account_reverification_required"
                : "refund_account_mismatch",
          };
        }
        verifiedRefundAccount = {
          bankCode: refundBankCode,
          accountNumberFull: refundAccountNumberFull,
          accountNumberLast5: refundAccountNumberFull.slice(-5),
        };
      }
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
            ...(verifiedRefundAccount
              ? {
                  targetPaymentId,
                  refundBankCode: verifiedRefundAccount.bankCode,
                  refundAccountLast5: verifiedRefundAccount.accountNumberLast5,
                }
              : {}),
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
        ...(verifiedRefundAccount
          ? { refundAccountNumberFull: verifiedRefundAccount.accountNumberFull }
          : {}),
      };
    });

    if ("error" in result) {
      throw new Error(result.error);
    }
    const privateAccountNumber = "refundAccountNumberFull" in result
      ? result.refundAccountNumberFull
      : undefined;
    if (result.requestId && privateAccountNumber) {
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await storeRefundAccount(result.requestId, privateAccountNumber, expiresAt);
    }

    const publicResult = { ...result } as typeof result & { refundAccountNumberFull?: string };
    delete publicResult.refundAccountNumberFull;
    return NextResponse.json({ ok: true, ...publicResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_token"
        ? 401
        : message === "forbidden"
          ? 403
          : message === "refund_account_rate_limited"
            ? 429
          : message.endsWith("_not_found")
            ? 404
            : message === "duplicate_pending_request"
              ? 409
              : message === "invalid_items"
                || message === "refund_account_required"
                || message === "refund_account_mismatch"
                || message === "refund_account_reverification_required"
                || message === "invalid_bank_code"
                || message === "invalid_account_number"
                ? 400
              : 500;
    return NextResponse.json(
      { error: status === 500 ? "internal_error" : message },
      { status },
    );
  }
}

async function recordRefundVerificationFailure(input: {
  transaction: FirebaseFirestore.Transaction;
  db: FirebaseFirestore.Firestore;
  requestId: string;
  memberUid: string;
  requestIp: string;
  orderId: string;
  verification: "mismatch" | "needsReverification";
}) {
  const windowStartedAt = Math.floor(Date.now() / (15 * 60 * 1000)) * 15 * 60 * 1000;
  const limits = [
    { scope: "request", key: input.requestId, maximum: 5 },
    { scope: "member", key: input.memberUid, maximum: 10 },
    { scope: "ip", key: input.requestIp, maximum: 20 },
  ];
  let rateLimited = false;
  for (const limit of limits) {
    const digest = createHash("sha256").update(limit.key).digest("hex");
    const ref = input.db.collection("securityRateLimits").doc(
      `refund-mismatch_${limit.scope}_${windowStartedAt}_${digest}`,
    );
    const snapshot = await input.transaction.get(ref);
    const previousCount = snapshot.exists
      ? Number((snapshot.data() as { count?: unknown }).count) || 0
      : 0;
    if (previousCount >= limit.maximum) {
      rateLimited = true;
    }
    input.transaction.set(ref, {
      scope: limit.scope,
      count: previousCount + 1,
      windowStartedAt: new Date(windowStartedAt).toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  input.transaction.set(input.db.collection("auditLogs").doc(`audit_refund_mismatch_${input.requestId}`), {
    id: `audit_refund_mismatch_${input.requestId}`,
    action: "refund.account.mismatch",
    actorUid: input.memberUid,
    targetType: "order",
    targetId: input.orderId,
    reason: input.verification === "needsReverification"
      ? "refund account verification unavailable"
      : "refund account verification failed",
    createdAt: FieldValue.serverTimestamp(),
  });
  return rateLimited;
}

function getRequestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}
