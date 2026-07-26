import {
  getDoc,
  writeBatch,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { buildPublicProductProjection, type ProductCatalogRecord } from "@/lib/product/catalog";
import { mapPublicCatalogItem, type PublicCatalogItem } from "@/lib/catalog/publicCatalog";

export async function listPublicProducts(db: Firestore): Promise<PublicCatalogItem[]> {
  const snapshots = await getDocs(collection(db, "productsPublic"));

  return snapshots.docs
    .map((snapshot) => mapPublicCatalogItem(snapshot.data()))
    .filter((item): item is PublicCatalogItem => item !== null);
}

export async function getPublicProduct(db: Firestore, productId: string): Promise<PublicCatalogItem | null> {
  const snapshot = await getDoc(doc(db, "productsPublic", productId));

  return snapshot.exists() ? mapPublicCatalogItem(snapshot.data()) : null;
}

export async function saveProductCatalogRecord(
  db: Firestore,
  record: ProductCatalogRecord,
  internalNote?: string,
) {
  const publicProjection = buildPublicProductProjection(record);
  const batch = writeBatch(db);

  batch.set(doc(db, "productsPublic", record.product.id), {
    ...publicProjection,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, "productsInternal", record.product.id), {
    id: record.product.id,
    originalCosts: record.variants.map((variant) => ({
      variantId: variant.id,
      originalCurrency: variant.originalCurrency ?? null,
      originalCost: variant.originalCost ?? null,
    })),
    internalNote: internalNote ?? null,
    updatedAt: serverTimestamp(),
  });

  record.variants.forEach((variant) => {
    batch.set(doc(db, "productVariants", variant.id), {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      name: variant.name,
      isDefault: variant.isDefault,
      priceTwd: variant.priceTwd,
      publishState: record.product.publishState,
      updatedAt: serverTimestamp(),
    });
  });

  record.campaigns.forEach((campaign) => {
    batch.set(doc(db, "saleCampaigns", campaign.id), {
      id: campaign.id,
      productId: campaign.productId,
      title: campaign.title,
      saleType: campaign.saleType,
      status: campaign.status,
      requiresSupplement: campaign.requiresSupplement,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}
