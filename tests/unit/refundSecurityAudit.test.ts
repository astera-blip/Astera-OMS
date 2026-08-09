import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assessRefundVerificationCooldown,
  buildRefundVerificationFailureAudit,
  buildRefundVerificationScopes,
  releaseRefundVerificationReservation,
  reserveAndVerifyRefundAccount,
  reserveRefundVerificationAttempt,
} from "../../src/lib/order/refundVerificationAttempts";
import { POST as resubmitRefundAccount } from "../../src/app/api/cancellations/[id]/refund-account/route";

const refundRoute = vi.hoisted(() => ({
  getAdminFirestore: vi.fn(),
  requireFirebaseUser: vi.fn(),
  isOwnerClaim: vi.fn(),
  verifyRefundAccountForPayment: vi.fn(),
  encryptRefundAccount: vi.fn(),
  cloudKmsMac: vi.fn(function CloudKmsMacMock() {
    return { signCanonicalAccount: vi.fn() };
  }),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: refundRoute.getAdminFirestore,
}));

vi.mock("@/lib/firebase/serverAuth", () => ({
  requireFirebaseUser: refundRoute.requireFirebaseUser,
  isOwnerClaim: refundRoute.isOwnerClaim,
}));

vi.mock("@/lib/order/cancellation", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/lib/order/cancellation")>(),
  verifyRefundAccountForPayment: refundRoute.verifyRefundAccountForPayment,
}));

vi.mock("@/lib/payment/refundAccountVault", () => ({
  encryptRefundAccount: refundRoute.encryptRefundAccount,
}));

vi.mock("@/lib/security/cloudKmsMac", () => ({
  CloudKmsMac: refundRoute.cloudKmsMac,
}));

const secret = "task-5-test-rate-limit-secret-at-least-32-bytes";
const now = new Date("2026-08-04T00:10:00.000Z");

type ReservationRef = { collection: "auditLogs"; id: string };
type ReservationQuery = {
  collection: "auditLogs";
  field: string;
  operator: ">" | "<=";
  value: string;
  maximum?: number;
};

function createReservationFirestore() {
  const records = new Map<string, Record<string, unknown>>();
  let sequence = 0;
  let transactionTail = Promise.resolve();
  const collection = {
    doc: vi.fn((id = `reservation-${++sequence}`): ReservationRef => ({
      collection: "auditLogs",
      id,
    })),
    where: vi.fn((field: string, operator: ">" | "<=", value: string) => {
      const query: ReservationQuery & { limit: (maximum: number) => ReservationQuery } = {
        collection: "auditLogs",
        field,
        operator,
        value,
        limit(maximum) {
          this.maximum = maximum;
          return this;
        },
      };
      return query;
    }),
  };
  const db = {
    collection: vi.fn(() => collection),
    runTransaction: vi.fn(async (callback: (transaction: unknown) => unknown) => {
      let releaseLock: () => void = () => undefined;
      const previous = transactionTail;
      transactionTail = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      await previous;
      try {
        const transaction = {
          get: vi.fn(async (target: ReservationRef | ReservationQuery) => {
            if ("operator" in target) {
              const filtered = [...records.entries()].filter(([, value]) => {
                const candidate = String(value[target.field] ?? "");
                return target.operator === ">" ? candidate > target.value : candidate <= target.value;
              }).slice(0, target.maximum);
              return {
                docs: filtered.map(([id, value]) => ({
                  id,
                  data: () => ({ ...value }),
                })),
              };
            }
            const value = records.get(target.id);
            return {
              exists: Boolean(value),
              data: () => value ? { ...value } : undefined,
            };
          }),
          create: vi.fn((ref: ReservationRef, value: Record<string, unknown>) => {
            if (records.has(ref.id)) {
              throw new Error("already_exists");
            }
            records.set(ref.id, { ...value });
          }),
          delete: vi.fn((ref: ReservationRef) => {
            records.delete(ref.id);
          }),
        };
        return await callback(transaction);
      } finally {
        releaseLock();
      }
    }),
  };
  return { db, records };
}

function createRefundRouteFirestore() {
  const auditRecords = new Map<string, Record<string, unknown>>();
  const deletedAuditIds: string[] = [];
  let cancellation: Record<string, unknown> = {
    id: "cancel-concurrent",
    memberUid: "member-a",
    targetPaymentId: "payment-a",
    refundBankCode: "012",
    refundAccountLast5: "56789",
    status: "needsReverification",
  };
  const payment = {
    id: "payment-a",
    memberUid: "member-a",
    status: "confirmed",
  };
  let sequence = 0;
  let transactionTail = Promise.resolve();
  const makeRef = (collection: string, id: string) => ({
    collection,
    id,
    get: vi.fn(async () => {
      const value = collection === "cancellationRequests"
        ? cancellation
        : collection === "payments"
          ? payment
          : auditRecords.get(id);
      return {
        exists: Boolean(value),
        data: () => value ? { ...value } : undefined,
      };
    }),
  });
  const db = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id = `audit-${++sequence}`) => makeRef(name, id)),
      where: vi.fn((field: string, operator: ">" | "<=", value: string) => {
        const query = {
          collection: name,
          field,
          operator,
          value,
          maximum: undefined as number | undefined,
          limit(maximum: number) {
            this.maximum = maximum;
            return this;
          },
        };
        return query;
      }),
    })),
    runTransaction: vi.fn(async (callback: (transaction: unknown) => unknown) => {
      let releaseLock: () => void = () => undefined;
      const previous = transactionTail;
      transactionTail = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      await previous;
      try {
        const transaction = {
          get: vi.fn(async (target: {
            collection: string;
            id?: string;
            field?: string;
            operator?: ">" | "<=";
            value?: string;
            maximum?: number;
          }) => {
            if (target.operator && target.field && target.value) {
              const matches = [...auditRecords.entries()]
                .filter(([, record]) => {
                  const candidate = String(record[target.field!] ?? "");
                  return target.operator === ">"
                    ? candidate > target.value!
                    : candidate <= target.value!;
                })
                .slice(0, target.maximum);
              return {
                docs: matches.map(([id, value]) => ({
                  id,
                  data: () => ({ ...value }),
                })),
              };
            }
            const value = target.collection === "cancellationRequests"
              ? cancellation
              : auditRecords.get(String(target.id));
            return {
              exists: Boolean(value),
              data: () => value ? { ...value } : undefined,
            };
          }),
          create: vi.fn((ref: { id: string }, value: Record<string, unknown>) => {
            auditRecords.set(ref.id, { ...value });
          }),
          update: vi.fn((
            ref: { collection: string; id: string },
            value: Record<string, unknown>,
          ) => {
            if (ref.collection === "cancellationRequests") {
              cancellation = { ...cancellation, ...value };
            } else {
              auditRecords.set(ref.id, {
                ...auditRecords.get(ref.id),
                ...value,
              });
            }
          }),
          delete: vi.fn((ref: { collection: string; id: string }) => {
            if (ref.collection === "auditLogs") {
              deletedAuditIds.push(ref.id);
              auditRecords.delete(ref.id);
            }
          }),
        };
        return await callback(transaction);
      } finally {
        releaseLock();
      }
    }),
  };
  return {
    db,
    auditRecords,
    deletedAuditIds,
    getCancellation: () => cancellation,
  };
}

describe("refund verification security audit", () => {
  it.each([
    { scope: "request", count: 5 },
    { scope: "member", count: 10 },
    { scope: "ip", count: 20 },
  ] as const)("blocks the $scope scope during its rolling 15-minute cooldown", ({ scope, count }) => {
    const target = buildRefundVerificationScopes({
      requestId: "cancel-a",
      memberUid: "member-a",
      requestIp: "203.0.113.8",
    }, secret);
    const records = Array.from({ length: count }, (_, index) => ({
      requestScopeHash: scope === "request" ? target.requestScopeHash : `request-${index}`,
      memberScopeHash: scope === "member" ? target.memberScopeHash : `member-${index}`,
      ipScopeHash: scope === "ip" ? target.ipScopeHash : `ip-${index}`,
      refundVerificationExpiresAt: "2026-08-04T00:20:00.000Z",
    }));

    expect(assessRefundVerificationCooldown(records, target, now)).toMatchObject({
      limited: true,
      scope,
      counts: {
        request: scope === "request" ? count : 0,
        member: scope === "member" ? count : 0,
        ip: scope === "ip" ? count : 0,
      },
    });
  });

  it("allows verification after every matching failure cooldown has expired", () => {
    const target = buildRefundVerificationScopes({
      requestId: "cancel-a",
      memberUid: "member-a",
      requestIp: "203.0.113.8",
    }, secret);
    const expired = Array.from({ length: 20 }, () => ({
      ...target,
      refundVerificationExpiresAt: "2026-08-04T00:09:59.999Z",
    }));

    expect(assessRefundVerificationCooldown(expired, target, now)).toEqual({
      limited: false,
      counts: { request: 0, member: 0, ip: 0 },
    });
  });

  it.each([
    ["missing", undefined],
    ["short", "too-short"],
  ])("rejects a %s server-only refund rate-limit hash secret", (_label, configuredSecret) => {
    const previous = process.env.REFUND_RATE_LIMIT_HASH_SECRET;
    try {
      if (configuredSecret === undefined) {
        delete process.env.REFUND_RATE_LIMIT_HASH_SECRET;
      } else {
        process.env.REFUND_RATE_LIMIT_HASH_SECRET = configuredSecret;
      }
      expect(() => buildRefundVerificationScopes({
        requestId: "cancel-a",
        memberUid: "member-a",
        requestIp: "203.0.113.8",
      })).toThrow("refund_rate_limit_hash_secret_missing");
    } finally {
      if (previous === undefined) {
        delete process.env.REFUND_RATE_LIMIT_HASH_SECRET;
      } else {
        process.env.REFUND_RATE_LIMIT_HASH_SECRET = previous;
      }
    }
  });

  it("builds an attributable mismatch audit without limiter or account secrets", () => {
    const audit = buildRefundVerificationFailureAudit({
      id: "audit-1",
      requestId: "cancel-sensitive",
      actorUid: "member-sensitive",
      priorRequestAttempts: 2,
      verification: "mismatch",
      now,
    });

    expect(audit).toEqual({
      id: "audit-1",
      action: "refund.account.mismatch",
      actorUid: "member-sensitive",
      targetType: "refundVerificationRequest",
      targetId: "cancel-sensitive",
      result: "mismatch",
      attemptCount: 3,
      createdAt: "2026-08-04T00:10:00.000Z",
    });
    expect(JSON.stringify(audit)).not.toMatch(
      /203\.0\.113\.8|requestScopeHash|memberScopeHash|ipScopeHash|accountNumber|canonical|ciphertext|keyVersion|secret/i,
    );
  });

  it("bounds concurrent verification callbacks through an atomic reservation", async () => {
    const fake = createReservationFirestore();
    const scopes = buildRefundVerificationScopes({
      requestId: "cancel-concurrent-api",
      memberUid: "member-a",
      requestIp: "203.0.113.8",
    }, secret);
    const signer = vi.fn(async () => "match" as const);

    const outcomes = await Promise.all(Array.from({ length: 6 }, () =>
      reserveAndVerifyRefundAccount({
        db: fake.db as never,
        scopes,
        requestId: "cancel-concurrent-api",
        actorUid: "member-a",
        verify: signer,
        now,
      })));

    expect(outcomes.filter((outcome) => outcome.limited)).toHaveLength(1);
    expect(signer).toHaveBeenCalledTimes(5);
  });

  it("atomically limits concurrent reservations before verification, KMS, or encryption", async () => {
    const fake = createReservationFirestore();
    const scopes = buildRefundVerificationScopes({
      requestId: "cancel-concurrent",
      memberUid: "member-a",
      requestIp: "203.0.113.8",
    }, secret);
    const verify = vi.fn();
    const kms = vi.fn();
    const encrypt = vi.fn();

    const outcomes = await Promise.all(Array.from({ length: 6 }, async () => {
      const reservation = await reserveRefundVerificationAttempt({
        db: fake.db as never,
        scopes,
        requestId: "cancel-concurrent",
        actorUid: "member-a",
        now,
      });
      if (reservation.limited) {
        return "limited";
      }
      verify();
      kms();
      encrypt();
      return "entered";
    }));

    expect(outcomes.filter((outcome) => outcome === "entered")).toHaveLength(5);
    expect(outcomes.filter((outcome) => outcome === "limited")).toHaveLength(1);
    expect(verify).toHaveBeenCalledTimes(5);
    expect(kms).toHaveBeenCalledTimes(5);
    expect(encrypt).toHaveBeenCalledTimes(5);
  });

  it("deletes a successful reservation and physically cleans an expired crash residual", async () => {
    const fake = createReservationFirestore();
    const scopes = buildRefundVerificationScopes({
      requestId: "cancel-cleanup",
      memberUid: "member-a",
      requestIp: "203.0.113.8",
    }, secret);
    const first = await reserveRefundVerificationAttempt({
      db: fake.db as never,
      scopes,
      requestId: "cancel-cleanup",
      actorUid: "member-a",
      now,
    });
    expect(first.limited).toBe(false);
    if (first.limited) {
      throw new Error("unexpected_limit");
    }

    await releaseRefundVerificationReservation({
      db: fake.db as never,
      reservationId: first.reservation.id,
    });
    expect(fake.records.has(first.reservation.id)).toBe(false);

    const crashed = await reserveRefundVerificationAttempt({
      db: fake.db as never,
      scopes,
      requestId: "cancel-cleanup",
      actorUid: "member-a",
      now,
    });
    expect(crashed.limited).toBe(false);
    if (crashed.limited) {
      throw new Error("unexpected_limit");
    }
    const afterExpiry = await reserveRefundVerificationAttempt({
      db: fake.db as never,
      scopes,
      requestId: "cancel-cleanup",
      actorUid: "member-a",
      now: new Date(now.getTime() + 61_000),
    });

    expect(afterExpiry.limited).toBe(false);
    expect(fake.records.has(crashed.reservation.id)).toBe(false);
    expect(JSON.stringify([...fake.records.values()])).not.toMatch(
      /cancel-cleanup|member-a|203\.0\.113\.8|accountNumber|canonical|ciphertext/i,
    );
  });
});

describe("refund verification API preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REFUND_RATE_LIMIT_HASH_SECRET = secret;
    refundRoute.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
  });

  it("returns 429 before account verification or KMS work when request cooldown is active", async () => {
    const scopes = buildRefundVerificationScopes({
      requestId: "cancel-a",
      memberUid: "member-a",
      requestIp: "203.0.113.8",
    });
    const activeAttempts = Array.from({ length: 5 }, () => ({
      ...scopes,
      refundVerificationExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    }));
    const requestRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: "cancel-a",
          memberUid: "member-a",
          targetPaymentId: "payment-a",
          refundBankCode: "012",
          refundAccountLast5: "56789",
          status: "needsReverification",
        }),
      }),
    };
    const paymentRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: "payment-a",
          memberUid: "member-a",
          status: "confirmed",
        }),
      }),
    };
    const auditCollection = {
      doc: vi.fn((id = "unused-reservation") => ({ collection: "auditLogs", id })),
      where: vi.fn((field: string, operator: ">" | "<=", value: string) => {
        const query = {
          collection: "auditLogs",
          field,
          operator,
          value,
          limit: vi.fn(),
        };
        query.limit.mockReturnValue(query);
        return query;
      }),
    };
    const transaction = {
      get: vi.fn(async (target: { operator: ">" | "<=" }) => ({
        docs: target.operator === ">"
          ? activeAttempts.map((attempt) => ({ data: () => attempt }))
          : [],
      })),
      delete: vi.fn(),
      create: vi.fn(),
    };
    const db = {
      collection: vi.fn((name: string) => name === "auditLogs"
        ? auditCollection
        : {
            doc: vi.fn(() => name === "cancellationRequests" ? requestRef : paymentRef),
          }),
      runTransaction: vi.fn(async (callback: (value: unknown) => unknown) =>
        callback(transaction)),
    };
    refundRoute.getAdminFirestore.mockReturnValue(db);

    const response = await resubmitRefundAccount(
      new Request("https://example.test/api/cancellations/cancel-a/refund-account", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.8",
        },
        body: JSON.stringify({
          refundBankCode: "012",
          refundAccountNumberFull: "00123456789",
        }),
      }),
      { params: Promise.resolve({ id: "cancel-a" }) },
    );

    expect(response.status).toBe(429);
    expect(refundRoute.verifyRefundAccountForPayment).not.toHaveBeenCalled();
    expect(refundRoute.cloudKmsMac).not.toHaveBeenCalled();
    expect(refundRoute.encryptRefundAccount).not.toHaveBeenCalled();
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
  });

  it("allows only five of six concurrent requests into verification, KMS, and encryption", async () => {
    const fake = createRefundRouteFirestore();
    refundRoute.getAdminFirestore.mockReturnValue(fake.db);
    refundRoute.verifyRefundAccountForPayment.mockResolvedValue("match");
    refundRoute.encryptRefundAccount.mockResolvedValue({
      refundAccountCiphertext: "encrypted",
      refundEncryptionKeyVersion: 7,
      refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
    });

    const responses = await Promise.all(Array.from({ length: 6 }, () =>
      resubmitRefundAccount(
        new Request("https://example.test/api/cancellations/cancel-concurrent/refund-account", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.8",
          },
          body: JSON.stringify({
            refundBankCode: "012",
            refundAccountNumberFull: "00123456789",
          }),
        }),
        { params: Promise.resolve({ id: "cancel-concurrent" }) },
      )));

    expect(responses.filter((response) => response.status === 429)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(4);
    expect(refundRoute.verifyRefundAccountForPayment).toHaveBeenCalledTimes(5);
    expect(refundRoute.cloudKmsMac).toHaveBeenCalledTimes(5);
    expect(refundRoute.encryptRefundAccount).toHaveBeenCalledTimes(5);
    expect(fake.deletedAuditIds).toHaveLength(1);
    expect(fake.getCancellation()).toMatchObject({ status: "pending" });
  });

  it("turns a mismatch reservation into an active failure and appends a safe immutable audit", async () => {
    const fake = createRefundRouteFirestore();
    refundRoute.getAdminFirestore.mockReturnValue(fake.db);
    refundRoute.verifyRefundAccountForPayment.mockResolvedValue("mismatch");

    const response = await resubmitRefundAccount(
      new Request("https://example.test/api/cancellations/cancel-concurrent/refund-account", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.8",
        },
        body: JSON.stringify({
          refundBankCode: "012",
          refundAccountNumberFull: "00123456789",
        }),
      }),
      { params: Promise.resolve({ id: "cancel-concurrent" }) },
    );

    expect(response.status).toBe(400);
    const records = [...fake.auditRecords.values()];
    const failed = records.find((record) =>
      record.action === "refund.verification.reservation");
    const audit = records.find((record) =>
      record.action === "refund.account.mismatch");
    expect(failed).toMatchObject({
      status: "failed",
      result: "mismatch",
      attemptCount: 1,
    });
    expect(Date.parse(String(failed?.refundVerificationExpiresAt))).toBeGreaterThan(
      Date.now() + 14 * 60 * 1000,
    );
    expect(audit).toEqual({
      id: expect.any(String),
      action: "refund.account.mismatch",
      actorUid: "member-a",
      targetType: "refundVerificationRequest",
      targetId: expect.any(String),
      result: "mismatch",
      attemptCount: 1,
      createdAt: expect.any(String),
    });
    expect(JSON.stringify(audit)).not.toMatch(
      /requestScopeHash|memberScopeHash|ipScopeHash|refundVerificationExpiresAt|00123456789|203\.0\.113\.8|ciphertext|canonical/i,
    );
  });
});

describe("Owner sanitized cancellation list API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refundRoute.requireFirebaseUser.mockResolvedValue({ uid: "owner-a", role: "owner" });
    refundRoute.isOwnerClaim.mockReturnValue(true);
  });

  it("returns cancellation metadata without refund vault fields", async () => {
    refundRoute.getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          docs: [{
            id: "cancel-a",
            data: () => ({
              id: "cancel-a",
              orderId: "order-a",
              orderItemIds: ["item-a"],
              memberUid: "member-a",
              reason: "refund",
              status: "pending",
              refundBankCode: "012",
              refundAccountLast5: "56789",
              refundAccountCiphertext: "kms-ciphertext",
              refundEncryptionKeyVersion: 4,
              refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
              refundAccountNumberFull: "00123456789",
              accountFingerprint: "private-fingerprint",
              canonicalInput: "astera:bank-account:v1|012|00123456789",
              createdAt: "2026-08-04T00:00:00.000Z",
              createdBy: "member-a",
            }),
          }],
        }),
      })),
    });
    const { GET } = await import("../../src/app/api/workspace/cancellations/route");

    const response = await GET(new Request("https://example.test/api/workspace/cancellations"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.requests).toEqual([
      expect.objectContaining({
        id: "cancel-a",
        refundBankCode: "012",
        refundAccountLast5: "56789",
      }),
    ]);
    expect(JSON.stringify(payload)).not.toMatch(
      /00123456789|kms-ciphertext|private-fingerprint|canonicalInput|refundAccountCiphertext|refundEncryptionKeyVersion|refundAccountExpiresAt/,
    );
  });
});

describe("Owner sanitized audit list API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refundRoute.requireFirebaseUser.mockResolvedValue({ uid: "owner-a", role: "owner" });
    refundRoute.isOwnerClaim.mockReturnValue(true);
  });

  it("returns mismatch operations through a strict allowlist without limiter or secret metadata", async () => {
    refundRoute.getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          docs: [
            {
              id: "reservation-internal",
              data: () => ({
                id: "reservation-internal",
                action: "refund.verification.reservation",
                actorUid: "system",
                targetType: "refundVerificationReservation",
                targetId: "request-scope-hash",
                status: "pending",
                attemptCount: 5,
                requestScopeHash: "request-scope-hash",
                memberScopeHash: "member-scope-hash",
                ipScopeHash: "ip-scope-hash",
                refundVerificationExpiresAt: "2026-08-04T00:25:00.000Z",
              }),
            },
            {
              id: "audit-mismatch-1",
              data: () => ({
                id: "audit-mismatch-1",
                action: "refund.account.mismatch",
                actorUid: "member-a",
                targetType: "refundVerificationRequest",
                targetId: "cancel-actual-request",
                attemptCount: 5,
                result: "mismatch",
                createdAt: "2026-08-04T00:10:00.000Z",
                requestScopeHash: "request-scope-hash",
                memberScopeHash: "member-scope-hash",
                ipScopeHash: "ip-scope-hash",
                refundVerificationExpiresAt: "2026-08-04T00:25:00.000Z",
                providerError: "raw provider response",
                refundAccountCiphertext: "kms-ciphertext",
                accountFingerprint: "private-fingerprint",
                encryptionKeyVersion: 4,
              }),
            },
          ],
        }),
      })),
    });
    const { GET } = await import("../../src/app/api/workspace/audit-logs/route");

    const response = await GET(new Request("https://example.test/api/workspace/audit-logs"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      logs: [{
        id: "audit-mismatch-1",
        action: "refund.account.mismatch",
        actorUid: "member-a",
        requestReference: "cancel-actual-request",
        attemptCount: 5,
        result: "mismatch",
        createdAt: "2026-08-04T00:10:00.000Z",
      }],
    });
  });

  it("requires the Owner custom claim before reading audit documents", async () => {
    refundRoute.requireFirebaseUser.mockResolvedValue({ uid: "helper-a", role: "helper" });
    refundRoute.isOwnerClaim.mockReturnValue(false);

    const { GET } = await import("../../src/app/api/workspace/audit-logs/route");
    const response = await GET(new Request("https://example.test/api/workspace/audit-logs"));

    expect(response.status).toBe(403);
    expect(refundRoute.getAdminFirestore).not.toHaveBeenCalled();
  });
});
