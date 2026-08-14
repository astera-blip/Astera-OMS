import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  listWorkspaceProductsServer,
  saveWorkspaceProductInTransaction,
} from "@/lib/product/serverCatalog";

describe("server catalog preservation", () => {
  it("hydrates internal original costs into Partner workspace variants", async () => {
    const snapshots = {
      productsPublic: [{ id: "product-a", data: () => ({
        id: "product-a",
        name: "商品",
        publicDescription: "說明",
        publishState: "published",
      }) }],
      productsInternal: [{ id: "product-a", data: () => ({
        sku: "AST-P000001",
        updatedAt: "version-1",
        originalCosts: [{
          variantId: "variant-a",
          originalCurrency: "THB",
          originalCost: 350,
        }],
      }) }],
      productVariants: [{ id: "variant-a", data: () => ({
        id: "variant-a",
        productId: "product-a",
        sku: "AST-P000001-V001",
        name: "一般款",
        isDefault: true,
        priceTwd: 520,
      }) }, { id: "variant-archived", data: () => ({
        id: "variant-archived",
        productId: "product-a",
        sku: "AST-P000001-V002",
        name: "已封存",
        isDefault: false,
        priceTwd: 600,
        publishState: "archived",
      }) }],
      saleCampaigns: [],
    };
    const db = {
      collection: vi.fn((name: keyof typeof snapshots) => ({
        get: vi.fn(async () => ({ docs: snapshots[name] })),
      })),
    };

    const [record] = await listWorkspaceProductsServer(db as never);
    expect(record.variants[0]).toMatchObject({
      originalCurrency: "THB",
      originalCost: 350,
    });
    expect(record.variants).toHaveLength(1);
    expect(record.catalogVersion).toBe("version-1");
  });

  it("rejects a stale draft before any formal catalog write", async () => {
    const productRef = { id: "product-a" };
    const db = {
      collection: vi.fn(() => ({ doc: vi.fn(() => productRef) })),
    };
    const transaction = {
      get: vi.fn(async () => ({
        exists: true,
        data: () => ({ updatedAt: "version-2" }),
      })),
      set: vi.fn(),
    };

    await expect(saveWorkspaceProductInTransaction(
      db as never,
      transaction as never,
      {
        product: {
          id: "product-a",
          sku: "",
          name: "商品",
          publicDescription: "說明",
          publishState: "published",
        },
        variants: [],
        campaigns: [],
      },
      "owner-a",
      { expectedProductVersion: "version-1" },
    )).rejects.toThrow("catalog_change_stale_base");
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it.each([
    ["productVariants", "variant-foreign", "saleCampaigns", ""],
    ["saleCampaigns", "campaign-foreign", "productVariants", "variant-a"],
  ])("rejects a child ID owned by another product (%s)", async (
    foreignCollection,
    foreignId,
    _otherCollection,
    retainedVariantId,
  ) => {
    const harness = createWriterHarness();
    const variants = retainedVariantId ? [variantInput(retainedVariantId)] : [variantInput(foreignId)];
    const campaigns = foreignCollection === "saleCampaigns"
      ? [campaignInput(foreignId)]
      : [];

    await expect(saveWorkspaceProductInTransaction(
      harness.db as never,
      harness.transaction as never,
      {
        product: productInput(),
        variants,
        campaigns,
      },
      "owner-a",
      { expectedProductVersion: "version-1" },
    )).rejects.toThrow("catalog_change_child_id_conflict");
    expect(harness.transaction.set).not.toHaveBeenCalled();
  });

  it("rejects reusing an archived child ID from the same product", async () => {
    const harness = createWriterHarness();
    await expect(saveWorkspaceProductInTransaction(
      harness.db as never,
      harness.transaction as never,
      {
        product: productInput(),
        variants: [variantInput("product-a-variant-2")],
        campaigns: [],
      },
      "owner-a",
      { expectedProductVersion: "version-1" },
    )).rejects.toThrow("catalog_change_child_id_conflict");
  });

  it("archives omitted variants and campaigns instead of letting them reappear", async () => {
    const harness = createWriterHarness();
    await saveWorkspaceProductInTransaction(
      harness.db as never,
      harness.transaction as never,
      {
        product: productInput(),
        variants: [variantInput("variant-a")],
        campaigns: [],
      },
      "owner-a",
      { expectedProductVersion: "version-1" },
    );

    expect(harness.transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "productVariants", id: "variant-b" }),
      expect.objectContaining({ publishState: "archived", updatedBy: "owner-a" }),
      { merge: true },
    );
    expect(harness.transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "saleCampaigns", id: "campaign-a" }),
      expect.objectContaining({ status: "archived", updatedBy: "owner-a" }),
      { merge: true },
    );
    expect(harness.transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "productsInternal", id: "product-a" }),
      expect.objectContaining({
        originalCosts: expect.arrayContaining([
          expect.objectContaining({ variantId: "variant-b", originalCurrency: "THB", originalCost: 280 }),
        ]),
      }),
    );
  });

  it("uses a fresh server child ID and continues SKU numbering after archived variants", async () => {
    const harness = createWriterHarness();
    await saveWorkspaceProductInTransaction(
      harness.db as never,
      harness.transaction as never,
      {
        product: productInput(),
        variants: [
          variantInput("variant-a"),
          { ...variantInput(""), isDefault: false, name: "新規格" },
        ],
        campaigns: [],
      },
      "owner-a",
      { expectedProductVersion: "version-1" },
    );
    expect(harness.transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "productVariants", id: expect.stringMatching(/^productVariants-generated-/) }),
      expect.objectContaining({ name: "新規格", sku: "AST-P000001-V004" }),
    );
  });

  it("never persists the legacy global -default child ID", async () => {
    const harness = createWriterHarness();
    await saveWorkspaceProductInTransaction(
      harness.db as never,
      harness.transaction as never,
      { product: productInput(), variants: [], campaigns: [] },
      "owner-a",
      { expectedProductVersion: "version-1" },
    );
    const generatedVariantWrite = harness.transaction.set.mock.calls.find(
      ([ref]) => (ref as Ref).collection === "productVariants"
        && (ref as Ref).id.startsWith("productVariants-generated-"),
    );
    expect(generatedVariantWrite?.[0]).not.toMatchObject({ id: "-default" });
    expect(generatedVariantWrite?.[1]).toMatchObject({ name: "Default Variant", sku: "AST-P000001-V004" });
  });

  it("accepts an unchanged active classification master", async () => {
    const harness = createWriterHarness();
    await saveWorkspaceProductInTransaction(
      harness.db as never,
      harness.transaction as never,
      {
        product: {
          ...productInput(),
          classifications: { artist: { id: "artist-a", label: "正式藝人名稱" } },
        },
        variants: [variantInput("variant-a")],
        campaigns: [],
      },
      "owner-a",
      { expectedProductVersion: "version-1" },
    );
    expect(harness.transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "productsPublic", id: "product-a" }),
      expect.objectContaining({ classifications: { artist: { id: "artist-a", label: "正式藝人名稱" } } }),
    );
  });

  it("rejects a missing or archived classification master", async () => {
    const harness = createWriterHarness();
    await expect(saveWorkspaceProductInTransaction(
      harness.db as never,
      harness.transaction as never,
      {
        product: {
          ...productInput(),
          classifications: { artist: { id: "artist-archived", label: "舊名稱" } },
        },
        variants: [variantInput("variant-a")],
        campaigns: [],
      },
      "owner-a",
      { expectedProductVersion: "version-1" },
    )).rejects.toThrow("catalog_change_classification_conflict");
    expect(harness.transaction.set).not.toHaveBeenCalled();
  });

  it("rejects a classification label changed after draft submission", async () => {
    const harness = createWriterHarness();
    await expect(saveWorkspaceProductInTransaction(
      harness.db as never,
      harness.transaction as never,
      {
        product: {
          ...productInput(),
          classifications: { artist: { id: "artist-a", label: "送審時舊名稱" } },
        },
        variants: [variantInput("variant-a")],
        campaigns: [],
      },
      "owner-a",
      { expectedProductVersion: "version-1" },
    )).rejects.toThrow("catalog_change_classification_conflict");
  });
});

type Ref = { kind: "doc"; collection: string; id: string };
type Query = { kind: "query"; collection: string; field: string; value: string };

function createWriterHarness() {
  const documents = new Map<string, Record<string, unknown>>([
    ["productsInternal/product-a", {
      sku: "AST-P000001",
      updatedAt: "version-1",
      originalCosts: [{ variantId: "variant-b", originalCurrency: "THB", originalCost: 280 }],
    }],
    ["productVariants/variant-a", { id: "variant-a", productId: "product-a", sku: "AST-P000001-V001" }],
    ["productVariants/variant-b", { id: "variant-b", productId: "product-a", sku: "AST-P000001-V002" }],
    ["productVariants/variant-foreign", { id: "variant-foreign", productId: "product-b", sku: "AST-P000002-V001" }],
    ["productVariants/product-a-variant-2", {
      id: "product-a-variant-2",
      productId: "product-a",
      sku: "AST-P000001-V003",
      publishState: "archived",
    }],
    ["saleCampaigns/campaign-a", { id: "campaign-a", productId: "product-a" }],
    ["saleCampaigns/campaign-foreign", { id: "campaign-foreign", productId: "product-b" }],
    ["catalogArtists/artist-a", { id: "artist-a", label: "正式藝人名稱", status: "active" }],
    ["catalogArtists/artist-archived", { id: "artist-archived", label: "舊名稱", status: "archived" }],
  ]);
  let generated = 0;
  const doc = (collection: string, id: string): Ref => ({ kind: "doc", collection, id });
  const snapshot = (ref: Ref) => ({
    id: ref.id,
    ref,
    exists: documents.has(`${ref.collection}/${ref.id}`),
    data: () => documents.get(`${ref.collection}/${ref.id}`),
  });
  const db = {
    collection: vi.fn((collection: string) => ({
      doc: vi.fn((id?: string) => doc(collection, id ?? `${collection}-generated-${++generated}`)),
      where: vi.fn((field: string, _operator: string, value: string): Query => ({
        kind: "query",
        collection,
        field,
        value,
      })),
    })),
  };
  const transaction = {
    get: vi.fn(async (target: Ref | Query) => {
      if (target.kind === "doc") return snapshot(target);
      const docs = [...documents.entries()]
        .filter(([key, value]) => key.startsWith(`${target.collection}/`) && value[target.field] === target.value)
        .map(([key]) => snapshot(doc(target.collection, key.slice(target.collection.length + 1))));
      return { docs, empty: docs.length === 0 };
    }),
    set: vi.fn(),
  };
  return { db, transaction };
}

function productInput() {
  return {
    id: "product-a",
    sku: "AST-P000001",
    name: "商品",
    publicDescription: "說明",
    publishState: "published" as const,
  };
}

function variantInput(id: string) {
  return {
    id,
    sku: "",
    name: "一般款",
    isDefault: true,
    priceTwd: 520,
  };
}

function campaignInput(id: string) {
  return {
    id,
    title: "預購",
    saleType: "preorder" as const,
    status: "open" as const,
    requiresSupplement: false,
  };
}
