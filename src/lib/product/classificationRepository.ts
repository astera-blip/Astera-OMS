import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import {
  classificationCollections,
  normalizeCatalogClassification,
  type CatalogClassification,
} from "@/lib/product/classifications";
import type { ProductClassificationKey } from "@/lib/product/catalog";

export async function listCatalogClassifications(
  db: Firestore,
  key: ProductClassificationKey,
): Promise<CatalogClassification[]> {
  const snapshot = await getDocs(collection(db, classificationCollections[key]));

  return snapshot.docs.map((entry) => entry.data() as CatalogClassification);
}

export async function saveCatalogClassification(
  db: Firestore,
  key: ProductClassificationKey,
  input: CatalogClassification,
) {
  const value = normalizeCatalogClassification(input);

  await setDoc(doc(db, classificationCollections[key], value.id), {
    ...value,
    updatedAt: serverTimestamp(),
  });
}
