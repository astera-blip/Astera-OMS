import type { IsoDateTime } from "@/domain/common";
import type { ProductDraft, ValidProductDraft } from "@/lib/product/catalog";
import { normalizeProductDraft } from "@/lib/product/catalog";

export type CatalogChangeRequestStatus = "submitted" | "rejected" | "approved";

export type CatalogChangeRequestRevision = {
  revision: number;
  title: string;
  changeReason: string;
  product: ValidProductDraft;
  internalNote?: string;
  payloadDigest: string;
  baseProductVersion: string | null;
  baseVariants: Array<{ id: string; name: string }>;
  baseCampaigns: Array<{ id: string; title: string }>;
  status: "rejected";
  reviewedBy: string;
  reviewedAt: IsoDateTime;
  reviewReason: string;
};

export type CatalogChangeRequest = {
  id: string;
  title: string;
  changeReason: string;
  product: ValidProductDraft;
  internalNote?: string;
  status: CatalogChangeRequestStatus;
  revision: number;
  payloadDigest: string;
  baseProductVersion: string | null;
  baseVariants: Array<{ id: string; name: string }>;
  baseCampaigns: Array<{ id: string; title: string }>;
  revisionHistory?: CatalogChangeRequestRevision[];
  createdBy: string;
  createdAt: IsoDateTime;
  updatedBy: string;
  updatedAt: IsoDateTime;
  reviewedBy?: string;
  reviewedAt?: IsoDateTime;
  reviewReason?: string;
  reviewDecisionDigest?: string;
  appliedProductId?: string;
};

export type CatalogDraftInput = {
  title?: unknown;
  changeReason?: unknown;
  product?: unknown;
  internalNote?: unknown;
  baseProductVersion?: unknown;
};

export type ValidCatalogDraftInput = {
  title: string;
  changeReason: string;
  product: ValidProductDraft;
  internalNote?: string;
  baseProductVersion: string | null;
};

export function validateCatalogDraftInput(input: CatalogDraftInput):
  | { ok: true; value: ValidCatalogDraftInput }
  | { ok: false; error: "catalog_change_title_required" | "catalog_change_reason_required" | "catalog_change_base_version_required" | "catalog_change_images_owner_only" | "invalid_product" } {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    return { ok: false, error: "catalog_change_title_required" };
  }

  const changeReason = typeof input.changeReason === "string" ? input.changeReason.trim() : "";
  if (!changeReason) {
    return { ok: false, error: "catalog_change_reason_required" };
  }

  const product = input.product;
  if (hasProductImages(product)) {
    return { ok: false, error: "catalog_change_images_owner_only" };
  }
  if (!isStrictProductDraft(product)) {
    return { ok: false, error: "invalid_product" };
  }

  const normalized = normalizeProductDraft(product);
  if (!normalized.ok) {
    return { ok: false, error: "invalid_product" };
  }

  const baseProductVersion = input.baseProductVersion;
  if (baseProductVersion !== null && (typeof baseProductVersion !== "string" || !baseProductVersion.trim())) {
    return { ok: false, error: "catalog_change_base_version_required" };
  }

  const internalNote = typeof input.internalNote === "string" ? input.internalNote.trim() : "";
  return {
    ok: true,
    value: {
      title,
      changeReason,
      product: normalized.value,
      ...(internalNote ? { internalNote } : {}),
      baseProductVersion: typeof baseProductVersion === "string"
        ? baseProductVersion.trim()
        : null,
    },
  };
}

function hasProductImages(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const product = (value as { product?: unknown }).product;
  return Boolean(product && typeof product === "object" && "images" in product);
}

function isStrictProductDraft(value: unknown): value is ProductDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  if (!draft.product || typeof draft.product !== "object") return false;
  const product = draft.product as Record<string, unknown>;
  if (
    typeof product.id !== "string"
    || (product.sku !== undefined && typeof product.sku !== "string")
    || typeof product.name !== "string"
    || typeof product.publicDescription !== "string"
    || !isOneOf(product.publishState, ["draft", "published", "archived"])
    || !isValidClassifications(product.classifications)
    || !Array.isArray(draft.variants)
    || !Array.isArray(draft.campaigns)
  ) return false;

  const variantIds = new Set<string>();
  if (draft.variants.length === 0) return false;
  for (const value of draft.variants) {
    if (!value || typeof value !== "object") return false;
    const variant = value as Record<string, unknown>;
    if (
      typeof variant.id !== "string"
      || typeof variant.sku !== "string"
      || typeof variant.name !== "string"
      || typeof variant.isDefault !== "boolean"
      || typeof variant.priceTwd !== "number"
      || (variant.originalCurrency !== undefined
        && !isOneOf(variant.originalCurrency, ["TWD", "THB", "JPY", "KRW", "USD"]))
      || (variant.originalCost !== undefined
        && (typeof variant.originalCost !== "number"
          || !Number.isFinite(variant.originalCost)
          || variant.originalCost < 0))
      || hasDuplicateNonEmptyId(variantIds, variant.id)
    ) return false;
  }
  if (draft.variants.length > 0 && draft.variants.filter(
    (value) => (value as Record<string, unknown>).isDefault === true,
  ).length !== 1) return false;

  const campaignIds = new Set<string>();
  for (const value of draft.campaigns) {
    if (!value || typeof value !== "object") return false;
    const campaign = value as Record<string, unknown>;
    if (
      typeof campaign.id !== "string"
      || typeof campaign.title !== "string"
      || !isOneOf(campaign.saleType, ["inStock", "preorder", "rushPurchase", "waitlist"])
      || !isOneOf(campaign.status, ["upcoming", "open", "closed", "archived"])
      || typeof campaign.requiresSupplement !== "boolean"
      || (campaign.salePriceTwd !== undefined && typeof campaign.salePriceTwd !== "number")
      || (campaign.startsAt !== undefined && typeof campaign.startsAt !== "string")
      || (campaign.endsAt !== undefined && typeof campaign.endsAt !== "string")
      || (campaign.publicNotice !== undefined && typeof campaign.publicNotice !== "string")
      || (campaign.supplementNote !== undefined && typeof campaign.supplementNote !== "string")
      || hasDuplicateNonEmptyId(campaignIds, campaign.id)
    ) return false;
  }
  return true;
}

function isValidClassifications(value: unknown) {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const allowedKeys = new Set(["company", "artist", "cp", "brand", "series"]);
  return Object.entries(value).every(([key, link]) => {
    if (!allowedKeys.has(key) || !link || typeof link !== "object") return false;
    const entry = link as Record<string, unknown>;
    return typeof entry.id === "string" && typeof entry.label === "string";
  });
}

function isOneOf(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === "string" && allowed.includes(value);
}

function hasDuplicateNonEmptyId(ids: Set<string>, value: string) {
  const id = value.trim();
  if (!id) return false;
  if (ids.has(id)) return true;
  ids.add(id);
  return false;
}
