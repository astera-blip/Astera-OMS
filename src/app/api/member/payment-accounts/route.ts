import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { deriveAccountIdentity, verifyAccountIdentity } from "@/lib/payment/accountIdentity";
import {
  buildMemberPaymentAccountSnapshot,
  maskMemberAccountNumber,
  memberPaymentAccountErrorMessage,
  validateMemberPaymentAccountInput,
  type MemberPaymentAccount,
  type MemberPaymentAccountDuplicateNotification,
} from "@/lib/payment/memberBankAccounts";
import { CloudKmsMac } from "@/lib/security/cloudKmsMac";

const collectionName = "memberPaymentAccounts";

export async function GET(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const snapshot = await getAdminFirestore()
      .collection(collectionName)
      .where("memberUid", "==", claims.uid)
      .get();
    const accounts = snapshot.docs
      .map((document) => buildMemberPaymentAccountSnapshot({
        id: document.id,
        ...(document.data() as Omit<MemberPaymentAccount, "id">),
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
    return NextResponse.json({ accounts });
  } catch (error) {
    return memberAccountResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const validation = validateMemberPaymentAccountInput(await request.json());
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const { bankCode, accountNumberFull } = validation.value;
    const macClient = new CloudKmsMac();
    const identity = await deriveAccountIdentity({ bankCode, accountNumber: accountNumberFull }, macClient);
    const db = getAdminFirestore();
    const result = await db.runTransaction(async (transaction) => {
      const existingSnapshot = await transaction.get(
        db.collection(collectionName).where("memberUid", "==", claims.uid),
      );
      const existing = existingSnapshot.docs.map((document) => ({
        id: document.id,
        ...(document.data() as Omit<MemberPaymentAccount, "id">),
      }));
      const countable = existing.filter((item) => item.status === "active" || item.status === "pendingDeletion");
      if (countable.length >= 5) {
        throw new Error("member_payment_account_limit_reached");
      }

      const candidateSnapshot = await transaction.get(
        db.collection(collectionName)
          .where("bankCode", "==", identity.bankCode)
          .where("accountNumberLast5", "==", identity.accountNumberLast5),
      );
      const exactDuplicateIds: string[] = [];
      const last5CollisionIds: string[] = [];
      for (const document of candidateSnapshot.docs) {
        const candidate = {
          id: document.id,
          ...(document.data() as Omit<MemberPaymentAccount, "id">),
        };
        if (await verifyAccountIdentity(
          { bankCode, accountNumber: accountNumberFull },
          candidate,
          macClient,
        )) {
          exactDuplicateIds.push(candidate.id);
        } else {
          last5CollisionIds.push(candidate.id);
        }
      }

      const ref = db.collection(collectionName).doc();
      const accountRecord = {
        ...identity,
        memberUid: claims.uid,
        status: "active" as const,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: claims.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      };
      transaction.set(ref, accountRecord);

      const notificationGroups: Array<{
        type: MemberPaymentAccountDuplicateNotification["type"];
        accountIds: string[];
      }> = [
        { type: "memberPaymentAccount.exactDuplicate", accountIds: exactDuplicateIds },
        { type: "memberPaymentAccount.last5Collision", accountIds: last5CollisionIds },
      ];
      for (const group of notificationGroups) {
        if (group.accountIds.length === 0) {
          continue;
        }
        const notificationRef = db.collection("notificationEvents").doc();
        const notification: MemberPaymentAccountDuplicateNotification = {
          id: notificationRef.id,
          type: group.type,
          audience: "owner",
          status: "pendingReview",
          payload: {
            accountIds: [...new Set([...group.accountIds, ref.id])],
            accountNumberMasked: maskMemberAccountNumber(identity.accountNumberLast5),
          },
          createdAt: FieldValue.serverTimestamp(),
          createdBy: claims.uid,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: claims.uid,
        };
        transaction.set(notificationRef, notification);
      }

      return {
        account: {
          id: ref.id,
          ...accountRecord,
        },
        duplicateReviewPending: candidateSnapshot.docs.length > 0,
      };
    });

    return NextResponse.json({
      account: buildMemberPaymentAccountSnapshot(result.account),
      ...(result.duplicateReviewPending
        ? { warning: "member_payment_account_duplicate_review_pending" }
        : {}),
    }, { status: 201 });
  } catch (error) {
    return memberAccountResponse(error);
  }
}

function memberAccountResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown_error";
  const status = message === "missing_token" || message === "invalid_token"
    ? 401
    : message.startsWith("member_payment_account_")
      ? message === "member_payment_account_not_found" ? 404 : 400
      : 500;
  return NextResponse.json({
    error: status === 500 ? "internal_error" : message,
    ...(status < 500 ? { message: memberPaymentAccountErrorMessage(message) } : {}),
  }, { status });
}
