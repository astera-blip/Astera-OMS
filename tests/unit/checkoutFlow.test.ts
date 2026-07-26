import { describe, expect, it } from "vitest";
import {
  buildCartSummary,
  createOrderFromCart,
  validateCartAddition,
} from "../../src/lib/order/checkout";

const catalog = [
  {
    product: {
      id: "prod_001",
      name: "星星耳環",
      publicDescription: "限量現貨",
      publishState: "published" as const,
    },
    variants: [
      {
        id: "var_001",
        productId: "prod_001",
        sku: "STAR-001",
        name: "Default Variant",
        isDefault: true,
        priceTwd: 880,
      },
    ],
    campaigns: [
      {
        id: "camp_001",
        productId: "prod_001",
        title: "七夕檔期",
        saleType: "preorder" as const,
        status: "open" as const,
        requiresSupplement: true,
      },
    ],
  },
  {
    product: {
      id: "prod_002",
      name: "髮夾",
      publicDescription: "現貨",
      publishState: "published" as const,
    },
    variants: [
      {
        id: "var_002",
        productId: "prod_002",
        sku: "HAIR-001",
        name: "Default Variant",
        isDefault: true,
        priceTwd: 320,
      },
    ],
    campaigns: [
      {
        id: "camp_002",
        productId: "prod_002",
        title: "現貨區",
        saleType: "inStock" as const,
        status: "open" as const,
        requiresSupplement: false,
      },
    ],
  },
] as const;

describe("validateCartAddition", () => {
  it("rejects mixing different sale types in one cart", () => {
    expect(
      validateCartAddition(
        [
          {
            productId: "prod_001",
            variantId: "var_001",
            saleCampaignId: "camp_001",
            quantity: 1,
          },
        ],
        {
          productId: "prod_002",
          variantId: "var_002",
          saleCampaignId: "camp_002",
          quantity: 1,
        },
        catalog,
      ),
    ).toEqual({
      ok: false,
      error: "不同 sale type 不能混在同一張訂單。",
    });
  });

  it("rejects adding an item with no open campaign", () => {
    expect(
      validateCartAddition(
        [],
        {
          productId: "prod_003",
          variantId: "var_003",
          saleCampaignId: "camp_closed",
          quantity: 1,
        },
        [
          {
            product: {
              id: "prod_003",
              name: "應援手燈",
              publicDescription: "小圈測試商品",
              publishState: "published" as const,
            },
            variants: [
              {
                id: "var_003",
                productId: "prod_003",
                sku: "LIGHT-001",
                name: "Default Variant",
                isDefault: true,
                priceTwd: 1280,
              },
            ],
            campaigns: [
              {
                id: "camp_closed",
                productId: "prod_003",
                title: "已關閉活動",
                saleType: "preorder" as const,
                status: "closed" as const,
                requiresSupplement: false,
              },
            ],
          },
        ],
      ),
    ).toEqual({
      ok: false,
      error: "找不到可售活動。",
    });
  });
});

describe("createOrderFromCart", () => {
  it("captures product and variant snapshots when creating an order", () => {
    const result = createOrderFromCart(
      {
        orderId: "order_001",
        memberUid: "member-a",
        createdAt: "2026-07-26T00:00:00.000Z",
      },
      [
        {
          productId: "prod_001",
          variantId: "var_001",
          saleCampaignId: "camp_001",
          quantity: 2,
        },
      ],
      catalog,
    );

    expect(result.order).toEqual({
      id: "order_001",
      memberUid: "member-a",
      status: "awaitingPayment",
      totalTwd: 1760,
      createdAt: "2026-07-26T00:00:00.000Z",
      createdBy: "member-a",
    });
    expect(result.items).toEqual([
      {
        id: "order_001-item-1",
        orderId: "order_001",
        memberUid: "member-a",
        productId: "prod_001",
        variantId: "var_001",
        saleCampaignId: "camp_001",
        quantity: 2,
        status: "awaitingPayment",
        snapshot: {
          productName: "星星耳環",
          variantName: "Default Variant",
          sku: "STAR-001",
          unitPriceTwd: 880,
          publicSaleNotes: "七夕檔期",
        },
        createdAt: "2026-07-26T00:00:00.000Z",
        createdBy: "member-a",
      },
    ]);
  });
});

describe("buildCartSummary", () => {
  it("summarizes cart totals and sale type", () => {
    expect(
      buildCartSummary(
        [
          {
            productId: "prod_001",
            variantId: "var_001",
            saleCampaignId: "camp_001",
            quantity: 2,
          },
        ],
        catalog,
      ),
    ).toEqual({
      itemCount: 2,
      totalTwd: 1760,
      saleType: "preorder",
    });
  });
});
