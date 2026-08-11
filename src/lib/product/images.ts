export type ProductImage = {
  id: string;
  objectPath: string;
  url: string;
  altText: string;
  width: number;
  height: number;
  sortOrder: number;
};

const supportedImageTypes = new Map([
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
]);

export function validateProductImageCandidate(input: {
  productId: string;
  objectPath: string;
  contentType: string;
  size: number;
  url: string;
  altText: string;
  width: number;
  height: number;
}): { ok: true } | { ok: false; error: string } {
  const extensions = supportedImageTypes.get(input.contentType);
  if (!extensions || !extensions.some((extension) => input.objectPath.toLowerCase().endsWith(extension))) {
    return { ok: false, error: "unsupported_image_type" };
  }
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > 5 * 1024 * 1024) {
    return { ok: false, error: "image_too_large" };
  }
  const prefix = `product-images/${input.productId}/`;
  const filename = input.objectPath.slice(prefix.length);
  if (
    !input.objectPath.startsWith(prefix)
    || !filename
    || filename.includes("/")
    || filename.includes("..")
  ) {
    return { ok: false, error: "invalid_image_path" };
  }
  if (
    !Number.isInteger(input.width)
    || !Number.isInteger(input.height)
    || input.width <= 0
    || input.height <= 0
  ) {
    return { ok: false, error: "invalid_image_dimensions" };
  }
  if (input.altText.trim().length > 200) {
    return { ok: false, error: "image_alt_text_too_long" };
  }
  if (!input.url.trim()) {
    return { ok: false, error: "invalid_image_url" };
  }
  return { ok: true };
}

export function normalizeProductImages(images: readonly ProductImage[]):
  | { ok: true; value: ProductImage[] }
  | { ok: false; error: string } {
  if (images.length > 8) {
    return { ok: false, error: "too_many_product_images" };
  }
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const image of images) {
    if (ids.has(image.id) || paths.has(image.objectPath)) {
      return { ok: false, error: "duplicate_product_image" };
    }
    ids.add(image.id);
    paths.add(image.objectPath);
  }
  return {
    ok: true,
    value: [...images]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((image, index) => ({
        ...image,
        altText: image.altText.trim(),
        sortOrder: index + 1,
      })),
  };
}
