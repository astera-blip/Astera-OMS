import type { ProductClassificationKey } from "@/lib/product/catalog";

export type CatalogClassificationStatus = "active" | "archived";

export type CatalogClassification = {
  id: string;
  label: string;
  normalizedLabelKey?: string;
  status: CatalogClassificationStatus;
  updatedAt?: string;
};

export const classificationCollections: Record<ProductClassificationKey, string> = {
  company: "catalogCompanies",
  artist: "catalogArtists",
  cp: "catalogCps",
  brand: "catalogBrands",
  series: "catalogSeries",
};

export function isProductClassificationKey(value: unknown): value is ProductClassificationKey {
  return typeof value === "string" && Object.hasOwn(classificationCollections, value);
}

export function normalizeCatalogClassification(input: {
  id: string;
  label: string;
  status: CatalogClassificationStatus;
}): CatalogClassification {
  return {
    id: input.id.trim(),
    label: input.label.trim(),
    status: input.status,
  };
}

export function normalizeClassificationLabelKey(label: string) {
  return label.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function validateClassificationLabel(label: unknown):
  | { ok: true; value: string }
  | {
      ok: false;
      error: "classification_label_required" | "classification_label_too_long";
    } {
  const value = typeof label === "string" ? label.trim().replace(/\s+/g, " ") : "";
  if (!value) {
    return { ok: false, error: "classification_label_required" };
  }
  if (value.length > 120) {
    return { ok: false, error: "classification_label_too_long" };
  }
  return { ok: true, value };
}

export function validateClassificationStatus(status: unknown):
  | { ok: true; value: CatalogClassificationStatus }
  | { ok: false; error: "invalid_classification_status" } {
  return status === "active" || status === "archived"
    ? { ok: true, value: status }
    : { ok: false, error: "invalid_classification_status" };
}
