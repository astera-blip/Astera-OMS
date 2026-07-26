import { describe, expect, it } from "vitest";
import {
  createDefaultProductVariant,
  normalizeSaleCampaignDraft,
  normalizeProductDraft,
} from "@/lib/product/model";

describe("normalizeProductDraft", () => {
  it("trims product fields and keeps the canonical name", () => {
    expect(
      normalizeProductDraft({
        name: "  Stray Kids Light Stick  ",
        slug: "  skz-light-stick  ",
        status: "draft",
        company: "  JYP  ",
        artist: "  Stray Kids  ",
        brand: "  JYP Shop  ",
        series: "  Official Goods  ",
      }),
    ).toEqual({
      ok: true,
      value: {
        name: "Stray Kids Light Stick",
        slug: "skz-light-stick",
        status: "draft",
        company: "JYP",
        artist: "Stray Kids",
        brand: "JYP Shop",
        series: "Official Goods",
      },
    });
  });

  it("rejects a product without a canonical name", () => {
    expect(
      normalizeProductDraft({
        name: " ",
        slug: "skz-light-stick",
        status: "draft",
      }),
    ).toEqual({
      ok: false,
      errors: {
        name: "請填寫商品名稱。",
      },
    });
  });
});

describe("createDefaultProductVariant", () => {
  it("creates a default sellable variant for products without variants", () => {
    expect(
      createDefaultProductVariant({
        productId: "product-001",
        name: "Stray Kids Light Stick",
      }),
    ).toEqual({
      productId: "product-001",
      name: "Default",
      sku: "product-001-default",
      isDefault: true,
      isSellable: true,
    });
  });
});

describe("normalizeSaleCampaignDraft", () => {
  it("trims sale campaign fields and preserves the sale window", () => {
    expect(
      normalizeSaleCampaignDraft({
        productId: "product-001",
        name: "  2026 Summer Drop  ",
        code: "  summer-drop-2026  ",
        status: "draft",
        startsAt: "2026-07-26",
        endsAt: "2026-08-01",
      }),
    ).toEqual({
      ok: true,
      value: {
        productId: "product-001",
        name: "2026 Summer Drop",
        code: "summer-drop-2026",
        status: "draft",
        startsAt: "2026-07-26",
        endsAt: "2026-08-01",
      },
    });
  });

  it("rejects a sale campaign without a code", () => {
    expect(
      normalizeSaleCampaignDraft({
        productId: "product-001",
        name: "2026 Summer Drop",
        code: " ",
        status: "draft",
        startsAt: "2026-07-26",
        endsAt: "2026-08-01",
      }),
    ).toEqual({
      ok: false,
      errors: {
        code: "請填寫活動代碼。",
      },
    });
  });
});
