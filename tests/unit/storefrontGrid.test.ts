import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("storefront grid contract", () => {
  it("uses the real homepage in the approved buyer-facing section order", () => {
    const home = readFileSync("src/app/page.tsx", "utf8");
    const sections = ["featured-products", "shopping-guide", "supplement", "faq-support"];
    const positions = sections.map((id) => home.indexOf(`id="${id}"`));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    for (const internalCopy of ["ASTERA OMS", "Firestore", "Custom Claim", "Owner", "Audit Log", "MVP"]) {
      expect(home).not.toContain(internalCopy);
    }
  });

  it("uses a responsive homepage product grid and 4:5 cover ratio", () => {
    const board = readFileSync("src/components/storefront/FeaturedProductsBoard.tsx", "utf8");
    const image = readFileSync("src/components/storefront/ProductCoverImage.tsx", "utf8");
    expect(board).toContain("grid-cols-2");
    expect(board).toContain("lg:grid-cols-4");
    expect(board).toContain('data-testid="featured-product-grid"');
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
    expect(header).toContain("/cart");
    expect(header).toContain("AccountActions");
  });

  it("shows campaign decisions and resilient catalog states on the homepage", () => {
    const board = readFileSync("src/components/storefront/FeaturedProductsBoard.tsx", "utf8");

    expect(board).toContain("listPublicProducts");
    expect(board).toContain("saleTypeCustomerLabels");
    expect(board).toContain("formatCampaignDateTime");
    expect(board).toContain("formatCampaignDeadline");
    expect(board).toContain("可能二補");
    expect(board).toContain('aria-live="polite"');
    expect(board).toContain('role="alert"');
    expect(board).toContain("重新載入");
  });
});
