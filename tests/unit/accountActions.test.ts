import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

let role = "member";
let pathname = "/workspace";

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({
    status: "signedIn",
    user: { displayName: "測試會員" },
    role,
    error: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("next/link", async () => {
  const { createElement: createAnchor } = await import("react");

  return {
    default: (props: Record<string, unknown>) =>
      createAnchor("a", { ...props, "data-next-link": "true" }),
  };
});

import { AccountActions } from "@/components/auth/AccountActions";
import WorkspaceHomePage from "@/app/workspace/page";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

function expectNextLinkWithLabel(markup: string, href: string, label: string) {
  expect(markup).toMatch(
    new RegExp(
      `<a(?=[^>]*data-next-link="true")(?=[^>]*href="${href}")[^>]*>[\\s\\S]*?${label}[\\s\\S]*?</a>`,
    ),
  );
}

describe("AccountActions workspace entry", () => {
  beforeEach(() => {
    role = "member";
    pathname = "/workspace";
  });

  it("shows a Partner entry that opens catalog reviews", () => {
    role = "partner";

    const markup = renderToStaticMarkup(createElement(AccountActions));

    expect(markup).toContain('href="/workspace/catalog-reviews"');
    expect(markup).toContain("合作人工作區");
  });

  it("shows a Helper entry that opens the restricted Helper workspace", () => {
    role = "helper";

    const markup = renderToStaticMarkup(createElement(AccountActions));

    expect(markup).toContain('href="/workspace"');
    expect(markup).toContain("小幫手工作區");
  });

  it("lets a Helper open a task-only workspace without Owner cards", () => {
    role = "helper";

    const shell = renderToStaticMarkup(
      createElement(WorkspaceShell, null, createElement("p", null, "Helper 專屬內容")),
    );
    const home = renderToStaticMarkup(createElement(WorkspaceHomePage));

    expect(shell).toContain("Helper 專屬內容");
    expect(shell).not.toContain("需要後台權限");
    expect(home).toContain("小幫手工作區");
    expect(home).not.toContain("付款 Payments");
  });

  it("rejects a Helper that directly opens an Owner-only workspace route", () => {
    role = "helper";
    pathname = "/workspace/payments";

    const markup = renderToStaticMarkup(
      createElement(WorkspaceShell, null, createElement("p", null, "Owner payment content")),
    );

    expect(markup).toContain("沒有此工作區權限");
    expect(markup).not.toContain("Owner payment content");
  });

  it("keeps the Owner management entry", () => {
    role = "owner";

    const markup = renderToStaticMarkup(createElement(AccountActions));

    expect(markup).toContain('href="/workspace"');
    expect(markup).toContain("管理後台");
  });

  it("已登入會員直接進入付款設定", () => {
    const markup = renderToStaticMarkup(createElement(AccountActions));

    expectNextLinkWithLabel(markup, "/account/bank-accounts", "付款設定");
  });

  it("已登入會員可從行動版帳號選單直接進入付款設定", () => {
    const markup = renderToStaticMarkup(createElement(AccountActions, { variant: "mobile" }));

    expectNextLinkWithLabel(markup, "/account/bank-accounts", "付款設定");
  });

  it("在 Owner 後台導覽提供付款與收款入口", () => {
    role = "owner";

    const markup = renderToStaticMarkup(
      createElement(WorkspaceShell, null, createElement("p", null, "Owner content")),
    );

    expectNextLinkWithLabel(markup, "/workspace/payments", "付款與收款");
  });

  it("removes the duplicate Owner workspace overview entry and redirects its landing page", () => {
    role = "owner";

    const shell = renderToStaticMarkup(
      createElement(WorkspaceShell, null, createElement("p", null, "Owner content")),
    );
    const home = renderToStaticMarkup(createElement(WorkspaceHomePage));

    expect(shell).not.toContain('href="/workspace"');
    const source = readFileSync("src/app/workspace/page.tsx", "utf8");

    expect(home).toContain("正在開啟商品工作區");
    expect(source).toContain('router.replace("/workspace/products")');
    expect(home).not.toContain("商品與活動 Products");
    expect(home).not.toContain("收款帳戶 Payment Accounts");
  });
});
