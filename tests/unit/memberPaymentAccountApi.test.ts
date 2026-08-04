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
import { POST as requestDeletion } from "@/app/api/member/payment-accounts/[id]/deletion-request/route";

type StoredDocument = { id: string; data: Record<string, unknown> };
const oldVersionFingerprint = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";
const currentFingerprint = "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=";
const differentFingerprint = "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=";

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
  let notificationSequence = 0;
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
  const notificationEvents = {
    doc: vi.fn(() => ({ id: `notification-${++notificationSequence}` })),
  };
  const db = {
    collection: vi.fn((name: string) => name === "notificationEvents"
      ? notificationEvents
      : memberPaymentAccounts),
    runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
  };

  return { db, set, accountRef };
}

describe("member payment account API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists only a derived identity and creates a non-blocking Owner duplicate event across key versions", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-new" });
    kms.signCanonicalAccount.mockImplementation(async (_canonical: string, keyVersion?: number) => ({
      mac: keyVersion === 3 ? oldVersionFingerprint : currentFingerprint,
      keyVersion: keyVersion ?? 7,
    }));
    const oldVersionMatch = {
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: oldVersionFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 3,
      memberUid: "member-old",
      status: "active",
    };
    const sameLast5ButDifferent = {
      ...oldVersionMatch,
      accountFingerprint: differentFingerprint,
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
        verificationStatus: "verified",
      },
      warning: "member_payment_account_duplicate_review_pending",
    });
    expect(JSON.stringify(payload)).not.toContain("accountNumberFull");
    expect(JSON.stringify(payload)).not.toContain("accountFingerprint");

    const accountWrite = registration.set.mock.calls.find(([ref]) => ref === registration.accountRef)?.[1];
    expect(accountWrite).toMatchObject({
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: currentFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
      memberUid: "member-new",
      status: "active",
      verificationStatus: "verified",
      createdBy: "member-new",
      updatedBy: "member-new",
    });
    expect(accountWrite).not.toHaveProperty("accountNumberFull");
    expect(accountWrite).not.toHaveProperty("bankName");
    expect(accountWrite).not.toHaveProperty("accountName");

    const eventWrite = registration.set.mock.calls.find(([, value]) => (
      value as { type?: string }
    ).type === "memberPaymentAccount.exactDuplicate")?.[1];
    expect(eventWrite).toMatchObject({
      type: "memberPaymentAccount.exactDuplicate",
      audience: "owner",
      status: "pendingReview",
      payload: {
        accountIds: ["account-old-match", "account-new"],
        bankCode: "012",
        accountNumberLast5: "56789",
      },
      createdBy: "member-new",
      updatedBy: "member-new",
    });
    expect(JSON.stringify(eventWrite)).not.toContain("accountNumberFull");
    expect(JSON.stringify(eventWrite)).not.toContain("accountFingerprint");
    expect(JSON.stringify(eventWrite)).not.toContain("astera:bank-account");
    const collisionEventWrite = registration.set.mock.calls.find(([, value]) => (
      value as { type?: string }
    ).type === "memberPaymentAccount.last5Collision")?.[1];
    expect(collisionEventWrite).toMatchObject({
      audience: "owner",
      status: "pendingReview",
      payload: {
        accountIds: ["account-same-last5", "account-new"],
        bankCode: "012",
        accountNumberLast5: "56789",
      },
    });
    expect(JSON.stringify(collisionEventWrite)).not.toContain("accountNumberFull");
    expect(JSON.stringify(collisionEventWrite)).not.toContain("accountFingerprint");
    expect(JSON.stringify(collisionEventWrite)).not.toContain("astera:bank-account");
    expect(kms.signCanonicalAccount).toHaveBeenCalledWith(
      "astera:bank-account:v1|012|00123456789",
      3,
    );
    expect(kms.signCanonicalAccount).toHaveBeenCalledWith(
      "astera:bank-account:v1|012|00123456789",
      7,
    );
  });

  it("allows a last-five collision and creates a non-blocking Owner review event", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-new" });
    kms.signCanonicalAccount.mockImplementation(async (_canonical: string, keyVersion?: number) => ({
      mac: currentFingerprint,
      keyVersion: keyVersion ?? 7,
    }));
    const registration = createRegistrationFirestore({
      candidates: [{
        id: "account-same-last5",
        data: {
          bankCode: "012",
          accountNumberLast5: "56789",
          accountFingerprint: oldVersionFingerprint,
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
    await expect(response.json()).resolves.toMatchObject({
      warning: "member_payment_account_duplicate_review_pending",
    });
    const collisionEventWrite = registration.set.mock.calls.find(([, value]) => (
      value as { type?: string }
    ).type === "memberPaymentAccount.last5Collision")?.[1];
    expect(collisionEventWrite).toMatchObject({
      audience: "owner",
      status: "pendingReview",
      payload: {
        accountIds: ["account-same-last5", "account-new"],
        bankCode: "012",
        accountNumberLast5: "56789",
      },
    });
    expect(JSON.stringify(collisionEventWrite)).not.toContain("accountNumberFull");
    expect(JSON.stringify(collisionEventWrite)).not.toContain("accountFingerprint");
    expect(JSON.stringify(collisionEventWrite)).not.toContain("astera:bank-account");
  });

  it("preserves the five active or pending-deletion account limit", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-full" });
    kms.signCanonicalAccount.mockResolvedValue({ mac: currentFingerprint, keyVersion: 7 });
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
              accountFingerprint: currentFingerprint,
              fingerprintAlgorithm: "HMAC-SHA-256",
              fingerprintKeyVersion: 7,
              status: "active",
              verificationStatus: "verified",
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
        verificationStatus: "verified",
      }],
    });
    expect(JSON.stringify(payload)).not.toContain("accountFingerprint");
    expect(JSON.stringify(payload)).not.toContain("accountNumberFull");
  });

  it("lets the owning member request deletion and returns a masked pending snapshot", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    const update = vi.fn();
    const accountRef = { id: "account-a" };
    const transaction = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "account-a",
        data: () => ({
          memberUid: "member-a",
          bankCode: "012",
          accountNumberLast5: "56789",
          accountFingerprint: currentFingerprint,
          fingerprintAlgorithm: "HMAC-SHA-256",
          fingerprintKeyVersion: 7,
          status: "active",
          verificationStatus: "verified",
        }),
      }),
      update,
    };
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => accountRef) })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    });

    const response = await requestDeletion(
      new Request("https://example.test/api/member/payment-accounts/account-a/deletion-request", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "account-a" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      account: {
        id: "account-a",
        bankCode: "012",
        accountNumberMasked: "***56789",
        accountNumberLast5: "56789",
        status: "pendingDeletion",
        verificationStatus: "verified",
      },
    });
    expect(update).toHaveBeenCalledWith(accountRef, expect.objectContaining({
      status: "pendingDeletion",
      deletionRequestedBy: "member-a",
      updatedBy: "member-a",
    }));
  });
});
