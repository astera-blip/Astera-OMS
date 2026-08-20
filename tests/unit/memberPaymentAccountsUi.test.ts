import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildMemberPaymentAccountSnapshot,
  isMemberPaymentAccountUsableForPayment,
} from "@/lib/payment/memberBankAccounts";

const { useStateMock } = vi.hoisted(() => ({ useStateMock: vi.fn() }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return { ...actual, useState: useStateMock };
});

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: {
      uid: "member-1",
      getIdToken: vi.fn(),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", async () => {
  const { createElement: createAnchor } = await import("react");

  return {
    default: (props: Record<string, unknown>) =>
      createAnchor("a", { ...props, "data-next-link": "true" }),
  };
});

import MembersPage from "@/app/members/page";
import { PaymentRequestsBoard } from "@/components/storefront/PaymentRequestsBoard";

function expectNextLinkWithLabel(markup: string, href: string, label: string) {
  expect(markup).toMatch(
    new RegExp(
      `<a(?=[^>]*data-next-link="true")(?=[^>]*href="${href}")[^>]*>[\\s\\S]*?${label}[\\s\\S]*?</a>`,
    ),
  );
}

function renderPaymentRequestsBoardWithAccounts(
  accounts: Array<Record<string, unknown>>,
  selectedAccountId: string,
) {
  const states = [
    [],
    [],
    [],
    [],
    "",
    accounts,
    selectedAccountId,
    [],
    "",
    "",
    "",
    "ready",
    "",
    false,
  ];
  let stateIndex = 0;

  // This test-only driver matches PaymentRequestsBoard's current state declarations.
  // Recreate it per render and assert the populated selector below so a hook-layout
  // change is diagnosed as fixture maintenance rather than discoverability behavior.
  useStateMock.mockImplementation(() => [states[stateIndex++], vi.fn()]);

  return renderToStaticMarkup(createElement(PaymentRequestsBoard));
}

function renderPaymentRequestsBoardWithUsableAccount() {
  return renderPaymentRequestsBoardWithAccounts([{
    id: "member-account-1",
    memberUid: "member-1",
    bankCode: "012",
    accountNumberLast5: "56789",
    accountNumberMasked: "*****56789",
    payerName: "王小明",
    status: "active",
    verificationStatus: "verified",
  }], "member-account-1");
}

describe("member payment account UI contract", () => {
  afterEach(() => {
    useStateMock.mockReset();
  });

  it("collects bank code, transient full account and the linked payer name", () => {
    const page = readFileSync("src/app/account/bank-accounts/page.tsx", "utf8");
    const board = readFileSync("src/components/account/MemberPaymentAccountsBoard.tsx", "utf8");

    expect(page).toContain("MemberPaymentAccountsBoard");
    expect(page).toContain("只保留銀行代碼、末五碼與不可逆帳號識別碼");
    expect(board).toContain("銀行代碼");
    expect(board).toContain("完整銀行帳號");
    expect(board).toContain("匯款人姓名");
    expect(board).toContain("JSON.stringify({ bankCode, accountNumberFull, payerName })");
    expect(board).not.toContain("銀行名稱");
    expect(board).not.toContain("分行名稱");
    expect(board).not.toContain("戶名");
  });

  it("offers one-time payer-name completion for legacy accounts", () => {
    const board = readFileSync("src/components/account/MemberPaymentAccountsBoard.tsx", "utf8");

    expect(board).toContain("需要補填匯款人");
    expect(board).toContain("/payer-name");
    expect(board).toContain("JSON.stringify({ payerName:");
    expect(board).toContain("補填匯款人姓名");
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
      payerName: "王小明",
      status: "active",
      verificationStatus: "unknown" as never,
    });

    expect(snapshot.verificationStatus).toBe("needsReverification");
    expect(isMemberPaymentAccountUsableForPayment(snapshot)).toBe(false);
  });

  it("updates the payment report date from native date-input events", () => {
    const paymentBoard = readFileSync(
      "src/components/storefront/PaymentRequestsBoard.tsx",
      "utf8",
    );

    expect(paymentBoard).toContain(
      "onInput={(event) => setReceivedAt(event.currentTarget.value)}",
    );
  });

  it("keeps the payment-report submit action visibly branded", () => {
    const paymentBoard = readFileSync(
      "src/components/storefront/PaymentRequestsBoard.tsx",
      "utf8",
    );

    expect(paymentBoard).toContain("bg-[#6E4E64]");
    expect(paymentBoard).toContain("disabled:bg-[#6E4E64]/60");
  });

  it("derives read-only last five and payer name from the selected member account", () => {
    const paymentBoard = readFileSync(
      "src/components/storefront/PaymentRequestsBoard.tsx",
      "utf8",
    );
    const paymentBody = paymentBoard.slice(
      paymentBoard.indexOf("const reportPayload ="),
      paymentBoard.indexOf("if (!response.ok)"),
    );

    expect(paymentBoard).toContain("const selectedMemberPaymentAccount = memberPaymentAccounts.find");
    expect(paymentBoard).toContain("account.payerName");
    expect(paymentBoard).toContain("selectedMemberPaymentAccount?.accountNumberLast5");
    expect(paymentBoard).toContain("selectedMemberPaymentAccount?.payerName");
    expect(paymentBoard).toContain("readOnly");
    expect(paymentBody).toContain("memberPaymentAccountId: selectedMemberPaymentAccountId");
    expect(paymentBody).not.toContain("payerName");
    expect(paymentBody).not.toContain("last5");
  });

  it("會員工作台有連結自己匯款帳戶的付款設定", () => {
    const markup = renderToStaticMarkup(createElement(MembersPage));

    expectNextLinkWithLabel(markup, "/account/bank-accounts", "付款設定");
  });

  it("有可用匯款帳戶時仍提供管理付款帳戶入口", () => {
    const markup = renderPaymentRequestsBoardWithUsableAccount();

    expect(markup).toContain('id="member-payment-account"');
    expect(markup).toContain('value="member-account-1"');
    expect(markup).toContain("匯出匯款的會員帳戶");
    expectNextLinkWithLabel(markup, "/account/bank-accounts", "管理付款帳戶");
  });

  it("沒有可用匯款帳戶時只提供一個管理付款帳戶入口", () => {
    const markup = renderPaymentRequestsBoardWithAccounts([], "");

    expect(markup).toContain("尚未登記匯款帳戶，請先新增自己的銀行帳戶。");
    expectNextLinkWithLabel(markup, "/account/bank-accounts", "管理付款帳戶");
    expect(markup.match(/href="\/account\/bank-accounts"/g)).toHaveLength(1);
  });
});
