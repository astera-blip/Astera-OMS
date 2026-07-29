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

  it("announces checkout status and prevents duplicate order submission", () => {
    const cart = read("src/components/storefront/CartBoard.tsx");
    expect(cart).toContain("placingOrder");
    expect(cart).toContain("isOrderDisabled");
    expect(cart).toContain("disabled={isOrderDisabled}");
    expect(cart).toContain('aria-live="polite"');
    expect(cart).toContain("建立中…");
    expect(cart).toContain("請先加入商品");
  });

  it("gives checkout fields stable form attributes", () => {
    const cart = read("src/components/storefront/CartBoard.tsx");
    for (const field of [
      "recipientName",
      "recipientPhone",
      "shippingMethod",
      "shippingAddress",
      "shippingStoreInfo",
      "acceptedLegalTerms",
      "acceptedSupplementRule",
    ]) {
      expect(cart, field).toContain(`id="${field}"`);
      expect(cart, field).toContain(`name="${field}"`);
    }
    expect(cart).toContain('autoComplete="name"');
    expect(cart).toContain('autoComplete="tel"');
    expect(cart).toContain('autoComplete="street-address"');
  });

  it("keeps compact workspace actions touch friendly", () => {
    const product = read("src/components/workspace/ProductWorkspace.tsx");
    const images = read("src/components/workspace/ProductImageManager.tsx");
    expect(product).not.toContain("px-3 py-1.5 text-xs");
    expect(images).toContain("min-h-11");
    expect(images).toContain('aria-live="polite"');
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

    expect(home).toContain('<p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-700">\n              泰國 GL / 藝人周邊代購');
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
