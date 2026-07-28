import { describe, expect, it } from "vitest";
import {
  getNewProductFormDefaults,
  getNewVariantFormDefaults,
} from "../../src/lib/product/workspaceDefaults";

describe("workspace defaults", () => {
  it("defaults new products to published for storefront visibility", () => {
    expect(getNewProductFormDefaults()).toEqual({
      publishState: "published",
    });
  });

  it("defaults new variants to THB original currency", () => {
    expect(getNewVariantFormDefaults()).toEqual({
      originalCurrency: "THB",
    });
  });
});
