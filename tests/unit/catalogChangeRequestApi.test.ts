import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  requireFirebaseUser: vi.fn(),
  getAdminFirestore: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  review: vi.fn(),
  listProducts: vi.fn(),
  saveProduct: vi.fn(),
}));

vi.mock("@/lib/firebase/serverAuth", () => ({
  requireFirebaseUser: dependencies.requireFirebaseUser,
  isOwnerClaim: (claims: Record<string, unknown>) => claims.role === "owner",
}));
vi.mock("@/lib/firebase/admin", () => ({ getAdminFirestore: dependencies.getAdminFirestore }));
vi.mock("@/lib/catalog-change/serverCatalogChangeRequests", () => ({
  listCatalogChangeRequestsServer: dependencies.list,
  createCatalogChangeRequestServer: dependencies.create,
  updateOwnCatalogChangeRequestServer: dependencies.update,
  reviewCatalogChangeRequestServer: dependencies.review,
}));
vi.mock("@/lib/product/serverCatalog", () => ({
  listWorkspaceProductsServer: dependencies.listProducts,
  saveWorkspaceProductServer: dependencies.saveProduct,
}));

import { GET, POST } from "@/app/api/workspace/catalog-change-requests/route";
import { PATCH } from "@/app/api/workspace/catalog-change-requests/[id]/route";
import { POST as reviewPost } from "@/app/api/workspace/catalog-change-requests/[id]/review/route";
import { GET as formalProductGet, POST as formalProductPost } from "@/app/api/workspace/products/route";

const requestBody = {
  title: "更新商品",
  changeReason: "官方資料更新",
  baseProductVersion: null,
  product: {
    product: {
      id: "product-a",
      sku: "AST-P000001",
      name: "測試商品",
      publicDescription: "公開說明",
      publishState: "published",
    },
    variants: [],
    campaigns: [],
  },
};

describe("catalog change request APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getAdminFirestore.mockReturnValue({ marker: "db" });
    dependencies.requireFirebaseUser.mockResolvedValue({ uid: "partner-a", role: "partner" });
  });

  it("allows Owner and Partner to list requests but denies Helper", async () => {
    dependencies.list.mockResolvedValue([{ id: "change-a", status: "submitted" }]);
    const allowed = await GET(new Request("https://example.test", {
      headers: { authorization: "Bearer token" },
    }));
    expect(allowed.status).toBe(200);

    dependencies.requireFirebaseUser.mockResolvedValue({ uid: "helper-a", role: "helper" });
    const denied = await GET(new Request("https://example.test", {
      headers: { authorization: "Bearer token" },
    }));
    expect(denied.status).toBe(403);
    expect(dependencies.list).toHaveBeenCalledTimes(1);
  });

  it("creates a Partner proposal but keeps the formal Product API Owner-only", async () => {
    dependencies.create.mockResolvedValue({ id: "change-a", status: "submitted" });
    const created = await POST(new Request("https://example.test", {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify(requestBody),
    }));
    expect(created.status).toBe(201);
    expect(dependencies.create).toHaveBeenCalledWith(
      { marker: "db" },
      requestBody,
      "partner-a",
    );

    const formal = await formalProductPost(new Request("https://example.test", {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify(requestBody.product),
    }));
    expect(formal.status).toBe(403);
    expect(dependencies.saveProduct).not.toHaveBeenCalled();
  });

  it("allows Partner to read the formal catalog needed to compose a proposal", async () => {
    dependencies.listProducts.mockResolvedValue([{ product: { id: "product-a" } }]);
    const response = await formalProductGet(new Request("https://example.test", {
      headers: { authorization: "Bearer token" },
    }));
    expect(response.status).toBe(200);
    expect(dependencies.listProducts).toHaveBeenCalledWith({ marker: "db" });
  });

  it("lets a Partner revise through the creator-enforcing repository", async () => {
    dependencies.update.mockResolvedValue({ id: "change-a", revision: 2, status: "submitted" });
    const response = await PATCH(new Request("https://example.test", {
      method: "PATCH",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify(requestBody),
    }), { params: Promise.resolve({ id: "change-a" }) });
    expect(response.status).toBe(200);
    expect(dependencies.update).toHaveBeenCalledWith(
      { marker: "db" },
      "change-a",
      requestBody,
      "partner-a",
    );
  });

  it("allows only Owner to approve or reject", async () => {
    const partnerDenied = await reviewPost(new Request("https://example.test", {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify({ decision: "approve", reason: "確認" }),
    }), { params: Promise.resolve({ id: "change-a" }) });
    expect(partnerDenied.status).toBe(403);

    dependencies.requireFirebaseUser.mockResolvedValue({ uid: "owner-a", role: "owner" });
    dependencies.review.mockResolvedValue({ id: "change-a", status: "approved" });
    const approved = await reviewPost(new Request("https://example.test", {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify({ decision: "approve", reason: "確認刊登" }),
    }), { params: Promise.resolve({ id: "change-a" }) });
    expect(approved.status).toBe(200);
    expect(dependencies.review).toHaveBeenCalledWith(
      { marker: "db" },
      "change-a",
      "owner-a",
      "approve",
      "確認刊登",
    );
  });

  it("maps missing tokens and safe domain errors", async () => {
    dependencies.requireFirebaseUser.mockRejectedValue(new Error("missing_token"));
    const missing = await GET(new Request("https://example.test"));
    expect(missing.status).toBe(401);

    dependencies.requireFirebaseUser.mockResolvedValue({ uid: "partner-a", role: "partner" });
    dependencies.create.mockRejectedValue(new Error("invalid_product"));
    const invalid = await POST(new Request("https://example.test", {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify(requestBody),
    }));
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "invalid_product" });

    dependencies.create.mockRejectedValue(new Error("catalog_change_stale_base"));
    const stale = await POST(new Request("https://example.test", {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify(requestBody),
    }));
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toEqual({ error: "catalog_change_stale_base" });
  });

  it("returns a safe 400 response for malformed JSON", async () => {
    const response = await POST(new Request("https://example.test", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: "{not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_request" });
    expect(dependencies.create).not.toHaveBeenCalled();
  });
});
