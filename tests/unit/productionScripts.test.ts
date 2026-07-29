import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  formatEnvironmentReport,
} from "../../scripts/check-production-env.mjs";
import {
  auditProductProjection,
  parseProductionArgs,
} from "../../scripts/audit-product-projection.mjs";
import {
  parseSmokeArgs,
  runAnonymousSmoke,
} from "../../scripts/smoke-production.mjs";

describe("production environment checker", () => {
  it("reports only configured or missing variable names without secret values", () => {
    const report = formatEnvironmentReport({
      RESEND_API_KEY: "secret-value",
      FIREBASE_PROJECT_ID: "",
    });

    expect(report).toContain("RESEND_API_KEY=configured");
    expect(report).toContain("FIREBASE_PROJECT_ID=missing");
    expect(report).not.toContain("secret-value");
  });
});

describe("product projection audit", () => {
  it("requires an exact repeated production project confirmation", () => {
    expect(() => parseProductionArgs([
      "--project",
      "astera-oms-prod",
      "--confirm-project",
      "astera-oms-dev-b2b2e",
    ])).toThrow("project_confirmation_mismatch");
  });

  it("detects count, SKU, price, image, and private-field projection problems", () => {
    const report = auditProductProjection(
      [{
        id: "prod_1",
        sku: "bad",
        variants: [{ id: "var_1", sku: "bad", priceTwd: 500 }],
        campaigns: [],
        images: [{ objectPath: "product-images/prod_1/a.webp", sortOrder: 1 }],
      }],
      [{
        id: "prod_1",
        variants: [{ id: "var_1", priceTwd: 400 }],
        campaigns: [],
        images: [],
        internalNote: "must not leak",
      }],
    );

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.stringContaining("invalid_product_sku"),
      expect.stringContaining("invalid_variant_sku"),
      expect.stringContaining("price_mismatch"),
      expect.stringContaining("image_count_mismatch"),
      expect.stringContaining("private_field_exposed"),
    ]));
  });

  it("detects private fields leaked inside public nested records", () => {
    const report = auditProductProjection(
      [{
        id: "prod_1",
        sku: "AST-P000001",
        variants: [{ id: "var_1", sku: "AST-P000001-V001", priceTwd: 500 }],
        campaigns: [],
        images: [],
      }],
      [{
        id: "prod_1",
        variants: [{ id: "var_1", priceTwd: 500, sku: "AST-P000001-V001" }],
        campaigns: [],
        images: [],
      }],
    );

    expect(report.issues).toContain("private_field_exposed:prod_1:variants.var_1.sku");
  });

  it("contains no Firestore mutation calls", () => {
    const source = readFileSync("scripts/audit-product-projection.mjs", "utf8");
    expect(source).not.toMatch(/\.(set|update|delete|create|add)\s*\(/);
    expect(source).not.toContain("bulkWriter");
  });
});

describe("anonymous production smoke", () => {
  it("requires an https base URL", () => {
    expect(() => parseSmokeArgs(["--base-url", "http://example.com"]))
      .toThrow("https_base_url_required");
  });

  it("checks public pages without sending credentials", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => new Response(
      new URL(input instanceof Request ? input.url : input.toString()).pathname === "/products"
        ? '<a href="/products/prod-public">Product</a>'
        : "ok",
      { status: 200 },
    ));
    const report = await runAnonymousSmoke("https://example.com", fetcher);

    expect(report.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(5);
    const calls = fetcher.mock.calls as unknown as Array<[URL, RequestInit | undefined]>;
    for (const [, init] of calls) {
      expect(init).toEqual(expect.objectContaining({
        credentials: "omit",
        redirect: "manual",
      }));
      expect(init?.headers).toBeUndefined();
    }
  });

  it("fails when no public Product detail can be discovered", async () => {
    const fetcher = vi.fn(async () => new Response("ok", { status: 200 }));
    const report = await runAnonymousSmoke("https://example.com", fetcher);

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({
      path: "/products/:id",
      status: 0,
      ok: false,
      error: "public_product_not_found",
    });
  });
});
