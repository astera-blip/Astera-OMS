import type { ProductClassifications } from "@/lib/product/catalog";

export type PublicCatalogItem = {
  product: {
    id: string;
    name: string;
    publicDescription: string;
    publishState: "draft" | "published" | "archived";
    classifications?: ProductClassifications;
  };
  variants: Array<{
    id: string;
    productId: string;
    sku: string;
    name: string;
    isDefault: boolean;
    priceTwd: number;
  }>;
  campaigns: Array<{
    id: string;
    productId: string;
    title: string;
    saleType: "inStock" | "preorder" | "rushPurchase" | "waitlist";
    status: "draft" | "open" | "closed" | "archived";
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
    },
    variants: variants.filter(isValidVariant).map((variant) => ({
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
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
      requiresSupplement: campaign.requiresSupplement,
      ...(typeof campaign.startsAt === "string" ? { startsAt: campaign.startsAt } : {}),
      ...(typeof campaign.endsAt === "string" ? { endsAt: campaign.endsAt } : {}),
      ...(typeof campaign.publicNotice === "string" ? { publicNotice: campaign.publicNotice } : {}),
      ...(typeof campaign.supplementNote === "string" ? { supplementNote: campaign.supplementNote } : {}),
    })),
  };
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
    && typeof (variant as Record<string, unknown>).sku === "string"
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
    && typeof (campaign as Record<string, unknown>).status === "string"
    && typeof (campaign as Record<string, unknown>).requiresSupplement === "boolean";
}
