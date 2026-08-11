import { createHmac } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
const RESERVATION_WINDOW_MS = 60 * 1000;
const RESERVATION_ACTION = "refund.verification.reservation";
const EXPIRED_RESERVATION_CLEANUP_LIMIT = 20;
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
  action?: unknown;
  refundVerificationExpiresAt?: unknown;
};

export type RefundVerificationReservation = {
  id: string;
  attemptCount: number;
  requestId: string;
  actorUid: string;
  scopes: RefundVerificationScopes;
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
  requestId: string;
  actorUid: string;
  priorRequestAttempts: number;
  verification: "mismatch" | "needsReverification";
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    id: input.id,
    action: "refund.account.mismatch" as const,
    actorUid: input.actorUid,
    targetType: "refundVerificationRequest" as const,
    targetId: input.requestId,
    result: input.verification,
    attemptCount: input.priorRequestAttempts + 1,
    createdAt: now.toISOString(),
  };
}

export async function reserveRefundVerificationAttempt(input: {
  db: FirebaseFirestore.Firestore;
  scopes: RefundVerificationScopes;
  requestId: string;
  actorUid: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  return input.db.runTransaction(async (transaction) => {
    const activeQuery = input.db
      .collection("auditLogs")
      .where("refundVerificationExpiresAt", ">", nowIso);
    const expiredQuery = input.db
      .collection("auditLogs")
      .where("refundVerificationExpiresAt", "<=", nowIso)
      .limit(EXPIRED_RESERVATION_CLEANUP_LIMIT);

    // Firestore transactions require all reads before writes. The active set
    // includes both failed attempts and still-pending reservations.
    const [activeSnapshot, expiredSnapshot] = await Promise.all([
      transaction.get(activeQuery),
      transaction.get(expiredQuery),
    ]);
    const cooldown = assessRefundVerificationCooldown(
      activeSnapshot.docs.map(
        (document) => document.data() as RefundVerificationAttemptRecord,
      ),
      input.scopes,
      now,
    );

    for (const document of expiredSnapshot.docs) {
      const record = document.data() as RefundVerificationAttemptRecord;
      if (record.action === RESERVATION_ACTION) {
        transaction.delete(input.db.collection("auditLogs").doc(document.id));
      }
    }

    if (cooldown.limited) {
      return cooldown;
    }

    const reservationRef = input.db.collection("auditLogs").doc();
    const reservation: RefundVerificationReservation = {
      id: reservationRef.id,
      attemptCount: cooldown.counts.request + 1,
      requestId: input.requestId,
      actorUid: input.actorUid,
      scopes: input.scopes,
    };
    transaction.create(reservationRef, {
      id: reservation.id,
      action: RESERVATION_ACTION,
      actorUid: "system",
      targetType: "refundVerificationReservation",
      targetId: input.scopes.requestScopeHash,
      status: "pending",
      attemptCount: reservation.attemptCount,
      ...input.scopes,
      refundVerificationExpiresAt: new Date(
        now.getTime() + RESERVATION_WINDOW_MS,
      ).toISOString(),
      createdAt: nowIso,
    });
    return {
      limited: false as const,
      counts: cooldown.counts,
      reservation,
    };
  });
}

export async function releaseRefundVerificationReservation(input: {
  db: FirebaseFirestore.Firestore;
  reservationId: string;
}) {
  await input.db.runTransaction(async (transaction) => {
    const reservationRef = input.db.collection("auditLogs").doc(input.reservationId);
    const snapshot = await transaction.get(reservationRef);
    if (
      snapshot.exists
      && (snapshot.data() as RefundVerificationAttemptRecord | undefined)?.action
        === RESERVATION_ACTION
    ) {
      transaction.delete(reservationRef);
    }
  });
}

export async function finalizeRefundVerificationFailureReservation(input: {
  db: FirebaseFirestore.Firestore;
  reservation: RefundVerificationReservation;
  verification: "mismatch" | "needsReverification";
  now?: Date;
}) {
  const now = input.now ?? new Date();
  await input.db.runTransaction(async (transaction) => {
    const reservationRef = input.db
      .collection("auditLogs")
      .doc(input.reservation.id);
    const reservationSnapshot = await transaction.get(reservationRef);
    const reservationRecord = reservationSnapshot.data() as
      | RefundVerificationAttemptRecord
      | undefined;
    if (
      !reservationSnapshot.exists
      || reservationRecord?.action !== RESERVATION_ACTION
    ) {
      throw new Error("refund_verification_reservation_missing");
    }

    const auditRef = input.db.collection("auditLogs").doc();
    transaction.update(reservationRef, {
      status: "failed",
      result: input.verification,
      finalizedAt: now.toISOString(),
      refundVerificationExpiresAt: new Date(
        now.getTime() + WINDOW_MS,
      ).toISOString(),
    });
    transaction.create(auditRef, {
      id: auditRef.id,
      action: "refund.account.mismatch",
      actorUid: input.reservation.actorUid,
      targetType: "refundVerificationRequest",
      targetId: input.reservation.requestId,
      result: input.verification,
      attemptCount: input.reservation.attemptCount,
      createdAt: now.toISOString(),
    });
  });
}

export async function reserveAndVerifyRefundAccount(input: {
  db: FirebaseFirestore.Firestore;
  scopes: RefundVerificationScopes;
  requestId: string;
  actorUid: string;
  verify: () => Promise<"match" | "mismatch" | "needsReverification">;
  now?: Date;
}) {
  const reservationResult = await reserveRefundVerificationAttempt({
    db: input.db,
    scopes: input.scopes,
    requestId: input.requestId,
    actorUid: input.actorUid,
    now: input.now,
  });
  if (reservationResult.limited) {
    return reservationResult;
  }
  const { reservation } = reservationResult;
  try {
    const verification = await input.verify();
    if (verification !== "match") {
      await finalizeRefundVerificationFailureReservation({
        db: input.db,
        reservation,
        verification,
        now: input.now,
      });
      return { limited: false as const, verification, reservation: undefined };
    }
    return { limited: false as const, verification, reservation };
  } catch (error) {
    await releaseRefundVerificationReservation({
      db: input.db,
      reservationId: reservation.id,
    });
    throw error;
  }
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
