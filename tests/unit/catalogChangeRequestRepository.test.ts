import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createCatalogChangeRequestServer,
  listCatalogChangeRequestsServer,
  reviewCatalogChangeRequestServer,
  updateOwnCatalogChangeRequestServer,
} from "@/lib/catalog-change/serverCatalogChangeRequests";
import type { ProductDraft } from "@/lib/product/catalog";

type Stored = Record<string, unknown>;

const product: ProductDraft = {
  product: {
    id: "product-a",
    sku: "AST-P000001",
    name: "測試商品",
    publicDescription: "公開說明",
    publishState: "published",
  },
  variants: [{
    id: "variant-a",
    sku: "AST-P000001-V001",
    name: "一般款",
    isDefault: true,
    priceTwd: 520,
  }],
  campaigns: [{
    id: "campaign-a",
    title: "預購活動",
    saleType: "preorder",
    status: "open",
    requiresSupplement: true,
  }],
};

function createDb(seed: Record<string, Stored> = {}) {
  const records = new Map<string, Stored>(Object.entries(seed));
  let generated = 0;
  const ref = (collection: string, id: string) => ({ collection, id });
  const snapshot = (collection: string, id: string) => ({
    id,
    exists: records.has(`${collection}/${id}`),
    data: () => records.get(`${collection}/${id}`),
  });
  const transaction = {
    get: vi.fn(async (target: { collection: string; id: string }) =>
      snapshot(target.collection, target.id)),
    set: vi.fn((target: { collection: string; id: string }, value: Stored, options?: { merge?: boolean }) => {
      const key = `${target.collection}/${target.id}`;
      records.set(key, options?.merge ? { ...records.get(key), ...value } : value);
    }),
  };
  const db = {
    collection: vi.fn((collection: string) => ({
      doc: vi.fn((id?: string) => ref(collection, id ?? `${collection}-${++generated}`)),
      orderBy: vi.fn(() => ({
        get: vi.fn(async () => ({
          docs: [...records.entries()]
            .filter(([key]) => key.startsWith(`${collection}/`))
            .map(([key, value]) => ({ id: key.slice(collection.length + 1), data: () => value })),
        })),
      })),
    })),
    runTransaction: vi.fn(async (operation: (value: typeof transaction) => unknown) => operation(transaction)),
  };
  return { db, records };
}

const input = {
  title: "更新商品",
  changeReason: "官方資料更新",
  product,
  internalNote: "Partner 交接",
};

describe("catalog change request repository", () => {
  it("creates a submitted request without writing formal catalog collections", async () => {
    const state = createDb();

    const result = await createCatalogChangeRequestServer(state.db as never, input, "partner-a");

    expect(result).toMatchObject({
      id: "catalogChangeRequests-1",
      status: "submitted",
      revision: 1,
      createdBy: "partner-a",
      payloadDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect([...state.records.keys()]).toEqual(["catalogChangeRequests/catalogChangeRequests-1"]);
  });

  it("lists all requests but only lets the creator revise a reviewable request", async () => {
    const state = createDb();
    const created = await createCatalogChangeRequestServer(state.db as never, input, "partner-a");

    await expect(updateOwnCatalogChangeRequestServer(
      state.db as never,
      created.id,
      { ...input, title: "他人修改" },
      "partner-b",
    )).rejects.toThrow("catalog_change_forbidden");

    const updated = await updateOwnCatalogChangeRequestServer(
      state.db as never,
      created.id,
      { ...input, title: "第二版" },
      "partner-a",
    );
    expect(updated).toMatchObject({ title: "第二版", revision: 2, status: "submitted" });
    await expect(listCatalogChangeRequestsServer(state.db as never)).resolves.toHaveLength(1);
  });

  it("records an Owner rejection and keeps the proposal for revision", async () => {
    const state = createDb();
    const created = await createCatalogChangeRequestServer(state.db as never, input, "partner-a");

    const rejected = await reviewCatalogChangeRequestServer(
      state.db as never,
      created.id,
      "owner-a",
      "reject",
      "請補活動說明",
      vi.fn(),
    );

    expect(rejected).toMatchObject({
      status: "rejected",
      reviewReason: "請補活動說明",
      reviewedBy: "owner-a",
    });
    expect([...state.records.values()]).toContainEqual(expect.objectContaining({
      action: "catalog_change.rejected",
      actorUid: "owner-a",
      targetId: created.id,
    }));
  });

  it("applies an approved proposal once and replays the approved result", async () => {
    const state = createDb();
    const created = await createCatalogChangeRequestServer(state.db as never, input, "partner-a");
    const applyProduct = vi.fn(async () => ({ ok: true }));

    const approved = await reviewCatalogChangeRequestServer(
      state.db as never,
      created.id,
      "owner-a",
      "approve",
      "確認刊登",
      applyProduct,
    );
    const replay = await reviewCatalogChangeRequestServer(
      state.db as never,
      created.id,
      "owner-a",
      "approve",
      "確認刊登",
      applyProduct,
    );

    expect(approved.status).toBe("approved");
    expect(replay).toEqual(approved);
    expect(applyProduct).toHaveBeenCalledTimes(1);
    expect(applyProduct).toHaveBeenCalledWith(expect.objectContaining({
      product: expect.objectContaining({ product: expect.objectContaining({ id: "product-a" }) }),
      internalNote: "Partner 交接",
    }), "owner-a");
  });
});
