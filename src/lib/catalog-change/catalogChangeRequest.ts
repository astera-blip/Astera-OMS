import type { IsoDateTime } from "@/domain/common";
import type { ProductDraft, ValidProductDraft } from "@/lib/product/catalog";
import { normalizeProductDraft } from "@/lib/product/catalog";

export type CatalogChangeRequestStatus = "submitted" | "rejected" | "approved";

export type CatalogChangeRequest = {
  id: string;
  title: string;
  changeReason: string;
  product: ValidProductDraft;
  internalNote?: string;
  status: CatalogChangeRequestStatus;
  revision: number;
  payloadDigest: string;
  createdBy: string;
  createdAt: IsoDateTime;
  updatedBy: string;
  updatedAt: IsoDateTime;
  reviewedBy?: string;
  reviewedAt?: IsoDateTime;
  reviewReason?: string;
};

export type CatalogDraftInput = {
  title?: unknown;
  changeReason?: unknown;
  product?: unknown;
  internalNote?: unknown;
};

export type ValidCatalogDraftInput = {
  title: string;
  changeReason: string;
  product: ValidProductDraft;
  internalNote?: string;
};

export function validateCatalogDraftInput(input: CatalogDraftInput):
  | { ok: true; value: ValidCatalogDraftInput }
  | { ok: false; error: "catalog_change_title_required" | "catalog_change_reason_required" | "invalid_product" } {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    return { ok: false, error: "catalog_change_title_required" };
  }

  const changeReason = typeof input.changeReason === "string" ? input.changeReason.trim() : "";
  if (!changeReason) {
    return { ok: false, error: "catalog_change_reason_required" };
  }

  const product = input.product as Partial<ProductDraft> | null | undefined;
  if (!product?.product || !Array.isArray(product.variants) || !Array.isArray(product.campaigns)) {
    return { ok: false, error: "invalid_product" };
  }

  const normalized = normalizeProductDraft(product as ProductDraft);
  if (!normalized.ok) {
    return { ok: false, error: "invalid_product" };
  }

  const internalNote = typeof input.internalNote === "string" ? input.internalNote.trim() : "";
  return {
    ok: true,
    value: {
      title,
      changeReason,
      product: normalized.value,
      ...(internalNote ? { internalNote } : {}),
    },
  };
}
