import "server-only";

import { createHash } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { ValidProductDraft } from "@/lib/product/catalog";
import {
  productVersion,
  saveWorkspaceProductInTransaction,
} from "@/lib/product/serverCatalog";
import {
  validateCatalogDraftInput,
  type CatalogChangeRequest,
  type CatalogChangeRequestRevision,
  type CatalogDraftInput,
  type ValidCatalogDraftInput,
} from "@/lib/catalog-change/catalogChangeRequest";

const maxRevisionHistory = 20;

type ApplyProduct = (
  transaction: Transaction,
  input: { product: ValidProductDraft; internalNote?: string },
  actorUid: string,
  options: { expectedProductVersion: string | null },
) => Promise<unknown>;

export async function listCatalogChangeRequestsServer(
  db: Firestore,
): Promise<CatalogChangeRequest[]> {
  const snapshot = await db.collection("catalogChangeRequests").orderBy("updatedAt", "desc").get();
  const requests = snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }) as CatalogChangeRequest);
  const creatorUids = [...new Set(requests.map((request) => request.createdBy).filter(Boolean))];
  const names = new Map(await Promise.all(creatorUids.map(async (uid) => {
    try {
      const member = await db.collection("members").doc(uid).get();
      return [uid, formatCreatorDisplayName(member.data() as Record<string, unknown> | undefined)] as const;
    } catch {
      return [uid, "未完成會員資料"] as const;
    }
  })));
  return requests.map((request) => ({
    ...request,
    creatorDisplayName: names.get(request.createdBy) ?? "未完成會員資料",
  }));
}

export async function createCatalogChangeRequestServer(
  db: Firestore,
  input: CatalogDraftInput,
  actorUid: string,
): Promise<CatalogChangeRequest> {
  const validated = requireValidInput(input);
  const ref = db.collection("catalogChangeRequests").doc();
  const clientProvidedProductId = validated.product.product.id.trim();
  const value = withStableProductId(db, validated);

  return db.runTransaction(async (transaction) => {
    const now = new Date().toISOString();
    const base = await readBaseCatalogState(
      db,
      transaction,
      value.product.product.id,
    );
    if (clientProvidedProductId && !base.exists) {
      throw new Error("catalog_change_product_id_invalid");
    }
    if (base.version !== value.baseProductVersion) {
      throw new Error("catalog_change_stale_base");
    }
    const request: CatalogChangeRequest = {
      id: ref.id,
      ...value,
      status: "submitted",
      revision: 1,
      payloadDigest: digestPayload(value),
      baseProductVersion: value.baseProductVersion,
      baseVariants: base.variants,
      baseCampaigns: base.campaigns,
      createdBy: actorUid,
      createdAt: now,
      updatedBy: actorUid,
      updatedAt: now,
    };
    transaction.set(ref, request);
    return request;
  });
}

export async function updateOwnCatalogChangeRequestServer(
  db: Firestore,
  requestId: string,
  input: CatalogDraftInput,
  actorUid: string,
): Promise<CatalogChangeRequest> {
  const value = requireValidInput(input);
  const ref = db.collection("catalogChangeRequests").doc(requireId(requestId));
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("catalog_change_not_found");
    const current = { id: snapshot.id, ...snapshot.data() } as CatalogChangeRequest;
    if (current.createdBy !== actorUid) throw new Error("catalog_change_forbidden");
    if (current.status !== "rejected") throw new Error("catalog_change_locked");
    if (!current.reviewedBy || !current.reviewedAt || !current.reviewReason) {
      throw new Error("catalog_change_invalid_history");
    }
    const history = [...(current.revisionHistory ?? []), revisionSnapshot(current)];
    if (history.length > maxRevisionHistory) throw new Error("catalog_change_revision_limit");
    const currentBaseProductVersion = await readBaseProductVersion(
      db,
      transaction,
      current.product.product.id,
    );
    if (
      value.product.product.id !== current.product.product.id
      || value.baseProductVersion !== current.baseProductVersion
      || currentBaseProductVersion !== current.baseProductVersion
    ) {
      throw new Error("catalog_change_stale_base");
    }
    const now = new Date().toISOString();
    const updated: CatalogChangeRequest = {
      ...current,
      ...value,
      status: "submitted",
      revision: current.revision + 1,
      revisionHistory: history,
      payloadDigest: digestPayload(value),
      baseProductVersion: current.baseProductVersion,
      baseVariants: current.baseVariants ?? [],
      baseCampaigns: current.baseCampaigns ?? [],
      updatedBy: actorUid,
      updatedAt: now,
    };
    delete updated.reviewedBy;
    delete updated.reviewedAt;
    delete updated.reviewReason;
    delete updated.reviewDecisionDigest;
    transaction.set(ref, updated);
    return updated;
  });
}

export async function reviewCatalogChangeRequestServer(
  db: Firestore,
  requestId: string,
  actorUid: string,
  decision: "approve" | "reject",
  reason: string,
  applyProduct: ApplyProduct = (transaction, input, uid, options) =>
    saveWorkspaceProductInTransaction(db, transaction, {
      ...input.product,
      ...(input.internalNote ? { internalNote: input.internalNote } : {}),
    }, uid, options),
): Promise<CatalogChangeRequest> {
  const id = requireId(requestId);
  const reviewReason = reason.trim();
  if (!reviewReason) throw new Error("catalog_change_review_reason_required");
  const ref = db.collection("catalogChangeRequests").doc(id);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("catalog_change_not_found");
    const current = { id: snapshot.id, ...snapshot.data() } as CatalogChangeRequest;
    const reviewDecisionDigest = digestReview(current, actorUid, decision, reviewReason);

    if (current.status === "approved" || current.status === "rejected") {
      if (current.reviewDecisionDigest === reviewDecisionDigest) return current;
      throw new Error("catalog_change_review_conflict");
    }
    if (current.status !== "submitted") throw new Error("catalog_change_not_reviewable");

    const now = new Date().toISOString();
    if (decision === "reject") {
      const rejected: CatalogChangeRequest = {
        ...current,
        status: "rejected",
        reviewReason,
        reviewDecisionDigest,
        reviewedBy: actorUid,
        reviewedAt: now,
        updatedBy: actorUid,
        updatedAt: now,
      };
      transaction.set(ref, rejected);
      transaction.set(db.collection("auditLogs").doc(), buildAudit(rejected, actorUid, "rejected"));
      return rejected;
    }

    const applied = await applyProduct(transaction, {
      product: current.product,
      ...(current.internalNote ? { internalNote: current.internalNote } : {}),
    }, actorUid, { expectedProductVersion: current.baseProductVersion });
    const appliedProductId = readAppliedProductId(applied) ?? current.product.product.id;
    const approved: CatalogChangeRequest = {
      ...current,
      status: "approved",
      reviewReason,
      reviewDecisionDigest,
      appliedProductId,
      reviewedBy: actorUid,
      reviewedAt: now,
      updatedBy: actorUid,
      updatedAt: now,
    };
    transaction.set(ref, approved);
    transaction.set(db.collection("auditLogs").doc(), buildAudit(approved, actorUid, "approved"));
    return approved;
  });
}

function requireValidInput(input: CatalogDraftInput): ValidCatalogDraftInput {
  const result = validateCatalogDraftInput(input);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function withStableProductId(db: Firestore, value: ValidCatalogDraftInput): ValidCatalogDraftInput {
  if (value.product.product.id.trim()) return value;
  return {
    ...value,
    product: {
      ...value.product,
      product: {
        ...value.product.product,
        id: db.collection("productsInternal").doc().id,
      },
    },
  };
}

async function readBaseProductVersion(
  db: Firestore,
  transaction: Transaction,
  productId: string,
): Promise<string | null> {
  if (!productId.trim()) return null;
  const snapshot = await transaction.get(db.collection("productsInternal").doc(productId));
  return productVersion(snapshot.data());
}

async function readBaseCatalogState(
  db: Firestore,
  transaction: Transaction,
  productId: string,
) {
  if (!productId.trim()) {
    return { exists: false, version: null, variants: [], campaigns: [] };
  }
  const productSnapshot = await transaction.get(db.collection("productsInternal").doc(productId));
  if (!productSnapshot.exists) {
    return { exists: false, version: null, variants: [], campaigns: [] };
  }
  const [variantsSnapshot, campaignsSnapshot] = await Promise.all([
    transaction.get(db.collection("productVariants").where("productId", "==", productId)),
    transaction.get(db.collection("saleCampaigns").where("productId", "==", productId)),
  ]);
  return {
    exists: true,
    version: productVersion(productSnapshot.data()),
    variants: variantsSnapshot.docs
      .filter((snapshot) => snapshot.data().publishState !== "archived")
      .map((snapshot) => ({
        id: snapshot.id,
        name: String(snapshot.data().name ?? snapshot.id),
      })),
    campaigns: campaignsSnapshot.docs
      .filter((snapshot) => snapshot.data().status !== "archived")
      .map((snapshot) => ({
        id: snapshot.id,
        title: String(snapshot.data().title ?? snapshot.id),
      })),
  };
}

function revisionSnapshot(current: CatalogChangeRequest): CatalogChangeRequestRevision {
  return {
    revision: current.revision,
    title: current.title,
    changeReason: current.changeReason,
    product: current.product,
    ...(current.internalNote ? { internalNote: current.internalNote } : {}),
    payloadDigest: current.payloadDigest,
    baseProductVersion: current.baseProductVersion,
    baseVariants: current.baseVariants ?? [],
    baseCampaigns: current.baseCampaigns ?? [],
    status: "rejected",
    reviewedBy: current.reviewedBy!,
    reviewedAt: current.reviewedAt!,
    reviewReason: current.reviewReason!,
  };
}

function requireId(value: string): string {
  const id = value.trim();
  if (!id) throw new Error("catalog_change_id_required");
  return id;
}

function digestPayload(value: ValidCatalogDraftInput): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function digestReview(
  request: CatalogChangeRequest,
  actorUid: string,
  decision: "approve" | "reject",
  reason: string,
): string {
  return createHash("sha256").update(JSON.stringify({
    actorUid,
    decision,
    reason,
    revision: request.revision,
    payloadDigest: request.payloadDigest,
  })).digest("hex");
}

function readAppliedProductId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const product = (value as { product?: { id?: unknown } }).product;
  return typeof product?.id === "string" && product.id ? product.id : null;
}

function buildAudit(
  request: CatalogChangeRequest,
  actorUid: string,
  outcome: "approved" | "rejected",
) {
  return {
    action: `catalog_change.${outcome}`,
    actorUid,
    targetType: "catalogChangeRequest",
    targetId: request.id,
    reason: request.reviewReason,
    revision: request.revision,
    payloadDigest: request.payloadDigest,
    reviewDecisionDigest: request.reviewDecisionDigest,
    createdAt: new Date().toISOString(),
  };
}

function formatCreatorDisplayName(member: Record<string, unknown> | undefined) {
  const displayName = typeof member?.displayName === "string" ? member.displayName.trim() : "";
  const communityId = typeof member?.communityId === "string" ? member.communityId.trim() : "";
  if (!displayName) return "未完成會員資料";
  return communityId && communityId !== displayName
    ? `${displayName}（${communityId}）`
    : displayName;
}
