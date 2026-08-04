import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { buildPaymentAccountSnapshot, type PaymentAccount } from "@/lib/payment/bankAccounts";
import type { MemberPaymentAccount } from "@/lib/payment/memberBankAccounts";
import {
  allocatePaymentReportAmount,
  buildMemberPaymentAccountIdentitySnapshot,
} from "@/lib/payment/manualBankTransfer";

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const body = (await request.json()) as {
      paymentRequestId?: string;
      paymentRequestIds?: string[];
      receivedAt?: string;
      receivedAmountTwd?: number;
      receivingPaymentAccountId?: string;
      memberPaymentAccountId?: string;
      payerName?: string;
      memberNote?: string;
    };
    const paymentRequestId = body.paymentRequestId?.trim() ?? "";
    const paymentRequestIds = (Array.isArray(body.paymentRequestIds)
      ? body.paymentRequestIds
      : paymentRequestId ? [paymentRequestId] : [])
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
    const uniquePaymentRequestIds = [...new Set(paymentRequestIds)];
    const receivedAt = body.receivedAt?.trim() ?? "";
    const receivedAmountTwd = body.receivedAmountTwd;
    const receivingPaymentAccountId = body.receivingPaymentAccountId?.trim() ?? "";
    const memberPaymentAccountId = body.memberPaymentAccountId?.trim() ?? "";
    const payerName = body.payerName?.trim() ?? "";
    const memberNote = body.memberNote?.trim() ?? "";

    if (
      uniquePaymentRequestIds.length === 0
      || uniquePaymentRequestIds.length > 20
      || !receivedAt
      || typeof receivedAmountTwd !== "number"
      || !Number.isInteger(receivedAmountTwd)
      || receivedAmountTwd <= 0
      || !payerName
    ) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    if (!receivingPaymentAccountId) {
      throw new Error("payment_account_required");
    }
    if (!memberPaymentAccountId) {
      throw new Error("payment_account_member_required");
    }

    const db = getAdminFirestore();
    const payment = await db.runTransaction(async (transaction) => {
      const requestRefs = uniquePaymentRequestIds.map((id) => db.collection("paymentRequests").doc(id));
      const requestSnapshots = [];
      for (const requestRef of requestRefs) {
        const requestSnapshot = await transaction.get(requestRef);
        if (!requestSnapshot.exists) {
          throw new Error("not_found");
        }
        requestSnapshots.push(requestSnapshot);
      }

      const paymentRequests = requestSnapshots.map((requestSnapshot) => {
        const paymentRequest = requestSnapshot.data() as {
          memberUid?: string;
          status?: string;
          amountTwd?: number;
          allocatedAmountTwd?: number;
        };
        if (paymentRequest.memberUid !== claims.uid) {
          throw new Error("forbidden");
        }
        if (paymentRequest.status === "paid" || paymentRequest.status === "cancelled") {
          throw new Error("invalid_payment_request");
        }
        return {
          id: requestSnapshot.id,
          amountTwd: paymentRequest.amountTwd ?? 0,
          allocatedAmountTwd: paymentRequest.allocatedAmountTwd ?? 0,
        };
      });
      const allocations = allocatePaymentReportAmount(receivedAmountTwd, paymentRequests);
      if (allocations.length === 0) {
        throw new Error("invalid_payment_request");
      }
      const allocatedTotal = allocations.reduce((total, allocation) => total + allocation.receivedAmountTwd, 0);
      const unallocatedAmountTwd = Math.max(receivedAmountTwd - allocatedTotal, 0);

      const receivingAccountRef = db.collection("paymentAccounts").doc(receivingPaymentAccountId);
      const memberAccountRef = db.collection("memberPaymentAccounts").doc(memberPaymentAccountId);
      const [receivingAccountSnapshot, memberAccountSnapshot] = await Promise.all([
        transaction.get(receivingAccountRef),
        transaction.get(memberAccountRef),
      ]);
      if (!receivingAccountSnapshot.exists) {
        throw new Error("payment_account_not_found");
      }
      const receivingAccount = {
        id: receivingAccountSnapshot.id,
        ...(receivingAccountSnapshot.data() as Omit<PaymentAccount, "id">),
      };
      if (receivingAccount.status !== "active") {
        throw new Error("payment_account_inactive");
      }
      if (!memberAccountSnapshot.exists) {
        throw new Error("payment_account_member_not_found");
      }
      const memberAccount = {
        id: memberAccountSnapshot.id,
        ...(memberAccountSnapshot.data() as Omit<MemberPaymentAccount, "id">),
      };
      if (memberAccount.memberUid !== claims.uid) {
        throw new Error("forbidden");
      }
      if (
        memberAccount.status !== "active"
        || memberAccount.verificationStatus === "needsReverification"
      ) {
        throw new Error("payment_account_member_inactive");
      }
      const receivingPaymentAccount = buildPaymentAccountSnapshot(receivingAccount);
      const memberPaymentAccount = buildMemberPaymentAccountIdentitySnapshot(memberAccount);
      const manualFingerprintReviewRequired = !memberPaymentAccount.accountFingerprint;

      const paymentRefs = allocations.map(() => db.collection("payments").doc());
      const paymentGroupId = paymentRefs[0]?.id ?? "";
      const payments = allocations.map((allocation, index) => {
        const paymentRef = paymentRefs[index];
        const paymentRecord = {
          id: paymentRef.id,
          memberUid: claims.uid,
          paymentRequestId: allocation.paymentRequestId,
          paymentGroupId,
          // Keep any overpayment on the last linked Payment so Owner confirmation
          // can persist it as PaymentRequest.unallocatedAmountTwd. Earlier linked
          // Payments remain exactly equal to their request allocation.
          receivedAmountTwd: allocation.receivedAmountTwd
            + (index === allocations.length - 1 ? unallocatedAmountTwd : 0),
           receivedAt,
          receivingPaymentAccountId,
          receivingPaymentAccount,
          memberPaymentAccountId,
          memberPaymentAccount,
          manualFingerprintReviewRequired,
          payerName,
          ...(memberNote ? { memberNote } : {}),
          status: "pendingReview",
          createdAt: FieldValue.serverTimestamp(),
          createdBy: claims.uid,
        };
        transaction.set(paymentRef, paymentRecord);
        return { ...paymentRecord, createdAt: new Date().toISOString() };
      });

      return { payments, paymentGroupId };
    });

    return NextResponse.json({
      payment: payment.payments[0],
      payments: payment.payments,
      paymentGroupId: payment.paymentGroupId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_token"
        ? 401
        : message === "forbidden"
          ? 403
          : message === "not_found"
            ? 404
            : message === "invalid_payment_request"
              ? 400
              : message === "payment_account_not_found"
                ? 404
                : message === "payment_account_inactive"
                  || message === "payment_account_required"
                  || message === "payment_account_member_not_found"
                  || message === "payment_account_member_inactive"
                  || message === "payment_account_member_required"
                  ? 400
              : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
