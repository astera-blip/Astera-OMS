import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("guest checkout gate", () => {
  it("requires Google sign-in before adding a public product to cart", () => {
    const source = readFileSync("src/components/storefront/PublicProductDetailBoard.tsx", "utf8");
    expect(source).toContain("signInWithGoogle");
    expect(source).toContain("請先使用 Google 登入");
    expect(source).toContain("if (!user)");
  });

  it("guards checkout on a completed server profile", () => {
    const source = readFileSync("src/app/api/checkout/route.ts", "utf8");
    expect(source).toContain('collection("members").doc(claims.uid)');
    expect(source).toContain("member_profile_incomplete");
  });

  it("disables the cart order CTA until sign-in and checkout requirements are complete", () => {
    const source = readFileSync("src/components/storefront/CartBoard.tsx", "utf8");
    expect(source).toContain("!user || catalog.length === 0 || !checkoutSubmissionReady");
    expect(source).toContain("disabled={isOrderDisabled}");
    expect(source).toContain("請先登入");
  });
});
