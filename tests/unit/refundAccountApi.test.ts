import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireFirebaseUser: vi.fn(),
  isOwnerClaim: vi.fn(),
}));
const vault = vi.hoisted(() => ({
  readRefundAccountForOwner: vi.fn(),
  storeRefundAccount: vi.fn(),
  encryptRefundAccount: vi.fn(),
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
import { GET as getOrderDetail } from "@/app/api/orders/[id]/route";

type FakeRef = { kind: "doc"; collection: string; id: string };
type FakeQuery = {
  kind: "query";
  collection: string;
  filters: Array<[string, unknown]>;
  operator?: string;
  value?: unknown;
  maximum?: number;
  limit?: (maximum: number) => FakeQuery;
};
const validHistoricalFingerprint = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

function createPaidCancellationFirestore(options: {
  existingCancellation?: Record<string, unknown>;
  existingCancellations?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  allocations?: Array<Record<string, unknown>>;
} = {}) {
  const writes: Array<{ operation: "set" | "update"; ref: FakeRef; value: Record<string, unknown> }> = [];
  const itemRef: FakeRef = { kind: "doc", collection: "orderItems", id: "item-paid" };
  const paymentRequestRef: FakeRef = { kind: "doc", collection: "paymentRequests", id: "request-paid" };
  const defaultPayment = {
    id: "payment-original",
    memberUid: "member-a",
    paymentRequestId: "request-paid",
    status: "confirmed",
    memberPaymentAccount: {
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: validHistoricalFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 3,
    },
  };
  const records: Record<string, Record<string, unknown>> = {
    "orders/order-paid": {
      id: "order-paid",
      memberUid: "member-a",
      status: "paid",
      totalTwd: 400,
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
  for (const payment of options.payments ?? [defaultPayment]) {
    records[`payments/${String(payment.id)}`] = payment;
  }
  for (const cancellation of [
    ...(options.existingCancellations ?? []),
    ...(options.existingCancellation ? [options.existingCancellation] : []),
  ]) {
    const id = String(cancellation.id ?? "cancel_retry-incomplete");
    records[`cancellationRequests/${id}`] = cancellation;
  }
  const documentSnapshot = (ref: FakeRef) => {
    const data = records[`${ref.collection}/${ref.id}`];
    return { exists: Boolean(data), id: ref.id, ref, data: () => data };
  };
  const querySnapshot = (query: FakeQuery) => {
    if (query.collection === "orderItems") {
      const orderItems = options.items ?? [{
        id: "item-paid",
        orderId: "order-paid",
        memberUid: "member-a",
        quantity: 1,
        status: "paid",
        snapshot: { unitPriceTwd: 400 },
      }];
      return {
        docs: orderItems.map((item) => ({
          id: String(item.id),
          ref: { ...itemRef, id: String(item.id) },
          data: () => item,
        })),
      };
    }
    if (query.collection === "paymentRequests") {
      return { docs: [{ id: "request-paid", ref: paymentRequestRef, data: () => records["paymentRequests/request-paid"] }] };
    }
    if (query.collection === "paymentAllocations") {
      const allocations = options.allocations ?? [{
          paymentId: "payment-original",
          kind: "payment",
          targetType: "paymentRequest",
          targetId: "request-paid",
          amountTwd: 400,
      }];
      const paymentId = query.filters.find(([field]) => field === "paymentId")?.[1];
      return { docs: allocations
        .filter((allocation) => !paymentId || allocation.paymentId === paymentId)
        .map((allocation, index) => ({
        id: `allocation-${index}`,
        data: () => allocation,
      })) };
    }
    if (query.collection === "auditLogs") {
      const candidate = String(query.value ?? "");
      const audits = Object.entries(records)
        .filter(([key]) => key.startsWith("auditLogs/"))
        .map(([key, value]) => ({ id: key.slice("auditLogs/".length), value }))
        .filter(({ value }) => {
          const expiry = String(value.refundVerificationExpiresAt ?? "");
          return query.operator === ">" ? expiry > candidate : expiry <= candidate;
        })
        .slice(0, query.maximum);
      return {
        docs: audits.map(({ id, value }) => ({ id, data: () => value })),
      };
    }
    if (query.collection === "cancellationRequests") {
      const cancellations = Object.entries(records)
        .filter(([key]) => key.startsWith("cancellationRequests/"))
        .map(([, value]) => value)
        .filter((cancellation) => query.filters.every(([field, value]) =>
          cancellation[field] === value));
      return {
        docs: cancellations.map((cancellation) => ({
          id: String(cancellation.id),
          ref: {
            kind: "doc" as const,
            collection: "cancellationRequests",
            id: String(cancellation.id),
          },
          data: () => cancellation,
        })),
      };
    }
    return { docs: [] };
  };
  let generatedSequence = 0;
  const collection = vi.fn((name: string) => ({
    doc: vi.fn((id = `generated-${name}-${++generatedSequence}`) => ({ kind: "doc", collection: name, id }) as FakeRef),
    where: vi.fn((field: string, _operator: string, value: unknown) => {
      const query: FakeQuery & { where: (field: string, operator: string, value: unknown) => unknown } = {
        kind: "query",
        collection: name,
        filters: [[field, value]],
        operator: _operator,
        value,
        limit(maximum) {
          this.maximum = maximum;
          return this;
        },
        where(nextField, _nextOperator, nextValue) {
          this.filters.push([nextField, nextValue]);
          return this;
        },
      };
      return query;
    }),
  }));
  let hasStagedWrite = false;
  const transaction = {
    get: vi.fn(async (target: FakeRef | FakeQuery) => {
      if (hasStagedWrite) {
        throw new Error("Firestore transactions require all reads before all writes");
      }
      return target.kind === "doc" ? documentSnapshot(target) : querySnapshot(target);
    }),
    set: vi.fn((ref: FakeRef, value: Record<string, unknown>) => {
      hasStagedWrite = true;
      records[`${ref.collection}/${ref.id}`] = { ...value };
      writes.push({ operation: "set", ref, value });
    }),
    create: vi.fn((ref: FakeRef, value: Record<string, unknown>) => {
      hasStagedWrite = true;
      records[`${ref.collection}/${ref.id}`] = { ...value };
      writes.push({ operation: "set", ref, value });
    }),
    update: vi.fn((ref: FakeRef, value: Record<string, unknown>) => {
      hasStagedWrite = true;
      records[`${ref.collection}/${ref.id}`] = {
        ...records[`${ref.collection}/${ref.id}`],
        ...value,
      };
      writes.push({ operation: "update", ref, value });
    }),
    delete: vi.fn((ref: FakeRef) => {
      hasStagedWrite = true;
      delete records[`${ref.collection}/${ref.id}`];
    }),
  };
  const db = {
    collection,
    runTransaction: vi.fn(async (callback: (value: never) => unknown) => {
      hasStagedWrite = false;
      return callback(transaction as never);
    }),
  };
  return { db, transaction, writes };
}

describe("refund account protected APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REFUND_RATE_LIMIT_HASH_SECRET = "task-5-regression-test-secret-at-least-32-bytes";
  });

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

  it.each([
    { status: "pending", refundAccountCiphertext: "private-ciphertext" },
    { status: "approved", refundAccountCiphertext: undefined },
  ])("rejects a foreign idempotency replay before returning success: %o", async (state) => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-attacker" });
    const fake = createPaidCancellationFirestore({
      existingCancellation: {
        id: "cancel_shared-key",
        orderId: "order-paid",
        orderItemIds: ["item-paid"],
        memberUid: "member-owner",
        reason: "owner request",
        status: state.status,
        targetPaymentId: "payment-original",
        refundBankCode: "012",
        refundAccountLast5: "56789",
        ...(state.refundAccountCiphertext
          ? { refundAccountCiphertext: state.refundAccountCiphertext }
          : {}),
      },
    });
    firestore.getAdminFirestore.mockReturnValue(fake.db);

    const response = await createCancellation(new Request("https://example.test/api/cancellations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "order-paid",
        orderItemIds: ["item-paid"],
        reason: "attacker replay",
        idempotencyKey: "shared-key",
        targetPaymentId: "payment-original",
        refundBankCode: "012",
        refundAccountNumberFull: "00123456789",
      }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "idempotency_conflict" });
    expect(kmsMac.signCanonicalAccount).not.toHaveBeenCalled();
    expect(vault.encryptRefundAccount).not.toHaveBeenCalled();
  });

  it("rejects an immutable payload change on a completed idempotent replay", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    const fake = createPaidCancellationFirestore({
      existingCancellation: {
        id: "cancel_immutable-key",
        orderId: "order-paid",
        orderItemIds: ["item-paid"],
        memberUid: "member-a",
        reason: "original reason",
        status: "pending",
        targetPaymentId: "payment-original",
        refundBankCode: "012",
        refundAccountLast5: "56789",
        refundAccountCiphertext: "private-ciphertext",
      },
    });
    firestore.getAdminFirestore.mockReturnValue(fake.db);

    const response = await createCancellation(new Request("https://example.test/api/cancellations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "order-paid",
        orderItemIds: ["item-paid"],
        reason: "changed reason",
        idempotencyKey: "immutable-key",
        targetPaymentId: "payment-original",
        refundBankCode: "012",
        refundAccountNumberFull: "00123456789",
      }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "idempotency_conflict" });
  });

  it("returns idempotent success when replaying the complete original mixed cancellation selection", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    kmsMac.signCanonicalAccount.mockResolvedValue({
      mac: validHistoricalFingerprint,
      keyVersion: 3,
    });
    vault.encryptRefundAccount.mockResolvedValue({
      refundAccountCiphertext: "bWl4ZWQtY2lwaGVydGV4dA==",
      refundEncryptionKeyVersion: 4,
      refundAccountExpiresAt: "2026-08-23T00:00:00.000Z",
    });
    const fake = createPaidCancellationFirestore({
      items: [
        {
          id: "item-unpaid",
          orderId: "order-paid",
          memberUid: "member-a",
          quantity: 1,
          status: "awaitingPayment",
          snapshot: { unitPriceTwd: 200 },
        },
        {
          id: "item-paid",
          orderId: "order-paid",
          memberUid: "member-a",
          quantity: 1,
          status: "paid",
          snapshot: { unitPriceTwd: 400 },
        },
      ],
    });
    firestore.getAdminFirestore.mockReturnValue(fake.db);
    const request = () => new Request("https://example.test/api/cancellations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "order-paid",
        orderItemIds: ["item-unpaid", "item-paid"],
        reason: "mixed cancellation",
        idempotencyKey: "mixed-replay",
        targetPaymentId: "payment-original",
        refundBankCode: "012",
        refundAccountNumberFull: "00123456789",
      }),
    });

    const initialResponse = await createCancellation(request());
    const replayResponse = await createCancellation(request());

    expect(initialResponse.status).toBe(200);
    expect(replayResponse.status).toBe(200);
    await expect(replayResponse.json()).resolves.toEqual({
      ok: true,
      requestId: "cancel_mixed-replay",
      alreadyExists: true,
    });
    expect(kmsMac.signCanonicalAccount).toHaveBeenCalledTimes(1);
  });

  it("rejects a replay that changes a mixed cancellation to only the paid subset", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    kmsMac.signCanonicalAccount.mockResolvedValue({
      mac: validHistoricalFingerprint,
      keyVersion: 3,
    });
    vault.encryptRefundAccount.mockResolvedValue({
      refundAccountCiphertext: "bWl4ZWQtY2lwaGVydGV4dA==",
      refundEncryptionKeyVersion: 4,
      refundAccountExpiresAt: "2026-08-23T00:00:00.000Z",
    });
    const fake = createPaidCancellationFirestore({
      items: [
        {
          id: "item-unpaid",
          orderId: "order-paid",
          memberUid: "member-a",
          quantity: 1,
          status: "awaitingPayment",
          snapshot: { unitPriceTwd: 200 },
        },
        {
          id: "item-paid",
          orderId: "order-paid",
          memberUid: "member-a",
          quantity: 1,
          status: "paid",
          snapshot: { unitPriceTwd: 400 },
        },
      ],
    });
    firestore.getAdminFirestore.mockReturnValue(fake.db);
    const submit = (orderItemIds: string[]) => createCancellation(new Request(
      "https://example.test/api/cancellations",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: "order-paid",
          orderItemIds,
          reason: "mixed cancellation",
          idempotencyKey: "mixed-subset",
          targetPaymentId: "payment-original",
          refundBankCode: "012",
          refundAccountNumberFull: "00123456789",
        }),
      },
    ));

    const initialResponse = await submit(["item-unpaid", "item-paid"]);
    const changedReplayResponse = await submit(["item-paid"]);

    expect(initialResponse.status).toBe(200);
    expect(changedReplayResponse.status).toBe(409);
    await expect(changedReplayResponse.json()).resolves.toEqual({
      error: "idempotency_conflict",
    });
  });

  it("verifies the specified historical payment and stores a 14-day vault entry", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    kmsMac.signCanonicalAccount.mockResolvedValue({
      mac: validHistoricalFingerprint,
      keyVersion: 3,
    });
    vault.encryptRefundAccount.mockResolvedValue({
      refundAccountCiphertext: "Y2lwaGVydGV4dA==",
      refundEncryptionKeyVersion: 4,
      refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
      refundRequestedAmountTwd: 400,
      refundItemAllocations: [{ orderItemId: "item-paid", amountTwd: 400 }],
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
      refundAccountCiphertext: "Y2lwaGVydGV4dA==",
      refundEncryptionKeyVersion: 4,
      refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
    });
    expect(cancellationWrite?.value).not.toHaveProperty("refundAccountNumberFull");
    expect(cancellationWrite?.value).not.toHaveProperty("fingerprintKeyVersion");
    expect(vault.encryptRefundAccount).toHaveBeenCalledWith(
      "cancel_paid-refund-1",
      "00123456789",
      expect.any(String),
    );
    expect(vault.storeRefundAccount).not.toHaveBeenCalled();
    const expiry = Date.parse(vault.encryptRefundAccount.mock.calls[0][2]);
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
    const audit = fake.writes.find((write) =>
      write.ref.collection === "auditLogs"
      && write.value.action === "refund.account.mismatch");
    expect(audit?.value).toMatchObject({
      action: "refund.account.mismatch",
      actorUid: "member-a",
      targetId: "cancel_paid-refund-mismatch",
    });
    expect(JSON.stringify(audit)).not.toContain("00123456789");
    expect(vault.storeRefundAccount).not.toHaveBeenCalled();
    expect(fake.writes.filter((write) => write.ref.collection === "securityRateLimits")).toHaveLength(0);
    expect(audit?.ref.id).toMatch(/^generated-auditLogs-/);
    expect(audit?.value).not.toHaveProperty("requestIp");
    expect(audit?.value).not.toHaveProperty("requestScopeHash");
    expect(audit?.value).not.toHaveProperty("memberScopeHash");
    expect(audit?.value).not.toHaveProperty("ipScopeHash");
    expect(fake.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "auditLogs" }),
      expect.objectContaining({ action: "refund.account.mismatch" }),
    );
    expect(JSON.stringify(audit)).not.toContain("203.0.113.8");
    expect(JSON.stringify(audit)).toContain("member-a");
    expect(JSON.stringify(audit)).toContain("cancel_paid-refund-mismatch");
  });

  it("does not commit cancellation state when KMS encryption fails", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    kmsMac.signCanonicalAccount.mockResolvedValue({
      mac: validHistoricalFingerprint,
      keyVersion: 3,
    });
    vault.encryptRefundAccount.mockRejectedValue(new Error("kms_unavailable"));
    const fake = createPaidCancellationFirestore();
    firestore.getAdminFirestore.mockReturnValue(fake.db);

    const response = await createCancellation(new Request("https://example.test/api/cancellations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "order-paid",
        orderItemIds: ["item-paid"],
        reason: "paid cancellation",
        idempotencyKey: "kms-failure",
        targetPaymentId: "payment-original",
        refundBankCode: "012",
        refundAccountNumberFull: "00123456789",
      }),
    }));

    expect(response.status).toBe(500);
    expect(fake.writes.filter((write) =>
      write.ref.collection === "cancellationRequests"
      || write.ref.collection === "orderItems")).toHaveLength(0);
  });

  it("derives non-overlapping source-specific shares for one item funded by two payments", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    kmsMac.signCanonicalAccount.mockResolvedValue({
      mac: validHistoricalFingerprint,
      keyVersion: 3,
    });
    vault.encryptRefundAccount.mockResolvedValue({
      refundAccountCiphertext: "Y2lwaGVy",
      refundEncryptionKeyVersion: 4,
      refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
    });
    const paidItem = {
      id: "item-shared",
      orderId: "order-paid",
      memberUid: "member-a",
      quantity: 1,
      status: "paid",
      snapshot: { unitPriceTwd: 1000 },
    };
    const payments = ["payment-source-a", "payment-source-b"].map((id) => ({
      id,
      memberUid: "member-a",
      paymentRequestId: "request-paid",
      status: "confirmed",
      memberPaymentAccount: {
        bankCode: "012",
        accountNumberLast5: "56789",
        accountFingerprint: validHistoricalFingerprint,
        fingerprintAlgorithm: "HMAC-SHA-256",
        fingerprintKeyVersion: 3,
      },
    }));
    const allocations = [
      {
        paymentId: "payment-source-a",
        kind: "payment",
        targetType: "paymentRequest",
        targetId: "request-paid",
        amountTwd: 400,
      },
      {
        paymentId: "payment-source-b",
        kind: "payment",
        targetType: "paymentRequest",
        targetId: "request-paid",
        amountTwd: 600,
      },
    ];
    const requestFor = (targetPaymentId: string, idempotencyKey: string) =>
      new Request("https://example.test/api/cancellations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: "order-paid",
          orderItemIds: ["item-shared"],
          reason: "shared source refund",
          idempotencyKey,
          targetPaymentId,
          refundBankCode: "012",
          refundAccountNumberFull: "00123456789",
        }),
      });

    const sourceAFake = createPaidCancellationFirestore({
      items: [paidItem],
      payments,
      allocations,
    });
    firestore.getAdminFirestore.mockReturnValue(sourceAFake.db);
    const sourceAResponse = await createCancellation(requestFor("payment-source-a", "source-a"));

    expect(sourceAResponse.status).toBe(200);
    const sourceARequest = sourceAFake.writes.find((write) =>
      write.ref.collection === "cancellationRequests")?.value;
    expect(sourceARequest).toMatchObject({
      id: "cancel_source-a",
      targetPaymentId: "payment-source-a",
      refundRequestedAmountTwd: 400,
      refundItemAllocations: [{ orderItemId: "item-shared", amountTwd: 400 }],
    });

    const expiredSourceAFake = createPaidCancellationFirestore({
      items: [{ ...paidItem, status: "cancelRequested" }],
      payments,
      allocations,
      existingCancellations: [{
        ...sourceARequest!,
        status: "needsReverification",
      }],
    });
    firestore.getAdminFirestore.mockReturnValue(expiredSourceAFake.db);
    const expiredSourceAResponse = await createCancellation(
      requestFor("payment-source-a", "source-a-expired-duplicate"),
    );

    expect(expiredSourceAResponse.status).toBe(400);
    await expect(expiredSourceAResponse.json()).resolves.toMatchObject({
      error: "refund_payment_allocation_exceeded",
    });
    expect(expiredSourceAFake.writes.filter((write) =>
      write.ref.collection === "cancellationRequests")).toHaveLength(0);

    const sourceBFake = createPaidCancellationFirestore({
      items: [{ ...paidItem, status: "cancelRequested" }],
      payments,
      allocations,
      existingCancellations: [sourceARequest!],
    });
    firestore.getAdminFirestore.mockReturnValue(sourceBFake.db);
    const sourceBResponse = await createCancellation(requestFor("payment-source-b", "source-b"));

    expect(sourceBResponse.status).toBe(200);
    const sourceBRequest = sourceBFake.writes.find((write) =>
      write.ref.collection === "cancellationRequests")?.value;
    expect(sourceBRequest).toMatchObject({
      id: "cancel_source-b",
      targetPaymentId: "payment-source-b",
      refundRequestedAmountTwd: 600,
      refundItemAllocations: [{ orderItemId: "item-shared", amountTwd: 600 }],
    });
    expect(
      Number(sourceARequest?.refundRequestedAmountTwd)
      + Number(sourceBRequest?.refundRequestedAmountTwd),
    ).toBe(1000);

    const duplicateSourceFake = createPaidCancellationFirestore({
      items: [{ ...paidItem, status: "cancelRequested" }],
      payments,
      allocations,
      existingCancellations: [sourceARequest!, sourceBRequest!],
    });
    firestore.getAdminFirestore.mockReturnValue(duplicateSourceFake.db);
    const duplicateSourceResponse = await createCancellation(
      requestFor("payment-source-a", "source-a-duplicate"),
    );

    expect(duplicateSourceResponse.status).toBe(400);
    await expect(duplicateSourceResponse.json()).resolves.toMatchObject({
      error: "refund_payment_allocation_exceeded",
    });
    expect(duplicateSourceFake.writes.filter((write) =>
      write.ref.collection === "cancellationRequests")).toHaveLength(0);
  });

  it("repairs an idempotent pending request left without ciphertext after a prior failure", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    kmsMac.signCanonicalAccount.mockResolvedValue({
      mac: validHistoricalFingerprint,
      keyVersion: 3,
    });
    vault.encryptRefundAccount.mockResolvedValue({
      refundAccountCiphertext: "cmVwYWlyZWQtY2lwaGVy",
      refundEncryptionKeyVersion: 5,
      refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
    });
    const fake = createPaidCancellationFirestore({
      existingCancellation: {
        id: "cancel_retry-incomplete",
        orderId: "order-paid",
        orderItemIds: ["item-paid"],
        memberUid: "member-a",
        reason: "retry",
        status: "pending",
        targetPaymentId: "payment-original",
        refundBankCode: "012",
        refundAccountLast5: "56789",
      },
    });
    firestore.getAdminFirestore.mockReturnValue(fake.db);

    const response = await createCancellation(new Request("https://example.test/api/cancellations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "order-paid",
        orderItemIds: ["item-paid"],
        reason: "retry",
        idempotencyKey: "retry-incomplete",
        targetPaymentId: "payment-original",
        refundBankCode: "012",
        refundAccountNumberFull: "00123456789",
      }),
    }));

    expect(response.status).toBe(200);
    expect(vault.encryptRefundAccount).toHaveBeenCalled();
    expect(fake.writes).toContainEqual(expect.objectContaining({
      operation: "update",
      ref: expect.objectContaining({ collection: "cancellationRequests" }),
      value: expect.objectContaining({ refundAccountCiphertext: "cmVwYWlyZWQtY2lwaGVy" }),
    }));
  });

  it("lets the member resubmit only their expired needs-reverification request", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    kmsMac.signCanonicalAccount.mockResolvedValue({
      mac: validHistoricalFingerprint,
      keyVersion: 3,
    });
    vault.encryptRefundAccount.mockResolvedValue({
      refundAccountCiphertext: "bmV3LWNpcGhlcg==",
      refundEncryptionKeyVersion: 5,
      refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
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
              accountFingerprint: validHistoricalFingerprint,
              fingerprintAlgorithm: "HMAC-SHA-256",
              fingerprintKeyVersion: 3,
            },
          }),
        }),
      },
    };
    const reservationRef = { id: "reservation-success", kind: "doc", collection: "auditLogs" };
    const auditQuery = {
      kind: "query",
      collection: "auditLogs",
      limit: vi.fn(),
    };
    auditQuery.limit.mockReturnValue(auditQuery);
    const transaction = {
      get: vi.fn(async (target: { kind?: string }) => target.kind === "query"
        ? { docs: [] }
        : {
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
      create: vi.fn(),
      update,
      delete: vi.fn(),
    };
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn((name: string) => name === "auditLogs"
        ? {
            doc: vi.fn(() => reservationRef),
            where: vi.fn(() => auditQuery),
          }
        : {
            doc: vi.fn((id: string) => refs[`${name}/${id}`]),
          }),
      runTransaction: vi.fn(async (callback: (value: never) => unknown) => callback(transaction as never)),
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
    expect(vault.encryptRefundAccount).toHaveBeenCalledWith(
      "cancel-expired",
      "00123456789",
      expect.any(String),
    );
    expect(vault.storeRefundAccount).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      refs["cancellationRequests/cancel-expired"],
      expect.objectContaining({
        status: "pending",
        refundAccountCiphertext: "bmV3LWNpcGhlcg==",
      }),
    );
    expect(transaction.delete).toHaveBeenCalledWith(reservationRef);
  });

  it("does not resurrect a vault when review wins the resubmission race", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    kmsMac.signCanonicalAccount.mockResolvedValue({
      mac: validHistoricalFingerprint,
      keyVersion: 3,
    });
    vault.encryptRefundAccount.mockResolvedValue({
      refundAccountCiphertext: "bmV3LWNpcGhlcg==",
      refundEncryptionKeyVersion: 5,
      refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
    });
    const requestRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: "cancel-race",
          memberUid: "member-a",
          orderId: "order-paid",
          targetPaymentId: "payment-original",
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
          memberUid: "member-a",
          paymentRequestId: "request-paid",
          status: "confirmed",
          memberPaymentAccount: {
            bankCode: "012",
            accountNumberLast5: "56789",
            accountFingerprint: validHistoricalFingerprint,
            fingerprintAlgorithm: "HMAC-SHA-256",
            fingerprintKeyVersion: 3,
          },
        }),
      }),
    };
    const update = vi.fn();
    const reservationRef = { id: "reservation-race", kind: "doc", collection: "auditLogs" };
    const auditQuery = {
      kind: "query",
      collection: "auditLogs",
      limit: vi.fn(),
    };
    auditQuery.limit.mockReturnValue(auditQuery);
    const transaction = {
      get: vi.fn(async (target: { kind?: string }) => target.kind === "query"
        ? { docs: [] }
        : {
            exists: true,
            data: () => ({
              id: "cancel-race",
              memberUid: "member-a",
              targetPaymentId: "payment-original",
              refundBankCode: "012",
              refundAccountLast5: "56789",
              status: "approved",
            }),
          }),
      create: vi.fn(),
      update,
      delete: vi.fn(),
    };
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn((name: string) => name === "auditLogs"
        ? {
            doc: vi.fn(() => reservationRef),
            where: vi.fn(() => auditQuery),
          }
        : {
            doc: vi.fn(() => name === "payments" ? paymentRef : requestRef),
          }),
      runTransaction: vi.fn(async (callback: (value: never) => unknown) => callback(transaction as never)),
    });

    const response = await resubmitRefundAccount(
      new Request("https://example.test/api/cancellations/cancel-race/refund-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          refundBankCode: "012",
          refundAccountNumberFull: "00123456789",
        }),
      }),
      { params: Promise.resolve({ id: "cancel-race" }) },
    );

    expect(response.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("transactionally deletes every source vault when the final approval refunds the order", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "owner-a", role: "owner" });
    auth.isOwnerClaim.mockReturnValue(true);
    const writes: Array<{ operation: string; ref: FakeRef; value: Record<string, unknown> }> = [];
    const refs = {
      sourceA: { kind: "doc", collection: "cancellationRequests", id: "cancel-source-a" } as FakeRef,
      sourceB: { kind: "doc", collection: "cancellationRequests", id: "cancel-source-b" } as FakeRef,
      noVault: { kind: "doc", collection: "cancellationRequests", id: "cancel-no-vault" } as FakeRef,
      order: { kind: "doc", collection: "orders", id: "order-paid" } as FakeRef,
      item: { kind: "doc", collection: "orderItems", id: "item-paid" } as FakeRef,
      paymentRequest: { kind: "doc", collection: "paymentRequests", id: "request-paid" } as FakeRef,
    };
    const requestRecord = {
      id: "cancel-source-b",
      orderId: "order-paid",
      orderItemIds: ["item-paid"],
      memberUid: "member-a",
      reason: "source B refund",
      status: "pending",
      targetPaymentId: "payment-source-b",
      targetPaymentRequestId: "request-paid",
      refundRequestedAmountTwd: 600,
      refundItemAllocations: [{ orderItemId: "item-paid", amountTwd: 600 }],
      refundBankCode: "012",
      refundAccountLast5: "56789",
      refundAccountCiphertext: "ciphertext-source-b",
      refundEncryptionKeyVersion: 5,
      refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
      createdAt: "2026-08-04T00:00:00.000Z",
      createdBy: "member-a",
    };
    const sourceARecord = {
      ...requestRecord,
      id: "cancel-source-a",
      reason: "source A refund",
      status: "approved",
      targetPaymentId: "payment-source-a",
      refundRequestedAmountTwd: 400,
      refundItemAllocations: [{ orderItemId: "item-paid", amountTwd: 400 }],
      refundAmountTwd: 400,
      refundReference: "BANK-A",
      refundAccountCiphertext: "ciphertext-source-a",
      refundEncryptionKeyVersion: 4,
    };
    const noVaultRecord = {
      ...sourceARecord,
      id: "cancel-no-vault",
      status: "rejected",
      targetPaymentId: "payment-unused",
      refundRequestedAmountTwd: 0,
      refundItemAllocations: [],
      refundAmountTwd: undefined,
      refundReference: undefined,
      refundAccountCiphertext: undefined,
      refundEncryptionKeyVersion: undefined,
      refundAccountExpiresAt: undefined,
    };
    let hasStagedWrite = false;
    const transaction = {
      get: vi.fn(async (target: FakeRef | FakeQuery): Promise<unknown> => {
        if (hasStagedWrite) {
          throw new Error("Firestore transactions require all reads before all writes");
        }
        if (target.kind === "query" && target.collection === "orderItems") {
          return { docs: [{ id: "item-paid", ref: refs.item, data: () => ({
            id: "item-paid",
            orderId: "order-paid",
            memberUid: "member-a",
            quantity: 1,
            status: "cancelRequested",
            snapshot: { unitPriceTwd: 1000 },
          }) }] };
        }
        if (target.kind === "query" && target.collection === "paymentRequests") {
          return { docs: [{ id: "request-paid", ref: refs.paymentRequest, data: () => ({
            id: "request-paid",
            memberUid: "member-a",
            orderId: "order-paid",
            amountTwd: 1000,
            status: "paid",
            method: "bankTransfer",
          }) }] };
        }
        if (target.kind === "query" && target.collection === "cancellationRequests") {
          return {
            docs: [
              { id: sourceARecord.id, ref: refs.sourceA, data: () => sourceARecord },
              { id: requestRecord.id, ref: refs.sourceB, data: () => requestRecord },
              { id: noVaultRecord.id, ref: refs.noVault, data: () => noVaultRecord },
            ],
          };
        }
        if (target.kind === "doc" && target.collection === "cancellationRequests") {
          return { exists: true, id: target.id, ref: target, data: () => requestRecord };
        }
        if (target.kind === "doc" && target.collection === "orders") {
          return { exists: true, id: target.id, ref: target, data: () => ({
            id: "order-paid",
            memberUid: "member-a",
            status: "paid",
            totalTwd: 1000,
          }) };
        }
        return { exists: false, data: () => undefined };
      }),
      set: vi.fn((ref: FakeRef, value: Record<string, unknown>, options?: { merge?: boolean }) => {
        if (
          Object.values(value).includes("__DELETE__")
          && !options?.merge
        ) {
          throw new Error("FieldValue.delete() requires update() or set() with merge");
        }
        hasStagedWrite = true;
        writes.push({ operation: "set", ref, value });
      }),
      update: vi.fn((ref: FakeRef, value: Record<string, unknown>) => {
        hasStagedWrite = true;
        writes.push({ operation: "update", ref, value });
      }),
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
      new Request("https://example.test/api/workspace/cancellations/cancel-source-b/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          reviewNote: "refund complete",
          refundAmountTwd: 600,
          refundCompletedAt: "2026-08-04",
          refundReference: "BANK-B",
          refundAccountNumberFull: "client-must-not-send-this",
        }),
      }),
      { params: Promise.resolve({ id: "cancel-source-b" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ orderStatus: "refunded" });
    const cancellationWrites = writes.filter((write) =>
      write.ref.collection === "cancellationRequests");
    expect(cancellationWrites).toHaveLength(2);
    const sourceBWrite = cancellationWrites.find((write) => write.ref.id === "cancel-source-b");
    expect(sourceBWrite?.value).toMatchObject({
      refundAccountCiphertext: "__DELETE__",
      refundEncryptionKeyVersion: "__DELETE__",
      refundAccountExpiresAt: "__DELETE__",
      refundAmountTwd: 600,
      refundCompletedAt: "2026-08-04",
      refundReference: "BANK-B",
    });
    const sourceAWrite = cancellationWrites.find((write) => write.ref.id === "cancel-source-a");
    expect(sourceAWrite?.value).toEqual({
      refundAccountCiphertext: "__DELETE__",
      refundEncryptionKeyVersion: "__DELETE__",
      refundAccountExpiresAt: "__DELETE__",
    });
    expect(cancellationWrites.some((write) => write.ref.id === "cancel-no-vault")).toBe(false);
    expect(JSON.stringify(cancellationWrites)).not.toContain("ciphertext-source-a");
    expect(JSON.stringify(cancellationWrites)).not.toContain("ciphertext-source-b");
    expect(JSON.stringify(writes)).not.toContain("client-must-not-send-this");
  });

  it("strips refund vault fields from the normal member order response", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    const queryResults: Record<string, Array<Record<string, unknown>>> = {
      orderItems: [],
      paymentRequests: [],
      cancellationRequests: [{
        id: "cancel-private",
        orderId: "order-paid",
        orderItemIds: ["item-paid"],
        memberUid: "member-a",
        reason: "paid cancellation",
        status: "pending",
        refundBankCode: "012",
        refundAccountLast5: "56789",
        refundAccountCiphertext: "ciphertext-secret",
        refundEncryptionKeyVersion: 4,
        refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
        createdAt: "2026-08-04T00:00:00.000Z",
        createdBy: "member-a",
      }],
    };
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn((name: string) => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ id: "order-paid", memberUid: "member-a", status: "paid" }),
          }),
        })),
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            docs: (queryResults[name] ?? []).map((data) => ({ data: () => data })),
          }),
        })),
      })),
    });

    const response = await getOrderDetail(
      new Request("https://example.test/api/orders/order-paid"),
      { params: Promise.resolve({ id: "order-paid" }) },
    );

    expect(response.status).toBe(200);
    const payload = JSON.stringify(await response.json());
    expect(payload).toContain("refundAccountLast5");
    expect(payload).not.toContain("refundAccountCiphertext");
    expect(payload).not.toContain("refundEncryptionKeyVersion");
    expect(payload).not.toContain("refundAccountExpiresAt");
    expect(payload).not.toContain("ciphertext-secret");
  });
});
