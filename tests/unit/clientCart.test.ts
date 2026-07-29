import { describe, expect, it } from "vitest";
import { mergeClientAndCloudCart, shouldSyncCloudCart } from "../../src/lib/cart/clientCart";

describe("mergeClientAndCloudCart", () => {
  it("keeps the local cart when the cloud cart is empty", () => {
    expect(
      mergeClientAndCloudCart(
        [],
        [
          {
            productId: "prod_001",
            variantId: "var_001",
            saleCampaignId: "camp_001",
            quantity: 1,
          },
        ],
      ),
    ).toEqual([
      {
        productId: "prod_001",
        variantId: "var_001",
        saleCampaignId: "camp_001",
        quantity: 1,
      },
    ]);
  });

  it("merges cloud and local carts without dropping distinct items", () => {
    expect(
      mergeClientAndCloudCart(
        [
          {
            productId: "prod_001",
            variantId: "var_001",
            saleCampaignId: "camp_001",
            quantity: 1,
          },
        ],
        [
          {
            productId: "prod_002",
            variantId: "var_002",
            saleCampaignId: "camp_002",
            quantity: 2,
          },
        ],
      ),
    ).toEqual([
      {
        productId: "prod_001",
        variantId: "var_001",
        saleCampaignId: "camp_001",
        quantity: 1,
      },
      {
        productId: "prod_002",
        variantId: "var_002",
        saleCampaignId: "camp_002",
        quantity: 2,
      },
    ]);
  });
});

describe("shouldSyncCloudCart", () => {
  it("does not overwrite a signed-in cart before that member's cloud cart has loaded", () => {
    expect(shouldSyncCloudCart("member-a", null)).toBe(false);
    expect(shouldSyncCloudCart("member-a", "member-b")).toBe(false);
    expect(shouldSyncCloudCart("member-a", "member-a")).toBe(true);
  });

  it("continues to save an anonymous cart locally", () => {
    expect(shouldSyncCloudCart(null, null)).toBe(true);
  });
});
