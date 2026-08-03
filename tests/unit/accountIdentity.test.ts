import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  deriveAccountIdentity,
  normalizeAccountNumber,
  normalizeBankCode,
  verifyAccountIdentity,
  type CloudKmsMacClient,
} from "@/lib/payment/accountIdentity";

const fakeMacClient = (latestKeyVersion = 9): CloudKmsMacClient => ({
  async signCanonicalAccount(canonical, keyVersion) {
    const version = keyVersion ?? latestKeyVersion;
    return {
      mac: createHmac("sha256", `test-key-version-${version}`).update(canonical).digest("base64"),
      keyVersion: version,
    };
  },
});

describe("bank account identity", () => {
  it("preserves leading zeros and removes only spaces and hyphens", () => {
    expect(normalizeAccountNumber("００１２-３４ ５６７８９")).toBe("00123456789");
  });

  it("rejects letters and unsupported punctuation", () => {
    expect(() => normalizeAccountNumber("00123/456789")).toThrow("invalid_account_number");
  });

  it("rejects compatibility digits other than full-width digits", () => {
    expect(() => normalizeAccountNumber("¹23456789")).toThrow("invalid_account_number");
  });

  it("requires exactly three ASCII digits for the bank code", () => {
    expect(normalizeBankCode(" ０１２ ")).toBe("012");
    expect(() => normalizeBankCode("12")).toThrow("invalid_bank_code");
  });

  it("rejects account numbers outside the 8 to 20 digit business range", () => {
    expect(() => normalizeAccountNumber("1234567")).toThrow("invalid_account_number");
    expect(() => normalizeAccountNumber("123456789012345678901")).toThrow("invalid_account_number");
  });

  it("derives the fingerprint from the exact canonical input using the latest configured key version", async () => {
    const calls: Array<{ canonical: string; keyVersion: number | undefined }> = [];
    const client: CloudKmsMacClient = {
      async signCanonicalAccount(canonical, keyVersion) {
        calls.push({ canonical, keyVersion });
        return { mac: "fingerprint-base64", keyVersion: 7 };
      },
    };

    await expect(deriveAccountIdentity({ bankCode: "０１２", accountNumber: "００１２-３４ ５６７８９" }, client)).resolves.toEqual({
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: "fingerprint-base64",
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
    });
    expect(calls).toEqual([{ canonical: "astera:bank-account:v1|012|00123456789", keyVersion: undefined }]);
  });

  it("verifies with the payment snapshot key version without mutating the expected record", async () => {
    const expected = {
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: "wrong-fingerprint",
      fingerprintAlgorithm: "HMAC-SHA-256" as const,
      fingerprintKeyVersion: 3,
    };
    const before = structuredClone(expected);
    const calls: Array<{ canonical: string; keyVersion: number | undefined }> = [];
    const client: CloudKmsMacClient = {
      async signCanonicalAccount(canonical, keyVersion) {
        calls.push({ canonical, keyVersion });
        return { mac: "matching-fingerprint", keyVersion: keyVersion ?? 0 };
      },
    };

    await expect(verifyAccountIdentity({ bankCode: "012", accountNumber: "00123456789" }, expected, client)).resolves.toBe(false);
    expect(calls).toEqual([{ canonical: "astera:bank-account:v1|012|00123456789", keyVersion: 3 }]);
    expect(expected).toEqual(before);
  });

  it("accepts a matching HMAC fingerprint", async () => {
    const client = fakeMacClient(9);
    const identity = await deriveAccountIdentity({ bankCode: "012", accountNumber: "00123456789" }, client);

    await expect(verifyAccountIdentity({ bankCode: "012", accountNumber: "00123456789" }, identity, client)).resolves.toBe(true);
  });
});
