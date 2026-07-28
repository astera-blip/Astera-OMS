import type { PublicCatalogItem } from "@/lib/catalog/publicCatalog";

export const saleTypeCustomerLabels = {
  inStock: "現貨",
  preorder: "預購",
  rushPurchase: "代搶",
  waitlist: "候補",
} as const;

export const campaignStatusCustomerLabels = {
  upcoming: "即將開始",
  open: "開放中",
  closed: "已結束",
  archived: "已封存",
} as const;

export function rankFeaturedProducts(items: readonly PublicCatalogItem[]) {
  return items
    .filter((item) =>
      item.product.publishState === "published"
      && item.campaigns.some((campaign) => campaign.status !== "archived"))
    .sort((left, right) => {
      const leftCampaign = featuredCampaign(left);
      const rightCampaign = featuredCampaign(right);
      const leftRush = leftCampaign?.saleType === "rushPurchase" ? 1 : 0;
      const rightRush = rightCampaign?.saleType === "rushPurchase" ? 1 : 0;
      if (leftRush !== rightRush) {
        return rightRush - leftRush;
      }
      const leftEnds = dateValue(leftCampaign?.endsAt, Number.POSITIVE_INFINITY);
      const rightEnds = dateValue(rightCampaign?.endsAt, Number.POSITIVE_INFINITY);
      if (leftEnds !== rightEnds) {
        return leftEnds - rightEnds;
      }
      const leftUpdated = dateValue(left.product.updatedAt, 0);
      const rightUpdated = dateValue(right.product.updatedAt, 0);
      if (leftUpdated !== rightUpdated) {
        return rightUpdated - leftUpdated;
      }
      return left.product.name.localeCompare(right.product.name);
    })
    .slice(0, 10);
}

export function featuredCampaign(item: PublicCatalogItem) {
  return item.campaigns.find((campaign) => campaign.status === "open")
    ?? item.campaigns.find((campaign) => campaign.status === "upcoming")
    ?? item.campaigns.find((campaign) => campaign.status === "closed")
    ?? null;
}

function dateValue(value: string | undefined, fallback: number) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : fallback;
}
