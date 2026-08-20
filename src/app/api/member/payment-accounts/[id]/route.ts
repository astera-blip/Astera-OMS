import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { deriveAccountIdentity, verifyAccountIdentity } from "@/lib/payment/accountIdentity";
import {
  buildMemberPaymentAccountSnapshot,
  memberPaymentAccountErrorMessage,
  validateMemberPaymentAccountInput,
  type MemberPaymentAccount,
  type MemberPaymentAccountDuplicateNotification,
} from "@/lib/payment/memberBankAccounts";
import { buildDuplicateAccountNotificationEvent } from "@/lib/notification/events";
import { CloudKmsMac } from "@/lib/security/cloudKmsMac";

const collectionName = "memberPaymentAccounts";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireFirebaseUser(request);
    const validation = validateMemberPaymentAccountInput(await request.json());
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const { id } = await params;
    if (!id.trim()) {
      throw new Error("member_payment_account_not_found");
    }

    const { bankCode, accountNumberFull, payerName } = validation.value;
    const macClient = new CloudKmsMac();
    const identity = await deriveAccountIdentity({ bankCode, accountNumber: accountNumberFull }, macClient);
    const db = getAdminFirestore();
    const result = await db.runTransaction(async (transaction) => {
      const ref = db.collection(collectionName).doc(id);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists || snapshot.data()?.memberUid !== claims.uid) {
        throw new Error("member_payment_account_not_found");
      }
      const stored = snapshot.data() as Omit<MemberPaymentAccount, "id">;
      if (buildMemberPaymentAccountSnapshot({ id: snapshot.id, ...stored }).verificationStatus !== "needsReverification") {
        throw new Error("member_payment_account_reverification_not_allowed");
      }
      if (
        stored.status !== "active"
        || stored.deletionRequestedAt != null
        || stored.deletionRequestedBy != null
        || stored.archivedAt != null
        || stored.archivedBy != null
      ) {
        throw new Error("member_payment_account_reverification_not_allowed");
      }

      const candidates = await transaction.get(
        db.collection(collectionName)
          .where("bankCode", "==", identity.bankCode)
          .where("accountNumberLast5", "==", identity.accountNumberLast5),
      );
      const exactDuplicateIds: string[] = [];
      const last5CollisionIds: string[] = [];
      for (const document of candidates.docs) {
        if (document.id === id) {
          continue;
        }
        const candidate = { id: document.id, ...(document.data() as Omit<MemberPaymentAccount, "id">) };
        if (await verifyAccountIdentity({ bankCode, accountNumber: accountNumberFull }, candidate, macClient)) {
          exactDuplicateIds.push(candidate.id);
        } else {
          last5CollisionIds.push(candidate.id);
        }
      }

      const updatedAt = FieldValue.serverTimestamp();
      const account = {
        id: snapshot.id,
        ...stored,
        ...identity,
        payerName,
        status: "active" as const,
        verificationStatus: "verified" as const,
        updatedAt,
        updatedBy: claims.uid,
      };
      transaction.update(ref, {
        ...identity,
        payerName,
        status: "active",
        verificationStatus: "verified",
        updatedAt,
        updatedBy: claims.uid,
      });

      for (const group of [
        { type: "memberPaymentAccount.exactDuplicate" as const, accountIds: exactDuplicateIds },
        { type: "memberPaymentAccount.last5Collision" as const, accountIds: last5CollisionIds },
      ]) {
        if (group.accountIds.length === 0) {
          continue;
        }
        const notificationRef = db.collection("notificationEvents").doc();
        const notification: MemberPaymentAccountDuplicateNotification = buildDuplicateAccountNotificationEvent({
          id: notificationRef.id,
          type: group.type,
          accountIds: [...new Set([...group.accountIds, id])],
          bankCode: identity.bankCode,
          accountNumberLast5: identity.accountNumberLast5,
          actorUid: claims.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
        transaction.set(notificationRef, notification);
      }

      return { account, duplicateReviewPending: candidates.docs.some((document) => document.id !== id) };
    });

    return NextResponse.json({
      account: buildMemberPaymentAccountSnapshot(result.account),
      ...(result.duplicateReviewPending ? { warning: "member_payment_account_duplicate_review_pending" } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" || message === "invalid_token"
      ? 401
      : message === "member_payment_account_not_found"
        ? 404
        : message.startsWith("member_payment_account_") ? 400 : 500;
    return NextResponse.json({
      error: status === 500 ? "internal_error" : message,
      ...(status < 500 ? { message: memberPaymentAccountErrorMessage(message) } : {}),
    }, { status });
  }
}
