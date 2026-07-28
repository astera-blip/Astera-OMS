import "server-only";

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  normalizeProductImages,
  type ProductImage,
} from "@/lib/product/images";

export async function saveProductImages(
  db: Firestore,
  productId: string,
  images: readonly ProductImage[],
  actorUid: string,
) {
  const normalized = normalizeProductImages(images);
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }
  await db.runTransaction(async (transaction) => {
    const internalRef = db.collection("productsInternal").doc(productId);
    const publicRef = db.collection("productsPublic").doc(productId);
    const [internalSnapshot, publicSnapshot] = await Promise.all([
      transaction.get(internalRef),
      transaction.get(publicRef),
    ]);
    if (!internalSnapshot.exists || !publicSnapshot.exists) {
      throw new Error("product_not_found");
    }
    const update = {
      images: normalized.value,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    };
    transaction.update(internalRef, update);
    transaction.update(publicRef, update);
  });
  return normalized.value;
}

export async function listProductImages(db: Firestore, productId: string) {
  const snapshot = await db.collection("productsInternal").doc(productId).get();
  if (!snapshot.exists) {
    throw new Error("product_not_found");
  }
  const images = (snapshot.data()?.images ?? []) as ProductImage[];
  const normalized = normalizeProductImages(images);
  if (!normalized.ok) {
    throw new Error("invalid_stored_product_images");
  }
  return normalized.value;
}
