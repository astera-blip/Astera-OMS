import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assessRefundVerificationCooldown,
  buildRefundVerificationFailureAudit,
  buildRefundVerificationScopes,
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

  it("builds an allowlisted mismatch audit with safe hashes, counters, result, and timestamps only", () => {
    const scopes = buildRefundVerificationScopes({
      requestId: "cancel-sensitive",
      memberUid: "member-sensitive",
      requestIp: "203.0.113.8",
    }, secret);
    const audit = buildRefundVerificationFailureAudit({
      id: "audit-1",
      scopes,
      priorRequestAttempts: 2,
      verification: "mismatch",
      now,
    });

    expect(audit).toEqual({
      id: "audit-1",
      action: "refund.account.mismatch",
      actorUid: "system",
      targetType: "refundVerificationRequest",
      targetId: scopes.requestScopeHash,
      result: "mismatch",
      attemptCount: 3,
      requestScopeHash: scopes.requestScopeHash,
      memberScopeHash: scopes.memberScopeHash,
      ipScopeHash: scopes.ipScopeHash,
      refundVerificationExpiresAt: "2026-08-04T00:25:00.000Z",
      createdAt: "2026-08-04T00:10:00.000Z",
    });
    expect(JSON.stringify(audit)).not.toMatch(
      /cancel-sensitive|member-sensitive|203\.0\.113\.8|accountNumber|canonical|ciphertext|keyVersion|secret/i,
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
    const auditQuery = {
      where: vi.fn(),
      get: vi.fn().mockResolvedValue({
        docs: activeAttempts.map((attempt) => ({ data: () => attempt })),
      }),
    };
    auditQuery.where.mockReturnValue(auditQuery);
    const db = {
      collection: vi.fn((name: string) => ({
        doc: vi.fn(() => name === "cancellationRequests" ? requestRef : paymentRef),
        where: auditQuery.where,
      })),
      runTransaction: vi.fn(),
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
    expect(db.runTransaction).not.toHaveBeenCalled();
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
