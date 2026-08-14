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
  const records = new Map<string, Stored>(Object.entries({
    "productsInternal/product-a": { updatedAt: "version-1" },
    ...seed,
  }));
  let generated = 0;
  const ref = (collection: string, id: string) => ({ collection, id });
  const query = (collection: string, field: string, value: string) => ({ collection, field, value });
  const snapshot = (collection: string, id: string) => ({
    id,
    exists: records.has(`${collection}/${id}`),
    data: () => records.get(`${collection}/${id}`),
  });
  const transaction = {
    get: vi.fn(async (target: { collection: string; id?: string; field?: string; value?: string }) => {
      if (target.id) return snapshot(target.collection, target.id);
      const docs = [...records.entries()]
        .filter(([key, value]) => key.startsWith(`${target.collection}/`) && value[target.field!] === target.value)
        .map(([key, value]) => ({
          id: key.slice(target.collection.length + 1),
          data: () => value,
        }));
      return { docs, empty: docs.length === 0 };
    }),
    set: vi.fn((target: { collection: string; id: string }, value: Stored, options?: { merge?: boolean }) => {
      const key = `${target.collection}/${target.id}`;
      records.set(key, options?.merge ? { ...records.get(key), ...value } : value);
    }),
  };
  const db = {
    collection: vi.fn((collection: string) => ({
      doc: vi.fn((id?: string) => ref(collection, id ?? `${collection}-${++generated}`)),
      where: vi.fn((field: string, _operator: string, value: string) => query(collection, field, value)),
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
  baseProductVersion: "version-1",
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
    expect([...state.records.keys()]).toEqual([
      "productsInternal/product-a",
      "catalogChangeRequests/catalogChangeRequests-1",
    ]);
  });

  it("rejects submission when the product changed after the Partner loaded it", async () => {
    const state = createDb({
      "productsInternal/product-a": { updatedAt: "version-2" },
    });
    await expect(createCatalogChangeRequestServer(
      state.db as never,
      { ...input, baseProductVersion: "version-1" },
      "partner-a",
    )).rejects.toThrow("catalog_change_stale_base");
    expect([...state.records.keys()]).toEqual(["productsInternal/product-a"]);
  });

  it("rejects a client-chosen ID for a new product", async () => {
    const state = createDb();
    await expect(createCatalogChangeRequestServer(
      state.db as never,
      {
        ...input,
        baseProductVersion: null,
        product: { ...product, product: { ...product.product, id: "client-chosen-id" } },
      },
      "partner-a",
    )).rejects.toThrow("catalog_change_product_id_invalid");
  });

  it("assigns a stable server ID for a new product draft", async () => {
    const state = createDb();
    const created = await createCatalogChangeRequestServer(
      state.db as never,
      {
        ...input,
        baseProductVersion: null,
        product: { ...product, product: { ...product.product, id: "" } },
      },
      "partner-a",
    );
    expect(created.product.product.id).toBe("productsInternal-2");
    expect(created.baseProductVersion).toBeNull();
  });

  it("captures only active base children for the Owner removal review", async () => {
    const state = createDb({
      "productVariants/variant-active": { productId: "product-a", name: "有效規格", publishState: "published" },
      "productVariants/variant-old": { productId: "product-a", name: "舊規格", publishState: "archived" },
      "saleCampaigns/campaign-active": { productId: "product-a", title: "有效活動", status: "open" },
      "saleCampaigns/campaign-old": { productId: "product-a", title: "舊活動", status: "archived" },
    });
    const created = await createCatalogChangeRequestServer(state.db as never, input, "partner-a");
    expect(created.baseVariants).toEqual([{ id: "variant-active", name: "有效規格" }]);
    expect(created.baseCampaigns).toEqual([{ id: "campaign-active", title: "有效活動" }]);
  });

  it("only lets the creator revise a rejected request and preserves the rejected revision", async () => {
    const state = createDb();
    const created = await createCatalogChangeRequestServer(state.db as never, input, "partner-a");

    await expect(updateOwnCatalogChangeRequestServer(
      state.db as never,
      created.id,
      { ...input, title: "他人修改" },
      "partner-b",
    )).rejects.toThrow("catalog_change_forbidden");

    await expect(updateOwnCatalogChangeRequestServer(
      state.db as never,
      created.id,
      { ...input, title: "第二版" },
      "partner-a",
    )).rejects.toThrow("catalog_change_locked");

    await reviewCatalogChangeRequestServer(
      state.db as never,
      created.id,
      "owner-a",
      "reject",
      "請補活動說明",
      vi.fn(),
    );
    const updated = await updateOwnCatalogChangeRequestServer(
      state.db as never,
      created.id,
      { ...input, title: "第二版" },
      "partner-a",
    );
    expect(updated).toMatchObject({
      title: "第二版",
      revision: 2,
      status: "submitted",
      revisionHistory: [expect.objectContaining({
        revision: 1,
        title: "更新商品",
        status: "rejected",
        reviewReason: "請補活動說明",
      })],
    });
    await expect(listCatalogChangeRequestsServer(state.db as never)).resolves.toHaveLength(1);
  });

  it("rejects resubmission when the formal product changed after the original draft", async () => {
    const state = createDb();
    const created = await createCatalogChangeRequestServer(state.db as never, input, "partner-a");
    await reviewCatalogChangeRequestServer(
      state.db as never,
      created.id,
      "owner-a",
      "reject",
      "請重新確認",
      vi.fn(),
    );
    state.records.set("productsInternal/product-a", { updatedAt: "version-2" });
    await expect(updateOwnCatalogChangeRequestServer(
      state.db as never,
      created.id,
      { ...input, title: "過期修訂" },
      "partner-a",
    )).rejects.toThrow("catalog_change_stale_base");
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
    expect(applyProduct).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      product: expect.objectContaining({ product: expect.objectContaining({ id: "product-a" }) }),
      internalNote: "Partner 交接",
    }), "owner-a", { expectedProductVersion: "version-1" });
  });

  it("replays only an identical terminal review decision", async () => {
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
    const replay = await reviewCatalogChangeRequestServer(
      state.db as never,
      created.id,
      "owner-a",
      "reject",
      "請補活動說明",
      vi.fn(),
    );
    expect(replay).toEqual(rejected);
    await expect(reviewCatalogChangeRequestServer(
      state.db as never,
      created.id,
      "owner-a",
      "approve",
      "請補活動說明",
      vi.fn(),
    )).rejects.toThrow("catalog_change_review_conflict");
    await expect(reviewCatalogChangeRequestServer(
      state.db as never,
      created.id,
      "owner-a",
      "reject",
      "不同理由",
      vi.fn(),
    )).rejects.toThrow("catalog_change_review_conflict");
  });

  it("does not change request state when the atomic product apply fails", async () => {
    const state = createDb();
    const created = await createCatalogChangeRequestServer(state.db as never, input, "partner-a");
    await expect(reviewCatalogChangeRequestServer(
      state.db as never,
      created.id,
      "owner-a",
      "approve",
      "確認刊登",
      vi.fn(async () => { throw new Error("apply_failed"); }),
    )).rejects.toThrow("apply_failed");
    expect(state.records.get(`catalogChangeRequests/${created.id}`)?.status).toBe("submitted");
  });
});
