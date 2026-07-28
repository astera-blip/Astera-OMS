import { describe, expect, it } from "vitest";
import { mergeClientAndCloudCart } from "../../src/lib/cart/clientCart";

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
