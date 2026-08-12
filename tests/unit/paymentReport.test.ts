import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireFirebaseUser: vi.fn(),
}));

const firestore = vi.hoisted(() => ({
  getAdminFirestore: vi.fn(),
}));

vi.mock("@/lib/firebase/serverAuth", () => ({
  requireFirebaseUser: auth.requireFirebaseUser,
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: firestore.getAdminFirestore,
}));

import {
  allocatePaymentReportAmount,
  buildMemberPaymentAccountIdentitySnapshot,
  getPaymentAccountLast5,
} from "../../src/lib/payment/manualBankTransfer";
import type { LocalPayment } from "../../src/lib/payment/manualBankTransfer";
import { POST } from "@/app/api/payments/route";

type StoredPaymentAccount = {
  memberUid: string;
  status: "active" | "inactive" | "pendingDeletion";
  verificationStatus?: "verified" | "needsReverification";
  accountFingerprint: string | undefined;
  fingerprintAlgorithm: "HMAC-SHA-256" | string | undefined;
  fingerprintKeyVersion: number | undefined;
  payerName?: string;
};

const validFingerprint = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

function createPaymentReportFirestore(memberAccountOverrides: Partial<StoredPaymentAccount> = {}) {
  const storedPayments = new Map<string, Record<string, unknown>>();
  let paymentRequestStatus = "open";
  let transactionQueue = Promise.resolve<unknown>(undefined);
  const set = vi.fn((ref: { collection: string; id: string }, value: Record<string, unknown>) => {
    if (ref.collection === "payments") {
      storedPayments.set(ref.id, value);
    }
  });
  const transaction = {
    get: vi.fn(async (ref: { collection: string; id?: string; kind?: string; filters?: Array<[string, unknown]> }) => {
      if (ref.kind === "query") {
        const docs = [...storedPayments.entries()]
          .filter(([, value]) => ref.filters?.every(([field, expected]) => value[field] === expected))
          .map(([id, value]) => ({ id, exists: true, data: () => value }));
        return { empty: docs.length === 0, docs };
      }
      if (ref.collection === "paymentRequests") {
        return {
          exists: true,
          id: ref.id,
          data: () => ({
            memberUid: "member-a",
            status: paymentRequestStatus,
            amountTwd: 520,
            allocatedAmountTwd: 0,
          }),
        };
      }
      if (ref.collection === "paymentAccounts") {
        return {
          exists: true,
          id: ref.id,
          data: () => ({
            bankName: "Astera Bank",
            accountName: "Astera OMS",
            accountNumberLast5: "99999",
            currency: "TWD",
            status: "active",
            verificationStatus: "verified",
          }),
        };
      }
      if (ref.collection === "memberPaymentAccounts") {
        return {
          exists: true,
          id: ref.id,
          data: () => ({
            memberUid: "member-a",
            bankCode: "012",
            accountNumberLast5: "56789",
            accountFingerprint: validFingerprint,
            fingerprintAlgorithm: "HMAC-SHA-256",
            fingerprintKeyVersion: 7,
            payerName: "王小明",
            status: "active",
            verificationStatus: "verified",
            ...memberAccountOverrides,
          }),
        };
      }
      if (ref.collection === "payments") {
        const value = storedPayments.get(ref.id ?? "");
        return {
          exists: Boolean(value),
          id: ref.id,
          data: () => value,
        };
      }
      throw new Error(`unexpected_collection:${ref.collection}`);
    }),
    set,
    update: vi.fn(),
  };
  const db = {
    collection: vi.fn((collection: string) => {
      const filters: Array<[string, unknown]> = [];
      const query = {
        collection,
        kind: "query",
        filters,
        where: vi.fn((field: string, _operator: string, value: unknown) => {
          filters.push([field, value]);
          return query;
        }),
        limit: vi.fn(() => query),
      };
      return {
        ...query,
        doc: vi.fn((id?: string) => ({
        collection,
        id: id ?? "unexpected-random-payment-id",
        })),
      };
    }),
    runTransaction: vi.fn((callback: (value: typeof transaction) => unknown) => {
      const result = transactionQueue.then(() => callback(transaction));
      transactionQueue = result.then(() => undefined, () => undefined);
      return result;
    }),
  };

  return {
    db,
    set,
    update: transaction.update,
    storedPayments,
    setPaymentRequestStatus(status: string) {
      paymentRequestStatus = status;
    },
  };
}

function paymentReportRequest(extra: Record<string, unknown> = {}) {
  return new Request("https://example.test/api/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      paymentRequestId: "payment-request-1",
      receivedAt: "2026-08-03",
      receivedAmountTwd: 520,
      receivingPaymentAccountId: "astera-account-1",
      memberPaymentAccountId: "member-account-1",
      idempotencyKey: "pay_12345678-1234-4234-9234-123456789abc",
      ...extra,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
});

describe("allocatePaymentReportAmount", () => {
  it("distributes one transfer across two selected payment requests", () => {
    expect(allocatePaymentReportAmount(1760, [
      { id: "pr-a", amountTwd: 880 },
      { id: "pr-b", amountTwd: 880 },
    ])).toEqual([
      { paymentRequestId: "pr-a", receivedAmountTwd: 880 },
      { paymentRequestId: "pr-b", receivedAmountTwd: 880 },
    ]);
  });

  it("uses remaining balances when a selected request was partially paid", () => {
    expect(allocatePaymentReportAmount(1000, [
      { id: "pr-a", amountTwd: 880, allocatedAmountTwd: 500 },
      { id: "pr-b", amountTwd: 880 },
    ])).toEqual([
      { paymentRequestId: "pr-a", receivedAmountTwd: 380 },
      { paymentRequestId: "pr-b", receivedAmountTwd: 620 },
    ]);
  });
});

describe("Owner payment account display", () => {
  it("reads the last five from a new server-authoritative member account snapshot", () => {
    const payment = {
      memberPaymentAccount: {
        bankCode: "012",
        accountNumberLast5: "56789",
        accountFingerprint: "fingerprint",
        fingerprintKeyVersion: 7,
      },
    } as LocalPayment;

    expect(getPaymentAccountLast5(payment)).toBe("56789");
  });

  it("falls back to the legacy top-level last five for historical payments", () => {
    const historicalPayment = {
      transferAccountLast5: "54321",
    } as LocalPayment;

    expect(getPaymentAccountLast5(historicalPayment)).toBe("54321");
  });
});

describe("payment report member account snapshot", () => {
  it("returns the original payment without writing again for an identical replay", async () => {
    const reporting = createPaymentReportFirestore();
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const firstResponse = await POST(paymentReportRequest());
    const firstPayload = await firstResponse.json();
    const writeCount = reporting.set.mock.calls.length;
    const replayResponse = await POST(paymentReportRequest());
    const replayPayload = await replayResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(replayResponse.status).toBe(200);
    expect(replayPayload).toMatchObject({
      alreadyExists: true,
      paymentGroupId: firstPayload.paymentGroupId,
    });
    expect(replayPayload.payments[0].id).toBe(firstPayload.payments[0].id);
    expect(reporting.set).toHaveBeenCalledTimes(writeCount);
  });

  it("returns the original replay even after Owner confirmation closes the request", async () => {
    const reporting = createPaymentReportFirestore();
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const firstResponse = await POST(paymentReportRequest());
    const firstPayload = await firstResponse.json();
    reporting.setPaymentRequestStatus("paid");
    const replayResponse = await POST(paymentReportRequest());

    expect(firstResponse.status).toBe(200);
    expect(replayResponse.status).toBe(200);
    await expect(replayResponse.json()).resolves.toMatchObject({
      alreadyExists: true,
      paymentGroupId: firstPayload.paymentGroupId,
      payment: { id: firstPayload.payment.id },
    });
  });

  it("replays a multi-request report when the amount only created the first allocation", async () => {
    const reporting = createPaymentReportFirestore();
    firestore.getAdminFirestore.mockReturnValue(reporting.db);
    const partialMultiRequest = {
      paymentRequestId: undefined,
      paymentRequestIds: ["payment-request-1", "payment-request-2"],
      receivedAmountTwd: 520,
    };

    const firstResponse = await POST(paymentReportRequest(partialMultiRequest));
    const firstPayload = await firstResponse.json();
    const replayResponse = await POST(paymentReportRequest(partialMultiRequest));

    expect(firstResponse.status).toBe(200);
    expect(firstPayload.payments).toHaveLength(1);
    expect(replayResponse.status).toBe(200);
    await expect(replayResponse.json()).resolves.toMatchObject({
      alreadyExists: true,
      paymentGroupId: firstPayload.paymentGroupId,
      payments: [{ id: firstPayload.payments[0].id }],
    });
  });

  it("serializes concurrent identical reports to one deterministic payment", async () => {
    const reporting = createPaymentReportFirestore();
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const [first, replay] = await Promise.all([
      POST(paymentReportRequest()),
      POST(paymentReportRequest()),
    ]);
    const [firstPayload, replayPayload] = await Promise.all([first.json(), replay.json()]);

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect([firstPayload.alreadyExists, replayPayload.alreadyExists].sort()).toEqual([false, true]);
    expect(firstPayload.paymentGroupId).toBe(replayPayload.paymentGroupId);
    expect(reporting.storedPayments.size).toBe(1);
    expect(reporting.set).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when the same idempotency key is reused with a different immutable payload", async () => {
    const reporting = createPaymentReportFirestore();
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    expect((await POST(paymentReportRequest())).status).toBe(200);
    const conflict = await POST(paymentReportRequest({ receivedAmountTwd: 519 }));

    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({ error: "idempotency_conflict" });
  });

  it("rejects another report while the selected request already has a pending review", async () => {
    const reporting = createPaymentReportFirestore();
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const first = await POST(paymentReportRequest());
    const second = await POST(paymentReportRequest({
      idempotencyKey: "pay_87654321-4321-4321-9234-cba987654321",
    }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toEqual({ error: "payment_report_pending_review" });
  });

  it("writes a stable payment-request contention marker with a new report", async () => {
    const reporting = createPaymentReportFirestore();
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const response = await POST(paymentReportRequest());

    expect(response.status).toBe(200);
    expect(reporting.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "paymentRequests", id: "payment-request-1" }),
      expect.objectContaining({ latestReportBy: "member-a" }),
    );
  });

  it("requires a valid idempotency key", async () => {
    const reporting = createPaymentReportFirestore();
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const response = await POST(paymentReportRequest({ idempotencyKey: "" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_idempotency_key" });
    expect(reporting.set).not.toHaveBeenCalled();
  });

  it("copies the stored payer name into the immutable member account snapshot", () => {
    expect(buildMemberPaymentAccountIdentitySnapshot({
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: validFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
      payerName: "王小明",
    })).toEqual({
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: validFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
      payerName: "王小明",
    });
  });

  it("ignores the client transfer last five and persists only the selected account snapshot identity", async () => {
    const reporting = createPaymentReportFirestore();
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const response = await POST(paymentReportRequest({
      transferAccountLast5: "00000",
      payerName: "偽造匯款人",
      bankCode: "999",
      accountNumberLast5: "00000",
      accountFingerprint: "Y2xpZW50LWZpbmdlcnByaW50",
      fingerprintKeyVersion: 99,
      memberPaymentAccount: {
        bankCode: "999",
        accountNumberLast5: "00000",
        accountFingerprint: "Y2xpZW50LWZpbmdlcnByaW50",
        fingerprintKeyVersion: 99,
      },
    }));

    expect(response.status).toBe(200);
    const paymentWrite = reporting.set.mock.calls[0]?.[1];
    expect(paymentWrite).toMatchObject({
      memberPaymentAccountId: "member-account-1",
      memberPaymentAccount: {
        bankCode: "012",
        accountNumberLast5: "56789",
        accountFingerprint: validFingerprint,
        fingerprintAlgorithm: "HMAC-SHA-256",
        fingerprintKeyVersion: 7,
        payerName: "王小明",
      },
      manualFingerprintReviewRequired: false,
      payerName: "王小明",
    });
    expect(paymentWrite.memberPaymentAccount).toEqual({
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: validFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
      payerName: "王小明",
    });
    expect(paymentWrite).not.toHaveProperty("transferAccountLast5");
  });

  it("rejects an active legacy account without a usable fingerprint", async () => {
    const reporting = createPaymentReportFirestore({
      accountFingerprint: undefined,
      fingerprintKeyVersion: 0,
    });
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const response = await POST(paymentReportRequest());

    expect(response.status).toBe(400);
    expect(reporting.set).not.toHaveBeenCalled();
  });

  it("rejects an otherwise verified legacy account without a payer name", async () => {
    const reporting = createPaymentReportFirestore({ payerName: undefined });
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const response = await POST(paymentReportRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "payment_account_member_payer_name_required",
    });
    expect(reporting.set).not.toHaveBeenCalled();
  });

  it("rejects another member's selected account without creating a payment", async () => {
    const reporting = createPaymentReportFirestore({ memberUid: "member-b" });
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const response = await POST(paymentReportRequest());

    expect(response.status).toBe(403);
    expect(reporting.set).not.toHaveBeenCalled();
  });

  it("rejects an inactive selected member account without creating a payment", async () => {
    const reporting = createPaymentReportFirestore({ status: "inactive" });
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const response = await POST(paymentReportRequest());

    expect(response.status).toBe(400);
    expect(reporting.set).not.toHaveBeenCalled();
  });

  it("rejects an active account that requires identity re-verification", async () => {
    const reporting = createPaymentReportFirestore({
      verificationStatus: "needsReverification",
    });
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const response = await POST(paymentReportRequest());

    expect(response.status).toBe(400);
    expect(reporting.set).not.toHaveBeenCalled();
  });

  it("rejects an active account with an unknown verification state", async () => {
    const reporting = createPaymentReportFirestore({
      verificationStatus: "unknown" as never,
    });
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const response = await POST(paymentReportRequest());

    expect(response.status).toBe(400);
    expect(reporting.set).not.toHaveBeenCalled();
  });

  it("rejects an explicitly verified account with malformed fingerprint bytes", async () => {
    const reporting = createPaymentReportFirestore({
      accountFingerprint: "not-canonical-base64",
    });
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const response = await POST(paymentReportRequest());

    expect(response.status).toBe(400);
    expect(reporting.set).not.toHaveBeenCalled();
  });
});
