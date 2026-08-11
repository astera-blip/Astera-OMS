import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import {
  buildMemberPaymentAccountSnapshot,
  memberPaymentAccountErrorMessage,
  normalizeMemberPaymentAccountPayerName,
  type MemberPaymentAccount,
} from "@/lib/payment/memberBankAccounts";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireFirebaseUser(request);
    const { id } = await params;
    const body = (await request.json()) as { payerName?: unknown };
    const payerName = normalizeMemberPaymentAccountPayerName(body.payerName);
    const db = getAdminFirestore();

    const account = await db.runTransaction(async (transaction) => {
      const ref = db.collection("memberPaymentAccounts").doc(id);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        throw new Error("member_payment_account_not_found");
      }
      const stored = snapshot.data() as Omit<MemberPaymentAccount, "id">;
      if (stored.memberUid !== claims.uid) {
        throw new Error("member_payment_account_not_found");
      }

      if (hasValidPayerName(stored.payerName)) {
        throw new Error("member_payment_account_payer_name_already_set");
      }

      const updatedAt = FieldValue.serverTimestamp();
      transaction.update(ref, {
        payerName,
        updatedAt,
        updatedBy: claims.uid,
      });

      return buildMemberPaymentAccountSnapshot({
        id: snapshot.id,
        ...stored,
        payerName,
        updatedAt,
        updatedBy: claims.uid,
      });
    });

    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" || message === "invalid_token"
      ? 401
      : message === "member_payment_account_not_found"
        ? 404
        : message === "member_payment_account_payer_name_already_set"
          ? 409
          : message === "invalid_payer_name"
            ? 400
            : 500;
    const errorKey = message === "invalid_payer_name"
      ? "member_payment_account_payer_name_invalid"
      : message;

    return NextResponse.json({
      error: status === 500 ? "internal_error" : errorKey,
      ...(status < 500 ? { message: payerNameErrorMessage(errorKey) } : {}),
    }, { status });
  }
}

function hasValidPayerName(value: unknown): boolean {
  try {
    normalizeMemberPaymentAccountPayerName(value);
    return true;
  } catch {
    return false;
  }
}

function payerNameErrorMessage(error: string): string {
  if (error === "member_payment_account_payer_name_already_set") {
    return "這個匯款帳戶已設定匯款人姓名，無法再次修改。";
  }
  return memberPaymentAccountErrorMessage(error);
}
