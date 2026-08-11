import { describe, expect, it } from "vitest";
import {
  buildMemberPaymentAccountSnapshot,
  isMemberPaymentAccountUsableForPayment,
  maskMemberAccountNumber,
  normalizeMemberPaymentAccount,
  normalizeMemberPaymentAccountInput,
  normalizeMemberPaymentAccountPayerName,
  validateMemberPaymentAccountInput,
} from "@/lib/payment/memberBankAccounts";

const validFingerprint = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

describe("member payment accounts", () => {
  it("accepts only a bank code and normalized full account as transient request data", () => {
    expect(validateMemberPaymentAccountInput({
      bankCode: " ０１２ ",
      accountNumberFull: "００１２-３４ ５６７８９",
      payerName: "  王 小明  ",
    })).toEqual({
      ok: true,
      value: {
        bankCode: "012",
        accountNumberFull: "00123456789",
        payerName: "王 小明",
      },
    });

    expect(normalizeMemberPaymentAccountInput({
      bankCode: "012",
      accountNumberFull: "0012-345 6789",
      payerName: "  王 小明  ",
    })).toEqual({
      bankCode: "012",
      accountNumberFull: "00123456789",
      payerName: "王 小明",
    });
  });

  it("normalizes a payer name by Unicode code points and rejects unsafe values", () => {
    expect(normalizeMemberPaymentAccountPayerName("  王 小明  ")).toBe("王 小明");
    expect(Array.from(normalizeMemberPaymentAccountPayerName("𠮷".repeat(80)))).toHaveLength(80);
    expect(() => normalizeMemberPaymentAccountPayerName("𠮷".repeat(81))).toThrow("invalid_payer_name");
    expect(() => normalizeMemberPaymentAccountPayerName(" ")).toThrow("invalid_payer_name");
    expect(() => normalizeMemberPaymentAccountPayerName("王\n小明")).toThrow("invalid_payer_name");
  });

  it("rejects invalid bank codes and account numbers", () => {
    expect(validateMemberPaymentAccountInput({
      bankCode: "12",
      accountNumberFull: "00123456789",
      payerName: "王小明",
    })).toEqual({ ok: false, error: "member_payment_account_bank_code_invalid" });
    expect(validateMemberPaymentAccountInput({
      bankCode: "012",
      accountNumberFull: "12A45",
      payerName: "王小明",
    })).toEqual({ ok: false, error: "member_payment_account_number_invalid" });
    expect(validateMemberPaymentAccountInput({
      bankCode: "012",
      accountNumberFull: "00123456789",
      payerName: "",
    })).toEqual({ ok: false, error: "member_payment_account_payer_name_invalid" });
  });

  it("builds a display snapshot from persisted identity without plaintext account fields", () => {
    const snapshot = buildMemberPaymentAccountSnapshot({
      id: "member-account-1",
      memberUid: "member-1",
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: validFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
      payerName: "王小明",
      status: "active",
      verificationStatus: "verified",
    });

    expect(snapshot).toEqual({
      id: "member-account-1",
      bankCode: "012",
      accountNumberMasked: "***56789",
      accountNumberLast5: "56789",
      payerName: "王小明",
      needsPayerName: false,
      status: "active",
      verificationStatus: "verified",
    });
    expect(JSON.stringify(snapshot)).not.toContain("accountNumberFull");
    expect(JSON.stringify(snapshot)).not.toContain("accountFingerprint");
    expect(maskMemberAccountNumber("56789")).toBe("***56789");
  });

  it("fails closed for an unknown lifecycle and explicitly exposes re-verification", () => {
    const normalized = normalizeMemberPaymentAccount({
      id: "member-account-legacy",
      memberUid: "member-1",
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: "",
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 0,
      status: "needsReverification" as never,
    });

    expect(normalized.status).toBe("inactive");
    expect(buildMemberPaymentAccountSnapshot(normalized)).toEqual({
      id: "member-account-legacy",
      bankCode: "012",
      accountNumberMasked: "***56789",
      accountNumberLast5: "56789",
      needsPayerName: true,
      status: "inactive",
      verificationStatus: "needsReverification",
    });
  });

  it("offers only active accounts with a verified identity for payment", () => {
    const base = {
      id: "member-account-1",
      bankCode: "012",
      accountNumberMasked: "***56789",
      accountNumberLast5: "56789",
      payerName: "王小明",
      needsPayerName: false,
      status: "active" as const,
      verificationStatus: "verified" as const,
    };

    expect(isMemberPaymentAccountUsableForPayment(base)).toBe(true);
    expect(isMemberPaymentAccountUsableForPayment({
      ...base,
      verificationStatus: "needsReverification",
    })).toBe(false);
    expect(isMemberPaymentAccountUsableForPayment({
      ...base,
      status: "inactive",
    })).toBe(false);
  });

  it("keeps a verified legacy account visible but unusable until payer name completion", () => {
    const account = buildMemberPaymentAccountSnapshot({
      id: "member-account-without-payer",
      memberUid: "member-1",
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: validFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
      status: "active",
      verificationStatus: "verified",
    });

    expect(account).toMatchObject({
      payerName: undefined,
      needsPayerName: true,
      status: "active",
      verificationStatus: "verified",
    });
    expect(isMemberPaymentAccountUsableForPayment(account)).toBe(false);
  });

  it.each([
    ["missing", undefined],
    ["unknown", "unknown"],
  ])("fails closed when verification status is %s", (_label, verificationStatus) => {
    const normalized = normalizeMemberPaymentAccount({
      id: "member-account-untrusted-verification",
      memberUid: "member-1",
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: validFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
      status: "active",
      verificationStatus: verificationStatus as never,
    });

    expect(normalized.verificationStatus).toBe("needsReverification");
    expect(isMemberPaymentAccountUsableForPayment(
      buildMemberPaymentAccountSnapshot(normalized),
    )).toBe(false);
  });

  it("fails closed when verified identity bytes are malformed", () => {
    const normalized = normalizeMemberPaymentAccount({
      id: "member-account-malformed-fingerprint",
      memberUid: "member-1",
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: "not-canonical-base64",
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
      status: "active",
      verificationStatus: "verified",
    });

    expect(normalized.verificationStatus).toBe("needsReverification");
  });
});
