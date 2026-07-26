type CatalogVariant = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  isDefault: boolean;
  priceTwd: number;
};

type CatalogCampaign = {
  id: string;
  productId: string;
  title: string;
  saleType: "inStock" | "preorder" | "rushPurchase" | "waitlist";
  status: "draft" | "open" | "closed" | "archived";
  requiresSupplement: boolean;
};

type CatalogProduct = {
  product: {
    id: string;
    name: string;
    publicDescription: string;
    publishState: "draft" | "published" | "archived";
  };
  variants: readonly CatalogVariant[];
  campaigns: readonly CatalogCampaign[];
};

export type CartLineItem = {
  productId: string;
  variantId: string;
  saleCampaignId: string;
  quantity: number;
};

type CheckoutContext = {
  orderId: string;
  memberUid: string;
  createdAt: string;
};

type OrderSnapshot = {
  productName: string;
  variantName: string;
  sku: string;
  unitPriceTwd: number;
  publicSaleNotes?: string;
};

export type OrderRecord = {
  id: string;
  memberUid: string;
  status: "awaitingPayment" | "partiallyPaid" | "paid" | "cancelled";
  totalTwd: number;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type OrderItemRecord = {
  id: string;
  orderId: string;
  memberUid: string;
  productId: string;
  variantId: string;
  saleCampaignId: string;
  quantity: number;
  status: "awaitingPayment" | "paid" | "cancelRequested" | "cancelled";
  snapshot: OrderSnapshot;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
};

type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateCartAddition(
  currentItems: readonly CartLineItem[],
  nextItem: CartLineItem,
  catalog: readonly CatalogProduct[],
): ValidationResult {
  const currentSaleType = getCartSaleType(currentItems, catalog);
  const nextSaleType = getSaleTypeForItem(nextItem, catalog);

  if (!nextSaleType) {
    return { ok: false, error: "找不到可售活動。" };
  }

  if (currentSaleType && currentSaleType !== nextSaleType) {
    return { ok: false, error: "不同 sale type 不能混在同一張訂單。" };
  }

  return { ok: true };
}

export function buildCartSummary(
  items: readonly CartLineItem[],
  catalog: readonly CatalogProduct[],
): {
  itemCount: number;
  totalTwd: number;
  saleType: CatalogCampaign["saleType"] | null;
} {
  return items.reduce(
    (summary, item) => {
      const variant = findVariant(catalog, item.variantId);
      const saleType = getSaleTypeForItem(item, catalog);

      return {
        itemCount: summary.itemCount + item.quantity,
        totalTwd: summary.totalTwd + (variant?.priceTwd ?? 0) * item.quantity,
        saleType: summary.saleType ?? saleType ?? null,
      };
    },
    { itemCount: 0, totalTwd: 0, saleType: null as CatalogCampaign["saleType"] | null },
  );
}

export function createOrderFromCart(
  context: CheckoutContext,
  items: readonly CartLineItem[],
  catalog: readonly CatalogProduct[],
): { order: OrderRecord; items: OrderItemRecord[] } {
  const summary = buildCartSummary(items, catalog);
  const orderItems = items.map((item, index) => {
    const variant = findVariant(catalog, item.variantId);
    const campaign = findCampaign(catalog, item.saleCampaignId);
    const product = findProduct(catalog, item.productId);

    return {
      id: `${context.orderId}-item-${index + 1}`,
      orderId: context.orderId,
      memberUid: context.memberUid,
      productId: item.productId,
      variantId: item.variantId,
      saleCampaignId: item.saleCampaignId,
      quantity: item.quantity,
      status: "awaitingPayment" as const,
      snapshot: {
        productName: product?.product.name ?? "",
        variantName: variant?.name ?? "",
        sku: variant?.sku ?? "",
        unitPriceTwd: variant?.priceTwd ?? 0,
        ...(campaign?.title ? { publicSaleNotes: campaign.title } : {}),
      },
      createdAt: context.createdAt,
      createdBy: context.memberUid,
    };
  });

  return {
    order: {
      id: context.orderId,
      memberUid: context.memberUid,
      status: "awaitingPayment",
      totalTwd: summary.totalTwd,
      createdAt: context.createdAt,
      createdBy: context.memberUid,
    },
    items: orderItems,
  };
}

function getCartSaleType(
  items: readonly CartLineItem[],
  catalog: readonly CatalogProduct[],
): CatalogCampaign["saleType"] | null {
  return items.reduce<CatalogCampaign["saleType"] | null>((current, item) => {
    const next = getSaleTypeForItem(item, catalog);
    if (!next) {
      return current;
    }
    return current ?? next;
  }, null);
}

function getSaleTypeForItem(
  item: CartLineItem,
  catalog: readonly CatalogProduct[],
): CatalogCampaign["saleType"] | null {
  return findCampaign(catalog, item.saleCampaignId)?.saleType ?? null;
}

function findProduct(catalog: readonly CatalogProduct[], productId: string) {
  return catalog.find((entry) => entry.product.id === productId);
}

function findVariant(catalog: readonly CatalogProduct[], variantId: string) {
  return catalog.flatMap((entry) => entry.variants).find((variant) => variant.id === variantId);
}

function findCampaign(catalog: readonly CatalogProduct[], campaignId: string) {
  return catalog.flatMap((entry) => entry.campaigns).find((campaign) => campaign.id === campaignId);
}
