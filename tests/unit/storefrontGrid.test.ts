import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("storefront grid contract", () => {
  it("uses a responsive product grid and 4:5 cover ratio", () => {
    const board = readFileSync("src/components/storefront/PublicProductsBoard.tsx", "utf8");
    const image = readFileSync("src/components/storefront/ProductCoverImage.tsx", "utf8");
    expect(board).toContain("grid-cols-2");
    expect(board).toContain("lg:grid-cols-4");
    expect(image).toContain("aspect-[4/5]");
    expect(image).not.toContain("unoptimized");
  });

  it("requires sign-in before a public list item can be added", () => {
    const board = readFileSync("src/components/storefront/PublicProductsBoard.tsx", "utf8");
    expect(board).toContain("signInWithGoogle");
    expect(board).toContain("請先使用 Google 登入");
  });

  it("provides a public storefront header with core navigation", () => {
    const header = readFileSync("src/components/storefront/StorefrontHeader.tsx", "utf8");
    expect(header).toContain("ASTERA OMS");
    expect(header).toContain("/products");
    expect(header).toContain("/brand");
    expect(header).toContain("/cart");
    expect(header).toContain("/account/bank-accounts");
  });
});
