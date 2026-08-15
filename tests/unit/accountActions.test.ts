import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
}));

import { AccountActions } from "@/components/auth/AccountActions";
import WorkspaceHomePage from "@/app/workspace/page";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

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
});
