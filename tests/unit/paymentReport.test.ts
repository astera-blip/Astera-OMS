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
  getPaymentAccountLast5,
} from "../../src/lib/payment/manualBankTransfer";
import type { LocalPayment } from "../../src/lib/payment/manualBankTransfer";
import { POST } from "@/app/api/payments/route";

type StoredPaymentAccount = {
  memberUid: string;
  status: "active" | "inactive" | "pendingDeletion";
  verificationStatus?: "verified" | "needsReverification";
  accountFingerprint: string | undefined;
  fingerprintKeyVersion: number | undefined;
};

function createPaymentReportFirestore(memberAccountOverrides: Partial<StoredPaymentAccount> = {}) {
  let paymentSequence = 0;
  const set = vi.fn();
  const transaction = {
    get: vi.fn(async (ref: { collection: string; id: string }) => {
      if (ref.collection === "paymentRequests") {
        return {
          exists: true,
          id: ref.id,
          data: () => ({
            memberUid: "member-a",
            status: "open",
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
            accountFingerprint: "c2VydmVyLWZpbmdlcnByaW50",
            fingerprintAlgorithm: "HMAC-SHA-256",
            fingerprintKeyVersion: 7,
            status: "active",
            ...memberAccountOverrides,
          }),
        };
      }
      throw new Error(`unexpected_collection:${ref.collection}`);
    }),
    set,
  };
  const db = {
    collection: vi.fn((collection: string) => ({
      doc: vi.fn((id?: string) => ({
        collection,
        id: id ?? `payment-${++paymentSequence}`,
      })),
    })),
    runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
  };

  return { db, set };
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
      payerName: "Member A",
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
  it("ignores the client transfer last five and persists only the selected account snapshot identity", async () => {
    const reporting = createPaymentReportFirestore();
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const response = await POST(paymentReportRequest({
      transferAccountLast5: "00000",
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
        accountFingerprint: "c2VydmVyLWZpbmdlcnByaW50",
        fingerprintKeyVersion: 7,
      },
      manualFingerprintReviewRequired: false,
    });
    expect(paymentWrite.memberPaymentAccount).toEqual({
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: "c2VydmVyLWZpbmdlcnByaW50",
      fingerprintKeyVersion: 7,
    });
    expect(paymentWrite).not.toHaveProperty("transferAccountLast5");
  });

  it("creates a manual-review payment for an active legacy account without a usable fingerprint", async () => {
    const reporting = createPaymentReportFirestore({
      accountFingerprint: undefined,
      fingerprintKeyVersion: 0,
    });
    firestore.getAdminFirestore.mockReturnValue(reporting.db);

    const response = await POST(paymentReportRequest());

    expect(response.status).toBe(200);
    const paymentWrite = reporting.set.mock.calls[0]?.[1];
    expect(paymentWrite).toMatchObject({
      memberPaymentAccountId: "member-account-1",
      memberPaymentAccount: {
        bankCode: "012",
        accountNumberLast5: "56789",
      },
      manualFingerprintReviewRequired: true,
    });
    expect(paymentWrite.memberPaymentAccount).not.toHaveProperty("accountFingerprint");
    expect(paymentWrite.memberPaymentAccount).not.toHaveProperty("fingerprintKeyVersion");
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
});
