import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import {
  buildMemberPaymentAccountSnapshot,
  memberPaymentAccountErrorMessage,
  type MemberPaymentAccount,
} from "@/lib/payment/memberBankAccounts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireFirebaseUser(request);
    const { id } = await context.params;
    if (!id.trim()) {
      throw new Error("member_payment_account_not_found");
    }
    const db = getAdminFirestore();
    const ref = db.collection("memberPaymentAccounts").doc(id);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        throw new Error("member_payment_account_not_found");
      }
      const account = {
        id: snapshot.id,
        ...(snapshot.data() as Omit<MemberPaymentAccount, "id">),
      };
      if (account.memberUid !== claims.uid) {
        throw new Error("forbidden");
      }
      if (account.status !== "active") {
        throw new Error("member_payment_account_not_active");
      }
      transaction.update(ref, {
        status: "pendingDeletion",
        deletionRequestedAt: FieldValue.serverTimestamp(),
        deletionRequestedBy: claims.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
      return { ...account, status: "pendingDeletion" as const };
    });

    return NextResponse.json({ account: buildMemberPaymentAccountSnapshot(result) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" || message === "invalid_token"
      ? 401
      : message === "forbidden" ? 403
        : message === "member_payment_account_not_found" ? 404
          : message.startsWith("member_payment_account_") ? 400 : 500;
    return NextResponse.json({
      error: status === 500 ? "internal_error" : message,
      ...(status < 500 ? { message: memberPaymentAccountErrorMessage(message) } : {}),
    }, { status });
  }
}
