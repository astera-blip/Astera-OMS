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
    expect(cart).toContain("disabled={placingOrder}");
    expect(cart).toContain('aria-live="polite"');
    expect(cart).toContain("建立中…");
  });

  it("keeps compact workspace actions touch friendly", () => {
    const product = read("src/components/workspace/ProductWorkspace.tsx");
    const images = read("src/components/workspace/ProductImageManager.tsx");
    expect(product).not.toContain("px-3 py-1.5 text-xs");
    expect(images).toContain("min-h-11");
    expect(images).toContain('aria-live="polite"');
  });
});
