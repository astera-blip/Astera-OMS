import type { ProductClassifications } from "@/lib/product/catalog";
import type { ProductImage } from "@/lib/product/images";

export type PublicCatalogItem = {
  product: {
    id: string;
    name: string;
    publicDescription: string;
    publishState: "draft" | "published" | "archived";
    classifications?: ProductClassifications;
    images?: ProductImage[];
  };
  variants: Array<{
    id: string;
    productId: string;
    name: string;
    isDefault: boolean;
    priceTwd: number;
  }>;
  campaigns: Array<{
    id: string;
    productId: string;
    title: string;
    saleType: "inStock" | "preorder" | "rushPurchase" | "waitlist";
    status: "upcoming" | "open" | "closed" | "archived";
    salePriceTwd?: number;
    requiresSupplement: boolean;
    startsAt?: string;
    endsAt?: string;
    publicNotice?: string;
    supplementNote?: string;
  }>;
};

export function mapPublicCatalogItem(data: unknown): PublicCatalogItem | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const raw = data as Record<string, unknown>;
  const variants = raw.variants;
  const campaigns = raw.campaigns;

  if (
    typeof raw.id !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.publicDescription !== "string" ||
    !isPublishState(raw.publishState) ||
    !Array.isArray(variants) ||
    !Array.isArray(campaigns)
  ) {
    return null;
  }

  return {
    product: {
      id: raw.id,
      name: raw.name,
      publicDescription: raw.publicDescription,
      publishState: raw.publishState,
      ...(isProductClassifications(raw.classifications)
        ? { classifications: raw.classifications }
        : {}),
      ...(isProductImages(raw.images) ? { images: raw.images } : {}),
    },
    variants: variants.filter(isValidVariant).map((variant) => ({
      id: variant.id,
      productId: variant.productId,
      name: variant.name,
      isDefault: variant.isDefault,
      priceTwd: variant.priceTwd,
    })),
    campaigns: campaigns.filter(isValidCampaign).map((campaign) => ({
      id: campaign.id,
      productId: campaign.productId,
      title: campaign.title,
      saleType: campaign.saleType,
      status: campaign.status,
      ...(typeof campaign.salePriceTwd === "number" ? { salePriceTwd: campaign.salePriceTwd } : {}),
      requiresSupplement: campaign.requiresSupplement,
      ...(typeof campaign.startsAt === "string" ? { startsAt: campaign.startsAt } : {}),
      ...(typeof campaign.endsAt === "string" ? { endsAt: campaign.endsAt } : {}),
      ...(typeof campaign.publicNotice === "string" ? { publicNotice: campaign.publicNotice } : {}),
      ...(typeof campaign.supplementNote === "string" ? { supplementNote: campaign.supplementNote } : {}),
    })),
  };
}

function isProductImages(value: unknown): value is ProductImage[] {
  return Array.isArray(value) && value.every((image) => {
    if (!image || typeof image !== "object") {
      return false;
    }
    const entry = image as Record<string, unknown>;
    return typeof entry.id === "string"
      && typeof entry.objectPath === "string"
      && typeof entry.url === "string"
      && typeof entry.altText === "string"
      && typeof entry.width === "number"
      && typeof entry.height === "number"
      && typeof entry.sortOrder === "number";
  });
}

export function getDefaultVariant(item: PublicCatalogItem) {
  return item.variants.find((variant) => variant.isDefault) ?? item.variants[0] ?? null;
}

export function getDefaultCampaign(item: PublicCatalogItem) {
  return item.campaigns.find((campaign) => campaign.status === "open") ?? item.campaigns[0] ?? null;
}

export function findCatalogItem(catalog: PublicCatalogItem[], productId: string) {
  return catalog.find((item) => item.product.id === productId) ?? null;
}

export function findCatalogVariant(catalog: PublicCatalogItem[], variantId: string) {
  return catalog.flatMap((item) => item.variants).find((variant) => variant.id === variantId) ?? null;
}

export function findCatalogCampaign(catalog: PublicCatalogItem[], campaignId: string) {
  return catalog.flatMap((item) => item.campaigns).find((campaign) => campaign.id === campaignId) ?? null;
}

export function getPurchasableVariants(item: PublicCatalogItem) {
  return item.variants;
}

export function getPurchasableCampaigns(item: PublicCatalogItem) {
  return item.campaigns.filter((campaign) => campaign.status === "open");
}

export function getEffectiveCatalogPriceTwd(
  variant: PublicCatalogItem["variants"][number],
  campaign?: PublicCatalogItem["campaigns"][number] | null,
) {
  return typeof campaign?.salePriceTwd === "number" ? campaign.salePriceTwd : variant.priceTwd;
}

function isPublishState(value: unknown): value is PublicCatalogItem["product"]["publishState"] {
  return value === "draft" || value === "published" || value === "archived";
}

function isProductClassifications(
  value: unknown,
): value is NonNullable<PublicCatalogItem["product"]["classifications"]> {
  return !!value && typeof value === "object";
}

function isValidVariant(variant: unknown): variant is PublicCatalogItem["variants"][number] {
  return !!variant
    && typeof variant === "object"
    && typeof (variant as Record<string, unknown>).id === "string"
    && typeof (variant as Record<string, unknown>).productId === "string"
    && typeof (variant as Record<string, unknown>).name === "string"
    && typeof (variant as Record<string, unknown>).isDefault === "boolean"
    && typeof (variant as Record<string, unknown>).priceTwd === "number";
}

function isValidCampaign(campaign: unknown): campaign is PublicCatalogItem["campaigns"][number] {
  return !!campaign
    && typeof campaign === "object"
    && typeof (campaign as Record<string, unknown>).id === "string"
    && typeof (campaign as Record<string, unknown>).productId === "string"
    && typeof (campaign as Record<string, unknown>).title === "string"
    && typeof (campaign as Record<string, unknown>).saleType === "string"
    && isCampaignStatus((campaign as Record<string, unknown>).status)
    && typeof (campaign as Record<string, unknown>).requiresSupplement === "boolean";
}

function isCampaignStatus(value: unknown): value is PublicCatalogItem["campaigns"][number]["status"] {
  return value === "upcoming" || value === "open" || value === "closed" || value === "archived";
}
