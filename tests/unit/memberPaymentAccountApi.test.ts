import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireFirebaseUser: vi.fn(),
}));

const firestore = vi.hoisted(() => ({
  getAdminFirestore: vi.fn(),
}));

const kms = vi.hoisted(() => ({
  signCanonicalAccount: vi.fn(),
}));

vi.mock("@/lib/firebase/serverAuth", () => ({
  requireFirebaseUser: auth.requireFirebaseUser,
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: firestore.getAdminFirestore,
}));

vi.mock("@/lib/security/cloudKmsMac", () => ({
  CloudKmsMac: class {
    signCanonicalAccount = kms.signCanonicalAccount;
  },
}));

import { GET, POST } from "@/app/api/member/payment-accounts/route";

type StoredDocument = { id: string; data: Record<string, unknown> };

function documents(records: StoredDocument[]) {
  return {
    docs: records.map((record) => ({
      id: record.id,
      data: () => record.data,
    })),
  };
}

function createRegistrationFirestore(input: {
  existing?: StoredDocument[];
  candidates?: StoredDocument[];
}) {
  const memberQuery = { kind: "member-query" };
  const candidateQuery = { kind: "candidate-query" };
  const accountRef = { id: "account-new" };
  const notificationRef = { id: "notification-new" };
  const set = vi.fn();
  const transaction = {
    get: vi.fn(async (target: unknown) => target === memberQuery
      ? documents(input.existing ?? [])
      : documents(input.candidates ?? [])),
    set,
  };
  const memberPaymentAccounts = {
    where: vi.fn((field: string) => field === "memberUid"
      ? memberQuery
      : { where: vi.fn(() => candidateQuery) }),
    doc: vi.fn(() => accountRef),
  };
  const notificationEvents = { doc: vi.fn(() => notificationRef) };
  const db = {
    collection: vi.fn((name: string) => name === "notificationEvents"
      ? notificationEvents
      : memberPaymentAccounts),
    runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
  };

  return { db, set, accountRef, notificationRef };
}

describe("member payment account API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists only a derived identity and creates a non-blocking Owner duplicate event across key versions", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-new" });
    kms.signCanonicalAccount.mockImplementation(async (_canonical: string, keyVersion?: number) => ({
      mac: keyVersion === 3 ? "b2xk" : "bmV3",
      keyVersion: keyVersion ?? 7,
    }));
    const oldVersionMatch = {
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: "b2xk",
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 3,
      memberUid: "member-old",
      status: "active",
    };
    const sameLast5ButDifferent = {
      ...oldVersionMatch,
      accountFingerprint: "bm90",
      fingerprintKeyVersion: 7,
      memberUid: "member-other",
    };
    const registration = createRegistrationFirestore({
      candidates: [
        { id: "account-old-match", data: oldVersionMatch },
        { id: "account-same-last5", data: sameLast5ButDifferent },
      ],
    });
    firestore.getAdminFirestore.mockReturnValue(registration.db);

    const response = await POST(new Request("https://example.test/api/member/payment-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bankCode: "０１２", accountNumberFull: "0012-345 6789" }),
    }));

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload).toEqual({
      account: {
        id: "account-new",
        bankCode: "012",
        accountNumberMasked: "***56789",
        accountNumberLast5: "56789",
        status: "active",
      },
      warning: "member_payment_account_duplicate_review_pending",
    });
    expect(JSON.stringify(payload)).not.toContain("accountNumberFull");
    expect(JSON.stringify(payload)).not.toContain("accountFingerprint");

    const accountWrite = registration.set.mock.calls.find(([ref]) => ref === registration.accountRef)?.[1];
    expect(accountWrite).toMatchObject({
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: "bmV3",
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
      memberUid: "member-new",
      status: "active",
      createdBy: "member-new",
      updatedBy: "member-new",
    });
    expect(accountWrite).not.toHaveProperty("accountNumberFull");
    expect(accountWrite).not.toHaveProperty("bankName");
    expect(accountWrite).not.toHaveProperty("accountName");

    const eventWrite = registration.set.mock.calls.find(([ref]) => ref === registration.notificationRef)?.[1];
    expect(eventWrite).toMatchObject({
      type: "memberPaymentAccount.exactDuplicate",
      audience: "owner",
      status: "pendingReview",
      payload: {
        accountIds: ["account-old-match", "account-new"],
        accountNumberMasked: "***56789",
      },
      createdBy: "member-new",
      updatedBy: "member-new",
    });
    expect(JSON.stringify(eventWrite)).not.toContain("accountNumberFull");
    expect(JSON.stringify(eventWrite)).not.toContain("accountFingerprint");
    expect(JSON.stringify(eventWrite)).not.toContain("astera:bank-account");
    expect(kms.signCanonicalAccount).toHaveBeenCalledWith(
      "astera:bank-account:v1|012|00123456789",
      3,
    );
    expect(kms.signCanonicalAccount).toHaveBeenCalledWith(
      "astera:bank-account:v1|012|00123456789",
      7,
    );
  });

  it("allows same bank code and last five digits when the full identity differs", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-new" });
    kms.signCanonicalAccount.mockImplementation(async (_canonical: string, keyVersion?: number) => ({
      mac: keyVersion === 3 ? "bmV3" : "bmV3",
      keyVersion: keyVersion ?? 7,
    }));
    const registration = createRegistrationFirestore({
      candidates: [{
        id: "account-same-last5",
        data: {
          bankCode: "012",
          accountNumberLast5: "56789",
          accountFingerprint: "b2xk",
          fingerprintAlgorithm: "HMAC-SHA-256",
          fingerprintKeyVersion: 3,
          memberUid: "member-other",
          status: "active",
        },
      }],
    });
    firestore.getAdminFirestore.mockReturnValue(registration.db);

    const response = await POST(new Request("https://example.test/api/member/payment-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bankCode: "012", accountNumberFull: "00123456789" }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.not.toHaveProperty("warning");
    expect(registration.set.mock.calls.some(([ref]) => ref === registration.notificationRef)).toBe(false);
  });

  it("preserves the five active or pending-deletion account limit", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-full" });
    kms.signCanonicalAccount.mockResolvedValue({ mac: "bmV3", keyVersion: 7 });
    const registration = createRegistrationFirestore({
      existing: Array.from({ length: 5 }, (_, index) => ({
        id: `account-${index}`,
        data: {
          memberUid: "member-full",
          bankCode: "012",
          accountNumberLast5: `0000${index}`,
          accountFingerprint: `fingerprint-${index}`,
          fingerprintAlgorithm: "HMAC-SHA-256",
          fingerprintKeyVersion: 7,
          status: index === 4 ? "pendingDeletion" : "active",
        },
      })),
    });
    firestore.getAdminFirestore.mockReturnValue(registration.db);

    const response = await POST(new Request("https://example.test/api/member/payment-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bankCode: "012", accountNumberFull: "00123456789" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "member_payment_account_limit_reached",
    });
    expect(registration.set).not.toHaveBeenCalled();
  });

  it("returns only masked display data from GET", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(documents([{
            id: "account-a",
            data: {
              memberUid: "member-a",
              bankCode: "012",
              accountNumberLast5: "56789",
              accountFingerprint: "c2VjcmV0LW1hYw==",
              fingerprintAlgorithm: "HMAC-SHA-256",
              fingerprintKeyVersion: 7,
              status: "active",
            },
          }])),
        })),
      })),
    });

    const response = await GET(new Request("https://example.test/api/member/payment-accounts"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      accounts: [{
        id: "account-a",
        bankCode: "012",
        accountNumberMasked: "***56789",
        accountNumberLast5: "56789",
        status: "active",
      }],
    });
    expect(JSON.stringify(payload)).not.toContain("accountFingerprint");
    expect(JSON.stringify(payload)).not.toContain("accountNumberFull");
  });
});
