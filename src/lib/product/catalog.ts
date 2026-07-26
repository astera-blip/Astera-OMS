import type { AuditMetadata, PublishState } from "@/domain/common";

export type ProductClassificationKey = "company" | "artist" | "cp" | "brand" | "series";

export type ProductClassificationLink = {
  id: string;
  label: string;
};

export type ProductClassifications = Partial<
  Record<ProductClassificationKey, ProductClassificationLink>
>;

export type ProductDraft = {
  product: {
    id: string;
    name: string;
    publicDescription: string;
    publishState: PublishState;
    classifications?: ProductClassifications;
  };
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    isDefault: boolean;
    priceTwd: number;
    originalCurrency?: "TWD" | "THB" | "JPY" | "KRW" | "USD";
    originalCost?: number;
  }>;
  campaigns: Array<{
    id: string;
    title: string;
    saleType: "inStock" | "preorder" | "rushPurchase" | "waitlist";
    status: "draft" | "open" | "closed" | "archived";
    requiresSupplement: boolean;
  }>;
};

export type ValidProductDraft = {
  product: {
    id: string;
    name: string;
    publicDescription: string;
    publishState: PublishState;
    classifications?: ProductClassifications;
  };
  variants: Array<{
    id: string;
    productId: string;
    sku: string;
    name: string;
    isDefault: boolean;
    priceTwd: number;
    originalCurrency?: "TWD" | "THB" | "JPY" | "KRW" | "USD";
    originalCost?: number;
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

export type ProductCatalogError = {
  name?: string;
  publicDescription?: string;
  variants?: Array<{ priceTwd?: string; sku?: string; name?: string }>;
  campaigns?: Array<{ title?: string }>;
};

export type ProductCatalogValidationResult =
  | { ok: true; value: ValidProductDraft }
  | { ok: false; errors: ProductCatalogError };

export type PublicProductProjection = {
  id: string;
  name: string;
  publicDescription: string;
  publishState: PublishState;
  classifications?: ProductClassifications;
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    isDefault: boolean;
    priceTwd: number;
  }>;
  campaigns: Array<{
    id: string;
    title: string;
    saleType: "inStock" | "preorder" | "rushPurchase" | "waitlist";
    status: "draft" | "open" | "closed" | "archived";
    requiresSupplement: boolean;
  }>;
};

export type ProductCatalogRecord = {
  product: ValidProductDraft["product"] & AuditMetadata;
  variants: Array<ValidProductDraft["variants"][number] & AuditMetadata>;
  campaigns: Array<ValidProductDraft["campaigns"][number] & AuditMetadata>;
};

export function normalizeProductDraft(
  draft: ProductDraft,
): ProductCatalogValidationResult {
  const name = draft.product.name.trim();
  const publicDescription = draft.product.publicDescription.trim();
  const errors: ProductCatalogError = {};

  if (!name) {
    errors.name = "請填寫商品名稱。";
  }

  if (!publicDescription) {
    errors.publicDescription = "請填寫商品公開說明。";
  }

  const normalizedVariants = draft.variants.map((variant) => ({
    id: variant.id.trim(),
    productId: draft.product.id,
    sku: variant.sku.trim(),
    name: variant.name.trim(),
    isDefault: variant.isDefault,
    priceTwd: variant.priceTwd,
    ...(variant.originalCurrency ? { originalCurrency: variant.originalCurrency } : {}),
    ...(typeof variant.originalCost === "number"
      ? { originalCost: variant.originalCost }
      : {}),
  }));

  const variantErrors: Array<{ priceTwd?: string; sku?: string; name?: string }> = [];

  normalizedVariants.forEach((variant, index) => {
    const fieldErrors: { priceTwd?: string; sku?: string; name?: string } = {};

    if (!variant.sku) {
      fieldErrors.sku = "請填寫 SKU。";
    }
    if (!variant.name) {
      fieldErrors.name = "請填寫規格名稱。";
    }
    if (!Number.isInteger(variant.priceTwd) || variant.priceTwd < 0) {
      fieldErrors.priceTwd = "售價需為 0 以上的整數。";
    }

    if (Object.keys(fieldErrors).length > 0) {
      variantErrors[index] = fieldErrors;
    }
  });

  if (variantErrors.length > 0) {
    errors.variants = variantErrors;
  }

  const normalizedCampaigns = draft.campaigns.map((campaign) => ({
    id: campaign.id.trim(),
    productId: draft.product.id,
    title: campaign.title.trim(),
    saleType: campaign.saleType,
    status: campaign.status,
    requiresSupplement: campaign.requiresSupplement,
  }));

  const campaignErrors: Array<{ title?: string }> = [];

  normalizedCampaigns.forEach((campaign, index) => {
    if (!campaign.title) {
      campaignErrors[index] = { title: "請填寫活動名稱。" };
    }
  });

  if (campaignErrors.length > 0) {
    errors.campaigns = campaignErrors;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      product: {
        id: draft.product.id,
        name,
        publicDescription,
        publishState: draft.product.publishState,
        ...(normalizeClassifications(draft.product.classifications)
          ? { classifications: normalizeClassifications(draft.product.classifications) }
          : {}),
      },
      variants:
        normalizedVariants.length > 0
          ? normalizedVariants
          : [
              {
                id: `${draft.product.id}-default`,
                productId: draft.product.id,
                sku: `${draft.product.id}-default`,
                name: "Default Variant",
                isDefault: true,
                priceTwd: 0,
              },
            ],
      campaigns: normalizedCampaigns,
    },
  };
}

export function buildPublicProductProjection(
  record: ProductCatalogRecord,
): PublicProductProjection {
  const classifications = normalizeClassifications(record.product.classifications);

  return {
    id: record.product.id,
    name: record.product.name,
    publicDescription: record.product.publicDescription,
    publishState: record.product.publishState,
    ...(classifications ? { classifications } : {}),
    variants: record.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      isDefault: variant.isDefault,
      priceTwd: variant.priceTwd,
    })),
    campaigns: record.campaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title.trim(),
      saleType: campaign.saleType,
      status: campaign.status,
      requiresSupplement: campaign.requiresSupplement,
    })),
  };
}

function normalizeClassifications(
  classifications: ProductClassifications | undefined,
): ProductClassifications | undefined {
  if (!classifications) {
    return undefined;
  }

  const entries = (Object.entries(classifications) as Array<
    [ProductClassificationKey, ProductClassificationLink]
  >)
    .map(([key, value]): [ProductClassificationKey, ProductClassificationLink] => [
      key,
      {
        id: value.id.trim(),
        label: value.label.trim(),
      },
    ])
    .filter(([, value]) => value.id && value.label);

  return entries.length > 0
    ? (Object.fromEntries(entries) as ProductClassifications)
    : undefined;
}
