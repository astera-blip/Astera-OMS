import { describe, expect, it } from "vitest";
import {
  buildMemberPaymentAccountSnapshot,
  isMemberPaymentAccountUsableForPayment,
  maskMemberAccountNumber,
  normalizeMemberPaymentAccount,
  normalizeMemberPaymentAccountInput,
  validateMemberPaymentAccountInput,
} from "@/lib/payment/memberBankAccounts";

describe("member payment accounts", () => {
  it("accepts only a bank code and normalized full account as transient request data", () => {
    expect(validateMemberPaymentAccountInput({
      bankCode: " ０１２ ",
      accountNumberFull: "００１２-３４ ５６７８９",
    })).toEqual({
      ok: true,
      value: {
        bankCode: "012",
        accountNumberFull: "00123456789",
      },
    });

    expect(normalizeMemberPaymentAccountInput({
      bankCode: "012",
      accountNumberFull: "0012-345 6789",
    })).toEqual({
      bankCode: "012",
      accountNumberFull: "00123456789",
    });
  });

  it("rejects invalid bank codes and account numbers", () => {
    expect(validateMemberPaymentAccountInput({
      bankCode: "12",
      accountNumberFull: "00123456789",
    })).toEqual({ ok: false, error: "member_payment_account_bank_code_invalid" });
    expect(validateMemberPaymentAccountInput({
      bankCode: "012",
      accountNumberFull: "12A45",
    })).toEqual({ ok: false, error: "member_payment_account_number_invalid" });
  });

  it("builds a display snapshot from persisted identity without plaintext account fields", () => {
    const snapshot = buildMemberPaymentAccountSnapshot({
      id: "member-account-1",
      memberUid: "member-1",
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: "fingerprint-base64",
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
      status: "active",
      verificationStatus: "verified",
    });

    expect(snapshot).toEqual({
      id: "member-account-1",
      bankCode: "012",
      accountNumberMasked: "***56789",
      accountNumberLast5: "56789",
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
});
