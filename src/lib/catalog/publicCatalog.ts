export type PublicCatalogItem = {
  product: {
    id: string;
    name: string;
    publicDescription: string;
    publishState: "draft" | "published" | "archived";
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
  }>;
};

export const publicCatalogSeed: PublicCatalogItem[] = [
  {
    product: {
      id: "prod_001",
      name: "星星耳環",
      publicDescription: "限量現貨，採預約優先。",
      publishState: "published",
    },
    variants: [
      {
        id: "var_001",
        productId: "prod_001",
        sku: "STAR-001",
        name: "Default Variant",
        isDefault: true,
        priceTwd: 880,
      },
    ],
    campaigns: [
      {
        id: "camp_001",
        productId: "prod_001",
        title: "七夕檔期",
        saleType: "preorder",
        status: "open",
        requiresSupplement: true,
      },
    ],
  },
  {
    product: {
      id: "prod_002",
      name: "髮夾",
      publicDescription: "現貨，售完即止。",
      publishState: "published",
    },
    variants: [
      {
        id: "var_002",
        productId: "prod_002",
        sku: "HAIR-001",
        name: "Default Variant",
        isDefault: true,
        priceTwd: 320,
      },
    ],
    campaigns: [
      {
        id: "camp_002",
        productId: "prod_002",
        title: "現貨區",
        saleType: "inStock",
        status: "open",
        requiresSupplement: false,
      },
    ],
  },
];

export function getDefaultVariant(item: PublicCatalogItem) {
  return item.variants.find((variant) => variant.isDefault) ?? item.variants[0];
}

export function getDefaultCampaign(item: PublicCatalogItem) {
  return item.campaigns.find((campaign) => campaign.status === "open") ?? item.campaigns[0];
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
