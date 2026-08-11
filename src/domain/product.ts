import type { AuditMetadata, CurrencyCode, EntityId, PublishState } from "./common";
import type { ProductImage } from "@/lib/product/images";

export type Product = AuditMetadata & {
  id: EntityId;
  sku: string;
  name: string;
  publicDescription: string;
  publishState: PublishState;
  images?: ProductImage[];
};

export type ProductVariant = AuditMetadata & {
  id: EntityId;
  productId: EntityId;
  sku: string;
  name: string;
  isDefault: boolean;
  priceTwd: number;
  originalCurrency?: CurrencyCode;
  originalCost?: number;
};

export type SaleCampaign = AuditMetadata & {
  id: EntityId;
  productId: EntityId;
  title: string;
  saleType: "inStock" | "preorder" | "rushPurchase" | "waitlist";
  status: "upcoming" | "open" | "closed" | "archived";
  salePriceTwd?: number;
  startsAt?: string;
  endsAt?: string;
  requiresSupplement: boolean;
};
