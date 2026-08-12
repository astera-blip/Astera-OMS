import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { buildPaymentAccountSnapshot, type PaymentAccount } from "@/lib/payment/bankAccounts";
import {
  isStoredMemberPaymentAccountUsableForPayment,
  normalizeMemberPaymentAccountPayerName,
  type MemberPaymentAccount,
} from "@/lib/payment/memberBankAccounts";
import {
  allocatePaymentReportAmount,
  buildMemberPaymentAccountIdentitySnapshot,
  type MemberPaymentSummary,
} from "@/lib/payment/manualBankTransfer";
import {
  buildPaymentReportIdentity,
  validatePaymentReportIdempotencyKey,
} from "@/lib/payment/reportIdempotency";

function serializeTimestamp(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      return (toDate.call(value) as Date).toISOString();
    }
  }
  return "";
}

export async function GET(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const snapshot = await getAdminFirestore()
      .collection("payments")
      .where("memberUid", "==", claims.uid)
      .get();
    const payments = snapshot.docs.map((doc) => {
      const data = doc.data() as {
        paymentRequestId?: string;
        paymentGroupId?: string;
        receivedAmountTwd?: number;
        receivedAt?: string;
        status?: MemberPaymentSummary["status"];
        receivingPaymentAccount?: { bankName?: string; accountNumberLast5?: string };
        memberPaymentAccount?: { bankCode?: string; accountNumberLast5?: string; payerName?: string };
        memberNote?: string;
        createdAt?: unknown;
      };
      const receivingParts = [
        data.receivingPaymentAccount?.bankName,
        data.receivingPaymentAccount?.accountNumberLast5
          ? `末五碼 ${data.receivingPaymentAccount.accountNumberLast5}`
          : undefined,
      ].filter(Boolean);
      const memberParts = [
        data.memberPaymentAccount?.bankCode
          ? `銀行代碼 ${data.memberPaymentAccount.bankCode}`
          : undefined,
        data.memberPaymentAccount?.accountNumberLast5
          ? `***${data.memberPaymentAccount.accountNumberLast5}`
          : undefined,
        data.memberPaymentAccount?.payerName,
      ].filter(Boolean);
      return {
        id: doc.id,
        paymentRequestId: data.paymentRequestId ?? "",
        ...(data.paymentGroupId ? { paymentGroupId: data.paymentGroupId } : {}),
        receivedAmountTwd: data.receivedAmountTwd ?? 0,
        receivedAt: data.receivedAt ?? "",
        status: data.status ?? "pendingReview",
        receivingAccountDisplay: receivingParts.join("・"),
        memberAccountDisplay: memberParts.join("・"),
        ...(data.memberNote ? { memberNote: data.memberNote } : {}),
        createdAt: serializeTimestamp(data.createdAt),
      } satisfies MemberPaymentSummary;
    }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return NextResponse.json({ payments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      { error: message },
      { status: message === "missing_token" ? 401 : 500 },
    );
  }
}

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
      memberNote?: string;
      idempotencyKey?: string;
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
    const memberNote = body.memberNote?.trim() ?? "";
    const idempotencyKey = validatePaymentReportIdempotencyKey(body.idempotencyKey);

    if (
      uniquePaymentRequestIds.length === 0
      || uniquePaymentRequestIds.length > 20
      || !receivedAt
      || typeof receivedAmountTwd !== "number"
      || !Number.isInteger(receivedAmountTwd)
      || receivedAmountTwd <= 0
    ) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    if (!receivingPaymentAccountId) {
      throw new Error("payment_account_required");
    }
    if (!memberPaymentAccountId) {
      throw new Error("payment_account_member_required");
    }

    const identity = buildPaymentReportIdentity({
      memberUid: claims.uid,
      idempotencyKey,
      paymentRequestIds: uniquePaymentRequestIds,
      receivedAt,
      receivedAmountTwd,
      receivingPaymentAccountId,
      memberPaymentAccountId,
      memberNote,
    });

    const db = getAdminFirestore();
    const payment = await db.runTransaction(async (transaction) => {
      const requestRefs = identity.paymentRequestIds.map((id) => db.collection("paymentRequests").doc(id));
      const paymentRefs = identity.paymentIds.map((id) => db.collection("payments").doc(id));
      const existingPaymentSnapshots = [];
      for (const paymentRef of paymentRefs) {
        existingPaymentSnapshots.push(await transaction.get(paymentRef));
      }
      const existingCount = existingPaymentSnapshots.filter((snapshot) => snapshot.exists).length;
      if (existingCount > 0) {
        const matchingReplay = existingPaymentSnapshots
          .filter((snapshot) => snapshot.exists)
          .every((snapshot) => {
            const existing = snapshot.data() as {
              memberUid?: string;
              paymentGroupId?: string;
              idempotencyPayloadDigest?: string;
            };
            return existing.memberUid === claims.uid
              && existing.paymentGroupId === identity.paymentGroupId
              && existing.idempotencyPayloadDigest === identity.payloadDigest;
          });
        if (!matchingReplay) {
          throw new Error("idempotency_conflict");
        }
        return {
          payments: existingPaymentSnapshots
            .filter((snapshot) => snapshot.exists)
            .map((snapshot) => ({
              id: snapshot.id,
              ...(snapshot.data() as Record<string, unknown>),
            })),
          paymentGroupId: identity.paymentGroupId,
          alreadyExists: true,
        };
      }

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

      for (const paymentRequestId of identity.paymentRequestIds) {
        const pendingReviewQuery = db.collection("payments")
          .where("paymentRequestId", "==", paymentRequestId)
          .where("status", "==", "pendingReview")
          .limit(1);
        const pendingReviewSnapshot = await transaction.get(pendingReviewQuery);
        if (!pendingReviewSnapshot.empty) {
          throw new Error("payment_report_pending_review");
        }
      }

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
      let payerName: string;
      try {
        payerName = normalizeMemberPaymentAccountPayerName(memberAccount.payerName);
      } catch {
        throw new Error("payment_account_member_payer_name_required");
      }
      const authoritativeMemberAccount = { ...memberAccount, payerName };
      if (!isStoredMemberPaymentAccountUsableForPayment(authoritativeMemberAccount)) {
        throw new Error("payment_account_member_inactive");
      }
      const receivingPaymentAccount = buildPaymentAccountSnapshot(receivingAccount);
      const memberPaymentAccount = buildMemberPaymentAccountIdentitySnapshot(authoritativeMemberAccount);
      const manualFingerprintReviewRequired = !memberPaymentAccount.accountFingerprint;

      const payments = allocations.map((allocation, index) => {
        const paymentRef = paymentRefs[index];
        const paymentRecord = {
          id: paymentRef.id,
          memberUid: claims.uid,
          paymentRequestId: allocation.paymentRequestId,
          paymentGroupId: identity.paymentGroupId,
          idempotencyPayloadDigest: identity.payloadDigest,
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
          payerName: memberPaymentAccount.payerName,
          ...(memberNote ? { memberNote } : {}),
          status: "pendingReview",
          createdAt: FieldValue.serverTimestamp(),
          createdBy: claims.uid,
        };
        transaction.set(paymentRef, paymentRecord);
        return { ...paymentRecord, createdAt: new Date().toISOString() };
      });

      for (const requestRef of requestRefs) {
        transaction.update(requestRef, {
          latestReportAt: FieldValue.serverTimestamp(),
          latestReportBy: claims.uid,
        });
      }

      return { payments, paymentGroupId: identity.paymentGroupId, alreadyExists: false };
    });

    return NextResponse.json({
      payment: payment.payments[0],
      payments: payment.payments,
      paymentGroupId: payment.paymentGroupId,
      alreadyExists: payment.alreadyExists,
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
              : message === "idempotency_conflict"
                ? 409
                : message === "payment_report_pending_review"
                  ? 409
                : message === "invalid_idempotency_key"
                  ? 400
              : message === "payment_account_not_found"
                ? 404
                : message === "payment_account_inactive"
                  || message === "payment_account_required"
                  || message === "payment_account_member_not_found"
                  || message === "payment_account_member_inactive"
                  || message === "payment_account_member_required"
                  || message === "payment_account_member_payer_name_required"
                  ? 400
              : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
