import { describe, expect, it } from "vitest";
import { normalizeCartDraft } from "@/lib/order/cart";

describe("normalizeCartDraft", () => {
  it("trims cart item fields and drops invalid lines", () => {
    expect(
      normalizeCartDraft({
        memberUid: "  member-a  ",
        items: [
          {
            productId: "  product-a  ",
            variantId: "  variant-a  ",
            saleCampaignId: "  campaign-a  ",
            productName: "  Light Stick  ",
            variantName: "  Default  ",
            sku: "  product-a-default  ",
            unitPriceTwd: 1280,
            quantity: 2,
            publicSaleNotes: "  limited stock  ",
          },
          {
            productId: " ",
            variantId: "variant-b",
            saleCampaignId: "campaign-b",
            productName: "broken",
            variantName: "broken",
            sku: "broken",
            unitPriceTwd: 0,
            quantity: 0,
          },
        ],
      }),
    ).toEqual({
      memberUid: "member-a",
      items: [
        {
          productId: "product-a",
          variantId: "variant-a",
          saleCampaignId: "campaign-a",
          productName: "Light Stick",
          variantName: "Default",
          sku: "product-a-default",
          unitPriceTwd: 1280,
          quantity: 2,
          publicSaleNotes: "limited stock",
        },
      ],
    });
  });
});
