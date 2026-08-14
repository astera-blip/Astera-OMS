import "server-only";

import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import {
  assignServerManagedSkus,
  buildPublicProductProjection,
  createVariantSku,
  normalizeProductDraft,
  resolveServerManagedProductSku,
  type ProductCatalogRecord,
  type ProductClassifications,
  type ProductDraft,
} from "@/lib/product/catalog";
import { classificationCollections } from "@/lib/product/classifications";

type SaveProductInput = ProductDraft & {
  internalNote?: string;
};

type SequenceDocument = {
  nextProductSequence?: number;
};

export async function listWorkspaceProductsServer(
  db: Firestore,
): Promise<Array<ProductCatalogRecord & { internalNote?: string; catalogVersion: string | null }>> {
  const [publicSnapshot, internalSnapshot, variantSnapshot, campaignSnapshot] = await Promise.all([
    db.collection("productsPublic").get(),
    db.collection("productsInternal").get(),
    db.collection("productVariants").get(),
    db.collection("saleCampaigns").get(),
  ]);

  const internalById = new Map(internalSnapshot.docs.map((snapshot) => [snapshot.id, snapshot.data()]));
  const variants = variantSnapshot.docs.map((snapshot) => snapshot.data() as ProductCatalogRecord["variants"][number]);
  const campaigns = campaignSnapshot.docs.map((snapshot) => snapshot.data() as ProductCatalogRecord["campaigns"][number]);

  return publicSnapshot.docs.map((snapshot) => {
    const data = snapshot.data() as {
      id: string;
      name: string;
      publicDescription: string;
      publishState: ProductCatalogRecord["product"]["publishState"];
      classifications?: ProductCatalogRecord["product"]["classifications"];
      images?: ProductCatalogRecord["product"]["images"];
    };
    const internal = internalById.get(snapshot.id) as {
      sku?: string;
      internalNote?: string;
      originalCosts?: Array<{
        variantId: string;
        originalCurrency?: ProductCatalogRecord["variants"][number]["originalCurrency"] | null;
        originalCost?: number | null;
      }>;
      updatedAt?: unknown;
    } | undefined;
    const originalCostsByVariant = new Map(
      (internal?.originalCosts ?? []).map((cost) => [cost.variantId, cost]),
    );
    const productSku = resolveServerManagedProductSku({
      productId: data.id,
      existingSku: internal?.sku,
      nextProductSequence: 1,
    }).sku;

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
        .filter((variant) => variant.productId === data.id && (variant as { publishState?: string }).publishState !== "archived")
        .map((variant, variantIndex) => {
          const originalCost = originalCostsByVariant.get(variant.id);
          return {
            ...variant,
            sku: variant.sku || createVariantSku(productSku, variantIndex + 1),
            ...(originalCost?.originalCurrency
              ? { originalCurrency: originalCost.originalCurrency }
              : {}),
            ...(typeof originalCost?.originalCost === "number"
              ? { originalCost: originalCost.originalCost }
              : {}),
            createdAt: variant.createdAt ?? new Date().toISOString(),
            createdBy: variant.createdBy ?? "system",
          };
        }),
      campaigns: campaigns
        .filter((campaign) => campaign.productId === data.id && campaign.status !== "archived")
        .map((campaign) => ({
          ...campaign,
          createdAt: campaign.createdAt ?? new Date().toISOString(),
          createdBy: campaign.createdBy ?? "system",
        })),
      ...(internal?.internalNote ? { internalNote: internal.internalNote } : {}),
      catalogVersion: productVersion(internal),
    };
  });
}

export async function saveWorkspaceProductServer(
  db: Firestore,
  input: SaveProductInput,
  actorUid: string,
): Promise<ProductCatalogRecord & { internalNote?: string }> {
  return db.runTransaction((transaction) =>
    saveWorkspaceProductInTransaction(db, transaction, input, actorUid));
}

export async function saveWorkspaceProductInTransaction(
  db: Firestore,
  transaction: Transaction,
  input: SaveProductInput,
  actorUid: string,
  options: { expectedProductVersion?: string | null } = {},
): Promise<ProductCatalogRecord & { internalNote?: string }> {
    const requestedProductId = input.product.id.trim();
    const productRef = requestedProductId
      ? db.collection("productsInternal").doc(requestedProductId)
      : db.collection("productsInternal").doc();
    const preparedInput: SaveProductInput = {
      ...input,
      variants: (input.variants.length ? input.variants : [{
        id: "",
        sku: "",
        name: "Default Variant",
        isDefault: true,
        priceTwd: 0,
      }]).map((variant) => ({
        ...variant,
        id: variant.id.trim() || db.collection("productVariants").doc().id,
      })),
      campaigns: input.campaigns.map((campaign) => ({
        ...campaign,
        id: campaign.id.trim() || db.collection("saleCampaigns").doc().id,
      })),
    };
    const existingProduct = await transaction.get(productRef);
    if (
      "expectedProductVersion" in options
      && productVersion(existingProduct.data()) !== options.expectedProductVersion
    ) {
      throw new Error("catalog_change_stale_base");
    }
    const sequenceRef = db.collection("siteSettings").doc("system-sequences");
    const existingSequence = await transaction.get(sequenceRef);
    const existingVariantsSnapshot = await transaction.get(
      db.collection("productVariants").where("productId", "==", productRef.id),
    );
    const existingCampaignsSnapshot = await transaction.get(
      db.collection("saleCampaigns").where("productId", "==", productRef.id),
    );
    const submittedVariantSnapshots = await Promise.all(
      preparedInput.variants
        .map((variant) => variant.id.trim())
        .filter(Boolean)
        .map((id) => transaction.get(db.collection("productVariants").doc(id))),
    );
    const submittedCampaignSnapshots = await Promise.all(
      preparedInput.campaigns
        .map((campaign) => campaign.id.trim())
        .filter(Boolean)
        .map((id) => transaction.get(db.collection("saleCampaigns").doc(id))),
    );
    assertChildOwnership(submittedVariantSnapshots, productRef.id, "variant");
    assertChildOwnership(submittedCampaignSnapshots, productRef.id, "campaign");
    const authoritativeClassifications = await resolveAuthoritativeClassifications(
      db,
      transaction,
      preparedInput.product.classifications,
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
    const existingOrderItemSnapshots = await Promise.all(
      existingVariantsSnapshot.docs.map((snapshot) =>
        transaction.get(db.collection("orderItems").where("variantId", "==", snapshot.id)),
      ),
    );
    const lockedVariantIds = new Set(
      existingVariantsSnapshot.docs.flatMap((snapshot, index) =>
        existingOrderItemSnapshots[index]?.empty ? [] : [snapshot.id],
      ),
    );

    const productId = productRef.id;
    const skuResolution = resolveServerManagedProductSku({
      productId,
      existingSku: existingProduct.exists ? String(existingProduct.data()?.sku ?? "") : undefined,
      nextProductSequence: sequenceData.nextProductSequence ?? 1,
    });
    const productSku = skuResolution.sku;
    const now = new Date().toISOString();
    const serverManagedDraft = assignServerManagedSkus({
      ...preparedInput,
      product: {
        ...preparedInput.product,
        id: productId,
        ...(authoritativeClassifications
          ? { classifications: authoritativeClassifications }
          : { classifications: undefined }),
        images: preparedInput.product.images
          ?? (existingProduct.data()?.images as ProductCatalogRecord["product"]["images"] | undefined)
          ?? [],
      },
      variants: preparedInput.variants,
      campaigns: preparedInput.campaigns,
    }, {
      productSku,
      existingVariantSkusById,
      lockedVariantIds,
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
    const originalCostsByVariant = new Map<string, {
      variantId: string;
      originalCurrency: ProductCatalogRecord["variants"][number]["originalCurrency"] | null;
      originalCost: number | null;
    }>();
    const existingOriginalCosts = existingProduct.data()?.originalCosts;
    if (Array.isArray(existingOriginalCosts)) {
      existingOriginalCosts.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        const value = entry as { variantId?: unknown; originalCurrency?: unknown; originalCost?: unknown };
        if (typeof value.variantId !== "string" || !value.variantId) return;
        originalCostsByVariant.set(value.variantId, {
          variantId: value.variantId,
          originalCurrency: isOriginalCurrency(value.originalCurrency) ? value.originalCurrency : null,
          originalCost: typeof value.originalCost === "number" ? value.originalCost : null,
        });
      });
    }
    record.variants.forEach((variant) => {
      originalCostsByVariant.set(variant.id, {
        variantId: variant.id,
        originalCurrency: variant.originalCurrency ?? null,
        originalCost: variant.originalCost ?? null,
      });
    });
    transaction.set(productRef, {
      id: record.product.id,
      sku: record.product.sku,
      originalCosts: [...originalCostsByVariant.values()],
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
    const submittedVariantIds = new Set(record.variants.map((variant) => variant.id));
    existingVariantsSnapshot.docs
      .filter((snapshot) => !submittedVariantIds.has(snapshot.id))
      .forEach((snapshot) => {
        transaction.set(snapshot.ref, {
          publishState: "archived",
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actorUid,
        }, { merge: true });
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
    const submittedCampaignIds = new Set(record.campaigns.map((campaign) => campaign.id));
    existingCampaignsSnapshot.docs
      .filter((snapshot) => !submittedCampaignIds.has(snapshot.id))
      .forEach((snapshot) => {
        transaction.set(snapshot.ref, {
          status: "archived",
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actorUid,
        }, { merge: true });
      });

    if (skuResolution.nextProductSequence !== (sequenceData.nextProductSequence ?? 1)) {
      transaction.set(sequenceRef, {
        nextProductSequence: skuResolution.nextProductSequence,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      }, { merge: true });
    }

    return record;
}

function assertChildOwnership(
  snapshots: Array<FirebaseFirestore.DocumentSnapshot>,
  productId: string,
  kind: "variant" | "campaign",
) {
  snapshots.forEach((snapshot) => {
    if (!snapshot.exists) return;
    const ownerProductId = String(snapshot.data()?.productId ?? "");
    const isArchived = kind === "variant"
      ? snapshot.data()?.publishState === "archived"
      : snapshot.data()?.status === "archived";
    if (ownerProductId !== productId || isArchived) {
      throw new Error("catalog_change_child_id_conflict");
    }
  });
}

async function resolveAuthoritativeClassifications(
  db: Firestore,
  transaction: Transaction,
  classifications: ProductClassifications | undefined,
): Promise<ProductClassifications | undefined> {
  if (!classifications) return undefined;
  const entries = Object.entries(classifications) as Array<
    [keyof typeof classificationCollections, { id: string; label: string }]
  >;
  const snapshots = await Promise.all(entries.map(([key, link]) =>
    transaction.get(db.collection(classificationCollections[key]).doc(link.id))));
  const resolved = entries.map(([key, link], index) => {
    const snapshot = snapshots[index];
    const data = snapshot?.data() as { label?: unknown; status?: unknown } | undefined;
    if (
      !snapshot?.exists
      || data?.status !== "active"
      || typeof data.label !== "string"
      || !data.label.trim()
      || data.label.trim() !== link.label.trim()
    ) {
      throw new Error("catalog_change_classification_conflict");
    }
    return [key, { id: link.id, label: data.label.trim() }] as const;
  });
  return resolved.length ? Object.fromEntries(resolved) as ProductClassifications : undefined;
}

function isOriginalCurrency(
  value: unknown,
): value is NonNullable<ProductCatalogRecord["variants"][number]["originalCurrency"]> {
  return value === "TWD" || value === "THB" || value === "JPY" || value === "KRW" || value === "USD";
}

export function productVersion(data: FirebaseFirestore.DocumentData | undefined): string | null {
  const updatedAt = data?.updatedAt;
  if (!updatedAt) return null;
  if (typeof updatedAt.toMillis === "function") return String(updatedAt.toMillis());
  if (typeof updatedAt === "string") return updatedAt;
  if (updatedAt instanceof Date) return updatedAt.toISOString();
  return String(updatedAt);
}
