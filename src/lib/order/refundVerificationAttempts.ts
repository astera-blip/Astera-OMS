import { FieldValue } from "firebase-admin/firestore";
import type { CloudKmsMacClient } from "@/lib/security/cloudKmsMac";

const WINDOW_MS = 15 * 60 * 1000;
const SCOPE_PREFIX = "astera:refund-verification-scope:v1";

export async function appendRefundVerificationFailure(input: {
  transaction: FirebaseFirestore.Transaction;
  db: FirebaseFirestore.Firestore;
  macClient: CloudKmsMacClient;
  requestId: string;
  memberUid: string;
  requestIp: string;
  verification: "mismatch" | "needsReverification";
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const windowStartedAt = Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS;
  const scopeInputs = [
    { scope: "request", value: input.requestId, maximum: 5 },
    { scope: "member", value: input.memberUid, maximum: 10 },
    { scope: "ip", value: input.requestIp, maximum: 20 },
  ] as const;
  const signedScopes = await Promise.all(scopeInputs.map(async (scope) => ({
    ...scope,
    signed: await input.macClient.signCanonicalAccount(
      `${SCOPE_PREFIX}|${scope.scope}|${scope.value}`,
    ),
  })));
  const verificationWindow = new Date(windowStartedAt).toISOString();
  const attemptsSnapshot = await input.transaction.get(
    input.db
      .collection("auditLogs")
      .where("refundVerificationWindow", "==", verificationWindow),
  );
  const priorAttempts = attemptsSnapshot.docs.map((document) => document.data() as {
    requestScopeHash?: unknown;
    memberScopeHash?: unknown;
    ipScopeHash?: unknown;
  });
  const fieldForScope = {
    request: "requestScopeHash",
    member: "memberScopeHash",
    ip: "ipScopeHash",
  } as const;
  const rateLimited = signedScopes.some((scope) => {
    const field = fieldForScope[scope.scope];
    return priorAttempts.filter((attempt) => attempt[field] === scope.signed.mac).length
      >= scope.maximum;
  });
  const [requestScope, memberScope, ipScope] = signedScopes;
  const auditRef = input.db.collection("auditLogs").doc();
  input.transaction.create(auditRef, {
    id: auditRef.id,
    action: "refund.account.mismatch",
    actorUid: "system",
    targetType: "order",
    targetId: requestScope.signed.mac,
    reason: input.verification === "needsReverification"
      ? "refund account verification unavailable"
      : "refund account verification failed",
    refundVerificationWindow: verificationWindow,
    requestScopeHash: requestScope.signed.mac,
    memberScopeHash: memberScope.signed.mac,
    ipScopeHash: ipScope.signed.mac,
    scopeKeyVersion: requestScope.signed.keyVersion,
    createdAt: FieldValue.serverTimestamp(),
  });
  return rateLimited;
}
