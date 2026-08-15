import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CatalogChangeRequest } from "@/lib/catalog-change/catalogChangeRequest";
import { CatalogReviewDetails } from "@/components/workspace/CatalogReviewBoard";

const request = {
  id: "request-a",
  title: "測試商品草稿",
  changeReason: "測試原因",
  product: {
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
    campaigns: [],
  },
  status: "submitted",
  revision: 1,
  payloadDigest: "digest",
  baseProductVersion: "1785369136279",
  baseVariants: [],
  baseCampaigns: [],
  createdBy: "partner-a",
  creatorDisplayName: "合作人小葉（葉葉）",
  createdAt: "2026-08-15T00:00:00.000Z",
  updatedBy: "partner-a",
  updatedAt: "2026-08-15T00:00:00.000Z",
} as unknown as CatalogChangeRequest;

describe("CatalogReviewDetails", () => {
  it("renders the creator name and human-readable base-version explanation without technical IDs", () => {
    const markup = renderToStaticMarkup(createElement(CatalogReviewDetails, { request }));

    expect(markup).toContain("合作人小葉（葉葉）");
    expect(markup).toContain("送審時版本");
    expect(markup).toContain("以送審當下的正式商品為準");
    expect(markup).not.toContain("partner-a");
    expect(markup).not.toContain("1785369136279");
  });
});
