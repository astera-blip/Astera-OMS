import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { verifyRefundAccountForPayment, type CancellationRequestRecord } from "@/lib/order/cancellation";
import { normalizeAccountNumber, normalizeBankCode } from "@/lib/payment/accountIdentity";
import type { LocalPayment } from "@/lib/payment/manualBankTransfer";
import { storeRefundAccount } from "@/lib/payment/refundAccountVault";
import { CloudKmsMac } from "@/lib/security/cloudKmsMac";

type RefundAccountResubmissionRequest = Omit<CancellationRequestRecord, "status"> & {
  status: "needsReverification";
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireFirebaseUser(request);
    const { id } = await context.params;
    const body = (await request.json()) as {
      refundBankCode?: unknown;
      refundAccountNumberFull?: unknown;
    };
    const refundBankCode = normalizeBankCode(body.refundBankCode);
    const refundAccountNumberFull = normalizeAccountNumber(body.refundAccountNumberFull);
    const db = getAdminFirestore();
    const requestRef = db.collection("cancellationRequests").doc(id);
    const requestSnapshot = await requestRef.get();
    if (!requestSnapshot.exists) {
      throw new Error("cancellation_request_not_found");
    }
    const cancellation = requestSnapshot.data() as
      | CancellationRequestRecord
      | RefundAccountResubmissionRequest;
    if (cancellation.memberUid !== claims.uid) {
      throw new Error("forbidden");
    }
    if (
      cancellation.status !== "needsReverification"
      || !cancellation.targetPaymentId
    ) {
      throw new Error("refund_account_resubmission_not_allowed");
    }

    const paymentSnapshot = await db.collection("payments").doc(cancellation.targetPaymentId).get();
    if (!paymentSnapshot.exists) {
      throw new Error("payment_not_found");
    }
    const payment = paymentSnapshot.data() as LocalPayment;
    if (payment.memberUid !== claims.uid || payment.status !== "confirmed") {
      throw new Error("forbidden");
    }
    const verification = await verifyRefundAccountForPayment({
      refundBankCode,
      refundAccountNumberFull,
      payment,
      macClient: new CloudKmsMac(),
    });
    if (
      verification !== "match"
      || cancellation.refundBankCode !== refundBankCode
      || cancellation.refundAccountLast5 !== refundAccountNumberFull.slice(-5)
    ) {
      const rateLimited = await recordResubmissionFailure(db, {
        requestId: id,
        memberUid: claims.uid,
        requestIp: getRequestIp(request),
        orderId: cancellation.orderId,
        verification,
      });
      throw new Error(rateLimited
        ? "refund_account_rate_limited"
        : verification === "needsReverification"
          ? "refund_account_reverification_required"
          : "refund_account_mismatch");
    }

    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const stored = await storeRefundAccount(id, refundAccountNumberFull, expiresAt);
    await requestRef.update({
      status: "pending",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: claims.uid,
    });
    return NextResponse.json({
      ok: true,
      requestId: id,
      expiresAt: stored.expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token"
      ? 401
      : message === "forbidden"
        ? 403
        : message === "cancellation_request_not_found" || message === "payment_not_found"
          ? 404
          : message === "refund_account_rate_limited"
            ? 429
            : message === "invalid_bank_code"
              || message === "invalid_account_number"
              || message === "refund_account_resubmission_not_allowed"
              || message === "refund_account_reverification_required"
              || message === "refund_account_mismatch"
              ? 400
              : 500;
    return NextResponse.json({ error: status === 500 ? "internal_error" : message }, { status });
  }
}

async function recordResubmissionFailure(
  db: FirebaseFirestore.Firestore,
  input: {
    requestId: string;
    memberUid: string;
    requestIp: string;
    orderId: string;
    verification: "match" | "mismatch" | "needsReverification";
  },
) {
  return db.runTransaction(async (transaction) => {
    const windowStartedAt = Math.floor(Date.now() / (15 * 60 * 1000)) * 15 * 60 * 1000;
    const limits = [
      { scope: "request", key: input.requestId, maximum: 5 },
      { scope: "member", key: input.memberUid, maximum: 10 },
      { scope: "ip", key: input.requestIp, maximum: 20 },
    ];
    let rateLimited = false;
    for (const limit of limits) {
      const digest = createHash("sha256").update(limit.key).digest("hex");
      const ref = db.collection("securityRateLimits").doc(
        `refund-mismatch_${limit.scope}_${windowStartedAt}_${digest}`,
      );
      const snapshot = await transaction.get(ref);
      const previousCount = snapshot.exists
        ? Number((snapshot.data() as { count?: unknown }).count) || 0
        : 0;
      rateLimited ||= previousCount >= limit.maximum;
      transaction.set(ref, {
        scope: limit.scope,
        count: previousCount + 1,
        windowStartedAt: new Date(windowStartedAt).toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    transaction.set(db.collection("auditLogs").doc(), {
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
  });
}

function getRequestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}
