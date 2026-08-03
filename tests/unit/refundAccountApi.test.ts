import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireFirebaseUser: vi.fn(),
  isOwnerClaim: vi.fn(),
}));
const vault = vi.hoisted(() => ({
  readRefundAccountForOwner: vi.fn(),
  storeRefundAccount: vi.fn(),
  deletedRefundVaultFields: vi.fn(() => ({
    refundAccountCiphertext: "__DELETE__",
    refundEncryptionKeyVersion: "__DELETE__",
    refundAccountExpiresAt: "__DELETE__",
  })),
}));
const firestore = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));
const kmsMac = vi.hoisted(() => ({ signCanonicalAccount: vi.fn() }));

vi.mock("@/lib/firebase/serverAuth", () => auth);
vi.mock("@/lib/firebase/admin", () => firestore);
vi.mock("@/lib/payment/refundAccountVault", () => vault);
vi.mock("@/lib/security/cloudKmsMac", () => ({
  CloudKmsMac: class {
    signCanonicalAccount = kmsMac.signCanonicalAccount;
  },
}));

import { GET as revealRefundAccount } from "@/app/api/workspace/cancellations/[id]/refund-account/route";
import { POST as createCancellation } from "@/app/api/cancellations/route";
import { POST as resubmitRefundAccount } from "@/app/api/cancellations/[id]/refund-account/route";
import { POST as reviewCancellation } from "@/app/api/workspace/cancellations/[id]/review/route";

type FakeRef = { kind: "doc"; collection: string; id: string };
type FakeQuery = { kind: "query"; collection: string; filters: Array<[string, unknown]> };

function createPaidCancellationFirestore() {
  const writes: Array<{ operation: "set" | "update"; ref: FakeRef; value: Record<string, unknown> }> = [];
  const itemRef: FakeRef = { kind: "doc", collection: "orderItems", id: "item-paid" };
  const paymentRequestRef: FakeRef = { kind: "doc", collection: "paymentRequests", id: "request-paid" };
  const records: Record<string, Record<string, unknown>> = {
    "orders/order-paid": {
      id: "order-paid",
      memberUid: "member-a",
      status: "paid",
      totalTwd: 400,
    },
    "payments/payment-original": {
      id: "payment-original",
      memberUid: "member-a",
      paymentRequestId: "request-paid",
      status: "confirmed",
      memberPaymentAccount: {
        bankCode: "012",
        accountNumberLast5: "56789",
        accountFingerprint: Buffer.from("historical-match").toString("base64"),
        fingerprintKeyVersion: 3,
      },
    },
    "paymentRequests/request-paid": {
      id: "request-paid",
      memberUid: "member-a",
      orderId: "order-paid",
      amountTwd: 400,
      status: "paid",
      method: "bankTransfer",
    },
  };
  const documentSnapshot = (ref: FakeRef) => {
    const data = records[`${ref.collection}/${ref.id}`];
    return { exists: Boolean(data), id: ref.id, ref, data: () => data };
  };
  const querySnapshot = (query: FakeQuery) => {
    if (query.collection === "orderItems") {
      return {
        docs: [{
          id: "item-paid",
          ref: itemRef,
          data: () => ({
            id: "item-paid",
            orderId: "order-paid",
            memberUid: "member-a",
            quantity: 1,
            status: "paid",
            snapshot: { unitPriceTwd: 400 },
          }),
        }],
      };
    }
    if (query.collection === "paymentRequests") {
      return { docs: [{ id: "request-paid", ref: paymentRequestRef, data: () => records["paymentRequests/request-paid"] }] };
    }
    return { docs: [] };
  };
  const collection = vi.fn((name: string) => ({
    doc: vi.fn((id = `generated-${name}`) => ({ kind: "doc", collection: name, id }) as FakeRef),
    where: vi.fn((field: string, _operator: string, value: unknown) => {
      const query: FakeQuery & { where: (field: string, operator: string, value: unknown) => unknown } = {
        kind: "query",
        collection: name,
        filters: [[field, value]],
        where(nextField, _nextOperator, nextValue) {
          this.filters.push([nextField, nextValue]);
          return this;
        },
      };
      return query;
    }),
  }));
  const transaction = {
    get: vi.fn(async (target: FakeRef | FakeQuery) => target.kind === "doc"
      ? documentSnapshot(target)
      : querySnapshot(target)),
    set: vi.fn((ref: FakeRef, value: Record<string, unknown>) => writes.push({ operation: "set", ref, value })),
    update: vi.fn((ref: FakeRef, value: Record<string, unknown>) => writes.push({ operation: "update", ref, value })),
  };
  const db = {
    collection,
    runTransaction: vi.fn(async (callback: (value: never) => unknown) => callback(transaction as never)),
  };
  return { db, transaction, writes };
}

describe("refund account protected APIs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows only an Owner claim to reveal the unexpired full account", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "owner-a", role: "owner" });
    auth.isOwnerClaim.mockReturnValue(true);
    vault.readRefundAccountForOwner.mockResolvedValue({
      bankCode: "012",
      accountNumberFull: "00123456789",
      expiresAt: "2026-08-18T00:00:00.000Z",
    });
    const set = vi.fn();
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ set })) })),
    });

    const response = await revealRefundAccount(
      new Request("https://example.test/api/workspace/cancellations/cancel-1/refund-account"),
      { params: Promise.resolve({ id: "cancel-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      refundAccount: {
        bankCode: "012",
        accountNumberFull: "00123456789",
        expiresAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      action: "refund.account.revealed",
      actorUid: "owner-a",
      targetId: "cancel-1",
    }));
    expect(JSON.stringify(set.mock.calls)).not.toContain("00123456789");
  });

  it("rejects a non-Owner without decrypting", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "helper-a", role: "helper" });
    auth.isOwnerClaim.mockReturnValue(false);

    const response = await revealRefundAccount(
      new Request("https://example.test/api/workspace/cancellations/cancel-1/refund-account"),
      { params: Promise.resolve({ id: "cancel-1" }) },
    );

    expect(response.status).toBe(403);
    expect(vault.readRefundAccountForOwner).not.toHaveBeenCalled();
  });

  it("verifies the specified historical payment and stores a 14-day vault entry", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    kmsMac.signCanonicalAccount.mockResolvedValue({
      mac: Buffer.from("historical-match").toString("base64"),
      keyVersion: 3,
    });
    vault.storeRefundAccount.mockResolvedValue({
      encryptionKeyVersion: 4,
      expiresAt: "2026-08-18T00:00:00.000Z",
    });
    const fake = createPaidCancellationFirestore();
    firestore.getAdminFirestore.mockReturnValue(fake.db);

    const before = Date.now();
    const response = await createCancellation(new Request("https://example.test/api/cancellations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.8",
      },
      body: JSON.stringify({
        orderId: "order-paid",
        orderItemIds: ["item-paid"],
        reason: "paid cancellation",
        idempotencyKey: "paid-refund-1",
        targetPaymentId: "payment-original",
        refundBankCode: "012",
        refundAccountNumberFull: "0012-345 6789",
        fingerprintKeyVersion: 99,
      }),
    }));

    expect(response.status).toBe(200);
    expect(kmsMac.signCanonicalAccount).toHaveBeenCalledWith(
      "astera:bank-account:v1|012|00123456789",
      3,
    );
    const cancellationWrite = fake.writes.find((write) => write.ref.collection === "cancellationRequests");
    expect(cancellationWrite?.value).toMatchObject({
      targetPaymentId: "payment-original",
      refundBankCode: "012",
      refundAccountLast5: "56789",
    });
    expect(cancellationWrite?.value).not.toHaveProperty("refundAccountNumberFull");
    expect(cancellationWrite?.value).not.toHaveProperty("fingerprintKeyVersion");
    expect(vault.storeRefundAccount).toHaveBeenCalledWith(
      "cancel_paid-refund-1",
      "00123456789",
      expect.any(String),
    );
    const expiry = Date.parse(vault.storeRefundAccount.mock.calls[0][2]);
    expect(expiry).toBeGreaterThanOrEqual(before + 14 * 24 * 60 * 60 * 1000 - 1000);
    expect(expiry).toBeLessThanOrEqual(Date.now() + 14 * 24 * 60 * 60 * 1000 + 1000);
  });

  it("rejects a mismatched account before request creation and writes only a redacted audit", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    kmsMac.signCanonicalAccount.mockResolvedValue({
      mac: Buffer.from("different-account").toString("base64"),
      keyVersion: 3,
    });
    const fake = createPaidCancellationFirestore();
    firestore.getAdminFirestore.mockReturnValue(fake.db);

    const response = await createCancellation(new Request("https://example.test/api/cancellations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.8",
      },
      body: JSON.stringify({
        orderId: "order-paid",
        orderItemIds: ["item-paid"],
        reason: "paid cancellation",
        idempotencyKey: "paid-refund-mismatch",
        targetPaymentId: "payment-original",
        refundBankCode: "012",
        refundAccountNumberFull: "00123456789",
      }),
    }));

    expect(response.status).toBe(400);
    expect(fake.writes.filter((write) => write.ref.collection === "cancellationRequests")).toHaveLength(0);
    expect(fake.writes.filter((write) => write.ref.collection === "paymentAllocations")).toHaveLength(0);
    const audit = fake.writes.find((write) => write.ref.collection === "auditLogs");
    expect(audit?.value).toMatchObject({ action: "refund.account.mismatch" });
    expect(JSON.stringify(audit)).not.toContain("00123456789");
    expect(vault.storeRefundAccount).not.toHaveBeenCalled();
    expect(fake.writes.filter((write) => write.ref.collection === "securityRateLimits")).toHaveLength(3);
  });

  it("lets the member resubmit only their expired needs-reverification request", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    kmsMac.signCanonicalAccount.mockResolvedValue({
      mac: Buffer.from("historical-match").toString("base64"),
      keyVersion: 3,
    });
    vault.storeRefundAccount.mockResolvedValue({
      encryptionKeyVersion: 5,
      expiresAt: "2026-08-18T00:00:00.000Z",
    });
    const update = vi.fn();
    const refs: Record<string, { id: string; get: ReturnType<typeof vi.fn>; update?: ReturnType<typeof vi.fn> }> = {
      "cancellationRequests/cancel-expired": {
        id: "cancel-expired",
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            id: "cancel-expired",
            memberUid: "member-a",
            orderId: "order-paid",
            targetPaymentId: "payment-original",
            refundBankCode: "012",
            refundAccountLast5: "56789",
            status: "needsReverification",
          }),
        }),
        update,
      },
      "payments/payment-original": {
        id: "payment-original",
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            id: "payment-original",
            memberUid: "member-a",
            paymentRequestId: "request-paid",
            status: "confirmed",
            memberPaymentAccount: {
              bankCode: "012",
              accountNumberLast5: "56789",
              accountFingerprint: Buffer.from("historical-match").toString("base64"),
              fingerprintKeyVersion: 3,
            },
          }),
        }),
      },
    };
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn((name: string) => ({
        doc: vi.fn((id: string) => refs[`${name}/${id}`]),
      })),
    });

    const response = await resubmitRefundAccount(
      new Request("https://example.test/api/cancellations/cancel-expired/refund-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          refundBankCode: "012",
          refundAccountNumberFull: "00123456789",
          fingerprintKeyVersion: 99,
        }),
      }),
      { params: Promise.resolve({ id: "cancel-expired" }) },
    );

    expect(response.status).toBe(200);
    expect(kmsMac.signCanonicalAccount).toHaveBeenCalledWith(
      "astera:bank-account:v1|012|00123456789",
      3,
    );
    expect(vault.storeRefundAccount).toHaveBeenCalledWith(
      "cancel-expired",
      "00123456789",
      expect.any(String),
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
  });

  it("transactionally deletes vault fields when Owner completes a full refund", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "owner-a", role: "owner" });
    auth.isOwnerClaim.mockReturnValue(true);
    const writes: Array<{ operation: string; ref: FakeRef; value: Record<string, unknown> }> = [];
    const refs = {
      cancellation: { kind: "doc", collection: "cancellationRequests", id: "cancel-full" } as FakeRef,
      order: { kind: "doc", collection: "orders", id: "order-paid" } as FakeRef,
      item: { kind: "doc", collection: "orderItems", id: "item-paid" } as FakeRef,
      paymentRequest: { kind: "doc", collection: "paymentRequests", id: "request-paid" } as FakeRef,
    };
    const requestRecord = {
      id: "cancel-full",
      orderId: "order-paid",
      orderItemIds: ["item-paid"],
      memberUid: "member-a",
      reason: "full refund",
      status: "pending",
      targetPaymentId: "payment-original",
      refundBankCode: "012",
      refundAccountLast5: "56789",
      refundAccountCiphertext: "ciphertext-secret",
      refundEncryptionKeyVersion: 4,
      refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
      createdAt: "2026-08-04T00:00:00.000Z",
      createdBy: "member-a",
    };
    const transaction = {
      get: vi.fn(async (target: FakeRef | FakeQuery): Promise<unknown> => {
        if (target.kind === "query" && target.collection === "orderItems") {
          return { docs: [{ id: "item-paid", ref: refs.item, data: () => ({
            id: "item-paid",
            orderId: "order-paid",
            memberUid: "member-a",
            quantity: 1,
            status: "cancelRequested",
            snapshot: { unitPriceTwd: 400 },
          }) }] };
        }
        if (target.kind === "query" && target.collection === "paymentRequests") {
          return { docs: [{ id: "request-paid", ref: refs.paymentRequest, data: () => ({
            id: "request-paid",
            memberUid: "member-a",
            orderId: "order-paid",
            amountTwd: 400,
            status: "paid",
            method: "bankTransfer",
          }) }] };
        }
        if (target.kind === "doc" && target.collection === "cancellationRequests") {
          return { exists: true, id: target.id, ref: target, data: () => requestRecord };
        }
        if (target.kind === "doc" && target.collection === "orders") {
          return { exists: true, id: target.id, ref: target, data: () => ({
            id: "order-paid",
            memberUid: "member-a",
            status: "paid",
            totalTwd: 400,
          }) };
        }
        return { exists: false, data: () => undefined };
      }),
      set: vi.fn((ref: FakeRef, value: Record<string, unknown>) => writes.push({ operation: "set", ref, value })),
      update: vi.fn((ref: FakeRef, value: Record<string, unknown>) => writes.push({ operation: "update", ref, value })),
    };
    const db = {
      collection: vi.fn((name: string) => ({
        doc: vi.fn((id = `generated-${name}`) => ({ kind: "doc", collection: name, id }) as FakeRef),
        where: vi.fn((field: string, _operator: string, value: unknown) => ({
          kind: "query",
          collection: name,
          filters: [[field, value]],
        }) as FakeQuery),
      })),
      runTransaction: vi.fn(async (callback: (value: never) => unknown) => callback(transaction as never)),
    };
    firestore.getAdminFirestore.mockReturnValue(db);

    const response = await reviewCancellation(
      new Request("https://example.test/api/workspace/cancellations/cancel-full/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          reviewNote: "refund complete",
          refundAmountTwd: 400,
          refundCompletedAt: "2026-08-04",
          refundReference: "BANK-400",
          refundAccountNumberFull: "client-must-not-send-this",
        }),
      }),
      { params: Promise.resolve({ id: "cancel-full" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ orderStatus: "refunded" });
    const requestWrite = writes.find((write) => write.ref.collection === "cancellationRequests");
    expect(requestWrite?.value).toMatchObject({
      refundAccountCiphertext: "__DELETE__",
      refundEncryptionKeyVersion: "__DELETE__",
      refundAccountExpiresAt: "__DELETE__",
      refundAmountTwd: 400,
      refundCompletedAt: "2026-08-04",
      refundReference: "BANK-400",
    });
    expect(JSON.stringify(requestWrite)).not.toContain("ciphertext-secret");
    expect(JSON.stringify(writes)).not.toContain("client-must-not-send-this");
  });
});
