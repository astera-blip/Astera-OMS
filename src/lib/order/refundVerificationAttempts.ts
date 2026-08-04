import { createHmac } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
const SCOPE_PREFIX = "astera:refund-verification-scope:v1";
const LIMITS = {
  request: 5,
  member: 10,
  ip: 20,
} as const;

export type RefundVerificationScopes = {
  requestScopeHash: string;
  memberScopeHash: string;
  ipScopeHash: string;
};

type RefundVerificationAttemptRecord = Partial<RefundVerificationScopes> & {
  refundVerificationExpiresAt?: unknown;
};

export function buildRefundVerificationScopes(input: {
  requestId: string;
  memberUid: string;
  requestIp: string;
}, secret = requireRateLimitSecret()): RefundVerificationScopes {
  const digest = (scope: "request" | "member" | "ip", value: string) =>
    createHmac("sha256", secret)
      .update(`${SCOPE_PREFIX}|${scope}|${value}`)
      .digest("base64url");

  return {
    requestScopeHash: digest("request", input.requestId),
    memberScopeHash: digest("member", input.memberUid),
    ipScopeHash: digest("ip", input.requestIp),
  };
}

export function assessRefundVerificationCooldown(
  records: RefundVerificationAttemptRecord[],
  scopes: RefundVerificationScopes,
  now = new Date(),
) {
  const activeRecords = records.filter((record) =>
    timestampMilliseconds(record.refundVerificationExpiresAt) > now.getTime());
  const counts = {
    request: activeRecords.filter((record) =>
      record.requestScopeHash === scopes.requestScopeHash).length,
    member: activeRecords.filter((record) =>
      record.memberScopeHash === scopes.memberScopeHash).length,
    ip: activeRecords.filter((record) =>
      record.ipScopeHash === scopes.ipScopeHash).length,
  };
  const limitedScope = (["request", "member", "ip"] as const)
    .find((scope) => counts[scope] >= LIMITS[scope]);

  return limitedScope
    ? { limited: true as const, scope: limitedScope, counts }
    : { limited: false as const, counts };
}

export function buildRefundVerificationFailureAudit(input: {
  id: string;
  scopes: RefundVerificationScopes;
  priorRequestAttempts: number;
  verification: "mismatch" | "needsReverification";
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    id: input.id,
    action: "refund.account.mismatch" as const,
    actorUid: "system" as const,
    targetType: "refundVerificationRequest" as const,
    targetId: input.scopes.requestScopeHash,
    result: input.verification,
    attemptCount: input.priorRequestAttempts + 1,
    ...input.scopes,
    refundVerificationExpiresAt: new Date(now.getTime() + WINDOW_MS).toISOString(),
    createdAt: now.toISOString(),
  };
}

export async function readRefundVerificationCooldown(input: {
  db: FirebaseFirestore.Firestore;
  scopes: RefundVerificationScopes;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const snapshot = await input.db
    .collection("auditLogs")
    .where("refundVerificationExpiresAt", ">", now.toISOString())
    .get();
  return assessRefundVerificationCooldown(
    snapshot.docs.map((document) => document.data() as RefundVerificationAttemptRecord),
    input.scopes,
    now,
  );
}

export async function readRefundVerificationCooldownInTransaction(input: {
  transaction: FirebaseFirestore.Transaction;
  db: FirebaseFirestore.Firestore;
  scopes: RefundVerificationScopes;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const snapshot = await input.transaction.get(
    input.db
      .collection("auditLogs")
      .where("refundVerificationExpiresAt", ">", now.toISOString()),
  );
  return assessRefundVerificationCooldown(
    snapshot.docs.map((document) => document.data() as RefundVerificationAttemptRecord),
    input.scopes,
    now,
  );
}

function requireRateLimitSecret() {
  const secret = process.env.REFUND_RATE_LIMIT_HASH_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw new Error("refund_rate_limit_hash_secret_missing");
  }
  return secret;
}

function timestampMilliseconds(value: unknown): number {
  if (typeof value === "string") {
    return Date.parse(value);
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (
    value
    && typeof value === "object"
    && "toDate" in value
    && typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return Number.NaN;
}

export async function appendRefundVerificationFailure(input: {
  transaction: FirebaseFirestore.Transaction;
  db: FirebaseFirestore.Firestore;
  scopes: RefundVerificationScopes;
  verification: "mismatch" | "needsReverification";
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const attemptsSnapshot = await input.transaction.get(
    input.db
      .collection("auditLogs")
      .where("refundVerificationExpiresAt", ">", now.toISOString()),
  );
  const cooldown = assessRefundVerificationCooldown(
    attemptsSnapshot.docs.map((document) => document.data() as RefundVerificationAttemptRecord),
    input.scopes,
    now,
  );
  const auditRef = input.db.collection("auditLogs").doc();
  input.transaction.create(auditRef, buildRefundVerificationFailureAudit({
    id: auditRef.id,
    scopes: input.scopes,
    priorRequestAttempts: cooldown.counts.request,
    verification: input.verification,
    now,
  }));
  return cooldown.limited;
}
