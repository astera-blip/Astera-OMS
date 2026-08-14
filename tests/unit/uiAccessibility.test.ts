import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("shared UI accessibility contract", () => {
  it("provides global keyboard focus, reduced motion, and a skip link target", () => {
    const css = read("src/app/globals.css");
    const layout = read("src/app/layout.tsx");
    const focusManager = read("src/components/accessibility/RouteFocusManager.tsx");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion");
    expect(layout).toContain('href="#main-content"');
    expect(focusManager).toContain('id="main-content"');
    expect(layout).toContain("min-h-dvh");
  });

  it("defines the approved Astera visual tokens and remaps legacy layout utilities", () => {
    const css = read("src/app/globals.css");

    for (const token of [
      "--astera-page: #F7F3F2",
      "--astera-surface: #FFFFFF",
      "--astera-ink: #20242B",
      "--astera-border: #DED7D6",
      "--astera-secondary: #6C6B70",
      "--astera-brand: #6E4E64",
      "--astera-brand-soft: #E7DDDF",
      "--astera-service: #466060",
      "--astera-campaign: #F8C7CC",
      "--astera-catalog: #81A684",
    ]) {
      expect(css, token).toContain(token);
    }

    expect(css).toContain('[class~="bg-slate-50"]');
    expect(css).toContain('[class~="bg-amber-400"]');
    expect(css).toContain("min-height: 100dvh");
  });

  it("announces checkout status and prevents duplicate order submission", () => {
    const cart = read("src/components/storefront/CartBoard.tsx");
    expect(cart).toContain("placingOrder");
    expect(cart).toContain("isOrderDisabled");
    expect(cart).toContain("disabled={isOrderDisabled}");
    expect(cart).toContain('aria-live="polite"');
    expect(cart).toContain("建立中…");
    expect(cart).toContain("請先加入商品");
  });

  it("shows buyer-facing product and variant names in cart lines", () => {
    const cart = read("src/components/storefront/CartBoard.tsx");

    expect(cart).toContain("findCatalogItem");
    expect(cart).toContain("product?.product.name");
    expect(cart).toContain("variant?.name");
    expect(cart).not.toContain("{item.productId}</h2>");
    expect(cart).not.toContain("Variant {item.variantId}");
  });

  it("gives checkout fields stable form attributes", () => {
    const cart = read("src/components/storefront/CartBoard.tsx");
    for (const field of [
      "recipientName",
      "recipientPhone",
      "shippingMethod",
      "acceptedLegalTerms",
      "acceptedSupplementRule",
    ]) {
      expect(cart, field).toContain(`id="${field}"`);
      expect(cart, field).toContain(`name="${field}"`);
    }
    expect(cart).toContain('autoComplete="name"');
    expect(cart).toContain('autoComplete="tel"');
    expect(cart).toContain('const shippingMethod = "seven_eleven" as const;');
    expect(cart).toContain("7-Eleven 賣貨便");
    expect(cart).not.toContain("shippingAddress");
    expect(cart).not.toContain("shippingStoreInfo");
    expect(cart).not.toContain("family_mart");
    expect(cart).not.toContain("宅配地址");
    expect(cart).not.toContain('value="address"');
    expect(cart).not.toContain('value="family_mart"');
  });

  it("exposes a clear Owner payment-account settings entry", () => {
    const workspace = read("src/app/workspace/page.tsx");
    const payments = read("src/components/workspace/PaymentAccountsBoard.tsx");

    expect(workspace).toContain("收款帳戶設定");
    expect(workspace).toContain("/workspace/payments#payment-accounts");
    expect(payments).toContain('id="payment-accounts"');
  });

  it("allows selecting multiple payment requests in one report", () => {
    const payments = read("src/components/storefront/PaymentRequestsBoard.tsx");

    expect(payments).toContain("selectedRequestIds");
    expect(payments).toContain("paymentRequestIds");
    expect(payments).toContain('type="checkbox"');
  });

  it("keeps compact workspace actions touch friendly", () => {
    const product = read("src/components/workspace/ProductWorkspace.tsx");
    const images = read("src/components/workspace/ProductImageManager.tsx");
    expect(product).not.toContain("px-3 py-1.5 text-xs");
    expect(images).toContain("min-h-11");
    expect(images).toContain('aria-live="polite"');
  });

  it("keeps dense Variant and Campaign fields from overflowing their grid tracks", () => {
    const product = read("src/components/workspace/ProductWorkspace.tsx");

    expect(product).toContain('className="grid min-w-0 gap-4 md:grid-cols-2"');
    expect(product).toContain('className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3"');
    expect(product).toContain("min-w-0 w-full rounded-2xl border border-slate-300");
  });

  it("blocks Product workspace mutations until the initial catalog load completes", () => {
    const product = read("src/components/workspace/ProductWorkspace.tsx");

    expect(product).toContain('const [isProductsLoading, setIsProductsLoading] = useState(true)');
    expect(product).toContain('if (isProductsLoading || isSaving)');
    expect(product).toContain('disabled={isProductsLoading}');
  });

  it("shows complete catalog proposals before Owner approval and provides load retry", () => {
    const review = read("src/components/workspace/CatalogReviewBoard.tsx");

    expect(review).toContain("公開說明");
    expect(review).toContain("目標 Product ID");
    expect(review).toContain("核准後將封存");
    expect(review).toContain("內部備註");
    expect(review).toContain("原幣成本");
    expect(review).toContain("活動售價");
    expect(review).toContain("重新載入");
    expect(review).toContain("catalog_change_stale_base");
    expect(review).toContain("正式商品已被更新");
  });

  it("keeps classification management Owner-only", () => {
    const product = read("src/components/workspace/ProductWorkspace.tsx");

    expect(product).toContain('{role === "owner" ? (');
    expect(product).toContain("Classifications（分類管理）");
  });

  it("tells Partner to reload a stale product draft", () => {
    const product = read("src/components/workspace/ProductWorkspace.tsx");
    expect(product).toContain("draftSaveErrorMessage");
    expect(product).toContain("商品已在你編輯期間被更新");
  });

  it("limits Partner workspace routes and homepage cards", () => {
    const shell = read("src/components/workspace/WorkspaceShell.tsx");
    const home = read("src/app/workspace/page.tsx");
    expect(shell).toContain("partnerAllowedPaths");
    expect(shell).toContain("沒有此工作區權限");
    expect(home).toContain('role === "partner"');
    expect(home).toContain("商品草稿 Catalog Reviews");
  });

  it("uses redirect-based Google sign-in without a mobile popup flash", () => {
    const authProvider = read("src/components/auth/AuthProvider.tsx");
    expect(authProvider).toContain("getRedirectResult");
    expect(authProvider).toContain("signInWithRedirect");
    expect(authProvider).not.toContain("signInWithPopup");
    expect(authProvider).not.toContain("isPopupFallbackError");
    expect(authProvider).toContain("getGoogleSignInErrorMessage");
    expect(authProvider).toContain("這個網址尚未允許 Google 登入");
  });

  it("keeps a Google redirect failure visible when Firebase reports signed-out afterwards", () => {
    const authProvider = read("src/components/auth/AuthProvider.tsx");

    expect(authProvider).toContain("redirectResultError");
    expect(authProvider).toContain("if (!redirectResultError)");
  });

  it("catches Firebase initialization failures when Google sign-in starts", () => {
    const authProvider = read("src/components/auth/AuthProvider.tsx");
    const signInStart = authProvider.slice(
      authProvider.indexOf("const signInWithGoogle"),
      authProvider.indexOf("const signOutCurrentUser"),
    );

    expect(signInStart).toMatch(
      /try\s*\{[\s\S]*const \[\{ auth \}, \{ GoogleAuthProvider, signInWithRedirect \}\]/,
    );
    expect(signInStart).toContain("setError(getGoogleSignInErrorMessage(error))");
  });

  it("uses buyer-facing public metadata and an ASTERA-only storefront brand", () => {
    const home = read("src/components/storefront/HomeExperience.tsx");
    const header = read("src/components/storefront/StorefrontHeader.tsx");
    const accountActions = read("src/components/auth/AccountActions.tsx");
    const layout = read("src/app/layout.tsx");

    expect(home).toContain("THAILAND ARTIST GOODS");
    expect(home).toContain("泰國 GL／藝人周邊代購");
    expect(home).not.toContain("/ Aatera");
    expect(home).not.toContain("ASTERA OMS");
    expect(header).toContain("AccountActions");
    expect(header).toContain("ASTERA");
    expect(header).not.toContain("ASTERA OMS");
    expect(accountActions).toContain("會員登入");
    expect(accountActions).toContain('aria-live="polite"');
    expect(accountActions).toContain("min-h-11");
    expect(layout).toContain('title: "Astera｜泰國 GL／藝人周邊代購"');
    expect(layout).not.toContain("Operations Workspace");
  });

  it("uses separated member last and first name fields, omits blank birthday, and redirects home after save", () => {
    const profile = read("src/app/account/profile/page.tsx");

    expect(profile).toContain('id="lastName"');
    expect(profile).toContain('label="姓"');
    expect(profile).toContain('autoComplete="family-name"');
    expect(profile).toContain('id="firstName"');
    expect(profile).toContain('label="名"');
    expect(profile).toContain('autoComplete="given-name"');
    expect(profile).toContain("sanitizeProfileDraft");
    expect(profile).toContain("delete sanitized.birthday");
    expect(profile).toContain('router.replace("/")');
  });

  it("does not show disabled Instagram placeholders in the public footer", () => {
    const footer = read("src/components/storefront/StorefrontFooter.tsx");

    expect(footer).not.toContain("：暫不提供");
    expect(footer).not.toContain("instagram\"] as const");
  });

  it("announces a one-time role change with an accessible touch target", () => {
    const notice = read("src/components/auth/RoleChangeNotice.tsx");
    const layout = read("src/app/layout.tsx");

    expect(notice).toContain('role="status"');
    expect(notice).toContain('aria-live="polite"');
    expect(notice).toContain("min-h-11");
    expect(notice).toContain("/api/member/role-notifications");
    expect(notice).toContain("user.getIdToken()");
    expect(layout).toContain("RoleChangeNotice");
  });

  it("uses an accessible confirmation dialog for Owner role assignments", () => {
    const members = read("src/components/workspace/MemberOperationsBoard.tsx");
    const workspace = read("src/components/workspace/WorkspaceShell.tsx");

    expect(members).toContain('role="alertdialog"');
    expect(members).toContain('aria-modal="true"');
    expect(members).toContain("角色變更中…");
    expect(members).toContain("min-h-11");
    expect(members).toContain("/role");
    expect(workspace).toContain('const canUseWorkspace = role === "owner" || role === "partner"');
    expect(workspace).toContain("目前角色為 Helper（小幫手）；搶購任務功能將在對應批次開放。");
  });
});
