import "server-only";

import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { ValidProductDraft } from "@/lib/product/catalog";
import { saveWorkspaceProductServer } from "@/lib/product/serverCatalog";
import {
  validateCatalogDraftInput,
  type CatalogChangeRequest,
  type CatalogDraftInput,
  type ValidCatalogDraftInput,
} from "@/lib/catalog-change/catalogChangeRequest";

type StoredCatalogChangeRequest = Omit<CatalogChangeRequest, "status"> & {
  status: CatalogChangeRequest["status"] | "applying";
};

type ApplyProduct = (
  input: { product: ValidProductDraft; internalNote?: string },
  actorUid: string,
) => Promise<unknown>;

export async function listCatalogChangeRequestsServer(
  db: Firestore,
): Promise<CatalogChangeRequest[]> {
  const snapshot = await db.collection("catalogChangeRequests").orderBy("updatedAt", "desc").get();
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }) as StoredCatalogChangeRequest)
    .filter((request): request is CatalogChangeRequest => request.status !== "applying");
}

export async function createCatalogChangeRequestServer(
  db: Firestore,
  input: CatalogDraftInput,
  actorUid: string,
): Promise<CatalogChangeRequest> {
  const value = requireValidInput(input);
  const ref = db.collection("catalogChangeRequests").doc();
  const now = new Date().toISOString();
  const request: CatalogChangeRequest = {
    id: ref.id,
    ...value,
    status: "submitted",
    revision: 1,
    payloadDigest: digestPayload(value),
    createdBy: actorUid,
    createdAt: now,
    updatedBy: actorUid,
    updatedAt: now,
  };
  await db.runTransaction(async (transaction) => {
    transaction.set(ref, request);
  });
  return request;
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
    const current = { id: snapshot.id, ...snapshot.data() } as StoredCatalogChangeRequest;
    if (current.createdBy !== actorUid) throw new Error("catalog_change_forbidden");
    if (current.status === "approved" || current.status === "applying") {
      throw new Error("catalog_change_locked");
    }
    const updated: CatalogChangeRequest = {
      ...current,
      ...value,
      status: "submitted",
      revision: current.revision + 1,
      payloadDigest: digestPayload(value),
      updatedBy: actorUid,
      updatedAt: new Date().toISOString(),
    };
    delete updated.reviewedBy;
    delete updated.reviewedAt;
    delete updated.reviewReason;
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
  applyProduct: ApplyProduct = (input, uid) => saveWorkspaceProductServer(db, {
    ...input.product,
    ...(input.internalNote ? { internalNote: input.internalNote } : {}),
  }, uid),
): Promise<CatalogChangeRequest> {
  const id = requireId(requestId);
  const reviewReason = reason.trim();
  if (!reviewReason) throw new Error("catalog_change_review_reason_required");
  const ref = db.collection("catalogChangeRequests").doc(id);

  if (decision === "reject") {
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error("catalog_change_not_found");
      const current = { id: snapshot.id, ...snapshot.data() } as StoredCatalogChangeRequest;
      if (current.status === "approved") return current as CatalogChangeRequest;
      if (current.status !== "submitted") throw new Error("catalog_change_not_reviewable");
      const rejected: CatalogChangeRequest = {
        ...current,
        status: "rejected",
        reviewReason,
        reviewedBy: actorUid,
        reviewedAt: new Date().toISOString(),
        updatedBy: actorUid,
        updatedAt: new Date().toISOString(),
      };
      transaction.set(ref, rejected);
      transaction.set(db.collection("auditLogs").doc(), buildAudit(rejected, actorUid, "rejected"));
      return rejected;
    });
  }

  const claimed = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("catalog_change_not_found");
    const current = { id: snapshot.id, ...snapshot.data() } as StoredCatalogChangeRequest;
    if (current.status === "approved") return current;
    if (current.status === "applying") throw new Error("catalog_change_review_in_progress");
    if (current.status !== "submitted") throw new Error("catalog_change_not_reviewable");
    transaction.set(ref, {
      ...current,
      status: "applying",
      reviewReason,
      reviewedBy: actorUid,
      updatedBy: actorUid,
      updatedAt: new Date().toISOString(),
    });
    return current;
  });
  if (claimed.status === "approved") return claimed as CatalogChangeRequest;

  try {
    await applyProduct({
      product: claimed.product,
      ...(claimed.internalNote ? { internalNote: claimed.internalNote } : {}),
    }, actorUid);
  } catch (error) {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists && (snapshot.data() as StoredCatalogChangeRequest).status === "applying") {
        transaction.set(ref, { status: "submitted", updatedAt: new Date().toISOString() }, { merge: true });
      }
    });
    throw error;
  }

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("catalog_change_not_found");
    const current = { id: snapshot.id, ...snapshot.data() } as StoredCatalogChangeRequest;
    if (current.status === "approved") return current as CatalogChangeRequest;
    if (current.status !== "applying") throw new Error("catalog_change_review_conflict");
    const approved: CatalogChangeRequest = {
      ...current,
      status: "approved",
      reviewReason,
      reviewedBy: actorUid,
      reviewedAt: new Date().toISOString(),
      updatedBy: actorUid,
      updatedAt: new Date().toISOString(),
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

function requireId(value: string): string {
  const id = value.trim();
  if (!id) throw new Error("catalog_change_id_required");
  return id;
}

function digestPayload(value: ValidCatalogDraftInput): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
    createdAt: new Date().toISOString(),
  };
}
