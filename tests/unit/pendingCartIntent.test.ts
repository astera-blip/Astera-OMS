import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartLineItem } from "@/lib/order/checkout";

const intent: CartLineItem = {
  productId: "product-a",
  variantId: "variant-a",
  saleCampaignId: "campaign-a",
  quantity: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pending guest cart intent", () => {
  it("round-trips only the minimal cart identifiers", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    const { loadPendingCartIntent, savePendingCartIntent } = await import("@/lib/cart/pendingCartIntent");

    savePendingCartIntent(intent);

    expect(loadPendingCartIntent()).toEqual(intent);
    expect([...values.values()][0]).not.toContain("price");
  });

  it("rejects malformed or unsafe stored values", async () => {
    const cases = [
      "not-json",
      JSON.stringify({ ...intent, quantity: 0 }),
      JSON.stringify({ ...intent, priceTwd: 520 }),
      JSON.stringify({ productId: "", variantId: "v", saleCampaignId: "c", quantity: 1 }),
    ];
    const { loadPendingCartIntent } = await import("@/lib/cart/pendingCartIntent");

    for (const stored of cases) {
      vi.stubGlobal("window", { sessionStorage: { getItem: () => stored } });
      expect(loadPendingCartIntent()).toBeNull();
    }
  });

  it("is safe when browser storage is unavailable and clears after success", async () => {
    vi.stubGlobal("window", undefined);
    const { clearPendingCartIntent, loadPendingCartIntent, savePendingCartIntent } = await import("@/lib/cart/pendingCartIntent");

    expect(() => savePendingCartIntent(intent)).not.toThrow();
    expect(loadPendingCartIntent()).toBeNull();
    expect(() => clearPendingCartIntent()).not.toThrow();
  });
});
