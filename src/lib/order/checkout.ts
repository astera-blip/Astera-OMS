import { normalizeTaiwanMobile } from "@/lib/phone/taiwanMobile";
import { getEffectiveCatalogPriceTwd } from "@/lib/catalog/publicCatalog";

type CatalogVariant = {
  id: string;
  productId: string;
  sku?: string;
  name: string;
  isDefault: boolean;
  priceTwd: number;
};

type CatalogCampaign = {
  id: string;
  productId: string;
  title: string;
  saleType: "inStock" | "preorder" | "rushPurchase" | "waitlist";
  status: "upcoming" | "open" | "closed" | "archived";
  salePriceTwd?: number;
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

export type ShippingMethod = "address" | "seven_eleven" | "family_mart";
export type CheckoutShippingMethod = "seven_eleven";

type CheckoutContext = {
  orderId: string;
  orderNumber?: string;
  checkoutGroupId?: string;
  memberUid: string;
  createdAt: string;
  recipientName: string;
  recipientPhone: string;
  shippingMethod: ShippingMethod;
  shippingAddress?: string;
  shippingStoreInfo?: string;
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
  orderNumber?: string;
  checkoutGroupId?: string;
  memberUid: string;
  status: "awaitingPayment" | "partiallyPaid" | "paid" | "cancelled";
  totalTwd: number;
  recipientName: string;
  recipientPhone: string;
  shippingMethod: ShippingMethod;
  shippingAddress?: string;
  shippingStoreInfo?: string;
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

export type OrderBundle = {
  order: OrderRecord;
  items: OrderItemRecord[];
};

type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateCheckoutCart(
  items: readonly CartLineItem[],
  catalog: readonly CatalogProduct[],
): ValidationResult {
  if (items.length === 0) {
    return { ok: false, error: "購物車是空的。" };
  }

  if (items.length > 50) {
    return { ok: false, error: "購物車項目不可超過 50 筆。" };
  }

  for (const item of items) {
    if (
      !item.productId ||
      !item.variantId ||
      !item.saleCampaignId ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 99
    ) {
      return { ok: false, error: "購物車內容格式不正確。" };
    }

    const product = findProduct(catalog, item.productId);
    const variant = findVariant(catalog, item.variantId);
    const campaign = findCampaign(catalog, item.saleCampaignId);
    if (
      !product ||
      product.product.publishState !== "published" ||
      !variant ||
      variant.productId !== item.productId ||
      !campaign ||
      campaign.productId !== item.productId ||
      campaign.status !== "open"
    ) {
      return { ok: false, error: "購物車內含不可購買商品。" };
    }
  }

  return { ok: true };
}

export function validateCartAddition(
  _currentItems: readonly CartLineItem[],
  nextItem: CartLineItem,
  catalog: readonly CatalogProduct[],
): ValidationResult {
  const nextSaleType = getSaleTypeForItem(nextItem, catalog);

  if (!nextSaleType) {
    return { ok: false, error: "找不到可售活動。" };
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
      const campaign = findCampaign(catalog, item.saleCampaignId);
      const saleType = getSaleTypeForItem(item, catalog);

      return {
        itemCount: summary.itemCount + item.quantity,
        totalTwd:
          summary.totalTwd
          + (variant ? getEffectiveCatalogPriceTwd(variant, campaign) : 0) * item.quantity,
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
        unitPriceTwd: variant ? getEffectiveCatalogPriceTwd(variant, campaign) : 0,
        ...(campaign?.title ? { publicSaleNotes: campaign.title } : {}),
      },
      createdAt: context.createdAt,
      createdBy: context.memberUid,
    };
  });

  return {
    order: {
      id: context.orderId,
      ...(context.orderNumber ? { orderNumber: context.orderNumber } : {}),
      ...(context.checkoutGroupId ? { checkoutGroupId: context.checkoutGroupId } : {}),
      memberUid: context.memberUid,
      status: "awaitingPayment",
      totalTwd: summary.totalTwd,
      recipientName: context.recipientName,
      recipientPhone: context.recipientPhone,
      shippingMethod: context.shippingMethod,
      ...(context.shippingAddress ? { shippingAddress: context.shippingAddress } : {}),
      ...(context.shippingStoreInfo ? { shippingStoreInfo: context.shippingStoreInfo } : {}),
      createdAt: context.createdAt,
      createdBy: context.memberUid,
    },
    items: orderItems,
  };
}

export function groupCartItemsByCampaign(items: readonly CartLineItem[]) {
  const groups = new Map<string, CartLineItem[]>();

  items.forEach((item) => {
    const current = groups.get(item.saleCampaignId) ?? [];
    current.push(item);
    groups.set(item.saleCampaignId, current);
  });

  return [...groups.entries()].map(([saleCampaignId, groupItems]) => ({
    saleCampaignId,
    items: groupItems,
  }));
}

export function createOrderNumber(date: Date, sequence: number) {
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error("Order number sequence must be a positive integer.");
  }

  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");

  return `AST-${yyyy}${mm}${dd}-${String(sequence).padStart(4, "0")}`;
}

export function normalizeRecipientPhone(input: string) {
  const normalized = normalizeTaiwanMobile(input);

  return normalized ?? input.trim().replace(/[\s\-()]/g, "");
}

export function validateShippingDetails(input: {
  recipientName: string;
  recipientPhone: string;
  shippingMethod: ShippingMethod;
}) {
  const errors: Partial<Record<"recipientName" | "recipientPhone" | "shippingMethod", string>> = {};
  const recipientName = input.recipientName.trim();
  const recipientPhone = normalizeRecipientPhone(input.recipientPhone);

  if (!recipientName) {
    errors.recipientName = "請填寫收件人姓名。";
  } else if (recipientName.length > 80) {
    errors.recipientName = "收件人姓名不可超過 80 個字元。";
  }

  if (!normalizeTaiwanMobile(input.recipientPhone)) {
    errors.recipientPhone = "請輸入有效的台灣手機號碼。";
  }

  if (input.shippingMethod !== "seven_eleven") {
    errors.shippingMethod = "目前僅提供 7-Eleven 賣貨便。";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false as const, errors };
  }

  return {
    ok: true as const,
    value: {
      recipientName,
      recipientPhone,
    },
  };
}

function getSaleTypeForItem(
  item: CartLineItem,
  catalog: readonly CatalogProduct[],
): CatalogCampaign["saleType"] | null {
  const campaign = findCampaign(catalog, item.saleCampaignId);

  return campaign && campaign.status === "open" ? campaign.saleType : null;
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
