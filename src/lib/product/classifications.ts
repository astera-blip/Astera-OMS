import type { ProductClassificationKey } from "@/lib/product/catalog";

export type CatalogClassificationStatus = "active" | "archived";

export type CatalogClassification = {
  id: string;
  label: string;
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
