import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("checkout route contract", () => {
  it("provides a dedicated checkout route without a self-referential checkout link", () => {
    const page = readFileSync("src/app/checkout/page.tsx", "utf8");
    expect(page).toContain("CartBoard");
    expect(page).toContain("showCheckoutStep={false}");
    expect(page).toContain("export default function CheckoutPage");
    expect(page).toContain("建立訂單");
  });

  it("links the cart summary to the dedicated checkout route", () => {
    const board = readFileSync("src/components/storefront/CartBoard.tsx", "utf8");
    expect(board).toContain('href="/checkout"');
    expect(board).toContain("前往結帳");
  });
});
