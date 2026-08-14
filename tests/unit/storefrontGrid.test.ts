import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("storefront grid contract", () => {
  it("uses the real homepage in the approved buyer-facing section order", () => {
    const page = readFileSync("src/app/page.tsx", "utf8");
    const home = readFileSync("src/components/storefront/HomeExperience.tsx", "utf8");
    expect(page).toContain("<HomeExperience />");
    expect(home.indexOf('data-testid="guest-login-card"')).toBeLessThan(home.indexOf('data-testid="shopping-steps-card"'));
    expect(home.indexOf('data-testid="shopping-steps-card"')).toBeLessThan(home.indexOf('<FeaturedProductsBoard mode="guest"'));
    expect(home.indexOf("<MemberHomeActions />")).toBeLessThan(home.indexOf('<FeaturedProductsBoard mode="member"'));
    for (const internalCopy of ["ASTERA OMS", "Firestore", "Custom Claim", "Owner", "Audit Log", "MVP"]) {
      expect(home).not.toContain(internalCopy);
    }
  });

  it("uses a responsive homepage product grid and 4:5 cover ratio", () => {
    const board = readFileSync("src/components/storefront/FeaturedProductsBoard.tsx", "utf8");
    const image = readFileSync("src/components/storefront/ProductCoverImage.tsx", "utf8");
    expect(board).toContain("grid-cols-2");
    expect(board).toContain("lg:grid-cols-4");
    expect(board).toContain('testId="latest-product-grid"');
    expect(board).toContain('testId="closing-soon-grid"');
    expect(image).toContain("aspect-[4/5]");
    expect(image).not.toContain("unoptimized");
  });

  it("preserves a guest homepage cart intent before existing Google sign-in", () => {
    const board = readFileSync("src/components/storefront/FeaturedProductsBoard.tsx", "utf8");
    expect(board).toContain("signInWithGoogle");
    expect(board).toContain("請先使用 Google 登入");
    expect(board).toContain("savePendingCartIntent");
    expect(board).toContain("loadPendingCartIntent");
    expect(board).toContain("clearPendingCartIntent");
    expect(board).toContain('fetch("/api/cart"');
  });

  it("provides a public storefront header with core navigation", () => {
    const header = readFileSync("src/components/storefront/StorefrontHeader.tsx", "utf8");
    expect(header).toContain(">ASTERA<");
    expect(header).not.toContain("ASTERA OMS");
    expect(header).toContain("/products");
    expect(header).toContain("/brand");
    expect(header).toContain("HeaderCartDrawer");
    expect(header).toContain("AccountActions");
  });

  it("uses the approved mobile navigation and a read-only header cart drawer", () => {
    const header = readFileSync("src/components/storefront/StorefrontHeader.tsx", "utf8");
    const drawer = readFileSync("src/components/storefront/HeaderCartDrawer.tsx", "utf8");
    const accountActions = readFileSync("src/components/auth/AccountActions.tsx", "utf8");

    expect(header).toContain("HeaderCartDrawer");
    expect(header).toContain('aria-expanded={isMobileMenuOpen}');
    expect(header).toContain("Escape");
    expect(header).toContain('id="storefront-mobile-menu"');
    expect(drawer).toContain('role="dialog"');
    expect(drawer).toContain('href="/cart"');
    expect(drawer).toContain('href="/checkout"');
    expect(accountActions).toContain('variant?: "desktop" | "mobile"');
    expect(accountActions).toContain('role === "owner"');
    expect(accountActions).toContain('href="/workspace"');
  });

  it("shows campaign decisions and resilient catalog states on the homepage", () => {
    const board = readFileSync("src/components/storefront/FeaturedProductsBoard.tsx", "utf8");
    const card = readFileSync("src/components/storefront/HomeProductCard.tsx", "utf8");

    expect(board).toContain("listPublicProducts");
    expect(card).toContain("saleTypeCustomerLabels");
    expect(card).toContain("formatCampaignDeadline");
    expect(card).toContain("二補");
    expect(board).toContain('aria-live="polite"');
    expect(board).toContain('role="alert"');
    expect(board).toContain("重新載入");
  });

  it("keeps public product cards image-first and exposes an accessible detail gallery", () => {
    const list = readFileSync("src/components/storefront/PublicProductsBoard.tsx", "utf8");
    const detail = readFileSync("src/components/storefront/PublicProductDetailBoard.tsx", "utf8");

    expect(list).toContain("grid-cols-2");
    expect(list).toContain("lg:grid-cols-4");
    expect(list).toContain("formatCampaignDateTime");
    expect(list).toContain("可能二補");
    expect(list).not.toContain("publicDescription}</p>");
    expect(detail).toContain("activeImageIndex");
    expect(detail).toContain('aria-label="上一張商品圖片"');
    expect(detail).toContain('aria-label="下一張商品圖片"');
    expect(detail).toContain("商品圖片 {activeImageIndex + 1} / {images.length}");
  });
});
