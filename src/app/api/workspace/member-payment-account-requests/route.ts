import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import {
  buildMemberPaymentAccountSnapshot,
  type MemberPaymentAccount,
} from "@/lib/payment/memberBankAccounts";

export async function GET(request: Request) {
  try {
    await requireOwner(request);
    const snapshot = await getAdminFirestore()
      .collection("memberPaymentAccounts")
      .where("status", "==", "pendingDeletion")
      .get();
    return NextResponse.json({
      accounts: snapshot.docs.map((document) => buildMemberPaymentAccountSnapshot({
        id: document.id,
        ...(document.data() as Omit<MemberPaymentAccount, "id">),
      })),
    });
  } catch (error) {
    return ownerMemberAccountResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const claims = await requireOwner(request);
    const body = await request.json() as { id?: unknown; approve?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id || body.approve !== true) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const db = getAdminFirestore();
    const result = await db.runTransaction(async (transaction) => {
      const ref = db.collection("memberPaymentAccounts").doc(id);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        throw new Error("member_payment_account_not_found");
      }
      const account = {
        id: snapshot.id,
        ...(snapshot.data() as Omit<MemberPaymentAccount, "id">),
      };
      if (account.status !== "pendingDeletion") {
        throw new Error("member_payment_account_not_pending");
      }
      transaction.update(ref, {
        status: "inactive",
        archivedAt: FieldValue.serverTimestamp(),
        archivedBy: claims.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
      transaction.set(db.collection("auditLogs").doc(`member_payment_account_${id}_${Date.now()}`), {
        action: "member_payment_account.archived",
        actorUid: claims.uid,
        targetType: "memberPaymentAccount",
        targetId: id,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ...account, status: "inactive" as const };
    });
    return NextResponse.json({ account: buildMemberPaymentAccountSnapshot(result) });
  } catch (error) {
    return ownerMemberAccountResponse(error);
  }
}

async function requireOwner(request: Request) {
  const claims = await requireFirebaseUser(request);
  if (!isOwnerClaim(claims)) {
    throw new Error("forbidden");
  }
  return claims;
}

function ownerMemberAccountResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown_error";
  const status = message === "missing_token" || message === "invalid_token" ? 401
    : message === "forbidden" ? 403
      : message === "member_payment_account_not_found" ? 404
        : message.startsWith("member_payment_account_") ? 400 : 500;
  return NextResponse.json({
    error: status === 500 ? "internal_error" : message,
  }, { status });
}
