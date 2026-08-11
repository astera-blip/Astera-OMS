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
    expect(cart).toContain('value="seven_eleven"');
    expect(cart).not.toContain("shippingStoreInfo");
    expect(cart).not.toContain("family_mart");
    expect(cart).not.toContain("宅配地址");
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
    expect(product).toContain('if (isProductsLoading)');
    expect(product).toContain('disabled={isProductsLoading}');
  });

  it("falls back to redirect-based Google sign-in when popup sign-in cannot complete", () => {
    const authProvider = read("src/components/auth/AuthProvider.tsx");
    expect(authProvider).toContain("getRedirectResult");
    expect(authProvider).toContain("signInWithRedirect");
    expect(authProvider).toContain("isPopupFallbackError");
    expect(authProvider).toContain("getGoogleSignInErrorMessage");
    expect(authProvider).toContain("這個網址尚未允許 Google 登入");
  });

  it("places storefront brand text before the large buyer title", () => {
    const home = read("src/app/page.tsx");

    expect(home).toContain('<p className="text-sm font-semibold uppercase tracking-[0.22em] text-astera-brand">\n              泰國 GL / 藝人周邊代購');
    expect(home).toContain('<h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">\n              ASTERA OMS');
    expect(home).not.toContain("/ Aatera");
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
});
