import { describe, expect, it } from "vitest";
import {
  buildPublicProductProjection,
  createProductSku,
  createVariantSku,
  assignServerManagedSkus,
  getEffectiveVariantPriceTwd,
  normalizeProductDraft,
  resolveCampaignStatus,
} from "../../src/lib/product/catalog";
import {
  getDefaultCampaign,
  getDefaultVariant,
  mapPublicCatalogItem,
  type PublicCatalogItem,
} from "../../src/lib/catalog/publicCatalog";

describe("normalizeProductDraft", () => {
  it("trims product data and creates a default variant when none is provided", () => {
    expect(
      normalizeProductDraft({
        product: {
          id: "prod_001",
          name: "  星星耳環  ",
          publicDescription: "  限量現貨  ",
          publishState: "published",
        },
        variants: [],
        campaigns: [],
      }),
    ).toEqual({
      ok: true,
      value: {
        product: {
          id: "prod_001",
          sku: "AST-P000001",
          name: "星星耳環",
          publicDescription: "限量現貨",
          publishState: "published",
        },
        variants: [
          {
            id: "prod_001-default",
            productId: "prod_001",
            sku: "AST-P000001-V001",
            name: "Default Variant",
            isDefault: true,
            priceTwd: 0,
          },
        ],
        campaigns: [],
      },
    });
  });

  it("ignores unselected classifications instead of throwing", () => {
    expect(
      normalizeProductDraft({
        product: {
          id: "prod_003",
          name: "  應援毛巾  ",
          publicDescription: "  小圈測試商品  ",
          publishState: "published",
          classifications: {
            company: { id: "company_001", label: "  Astera Goods  " },
            artist: undefined,
            cp: undefined,
            brand: { id: "brand_001", label: "  Official Shop  " },
            series: undefined,
          },
        },
        variants: [],
        campaigns: [],
      }),
    ).toEqual({
      ok: true,
      value: {
        product: {
          id: "prod_003",
          sku: "AST-P000003",
          name: "應援毛巾",
          publicDescription: "小圈測試商品",
          publishState: "published",
          classifications: {
            company: { id: "company_001", label: "Astera Goods" },
            brand: { id: "brand_001", label: "Official Shop" },
          },
        },
        variants: [
          {
            id: "prod_003-default",
            productId: "prod_003",
            sku: "AST-P000003-V001",
            name: "Default Variant",
            isDefault: true,
            priceTwd: 0,
          },
        ],
        campaigns: [],
      },
    });
  });

  it("returns field errors for missing product name and invalid variant price", () => {
    expect(
      normalizeProductDraft({
        product: {
          id: "prod_002",
          name: " ",
          publicDescription: "  ",
          publishState: "draft",
        },
        variants: [
          {
            id: "var_001",
            sku: "  SKU-001  ",
            name: "  主要規格  ",
            isDefault: true,
            priceTwd: -1,
          },
        ],
        campaigns: [],
      }),
    ).toEqual({
      ok: false,
      errors: {
        name: "請填寫商品名稱。",
        publicDescription: "請填寫商品公開說明。",
        variants: [
          {
            priceTwd: "售價需為 0 以上的整數。",
          },
        ],
      },
    });
  });
});

describe("buildPublicProductProjection", () => {
  it("omits internal cost and notes from the public projection", () => {
    expect(
      buildPublicProductProjection({
        product: {
          id: "prod_001",
          sku: "AST-P000001",
          name: "星星耳環",
          publicDescription: "限量現貨",
          publishState: "published",
          createdAt: "2026-07-26T00:00:00.000Z",
          createdBy: "system",
          updatedAt: "2026-07-26T00:00:00.000Z",
          updatedBy: "system",
        },
        variants: [
          {
            id: "var_001",
            productId: "prod_001",
            sku: "STAR-001",
            name: "Default Variant",
            isDefault: true,
            priceTwd: 880,
            originalCurrency: "JPY",
            originalCost: 650,
            createdAt: "2026-07-26T00:00:00.000Z",
            createdBy: "system",
          },
        ],
        campaigns: [
          {
            id: "camp_001",
            productId: "prod_001",
            title: "  七夕檔期  ",
            saleType: "preorder",
            status: "open",
            salePriceTwd: 820,
            requiresSupplement: true,
            startsAt: "2026-08-01T12:00",
            endsAt: "2026-08-10T23:59",
            publicNotice: "數量有限，依官方配貨結果通知。",
            supplementNote: "二補依實際國際運費通知。",
            createdAt: "2026-07-26T00:00:00.000Z",
            createdBy: "system",
          },
        ],
      }),
    ).toEqual({
      id: "prod_001",
      name: "星星耳環",
      publicDescription: "限量現貨",
      publishState: "published",
      variants: [
        {
          id: "var_001",
          productId: "prod_001",
          name: "Default Variant",
          isDefault: true,
          priceTwd: 880,
        },
      ],
      campaigns: [
        {
          id: "camp_001",
          title: "七夕檔期",
          saleType: "preorder",
          status: "upcoming",
          salePriceTwd: 820,
          requiresSupplement: true,
          startsAt: "2026-08-01T12:00",
          endsAt: "2026-08-10T23:59",
          publicNotice: "數量有限，依官方配貨結果通知。",
          supplementNote: "二補依實際國際運費通知。",
        },
      ],
    });
  });

  it("includes non-sensitive classification labels in the public projection", () => {
    const projection = buildPublicProductProjection({
      product: {
        id: "prod_002",
        sku: "AST-P000002",
        name: "應援手燈",
        publicDescription: "小圈測試商品",
        publishState: "published",
        classifications: {
          company: { id: "company_001", label: "  Astera Goods  " },
          artist: { id: "artist_001", label: "  Luna  " },
          cp: { id: "cp_001", label: "  Luna x Mira  " },
          brand: { id: "brand_001", label: "  Official Shop  " },
          series: { id: "series_001", label: "  2026 Summer  " },
        },
        createdAt: "2026-07-26T00:00:00.000Z",
        createdBy: "system",
      },
      variants: [
        {
          id: "var_002",
          productId: "prod_002",
          sku: "LIGHT-001",
          name: "Default Variant",
          isDefault: true,
          priceTwd: 1280,
          originalCurrency: "JPY",
          originalCost: 900,
          createdAt: "2026-07-26T00:00:00.000Z",
          createdBy: "system",
        },
      ],
      campaigns: [],
    });

    expect(projection.classifications).toEqual({
      company: { id: "company_001", label: "Astera Goods" },
      artist: { id: "artist_001", label: "Luna" },
      cp: { id: "cp_001", label: "Luna x Mira" },
      brand: { id: "brand_001", label: "Official Shop" },
      series: { id: "series_001", label: "2026 Summer" },
    });
    expect(JSON.stringify(projection)).not.toContain("originalCost");
  });
});

describe("mapPublicCatalogItem", () => {
  it("converts a flat Firestore projection to the nested public catalog model", () => {
    expect(
      mapPublicCatalogItem({
        id: "prod_001",
        name: "星星耳環",
        publicDescription: "限量現貨",
        publishState: "published",
        classifications: {
          company: { id: "company_001", label: "Astera Goods" },
        },
        variants: [
          {
            id: "var_001",
            productId: "prod_001",
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
            saleType: "preorder",
            status: "open",
            salePriceTwd: 820,
            requiresSupplement: true,
            startsAt: "2026-08-01T12:00",
            endsAt: "2026-08-10T23:59",
            publicNotice: "數量有限，依官方配貨結果通知。",
            supplementNote: "二補依實際國際運費通知。",
          },
        ],
      }),
    ).toEqual({
      product: {
        id: "prod_001",
        name: "星星耳環",
        publicDescription: "限量現貨",
        publishState: "published",
        classifications: {
          company: { id: "company_001", label: "Astera Goods" },
        },
      },
      variants: [
        {
          id: "var_001",
          productId: "prod_001",
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
          saleType: "preorder",
          status: "open",
          salePriceTwd: 820,
          requiresSupplement: true,
          startsAt: "2026-08-01T12:00",
          endsAt: "2026-08-10T23:59",
          publicNotice: "數量有限，依官方配貨結果通知。",
          supplementNote: "二補依實際國際運費通知。",
        },
      ],
    });
  });

  it("returns null for malformed projections", () => {
    expect(mapPublicCatalogItem({ id: "prod_001" })).toBeNull();
  });
});

describe("public catalog purchase selection", () => {
  it("chooses the default purchasable variant and open campaign", () => {
    const item: PublicCatalogItem = {
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
          salePriceTwd: 820,
          requiresSupplement: true,
        },
        {
          id: "camp_002",
          productId: "prod_001",
          title: "草稿活動",
          saleType: "preorder" as const,
          status: "upcoming" as const,
          requiresSupplement: false,
        },
      ],
    };

    expect(getDefaultVariant(item)?.id).toBe("var_001");
    expect(getDefaultCampaign(item)?.id).toBe("camp_001");
  });
});

describe("SKU and campaign pricing rules", () => {
  it("creates formal product and variant SKUs", () => {
    expect(createProductSku(125)).toBe("AST-P000125");
    expect(createVariantSku("AST-P000125", 3)).toBe("AST-P000125-V003");
  });

  it("resolves time-based campaign status without exposing archived campaigns as open", () => {
    const now = new Date("2026-07-27T12:00:00.000Z");

    expect(resolveCampaignStatus({ status: "open", startsAt: "2026-07-28T12:00" }, now)).toBe("upcoming");
    expect(resolveCampaignStatus({ status: "open", endsAt: "2026-07-26T12:00" }, now)).toBe("closed");
    expect(resolveCampaignStatus({ status: "archived" }, now)).toBe("archived");
  });

  it("uses campaign sale price before the variant default price", () => {
    expect(getEffectiveVariantPriceTwd({ priceTwd: 880 }, { salePriceTwd: 820 })).toBe(820);
    expect(getEffectiveVariantPriceTwd({ priceTwd: 880 }, null)).toBe(880);
  });

  it("assigns product and variant SKUs on the server without trusting submitted SKU values", () => {
    const assigned = assignServerManagedSkus(
      {
        product: {
          id: "prod_new",
          sku: "MANUAL-PRODUCT-SKU",
          name: "新品",
          publicDescription: "新品說明",
          publishState: "draft",
        },
        variants: [
          {
            id: "var_new_1",
            sku: "MANUAL-VARIANT-SKU",
            name: "A",
            isDefault: true,
            priceTwd: 100,
          },
          {
            id: "var_new_2",
            sku: "",
            name: "B",
            isDefault: false,
            priceTwd: 120,
          },
        ],
        campaigns: [],
      },
      {
        productSku: "AST-P000007",
        existingVariantSkusById: new Map(),
      },
    );

    expect(assigned.product.sku).toBe("AST-P000007");
    expect(assigned.variants.map((variant) => variant.sku)).toEqual([
      "AST-P000007-V001",
      "AST-P000007-V002",
    ]);
  });

  it("preserves existing variant SKUs and assigns new variants after the highest existing sequence", () => {
    const assigned = assignServerManagedSkus(
      {
        product: {
          id: "prod_existing",
          sku: "",
          name: "既有商品",
          publicDescription: "既有商品說明",
          publishState: "published",
        },
        variants: [
          {
            id: "var_existing",
            sku: "",
            name: "既有規格",
            isDefault: true,
            priceTwd: 100,
          },
          {
            id: "var_new",
            sku: "MANUAL-NEW-SKU",
            name: "新增規格",
            isDefault: false,
            priceTwd: 120,
          },
        ],
        campaigns: [],
      },
      {
        productSku: "AST-P000008",
        existingVariantSkusById: new Map([["var_existing", "AST-P000008-V003"]]),
      },
    );

    expect(assigned.variants.map((variant) => variant.sku)).toEqual([
      "AST-P000008-V003",
      "AST-P000008-V004",
    ]);
  });
});
