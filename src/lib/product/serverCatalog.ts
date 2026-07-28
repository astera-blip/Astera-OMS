import "server-only";

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  assignServerManagedSkus,
  buildPublicProductProjection,
  createProductSku,
  createVariantSku,
  normalizeProductDraft,
  type ProductCatalogRecord,
  type ProductDraft,
} from "@/lib/product/catalog";

type SaveProductInput = ProductDraft & {
  internalNote?: string;
};

type SequenceDocument = {
  nextProductSequence?: number;
};

export async function listWorkspaceProductsServer(db: Firestore): Promise<ProductCatalogRecord[]> {
  const [publicSnapshot, internalSnapshot, variantSnapshot, campaignSnapshot] = await Promise.all([
    db.collection("productsPublic").get(),
    db.collection("productsInternal").get(),
    db.collection("productVariants").get(),
    db.collection("saleCampaigns").get(),
  ]);

  const internalById = new Map(internalSnapshot.docs.map((snapshot) => [snapshot.id, snapshot.data()]));
  const variants = variantSnapshot.docs.map((snapshot) => snapshot.data() as ProductCatalogRecord["variants"][number]);
  const campaigns = campaignSnapshot.docs.map((snapshot) => snapshot.data() as ProductCatalogRecord["campaigns"][number]);

  return publicSnapshot.docs.map((snapshot, index) => {
    const data = snapshot.data() as {
      id: string;
      name: string;
      publicDescription: string;
      publishState: ProductCatalogRecord["product"]["publishState"];
      classifications?: ProductCatalogRecord["product"]["classifications"];
      images?: ProductCatalogRecord["product"]["images"];
    };
    const internal = internalById.get(snapshot.id) as { sku?: string; internalNote?: string } | undefined;
    const productSku = internal?.sku ?? createProductSku(index + 1);

    return {
      product: {
        id: data.id,
        sku: productSku,
        name: data.name,
        publicDescription: data.publicDescription,
        publishState: data.publishState,
        ...(data.classifications ? { classifications: data.classifications } : {}),
        ...(data.images ? { images: data.images } : {}),
        createdAt: new Date().toISOString(),
        createdBy: "system",
      },
      variants: variants
        .filter((variant) => variant.productId === data.id)
        .map((variant, variantIndex) => ({
          ...variant,
          sku: variant.sku || createVariantSku(productSku, variantIndex + 1),
          createdAt: variant.createdAt ?? new Date().toISOString(),
          createdBy: variant.createdBy ?? "system",
        })),
      campaigns: campaigns
        .filter((campaign) => campaign.productId === data.id)
        .map((campaign) => ({
          ...campaign,
          createdAt: campaign.createdAt ?? new Date().toISOString(),
          createdBy: campaign.createdBy ?? "system",
        })),
      ...(internal?.internalNote ? { internalNote: internal.internalNote } : {}),
    };
  });
}

export async function saveWorkspaceProductServer(
  db: Firestore,
  input: SaveProductInput,
  actorUid: string,
): Promise<ProductCatalogRecord & { internalNote?: string }> {
  return db.runTransaction(async (transaction) => {
    const requestedProductId = input.product.id.trim();
    const productRef = requestedProductId
      ? db.collection("productsInternal").doc(requestedProductId)
      : db.collection("productsInternal").doc();
    const existingProduct = await transaction.get(productRef);
    const sequenceRef = db.collection("siteSettings").doc("system-sequences");
    const existingSequence = await transaction.get(sequenceRef);
    const existingVariantsSnapshot = await transaction.get(
      db.collection("productVariants").where("productId", "==", productRef.id),
    );
    const sequenceData = existingSequence.exists
      ? (existingSequence.data() as SequenceDocument)
      : {};
    const existingVariantSkusById = new Map(
      existingVariantsSnapshot.docs.map((snapshot) => [
        snapshot.id,
        String((snapshot.data() as { sku?: string }).sku ?? ""),
      ]),
    );

    const productSku = existingProduct.exists
      ? String(existingProduct.data()?.sku ?? input.product.sku ?? createProductSku(1))
      : createProductSku(sequenceData.nextProductSequence ?? 1);
    const productId = productRef.id;
    const now = new Date().toISOString();
    const serverManagedDraft = assignServerManagedSkus({
      ...input,
      product: {
        ...input.product,
        id: productId,
        images: input.product.images
          ?? (existingProduct.data()?.images as ProductCatalogRecord["product"]["images"] | undefined)
          ?? [],
      },
      variants: input.variants.map((variant, index) => ({
        ...variant,
        id: variant.id.trim() || `${productId}-variant-${index + 1}`,
      })),
      campaigns: input.campaigns.map((campaign, index) => ({
        ...campaign,
        id: campaign.id.trim() || `${productId}-campaign-${index + 1}`,
      })),
    }, {
      productSku,
      existingVariantSkusById,
    });
    const normalized = normalizeProductDraft(serverManagedDraft);

    if (!normalized.ok) {
      throw new Error("invalid_product");
    }

    const record: ProductCatalogRecord & { internalNote?: string } = {
      product: {
        ...normalized.value.product,
        createdAt: now,
        createdBy: actorUid,
        updatedAt: now,
        updatedBy: actorUid,
      },
      variants: normalized.value.variants.map((variant) => ({
        ...variant,
        createdAt: now,
        createdBy: actorUid,
        updatedAt: now,
        updatedBy: actorUid,
      })),
      campaigns: normalized.value.campaigns.map((campaign) => ({
        ...campaign,
        createdAt: now,
        createdBy: actorUid,
        updatedAt: now,
        updatedBy: actorUid,
      })),
      ...(input.internalNote?.trim() ? { internalNote: input.internalNote.trim() } : {}),
    };
    const publicProjection = buildPublicProductProjection(record);

    transaction.set(db.collection("productsPublic").doc(record.product.id), {
      ...publicProjection,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(productRef, {
      id: record.product.id,
      sku: record.product.sku,
      originalCosts: record.variants.map((variant) => ({
        variantId: variant.id,
        originalCurrency: variant.originalCurrency ?? null,
        originalCost: variant.originalCost ?? null,
      })),
      internalNote: record.internalNote ?? null,
      images: record.product.images ?? [],
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    });

    record.variants.forEach((variant) => {
      transaction.set(db.collection("productVariants").doc(variant.id), {
        id: variant.id,
        productId: variant.productId,
        sku: variant.sku,
        name: variant.name,
        isDefault: variant.isDefault,
        priceTwd: variant.priceTwd,
        publishState: record.product.publishState,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      });
    });
    record.campaigns.forEach((campaign) => {
      transaction.set(db.collection("saleCampaigns").doc(campaign.id), {
        id: campaign.id,
        productId: campaign.productId,
        title: campaign.title,
        saleType: campaign.saleType,
        status: campaign.status,
        ...(typeof campaign.salePriceTwd === "number" ? { salePriceTwd: campaign.salePriceTwd } : {}),
        requiresSupplement: campaign.requiresSupplement,
        ...(campaign.startsAt ? { startsAt: campaign.startsAt } : {}),
        ...(campaign.endsAt ? { endsAt: campaign.endsAt } : {}),
        ...(campaign.publicNotice ? { publicNotice: campaign.publicNotice } : {}),
        ...(campaign.supplementNote ? { supplementNote: campaign.supplementNote } : {}),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      });
    });

    if (!existingProduct.exists) {
      transaction.set(sequenceRef, {
        nextProductSequence: (sequenceData.nextProductSequence ?? 1) + 1,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      }, { merge: true });
    }

    return record;
  });
}
