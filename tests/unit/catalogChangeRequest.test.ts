import { describe, expect, it } from "vitest";
import { validateCatalogDraftInput } from "@/lib/catalog-change/catalogChangeRequest";
import type { ProductDraft } from "@/lib/product/catalog";

const validProduct: ProductDraft = {
  product: {
    id: "product-a",
    sku: "AST-P000001",
    name: "測試商品",
    publicDescription: "公開說明",
    publishState: "published",
  },
  variants: [{
    id: "variant-a",
    sku: "AST-P000001-V001",
    name: "一般款",
    isDefault: true,
    priceTwd: 520,
  }],
  campaigns: [{
    id: "campaign-a",
    title: "預購活動",
    saleType: "preorder",
    status: "open",
    requiresSupplement: true,
  }],
};

describe("catalog change request", () => {
  it("normalizes a valid Partner product proposal", () => {
    expect(validateCatalogDraftInput({
      title: "  更新售價  ",
      changeReason: "  配合官方定價  ",
      product: validProduct,
      internalNote: "  Partner 交接  ",
      baseProductVersion: "  version-1  ",
    })).toEqual({
      ok: true,
      value: {
        title: "更新售價",
        changeReason: "配合官方定價",
        product: expect.objectContaining({
          product: expect.objectContaining({ name: "測試商品" }),
          variants: [expect.objectContaining({ priceTwd: 520 })],
          campaigns: [expect.objectContaining({ title: "預購活動" })],
        }),
        internalNote: "Partner 交接",
        baseProductVersion: "version-1",
      },
    });
  });

  it.each([
    [{ title: "", changeReason: "原因", product: validProduct }, "catalog_change_title_required"],
    [{ title: "更新", changeReason: "", product: validProduct }, "catalog_change_reason_required"],
    [{ title: "更新", changeReason: "原因" }, "invalid_product"],
    [{ title: "更新", changeReason: "原因", product: validProduct }, "catalog_change_base_version_required"],
    [{
      title: "更新",
      changeReason: "原因",
      product: { ...validProduct, product: { ...validProduct.product, name: "" } },
    }, "invalid_product"],
  ])("rejects invalid proposal %#", (input, error) => {
    expect(validateCatalogDraftInput(input)).toEqual({ ok: false, error });
  });

  it.each([
    { ...validProduct, product: { ...validProduct.product, images: [] } },
  ])("keeps Partner product images Owner-only", (product) => {
    expect(validateCatalogDraftInput({
      title: "更新",
      changeReason: "原因",
      product,
      baseProductVersion: "version-1",
    })).toEqual({ ok: false, error: "catalog_change_images_owner_only" });
  });

  it.each([
    { ...validProduct, product: { ...validProduct.product, publishState: "invalid" } },
    { ...validProduct, variants: [] },
    { ...validProduct, variants: [{ ...validProduct.variants[0], isDefault: "yes" }] },
    { ...validProduct, variants: [{ ...validProduct.variants[0], originalCost: -1 }] },
    { ...validProduct, variants: [validProduct.variants[0], { ...validProduct.variants[0], id: "variant-b" }] },
    { ...validProduct, variants: [validProduct.variants[0], { ...validProduct.variants[0] }] },
    { ...validProduct, campaigns: [{ ...validProduct.campaigns[0], saleType: "invalid" }] },
    { ...validProduct, campaigns: [validProduct.campaigns[0], { ...validProduct.campaigns[0] }] },
  ])("rejects untrusted enum, primitive, and duplicate child IDs %#", (product) => {
    expect(validateCatalogDraftInput({
      title: "更新",
      changeReason: "原因",
      product,
      baseProductVersion: "version-1",
    })).toEqual({ ok: false, error: "invalid_product" });
  });
});
