import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

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
});
