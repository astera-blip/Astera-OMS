import { describe, expect, it } from "vitest";
import { isUsableFingerprintIdentity } from "@/lib/payment/fingerprintIdentity.mjs";

const validFingerprint = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

describe("usable fingerprint identity", () => {
  it("accepts only canonical Base64 that decodes to a 32-byte HMAC-SHA-256 value", () => {
    expect(isUsableFingerprintIdentity({
      accountFingerprint: validFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
    })).toBe(true);
  });

  it.each([
    ["malformed Base64", "*".repeat(44)],
    ["wrong decoded length", "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ=="],
    ["surrounding whitespace", ` ${validFingerprint}`],
    ["noncanonical pad bits", `${validFingerprint.slice(0, -2)}B=`],
  ])("rejects %s", (_label, accountFingerprint) => {
    expect(isUsableFingerprintIdentity({
      accountFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
    })).toBe(false);
  });

  it("rejects a wrong algorithm or non-positive key version", () => {
    expect(isUsableFingerprintIdentity({
      accountFingerprint: validFingerprint,
      fingerprintAlgorithm: "SHA-256",
      fingerprintKeyVersion: 7,
    })).toBe(false);
    expect(isUsableFingerprintIdentity({
      accountFingerprint: validFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 0,
    })).toBe(false);
  });
});
