import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import {
  createDefaultProductVariant,
  normalizeProductDraft,
  normalizeSaleCampaignDraft,
  type ProductDraft,
  type ProductVariantDraft,
  type SaleCampaignDraft,
  type PublicProductProjection,
} from "@/lib/product/model";

export type SaveProductWithVariantsInput = {
  product: ProductDraft;
  variants: ProductVariantDraft[];
};

export type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "archived";
  company?: string;
  artist?: string;
  brand?: string;
  series?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ProductVariantRecord = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  isDefault: boolean;
  isSellable: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type SaleCampaignRecord = {
  id: string;
  productId: string;
  name: string;
  code: string;
  status: "draft" | "active" | "archived";
  startsAt: string;
  endsAt: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type { PublicProductProjection } from "@/lib/product/model";

export async function loadProduct(db: Firestore, productId: string) {
  const snapshot = await getDoc(doc(db, "products", productId));
  return snapshot.exists() ? (snapshot.data() as ProductRecord) : null;
}

export async function loadProducts(db: Firestore) {
  const snapshot = await getDocs(collection(db, "products"));
  return snapshot.docs.map((product) => ({
    id: product.id,
    ...(product.data() as Omit<ProductRecord, "id">),
  }));
}

export async function loadPublicProducts(db: Firestore) {
  const snapshot = await getDocs(collection(db, "productsPublic"));
  return snapshot.docs.map((product) => ({
    id: product.id,
    ...(product.data() as Omit<PublicProductProjection, "id">),
  }));
}

export async function loadProductVariants(db: Firestore, productId: string) {
  const snapshot = await getDocs(collection(db, "productVariants"));
  return snapshot.docs
    .map((variant) => ({
      id: variant.id,
      ...(variant.data() as Omit<ProductVariantRecord, "id">),
    }))
    .filter((variant) => variant.productId === productId);
}

export async function loadSaleCampaigns(db: Firestore, productId: string) {
  const snapshot = await getDocs(collection(db, "saleCampaigns"));
  return snapshot.docs
    .map((campaign) => ({
      id: campaign.id,
      ...(campaign.data() as Omit<SaleCampaignRecord, "id">),
    }))
    .filter((campaign) => campaign.productId === productId);
}

export async function saveSaleCampaign(
  db: Firestore,
  draft: SaleCampaignDraft,
) {
  const normalized = normalizeSaleCampaignDraft(draft);

  if (!normalized.ok) {
    return normalized;
  }

  const campaignId = normalized.value.code;
  await setDoc(doc(db, "saleCampaigns", campaignId), {
    ...normalized.value,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { ok: true as const, campaignId };
}

export async function saveProductWithVariants(
  db: Firestore,
  input: SaveProductWithVariantsInput,
) {
  const normalized = normalizeProductDraft(input.product);

  if (!normalized.ok) {
    return normalized;
  }

  const productId = normalized.value.slug;
  const productRef = doc(db, "products", productId);
  const existing = await getDoc(productRef);
  const variants = input.variants.length > 0 ? input.variants : [{ productId }];
  const primaryVariant = createDefaultProductVariant(variants[0] ?? { productId });

  if (existing.exists()) {
    await updateDoc(productRef, {
      ...normalized.value,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(productRef, {
      ...normalized.value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await setDoc(doc(db, "productsPublic", productId), {
    id: productId,
    name: normalized.value.name,
    slug: normalized.value.slug,
    status: normalized.value.status,
    ...(normalized.value.company ? { company: normalized.value.company } : {}),
    ...(normalized.value.artist ? { artist: normalized.value.artist } : {}),
    ...(normalized.value.brand ? { brand: normalized.value.brand } : {}),
    ...(normalized.value.series ? { series: normalized.value.series } : {}),
    defaultVariantName: primaryVariant.name,
    defaultVariantSku: primaryVariant.sku,
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, "productVariants", primaryVariant.sku), {
    ...primaryVariant,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    ok: true as const,
    productId,
    variantId: primaryVariant.sku,
    product: {
      id: productId,
      ...normalized.value,
      defaultVariantName: primaryVariant.name,
      defaultVariantSku: primaryVariant.sku,
    },
  };
}
