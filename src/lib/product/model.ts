export type ProductStatus = "draft" | "active" | "archived";

export type ProductDraft = {
  name: string;
  slug: string;
  status: ProductStatus;
  company?: string;
  artist?: string;
  brand?: string;
  series?: string;
};

export type ValidProductDraft = {
  name: string;
  slug: string;
  status: ProductStatus;
  company?: string;
  artist?: string;
  brand?: string;
  series?: string;
};

export type PublicProductRecord = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  company?: string;
  artist?: string;
  brand?: string;
  series?: string;
};

export type PublicProductProjection = PublicProductRecord & {
  defaultVariantName: string;
  defaultVariantSku: string;
};

export type ProductValidationResult =
  | { ok: true; value: ValidProductDraft }
  | { ok: false; errors: Partial<Record<keyof ProductDraft, string>> };

export type ProductVariantDraft = {
  productId: string;
  name?: string;
  sku?: string;
  isDefault?: boolean;
  isSellable?: boolean;
};

export type SaleCampaignStatus = "draft" | "active" | "archived";

export type SaleCampaignDraft = {
  productId: string;
  name: string;
  code: string;
  status: SaleCampaignStatus;
  startsAt: string;
  endsAt: string;
};

export type ValidSaleCampaignDraft = {
  productId: string;
  name: string;
  code: string;
  status: SaleCampaignStatus;
  startsAt: string;
  endsAt: string;
};

export type ValidProductVariantDraft = {
  productId: string;
  name: string;
  sku: string;
  isDefault: boolean;
  isSellable: boolean;
};

export type SaleCampaignValidationResult =
  | { ok: true; value: ValidSaleCampaignDraft }
  | { ok: false; errors: Partial<Record<keyof SaleCampaignDraft, string>> };


export function normalizeProductDraft(
  draft: ProductDraft,
): ProductValidationResult {
  const name = draft.name.trim();
  const slug = draft.slug.trim();
  const company = draft.company?.trim();
  const artist = draft.artist?.trim();
  const brand = draft.brand?.trim();
  const series = draft.series?.trim();
  const errors: Partial<Record<keyof ProductDraft, string>> = {};

  if (!name) {
    errors.name = "請填寫商品名稱。";
  }

  if (!slug) {
    errors.slug = "請填寫商品代稱。";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      status: draft.status,
      ...(company ? { company } : {}),
      ...(artist ? { artist } : {}),
      ...(brand ? { brand } : {}),
      ...(series ? { series } : {}),
    },
  };
}

export function createDefaultProductVariant(
  draft: ProductVariantDraft,
): ValidProductVariantDraft {
  const sku = draft.sku?.trim() || `${draft.productId}-default`;

  return {
    productId: draft.productId,
    name: "Default",
    sku,
    isDefault: draft.isDefault ?? true,
    isSellable: draft.isSellable ?? true,
  };
}

export function normalizeSaleCampaignDraft(
  draft: SaleCampaignDraft,
): SaleCampaignValidationResult {
  const productId = draft.productId.trim();
  const name = draft.name.trim();
  const code = draft.code.trim();
  const startsAt = draft.startsAt.trim();
  const endsAt = draft.endsAt.trim();
  const errors: Partial<Record<keyof SaleCampaignDraft, string>> = {};

  if (!productId) {
    errors.productId = "請指定商品。";
  }

  if (!name) {
    errors.name = "請填寫活動名稱。";
  }

  if (!code) {
    errors.code = "請填寫活動代碼。";
  }

  if (!startsAt) {
    errors.startsAt = "請填寫開始日期。";
  }

  if (!endsAt) {
    errors.endsAt = "請填寫結束日期。";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      productId,
      name,
      code,
      status: draft.status,
      startsAt,
      endsAt,
    },
  };
}
