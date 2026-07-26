import { describe, expect, it } from "vitest";
import {
  buildPublicProductProjection,
  normalizeProductDraft,
} from "../../src/lib/product/catalog";

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
          name: "星星耳環",
          publicDescription: "限量現貨",
          publishState: "published",
        },
        variants: [
          {
            id: "prod_001-default",
            productId: "prod_001",
            sku: "prod_001-default",
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
            requiresSupplement: true,
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
          sku: "STAR-001",
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
          status: "open",
          requiresSupplement: true,
        },
      ],
    });
  });

  it("includes non-sensitive classification labels in the public projection", () => {
    const projection = buildPublicProductProjection({
      product: {
        id: "prod_002",
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
