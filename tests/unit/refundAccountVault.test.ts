import { beforeEach, describe, expect, it, vi } from "vitest";

const kms = vi.hoisted(() => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
}));

const firestore = vi.hoisted(() => ({
  getAdminFirestore: vi.fn(),
}));

const fieldValue = vi.hoisted(() => ({
  delete: vi.fn(() => "__DELETE__"),
}));

vi.mock("@google-cloud/kms", () => ({
  KeyManagementServiceClient: class {
    encrypt = kms.encrypt;
    decrypt = kms.decrypt;
  },
}));

vi.mock("@/lib/firebase/admin", () => firestore);
vi.mock("firebase-admin/firestore", () => ({ FieldValue: fieldValue }));

import {
  deleteRefundAccount,
  expireRefundAccounts,
  readRefundAccountForOwner,
  storeRefundAccount,
} from "@/lib/payment/refundAccountVault";

function snapshot(data: Record<string, unknown>, exists = true) {
  return { exists, data: () => data };
}

describe("refund account vault", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GCP_PROJECT_ID", "astera-test");
    vi.stubEnv(
      "GCP_KMS_REFUND_KEY_NAME",
      "projects/astera-test/locations/asia-east1/keyRings/refunds/cryptoKeys/refund-account",
    );
  });

  it("stores only KMS ciphertext and expiry fields on the cancellation request", async () => {
    const update = vi.fn();
    const requestRef = {
      get: vi.fn().mockResolvedValue(snapshot({ refundBankCode: "012" })),
      update,
    };
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => requestRef) })),
    });
    kms.encrypt.mockResolvedValue([{
      ciphertext: Buffer.from("ciphertext"),
      name: "projects/astera-test/locations/asia-east1/keyRings/refunds/cryptoKeys/refund-account/cryptoKeyVersions/4",
    }]);

    await expect(storeRefundAccount(
      "cancel-1",
      "00123456789",
      "2026-08-18T00:00:00.000Z",
    )).resolves.toEqual({
      encryptionKeyVersion: 4,
      expiresAt: "2026-08-18T00:00:00.000Z",
    });

    expect(kms.encrypt).toHaveBeenCalledWith(expect.objectContaining({
      name: expect.stringContaining("cryptoKeys/refund-account"),
      plaintext: Buffer.from("00123456789"),
      additionalAuthenticatedData: Buffer.from("cancel-1"),
    }));
    expect(update).toHaveBeenCalledWith({
      refundAccountCiphertext: Buffer.from("ciphertext").toString("base64"),
      refundEncryptionKeyVersion: 4,
      refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
    });
    expect(JSON.stringify(update.mock.calls)).not.toContain("00123456789");
  });

  it("decrypts an unexpired account for the protected Owner API", async () => {
    const requestRef = {
      get: vi.fn().mockResolvedValue(snapshot({
        refundBankCode: "012",
        refundAccountCiphertext: Buffer.from("ciphertext").toString("base64"),
        refundEncryptionKeyVersion: 4,
        refundAccountExpiresAt: "2999-08-18T00:00:00.000Z",
      })),
      update: vi.fn(),
    };
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => requestRef) })),
    });
    kms.decrypt.mockResolvedValue([{ plaintext: Buffer.from("00123456789") }]);

    await expect(readRefundAccountForOwner("cancel-1")).resolves.toEqual({
      bankCode: "012",
      accountNumberFull: "00123456789",
      expiresAt: "2999-08-18T00:00:00.000Z",
    });
    expect(kms.decrypt).toHaveBeenCalledWith(expect.objectContaining({
      name: "projects/astera-test/locations/asia-east1/keyRings/refunds/cryptoKeys/refund-account",
      ciphertext: Buffer.from("ciphertext"),
      additionalAuthenticatedData: Buffer.from("cancel-1"),
    }));
  });

  it("fails closed and removes ciphertext when the record has expired", async () => {
    const update = vi.fn();
    const requestRef = {
      get: vi.fn().mockResolvedValue(snapshot({
        refundBankCode: "012",
        refundAccountCiphertext: "Y2lwaGVy",
        refundEncryptionKeyVersion: 4,
        refundAccountExpiresAt: "2020-01-01T00:00:00.000Z",
        status: "pending",
      })),
      update,
    };
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => requestRef) })),
    });

    await expect(readRefundAccountForOwner("cancel-1")).rejects.toThrow("refund_account_expired");
    expect(kms.decrypt).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      refundAccountCiphertext: "__DELETE__",
      refundEncryptionKeyVersion: "__DELETE__",
      refundAccountExpiresAt: "__DELETE__",
      status: "needsReverification",
    }));
  });

  it("deletes one account immediately and expires all due vault entries", async () => {
    const singleUpdate = vi.fn();
    const expiredUpdates = [vi.fn(), vi.fn()];
    const requestRef = { update: singleUpdate };
    const query = {
      get: vi.fn().mockResolvedValue({
        docs: expiredUpdates.map((update, index) => ({
          ref: { id: `expired-${index}`, update },
          data: () => ({ status: "pending" }),
        })),
      }),
    };
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => requestRef),
        where: vi.fn(() => query),
      })),
    });

    await deleteRefundAccount("cancel-1");
    await expect(expireRefundAccounts(new Date("2026-08-19T00:00:00.000Z"))).resolves.toBe(2);

    expect(singleUpdate).toHaveBeenCalledWith(expect.objectContaining({
      refundAccountCiphertext: "__DELETE__",
    }));
    for (const update of expiredUpdates) {
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        refundAccountCiphertext: "__DELETE__",
        status: "needsReverification",
      }));
    }
  });
});
