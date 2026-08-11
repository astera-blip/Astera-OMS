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

export function formatCampaignDeadline(endsAt: string | undefined, now = new Date()) {
  if (!endsAt) {
    return "結單時間依活動公告";
  }

  const deadline = new Date(endsAt);
  if (!Number.isFinite(deadline.getTime())) {
    return "結單時間依活動公告";
  }

  const deadlineParts = taipeiDateParts(deadline);
  const nowParts = taipeiDateParts(now);
  const shortDeadline = `${deadlineParts.month}/${deadlineParts.day} ${deadlineParts.hour}:${deadlineParts.minute}`;
  const remainingMs = deadline.getTime() - now.getTime();

  if (remainingMs <= 0) {
    return `已截止｜${shortDeadline}`;
  }

  const sameTaipeiDay = deadlineParts.year === nowParts.year
    && deadlineParts.month === nowParts.month
    && deadlineParts.day === nowParts.day;
  if (sameTaipeiDay) {
    return `剩 ${Math.max(1, Math.ceil(remainingMs / 3_600_000))} 小時｜今日 ${deadlineParts.hour}:${deadlineParts.minute} 結單`;
  }

  if (remainingMs < 24 * 3_600_000) {
    return `剩 ${Math.max(1, Math.ceil(remainingMs / 3_600_000))} 小時｜${shortDeadline} 結單`;
  }

  return `剩 ${Math.ceil(remainingMs / 86_400_000)} 天｜${shortDeadline} 結單`;
}

function taipeiDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour").padStart(2, "0"),
    minute: value("minute").padStart(2, "0"),
  };
}

function dateValue(value: string | undefined, fallback: number) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : fallback;
}
