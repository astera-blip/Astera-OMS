import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireFirebaseUser: vi.fn() }));
const firestore = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));

vi.mock("@/lib/firebase/serverAuth", () => ({
  requireFirebaseUser: auth.requireFirebaseUser,
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: firestore.getAdminFirestore,
}));

import { POST } from "@/app/api/member/payment-accounts/[id]/payer-name/route";

const validFingerprint = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

type AccountOverrides = {
  exists?: boolean;
  memberUid?: string;
  payerName?: string;
};

function createFirestore(overrides: AccountOverrides = {}) {
  const accountRef = { id: "account-a" };
  const update = vi.fn();
  const transaction = {
    get: vi.fn().mockResolvedValue({
      exists: overrides.exists ?? true,
      id: "account-a",
      data: () => ({
        memberUid: overrides.memberUid ?? "member-a",
        bankCode: "012",
        accountNumberLast5: "56789",
        accountFingerprint: validFingerprint,
        fingerprintAlgorithm: "HMAC-SHA-256",
        fingerprintKeyVersion: 7,
        status: "active",
        verificationStatus: "verified",
        ...(overrides.payerName === undefined ? {} : { payerName: overrides.payerName }),
      }),
    }),
    update,
  };
  const db = {
    collection: vi.fn(() => ({ doc: vi.fn(() => accountRef) })),
    runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
  };
  return { db, accountRef, update };
}

function request(payerName: unknown) {
  return new Request("https://example.test/api/member/payment-accounts/account-a/payer-name", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payerName }),
  });
}

const context = { params: Promise.resolve({ id: "account-a" }) };

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
});

describe("member payment account payer-name completion API", () => {
  it("lets the owning member complete a missing payer name exactly once", async () => {
    const setup = createFirestore();
    firestore.getAdminFirestore.mockReturnValue(setup.db);

    const response = await POST(request("  王小明  "), context);

    expect(response.status).toBe(200);
    expect(setup.update).toHaveBeenCalledWith(setup.accountRef, {
      payerName: "王小明",
      updatedAt: expect.anything(),
      updatedBy: "member-a",
    });
    const updatePayload = setup.update.mock.calls[0]?.[1];
    expect(updatePayload).not.toHaveProperty("bankCode");
    expect(updatePayload).not.toHaveProperty("accountNumberLast5");
    expect(updatePayload).not.toHaveProperty("accountFingerprint");
    expect(updatePayload).not.toHaveProperty("fingerprintKeyVersion");
    expect(updatePayload).not.toHaveProperty("memberUid");
    await expect(response.json()).resolves.toEqual({
      account: {
        id: "account-a",
        bankCode: "012",
        accountNumberMasked: "***56789",
        accountNumberLast5: "56789",
        payerName: "王小明",
        needsPayerName: false,
        status: "active",
        verificationStatus: "verified",
      },
    });
  });

  it("uses the same not-found response for a missing or cross-member account", async () => {
    for (const overrides of [
      { exists: false },
      { memberUid: "member-b" },
    ]) {
      const setup = createFirestore(overrides);
      firestore.getAdminFirestore.mockReturnValue(setup.db);
      const response = await POST(request("王小明"), context);
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: "member_payment_account_not_found",
      });
      expect(setup.update).not.toHaveBeenCalled();
    }
  });

  it("refuses to overwrite an existing payer name", async () => {
    const setup = createFirestore({ payerName: "原匯款人" });
    firestore.getAdminFirestore.mockReturnValue(setup.db);

    const response = await POST(request("新匯款人"), context);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "member_payment_account_payer_name_already_set",
    });
    expect(setup.update).not.toHaveBeenCalled();
  });

  it.each(["", "王\n小明"])("rejects invalid payer name input: %s", async (payerName) => {
    const setup = createFirestore();
    firestore.getAdminFirestore.mockReturnValue(setup.db);

    const response = await POST(request(payerName), context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "member_payment_account_payer_name_invalid",
    });
    expect(setup.update).not.toHaveBeenCalled();
  });
});
