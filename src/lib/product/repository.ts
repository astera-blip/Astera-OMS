import {
  getDoc,
  collection,
  doc,
  getDocs,
  query,
  where,
  type Firestore,
} from "firebase/firestore";
import { mapPublicCatalogItem, type PublicCatalogItem } from "@/lib/catalog/publicCatalog";

export async function listPublicProducts(db: Firestore): Promise<PublicCatalogItem[]> {
  const snapshots = await getDocs(
    query(collection(db, "productsPublic"), where("publishState", "==", "published")),
  );

  return snapshots.docs
    .map((snapshot) => mapPublicCatalogItem(snapshot.data()))
    .filter((item): item is PublicCatalogItem => item !== null);
}

export async function getPublicProduct(db: Firestore, productId: string): Promise<PublicCatalogItem | null> {
  const snapshot = await getDoc(doc(db, "productsPublic", productId));

  return snapshot.exists() ? mapPublicCatalogItem(snapshot.data()) : null;
}
