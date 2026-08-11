import { describe, expect, it } from "vitest";
import {
  formatCampaignDeadline,
  rankFeaturedProducts,
  saleTypeCustomerLabels,
} from "@/lib/catalog/featuredProducts";
import type { PublicCatalogItem } from "@/lib/catalog/publicCatalog";

function item(
  id: string,
  saleType: PublicCatalogItem["campaigns"][number]["saleType"],
  endsAt: string,
  updatedAt: string,
): PublicCatalogItem {
  return {
    product: {
      id,
      name: id,
      publicDescription: id,
      publishState: "published",
      updatedAt,
    },
    variants: [{
      id: `${id}-variant`,
      productId: id,
      name: "Default",
      isDefault: true,
      priceTwd: 100,
    }],
    campaigns: [{
      id: `${id}-campaign`,
      productId: id,
      title: id,
      saleType,
      status: "open",
      requiresSupplement: false,
      endsAt,
    }],
  };
}

describe("featured products", () => {
  it("prioritizes rush purchases, then closing time, then newest products", () => {
    const ranked = rankFeaturedProducts([
      item("newer", "preorder", "2026-08-10T00:00:00.000Z", "2026-07-29T00:00:00.000Z"),
      item("closing", "preorder", "2026-08-01T00:00:00.000Z", "2026-07-20T00:00:00.000Z"),
      item("rush", "rushPurchase", "2026-08-20T00:00:00.000Z", "2026-07-01T00:00:00.000Z"),
    ]);
    expect(ranked.map((entry) => entry.product.id)).toEqual(["rush", "closing", "newer"]);
  });

  it("filters unpublished products and limits the result to ten", () => {
    const entries = Array.from({ length: 12 }, (_, index) =>
      item(String(index), "inStock", `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`, "2026-07-01"));
    entries[0]!.product.publishState = "archived";
    expect(rankFeaturedProducts(entries)).toHaveLength(10);
    expect(rankFeaturedProducts(entries).some((entry) => entry.product.id === "0")).toBe(false);
  });

  it("returns no recommendations when every published product only has archived campaigns", () => {
    const archivedOnly = item("archived-campaign", "inStock", "2026-09-01T00:00:00.000Z", "2026-07-01");
    archivedOnly.campaigns[0]!.status = "archived";

    expect(rankFeaturedProducts([archivedOnly])).toEqual([]);
  });

  it("uses customer-facing sale type labels", () => {
    expect(saleTypeCustomerLabels).toEqual({
      inStock: "現貨",
      preorder: "預購",
      rushPurchase: "代搶",
      waitlist: "候補",
    });
  });

  it("formats buyer-facing Taipei campaign countdowns", () => {
    const now = new Date("2026-08-11T16:00:00.000Z");

    expect(formatCampaignDeadline("2026-08-14T15:59:00.000Z", now)).toBe("剩 3 天｜8/14 23:59 結單");
    expect(formatCampaignDeadline("2026-08-11T21:59:00.000Z", now)).toBe("剩 6 小時｜今日 05:59 結單");
    expect(formatCampaignDeadline("2026-08-11T15:59:00.000Z", now)).toBe("已截止｜8/11 23:59");
    expect(formatCampaignDeadline(undefined, now)).toBe("結單時間依活動公告");
  });
});
