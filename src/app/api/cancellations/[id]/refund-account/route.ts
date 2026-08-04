import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { verifyRefundAccountForPayment, type CancellationRequestRecord } from "@/lib/order/cancellation";
import { normalizeAccountNumber, normalizeBankCode } from "@/lib/payment/accountIdentity";
import type { LocalPayment } from "@/lib/payment/manualBankTransfer";
import { encryptRefundAccount } from "@/lib/payment/refundAccountVault";
import { CloudKmsMac } from "@/lib/security/cloudKmsMac";
import {
  buildRefundVerificationScopes,
  finalizeRefundVerificationFailureReservation,
  reserveRefundVerificationAttempt,
} from "@/lib/order/refundVerificationAttempts";

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
    const verificationScopes = buildRefundVerificationScopes({
      requestId: id,
      memberUid: claims.uid,
      requestIp: getRequestIp(request),
    });
    const reservationResult = await reserveRefundVerificationAttempt({
      db,
      scopes: verificationScopes,
    });
    if (reservationResult.limited) {
      throw new Error("refund_account_rate_limited");
    }
    const { reservation } = reservationResult;
    const macClient = new CloudKmsMac();
    const verification = await verifyRefundAccountForPayment({
      refundBankCode,
      refundAccountNumberFull,
      payment,
      macClient,
    });
    if (
      verification !== "match"
      || cancellation.refundBankCode !== refundBankCode
      || cancellation.refundAccountLast5 !== refundAccountNumberFull.slice(-5)
    ) {
      await finalizeRefundVerificationFailureReservation({
        db,
        reservation,
        verification: verification === "needsReverification"
          ? "needsReverification"
          : "mismatch",
      });
      throw new Error(verification === "needsReverification"
        ? "refund_account_reverification_required"
        : "refund_account_mismatch");
    }

    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const encryptedRefundAccount = await encryptRefundAccount(id, refundAccountNumberFull, expiresAt);
    await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(requestRef);
      if (!currentSnapshot.exists) {
        throw new Error("cancellation_request_not_found");
      }
      const current = currentSnapshot.data() as CancellationRequestRecord | RefundAccountResubmissionRequest;
      if (
        current.status !== "needsReverification"
        || current.memberUid !== claims.uid
        || current.targetPaymentId !== cancellation.targetPaymentId
        || current.refundBankCode !== refundBankCode
        || current.refundAccountLast5 !== refundAccountNumberFull.slice(-5)
      ) {
        throw new Error("refund_account_state_changed");
      }
      transaction.update(requestRef, {
        ...encryptedRefundAccount,
        status: "pending",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
      transaction.delete(db.collection("auditLogs").doc(reservation.id));
    });
    return NextResponse.json({
      ok: true,
      requestId: id,
      expiresAt: encryptedRefundAccount.refundAccountExpiresAt,
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
            : message === "refund_account_state_changed"
              ? 409
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

function getRequestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}
