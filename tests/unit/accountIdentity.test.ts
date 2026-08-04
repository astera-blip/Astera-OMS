import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  deriveAccountIdentity,
  normalizeAccountNumber,
  normalizeBankCode,
  verifyAccountIdentity,
  type CloudKmsMacClient,
} from "@/lib/payment/accountIdentity";

const validFingerprint = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";
const differentValidFingerprint = "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=";

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

  it("trims only surrounding bank-code whitespace and rejects embedded separators", () => {
    expect(normalizeBankCode(" ０１２ ")).toBe("012");
    expect(() => normalizeBankCode("0 12")).toThrow("invalid_bank_code");
    expect(() => normalizeBankCode("0-12")).toThrow("invalid_bank_code");
    expect(() => normalizeBankCode("0/12")).toThrow("invalid_bank_code");
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
        return { mac: validFingerprint, keyVersion: 7 };
      },
    };

    await expect(deriveAccountIdentity({ bankCode: "０１２", accountNumber: "００１２-３４ ５６７８９" }, client)).resolves.toEqual({
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: validFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
    });
    expect(calls).toEqual([{ canonical: "astera:bank-account:v1|012|00123456789", keyVersion: undefined }]);
  });

  it.each([
    ["malformed Base64", "not-base64", 7],
    ["wrong decoded length", "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ==", 7],
    ["invalid key version", validFingerprint, 0],
  ])("rejects a derived identity with %s", async (_label, mac, keyVersion) => {
    const client: CloudKmsMacClient = {
      async signCanonicalAccount() {
        return { mac, keyVersion };
      },
    };

    await expect(deriveAccountIdentity(
      { bankCode: "012", accountNumber: "00123456789" },
      client,
    )).rejects.toThrow("invalid_account_fingerprint");
  });

  it("rejects a malformed expected identity before signing", async () => {
    const client: CloudKmsMacClient = {
      signCanonicalAccount: vi.fn(),
    };

    await expect(verifyAccountIdentity({
      bankCode: "012",
      accountNumber: "00123456789",
    }, {
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: "not-base64",
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 3,
    }, client)).resolves.toBe(false);
    expect(client.signCanonicalAccount).not.toHaveBeenCalled();
  });

  it("verifies with the payment snapshot key version without mutating the expected record", async () => {
    const expected = {
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: validFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256" as const,
      fingerprintKeyVersion: 3,
    };
    const before = structuredClone(expected);
    const calls: Array<{ canonical: string; keyVersion: number | undefined }> = [];
    const client: CloudKmsMacClient = {
      async signCanonicalAccount(canonical, keyVersion) {
        calls.push({ canonical, keyVersion });
        return { mac: differentValidFingerprint, keyVersion: keyVersion ?? 0 };
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
