import type { AuditMetadata, PublishState } from "@/domain/common";
import type { ProductImage } from "@/lib/product/images";

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
    sku?: string;
    name: string;
    publicDescription: string;
    publishState: PublishState;
    classifications?: ProductClassifications;
    images?: ProductImage[];
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
    status: "upcoming" | "open" | "closed" | "archived";
    salePriceTwd?: number;
    requiresSupplement: boolean;
    startsAt?: string;
    endsAt?: string;
    publicNotice?: string;
    supplementNote?: string;
  }>;
};

export type ValidProductDraft = {
  product: {
    id: string;
    sku: string;
    name: string;
    publicDescription: string;
    publishState: PublishState;
    classifications?: ProductClassifications;
    images?: ProductImage[];
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
    status: "upcoming" | "open" | "closed" | "archived";
    salePriceTwd?: number;
    requiresSupplement: boolean;
    startsAt?: string;
    endsAt?: string;
    publicNotice?: string;
    supplementNote?: string;
  }>;
};

export type ProductCatalogError = {
  name?: string;
  publicDescription?: string;
  variants?: Array<{ priceTwd?: string; sku?: string; name?: string }>;
  campaigns?: Array<{
    title?: string;
    salePriceTwd?: string;
    startsAt?: string;
    endsAt?: string;
    publicNotice?: string;
    supplementNote?: string;
  }>;
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
  images?: ProductImage[];
  variants: Array<{
    id: string;
    productId: string;
    name: string;
    isDefault: boolean;
    priceTwd: number;
  }>;
  campaigns: Array<{
    id: string;
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
    sku: variant.sku.trim() || createVariantSku(draft.product.sku?.trim() || createProductSkuFromId(draft.product.id), 1),
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
    ...(typeof campaign.salePriceTwd === "number" ? { salePriceTwd: campaign.salePriceTwd } : {}),
    requiresSupplement: campaign.requiresSupplement,
    ...(campaign.startsAt?.trim() ? { startsAt: campaign.startsAt.trim() } : {}),
    ...(campaign.endsAt?.trim() ? { endsAt: campaign.endsAt.trim() } : {}),
    ...(campaign.publicNotice?.trim() ? { publicNotice: campaign.publicNotice.trim() } : {}),
    ...(campaign.supplementNote?.trim() ? { supplementNote: campaign.supplementNote.trim() } : {}),
  }));

  const campaignErrors: NonNullable<ProductCatalogError["campaigns"]> = [];

  normalizedCampaigns.forEach((campaign, index) => {
    const fieldErrors: NonNullable<ProductCatalogError["campaigns"]>[number] = {};
    if (!campaign.title) {
      fieldErrors.title = "請填寫活動名稱。";
    }
    if (
      typeof campaign.salePriceTwd === "number"
      && (!Number.isInteger(campaign.salePriceTwd) || campaign.salePriceTwd < 0)
    ) {
      fieldErrors.salePriceTwd = "活動價需為 0 以上的整數。";
    }
    if (campaign.startsAt && !isDateTimeLocalValue(campaign.startsAt)) {
      fieldErrors.startsAt = "開始時間格式需為 YYYY-MM-DDTHH:mm。";
    }
    if (campaign.endsAt && !isDateTimeLocalValue(campaign.endsAt)) {
      fieldErrors.endsAt = "結單時間格式需為 YYYY-MM-DDTHH:mm。";
    }
    if (campaign.startsAt && campaign.endsAt && campaign.startsAt >= campaign.endsAt) {
      fieldErrors.endsAt = "結單時間必須晚於開始時間。";
    }
    if (campaign.publicNotice && campaign.publicNotice.length > 300) {
      fieldErrors.publicNotice = "公開提醒不可超過 300 個字元。";
    }
    if (campaign.supplementNote && campaign.supplementNote.length > 300) {
      fieldErrors.supplementNote = "二補說明不可超過 300 個字元。";
    }
    if (Object.keys(fieldErrors).length > 0) {
      campaignErrors[index] = fieldErrors;
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
        sku: draft.product.sku?.trim() || createProductSkuFromId(draft.product.id),
        name,
        publicDescription,
        publishState: draft.product.publishState,
        ...(draft.product.images ? { images: draft.product.images } : {}),
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
                sku: createVariantSku(draft.product.sku?.trim() || createProductSkuFromId(draft.product.id), 1),
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
    ...(record.product.images ? { images: record.product.images } : {}),
    variants: record.variants.map((variant) => ({
      id: variant.id,
      productId: variant.productId,
      name: variant.name,
      isDefault: variant.isDefault,
      priceTwd: variant.priceTwd,
    })),
    campaigns: record.campaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title.trim(),
      saleType: campaign.saleType,
      status: resolveCampaignStatus(campaign, new Date()),
      ...(typeof campaign.salePriceTwd === "number" ? { salePriceTwd: campaign.salePriceTwd } : {}),
      requiresSupplement: campaign.requiresSupplement,
      ...(campaign.startsAt ? { startsAt: campaign.startsAt } : {}),
      ...(campaign.endsAt ? { endsAt: campaign.endsAt } : {}),
      ...(campaign.publicNotice ? { publicNotice: campaign.publicNotice } : {}),
      ...(campaign.supplementNote ? { supplementNote: campaign.supplementNote } : {}),
    })),
  };
}

export function createProductSku(sequence: number) {
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error("Product SKU sequence must be a positive integer.");
  }

  return `AST-P${String(sequence).padStart(6, "0")}`;
}

export function createVariantSku(productSku: string, sequence: number) {
  if (!/^AST-P[0-9]{6}$/.test(productSku)) {
    throw new Error("Variant SKU requires a valid product SKU.");
  }
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error("Variant SKU sequence must be a positive integer.");
  }

  return `${productSku}-V${String(sequence).padStart(3, "0")}`;
}

export function assignServerManagedSkus(
  draft: ProductDraft,
  input: {
    productSku: string;
    existingVariantSkusById: ReadonlyMap<string, string>;
  },
): ProductDraft {
  let nextVariantSequence = getHighestVariantSkuSequence(
    input.productSku,
    [...input.existingVariantSkusById.values()],
  ) + 1;

  return {
    ...draft,
    product: {
      ...draft.product,
      sku: input.productSku,
    },
    variants: draft.variants.map((variant) => {
      const existingSku = input.existingVariantSkusById.get(variant.id);
      const sku = existingSku ?? createVariantSku(input.productSku, nextVariantSequence);

      if (!existingSku) {
        nextVariantSequence += 1;
      }

      return {
        ...variant,
        sku,
      };
    }),
  };
}

function getHighestVariantSkuSequence(productSku: string, skus: string[]) {
  const prefix = `${productSku}-V`;

  return skus.reduce((highest, sku) => {
    if (!sku.startsWith(prefix)) {
      return highest;
    }
    const sequence = Number(sku.slice(prefix.length));

    return Number.isInteger(sequence) && sequence > highest ? sequence : highest;
  }, 0);
}

export function resolveCampaignStatus(
  campaign: Pick<ValidProductDraft["campaigns"][number], "status" | "startsAt" | "endsAt">,
  now: Date,
): ValidProductDraft["campaigns"][number]["status"] {
  if (campaign.status === "archived") {
    return "archived";
  }

  const nowTime = now.getTime();
  const startsAt = campaign.startsAt ? new Date(campaign.startsAt).getTime() : null;
  const endsAt = campaign.endsAt ? new Date(campaign.endsAt).getTime() : null;

  if (startsAt !== null && Number.isFinite(startsAt) && startsAt > nowTime) {
    return "upcoming";
  }
  if (endsAt !== null && Number.isFinite(endsAt) && endsAt <= nowTime) {
    return "closed";
  }

  return campaign.status === "upcoming" ? "upcoming" : "open";
}

export function getEffectiveVariantPriceTwd(
  variant: Pick<ValidProductDraft["variants"][number], "priceTwd">,
  campaign?: Pick<ValidProductDraft["campaigns"][number], "salePriceTwd"> | null,
) {
  return typeof campaign?.salePriceTwd === "number" ? campaign.salePriceTwd : variant.priceTwd;
}

function isDateTimeLocalValue(value: string) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(value);
}

function createProductSkuFromId(productId: string) {
  const numericSuffix = productId.match(/([0-9]+)$/)?.[1];
  const sequence = numericSuffix ? Number(numericSuffix) : 1;

  return createProductSku(Number.isInteger(sequence) && sequence > 0 ? sequence : 1);
}

function normalizeClassifications(
  classifications: ProductClassifications | undefined,
): ProductClassifications | undefined {
  if (!classifications) {
    return undefined;
  }

  const entries = (Object.entries(classifications) as Array<
    [ProductClassificationKey, ProductClassificationLink | undefined]
  >)
    .flatMap(([key, value]) => {
      if (!value) {
        return [];
      }

      return [[
        key,
        {
          id: value.id.trim(),
          label: value.label.trim(),
        },
      ] satisfies [ProductClassificationKey, ProductClassificationLink]];
    })
    .filter(([, value]) => value.id && value.label);

  return entries.length > 0
    ? (Object.fromEntries(entries) as ProductClassifications)
    : undefined;
}
