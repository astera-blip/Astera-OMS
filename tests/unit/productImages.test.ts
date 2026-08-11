import { describe, expect, it } from "vitest";
import {
  normalizeProductImages,
  validateProductImageCandidate,
  type ProductImage,
} from "@/lib/product/images";
import { mapPublicCatalogItem } from "@/lib/catalog/publicCatalog";

const baseCandidate = {
  productId: "prod_001",
  objectPath: "product-images/prod_001/image-a.webp",
  contentType: "image/webp",
  size: 1024,
  url: "https://example.test/image-a.webp",
  altText: "商品正面",
  width: 1200,
  height: 1200,
};

describe("product images", () => {
  it("accepts supported images owned by the product", () => {
    expect(validateProductImageCandidate(baseCandidate)).toEqual({ ok: true });
  });

  it.each(["image/gif", "application/pdf"])("rejects unsupported MIME %s", (contentType) => {
    expect(validateProductImageCandidate({ ...baseCandidate, contentType })).toEqual({
      ok: false,
      error: "unsupported_image_type",
    });
  });

  it("rejects oversize, foreign paths, invalid dimensions and long alt text", () => {
    expect(validateProductImageCandidate({ ...baseCandidate, size: 5 * 1024 * 1024 + 1 }))
      .toEqual({ ok: false, error: "image_too_large" });
    expect(validateProductImageCandidate({
      ...baseCandidate,
      objectPath: "product-images/prod_002/image-a.webp",
    })).toEqual({ ok: false, error: "invalid_image_path" });
    expect(validateProductImageCandidate({ ...baseCandidate, width: 0 }))
      .toEqual({ ok: false, error: "invalid_image_dimensions" });
    expect(validateProductImageCandidate({ ...baseCandidate, altText: "a".repeat(201) }))
      .toEqual({ ok: false, error: "image_alt_text_too_long" });
  });

  it("sorts images, reindexes cover order, and rejects duplicates or more than eight", () => {
    const image = (id: string, sortOrder: number): ProductImage => ({
      id,
      objectPath: `product-images/prod_001/${id}.webp`,
      url: `https://example.test/${id}.webp`,
      altText: id,
      width: 100,
      height: 100,
      sortOrder,
    });
    expect(normalizeProductImages([image("b", 5), image("a", 1)])).toEqual({
      ok: true,
      value: [image("a", 1), { ...image("b", 5), sortOrder: 2 }],
    });
    expect(normalizeProductImages([image("a", 1), image("a", 2)])).toEqual({
      ok: false,
      error: "duplicate_product_image",
    });
    expect(normalizeProductImages(Array.from({ length: 9 }, (_, index) => image(String(index), index))))
      .toEqual({ ok: false, error: "too_many_product_images" });
  });

  it("maps only valid public image fields into the storefront catalog", () => {
    const mapped = mapPublicCatalogItem({
      id: "prod_001",
      name: "商品",
      publicDescription: "說明",
      publishState: "published",
      variants: [],
      campaigns: [],
      images: [{
        id: "image-a",
        objectPath: "product-images/prod_001/image-a.webp",
        url: "https://example.test/image-a.webp",
        altText: "商品正面",
        width: 1200,
        height: 1200,
        sortOrder: 1,
      }],
    });

    expect(mapped?.product.images?.[0]).toMatchObject({
      id: "image-a",
      altText: "商品正面",
      sortOrder: 1,
    });
  });
});
