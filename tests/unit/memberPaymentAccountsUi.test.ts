import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildMemberPaymentAccountSnapshot,
  isMemberPaymentAccountUsableForPayment,
} from "@/lib/payment/memberBankAccounts";

describe("member payment account UI contract", () => {
  it("collects only bank code and full account while explaining minimized retention", () => {
    const page = readFileSync("src/app/account/bank-accounts/page.tsx", "utf8");
    const board = readFileSync("src/components/account/MemberPaymentAccountsBoard.tsx", "utf8");

    expect(page).toContain("MemberPaymentAccountsBoard");
    expect(page).toContain("只保留銀行代碼、末五碼與不可逆帳號識別碼");
    expect(board).toContain("銀行代碼");
    expect(board).toContain("完整銀行帳號");
    expect(board).toContain("JSON.stringify({ bankCode, accountNumberFull })");
    expect(board).not.toContain("銀行名稱");
    expect(board).not.toContain("分行名稱");
    expect(board).not.toContain("戶名");
  });

  it("shows only masked saved accounts and treats duplicate review as a warning", () => {
    const board = readFileSync("src/components/account/MemberPaymentAccountsBoard.tsx", "utf8");
    const savedAccountMarkup = board.slice(board.indexOf("accounts.map"), board.indexOf("{canAdd"));

    expect(savedAccountMarkup).toContain("account.bankCode");
    expect(savedAccountMarkup).toContain("account.accountNumberMasked");
    expect(savedAccountMarkup).not.toContain("accountNumberFull");
    expect(board).toContain("member_payment_account_duplicate_review_pending");
    expect(board).toContain("帳戶仍已新增");
  });

  it("does not offer accounts that require identity re-verification for payment reports", () => {
    const paymentBoard = readFileSync(
      "src/components/storefront/PaymentRequestsBoard.tsx",
      "utf8",
    );
    const accountBoard = readFileSync(
      "src/components/account/MemberPaymentAccountsBoard.tsx",
      "utf8",
    );

    expect(paymentBoard).toContain("isMemberPaymentAccountUsableForPayment");
    expect(accountBoard).toContain("需要重新驗證");
  });

  it("does not offer an account with an unknown stored verification state", () => {
    const snapshot = buildMemberPaymentAccountSnapshot({
      id: "member-account-unknown-verification",
      memberUid: "member-1",
      bankCode: "012",
      accountNumberLast5: "56789",
      accountFingerprint: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=",
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
      status: "active",
      verificationStatus: "unknown" as never,
    });

    expect(snapshot.verificationStatus).toBe("needsReverification");
    expect(isMemberPaymentAccountUsableForPayment(snapshot)).toBe(false);
  });
});
