import "server-only";

import { randomUUID } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { FirebaseUserClaims } from "@/lib/firebase/serverAuth";
import {
  getRoleFromClaims,
  validateRoleAssignment,
  type AssignableRoleKey,
} from "@/lib/member/rolePolicy";

type RoleAuth = {
  getUser(uid: string): Promise<{
    uid: string;
    customClaims?: Record<string, unknown>;
  }>;
  setCustomUserClaims(uid: string, claims: Record<string, unknown> | null): Promise<void>;
  revokeRefreshTokens(uid: string): Promise<void>;
};

export type RoleAssignmentResult = {
  uid: string;
  previousRole: ReturnType<typeof getRoleFromClaims>;
  nextRole: AssignableRoleKey;
  changedAt: string;
};

function isCompletedMemberProfile(value: Record<string, unknown> | undefined) {
  return Boolean(
    typeof value?.displayName === "string"
      && value.displayName.trim()
      && typeof value.communityId === "string"
      && value.communityId.trim()
      && typeof value.mobilePhone === "string"
      && /^09\d{8}$/.test(value.mobilePhone),
  );
}

function throwAssignmentError(error: string): never {
  throw new Error(error);
}

export async function assignMemberRole(input: {
  actorClaims: FirebaseUserClaims;
  targetUid: string;
  nextRole: unknown;
  auth: RoleAuth;
  db: Firestore;
}): Promise<RoleAssignmentResult> {
  const targetUid = input.targetUid.trim();
  if (!targetUid) throwAssignmentError("member_not_found");

  const actorRole = getRoleFromClaims(input.actorClaims);
  if (actorRole !== "owner") throwAssignmentError("forbidden");
  if (input.nextRole === "owner") throwAssignmentError("owner_assignment_forbidden");

  const memberSnapshot = await input.db.collection("members").doc(targetUid).get();
  if (!memberSnapshot.exists) throwAssignmentError("member_not_found");

  let authUser: Awaited<ReturnType<RoleAuth["getUser"]>>;
  try {
    authUser = await input.auth.getUser(targetUid);
  } catch {
    throwAssignmentError("member_not_found");
  }

  const originalClaims = authUser.customClaims ?? {};
  const previousRole = getRoleFromClaims(originalClaims);
  const validation = validateRoleAssignment({
    actorUid: input.actorClaims.uid,
    targetUid,
    actorRole,
    targetRole: previousRole,
    nextRole: input.nextRole,
    targetHasCompletedProfile: isCompletedMemberProfile(
      memberSnapshot.data() as Record<string, unknown> | undefined,
    ),
  });
  if (!validation.ok) throwAssignmentError(validation.error);

  const changedAt = new Date().toISOString();
  const operationId = randomUUID();
  const nextClaims = { ...originalClaims, role: validation.value.nextRole };

  await input.auth.setCustomUserClaims(targetUid, nextClaims);
  try {
    await input.auth.revokeRefreshTokens(targetUid);
  } catch {
    try {
      await input.auth.setCustomUserClaims(targetUid, originalClaims);
      await input.auth.revokeRefreshTokens(targetUid);
    } catch {
      // The caller receives failure and operations can reconcile the target account.
    }
    throwAssignmentError("role_assignment_auth_failed");
  }

  try {
    await input.db.runTransaction(async (transaction) => {
      const auditRef = input.db.collection("auditLogs").doc(`role_${operationId}`);
      const noticeRef = input.db.collection("roleChangeNotifications").doc(`role_${operationId}`);
      transaction.set(auditRef, {
        id: auditRef.id,
        action: "auth.role.updated",
        actorUid: input.actorClaims.uid,
        targetType: "member",
        targetId: targetUid,
        reason: "role_assignment",
        previousRole,
        nextRole: validation.value.nextRole,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(noticeRef, {
        id: noticeRef.id,
        memberUid: targetUid,
        type: "role_changed",
        previousRole,
        nextRole: validation.value.nextRole,
        changedAt: FieldValue.serverTimestamp(),
        acknowledgedAt: null,
      });
    });
  } catch {
    try {
      await input.auth.setCustomUserClaims(targetUid, originalClaims);
      await input.auth.revokeRefreshTokens(targetUid);
    } catch {
      // The caller receives failure and operations can reconcile from the audit gap.
    }
    throwAssignmentError("role_assignment_persistence_failed");
  }

  return {
    uid: targetUid,
    previousRole,
    nextRole: validation.value.nextRole,
    changedAt,
  };
}
