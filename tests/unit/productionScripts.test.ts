import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  assertProductionFlags,
  formatEnvironmentReport,
  getMissingEnvironmentNames,
  parseProductionEnvironmentArgs,
  productionEnvironmentNames,
  validateProductionEnvironment,
} from "../../scripts/check-production-env.mjs";
import {
  auditProductProjection,
  parseProductionArgs,
} from "../../scripts/audit-product-projection.mjs";
import {
  buildDesiredPublicProducts,
  buildProductProjectionSyncPlan,
  buildProjectionSyncPlan,
  parseSyncArgs,
} from "../../scripts/sync-product-projection.mjs";
import {
  parseSmokeArgs,
  runAnonymousSmoke,
} from "../../scripts/smoke-production.mjs";

describe("production environment checker", () => {
  it("reports only configured or missing variable names without secret values", () => {
    const report = formatEnvironmentReport({
      RESEND_API_KEY: "secret-value",
      FIREBASE_PROJECT_ID: "",
      GCP_SERVICE_ACCOUNT_EMAIL: "astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com",
    });

    expect(report).toContain("RESEND_API_KEY=configured");
    expect(report).toContain("FIREBASE_PROJECT_ID=missing");
    expect(report).toContain("GCP_SERVICE_ACCOUNT_EMAIL=configured");
    expect(report).not.toContain("secret-value");
    expect(report).not.toContain("astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com");
  });

  it("tracks required Vercel OIDC environment variable names", () => {
    const source = readFileSync("scripts/check-production-env.mjs", "utf8");

    expect(source).toContain("GCP_PROJECT_NUMBER");
    expect(source).toContain("GCP_WORKLOAD_IDENTITY_POOL_ID");
    expect(source).toContain("GCP_WORKLOAD_IDENTITY_PROVIDER_ID");
    expect(source).toContain("GCP_SERVICE_ACCOUNT_EMAIL");
  });

  it("returns missing production variables for strict deployment gates", () => {
    expect(getMissingEnvironmentNames({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: "astera-oms-prod" }))
      .toContain("GCP_PROJECT_ID");
    expect(getMissingEnvironmentNames(Object.fromEntries(
      [
        "GOOGLE_CLOUD_PROJECT",
        "GCP_PROJECT_ID",
        "GCP_PROJECT_NUMBER",
        "GCP_WORKLOAD_IDENTITY_POOL_ID",
        "GCP_WORKLOAD_IDENTITY_PROVIDER_ID",
        "GCP_SERVICE_ACCOUNT_EMAIL",
        "GCP_WORKLOAD_IDENTITY_AUDIENCE",
        "GCP_KMS_HMAC_KEY_NAME",
        "GCP_KMS_HMAC_KEY_VERSION",
        "GCP_KMS_REFUND_KEY_NAME",
        "REFUND_RATE_LIMIT_HASH_SECRET",
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
        "NEXT_PUBLIC_FIREBASE_APP_ID",
        "RESEND_API_KEY",
        "RESEND_FROM_EMAIL",
        "RESEND_REPLY_TO_EMAIL",
      ].map((name) => [name, "configured"]),
    ))).toEqual([]);
  });

  it("requires stable refund rate-limit, KMS, and workload identity configuration", () => {
    const environment = Object.fromEntries(
      [
        "GOOGLE_CLOUD_PROJECT",
        "GCP_PROJECT_ID",
        "GCP_PROJECT_NUMBER",
        "GCP_WORKLOAD_IDENTITY_POOL_ID",
        "GCP_WORKLOAD_IDENTITY_PROVIDER_ID",
        "GCP_SERVICE_ACCOUNT_EMAIL",
        "GCP_WORKLOAD_IDENTITY_AUDIENCE",
        "GCP_KMS_HMAC_KEY_NAME",
        "GCP_KMS_HMAC_KEY_VERSION",
        "GCP_KMS_REFUND_KEY_NAME",
        "REFUND_RATE_LIMIT_HASH_SECRET",
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
        "NEXT_PUBLIC_FIREBASE_APP_ID",
        "RESEND_API_KEY",
        "RESEND_FROM_EMAIL",
        "RESEND_REPLY_TO_EMAIL",
      ].map((name) => [name, "configured"]),
    );
    environment.GCP_KMS_HMAC_KEY_VERSION = "7";
    environment.REFUND_RATE_LIMIT_HASH_SECRET = "stable-secret-at-least-thirty-two-characters";
    environment.GCP_KMS_HMAC_KEY_NAME =
      "projects/configured/locations/global/keyRings/account/cryptoKeys/fingerprint";
    environment.GCP_KMS_REFUND_KEY_NAME =
      "projects/configured/locations/asia-east1/keyRings/refund/cryptoKeys/account";

    expect(validateProductionEnvironment(environment)).toEqual([]);
    expect(validateProductionEnvironment({
      ...environment,
      REFUND_RATE_LIMIT_HASH_SECRET: "short",
    })).toContain("REFUND_RATE_LIMIT_HASH_SECRET=invalid");
    expect(validateProductionEnvironment({
      ...environment,
      GCP_KMS_HMAC_KEY_VERSION: "latest",
    })).toContain("GCP_KMS_HMAC_KEY_VERSION=invalid");
    expect(validateProductionEnvironment({
      ...environment,
      GCP_KMS_HMAC_KEY_NAME: "configured",
    })).toContain("GCP_KMS_HMAC_KEY_NAME=invalid");
    expect(validateProductionEnvironment({
      ...environment,
      GCP_KMS_REFUND_KEY_NAME:
        "projects/another-project/locations/asia-east1/keyRings/refund/cryptoKeys/account",
    })).toContain("GCP_KMS_REFUND_KEY_NAME=invalid");
    expect(validateProductionEnvironment({
      ...environment,
      GOOGLE_CLOUD_PROJECT: "astera-oms-prod",
      GCP_PROJECT_ID: "demo-astera-oms",
    })).toContain("PROJECT_ID_ALIASES=conflict");
  });

  it("supports a strict security scope without weakening the default Resend gate", () => {
    const environment = Object.fromEntries(
      productionEnvironmentNames
        .filter((name) => !name.startsWith("RESEND_"))
        .map((name) => [name, "configured"]),
    );
    environment.GCP_KMS_HMAC_KEY_VERSION = "1";
    environment.REFUND_RATE_LIMIT_HASH_SECRET = "stable-secret-at-least-thirty-two-characters";
    environment.GCP_KMS_HMAC_KEY_NAME =
      "projects/configured/locations/asia-east1/keyRings/astera-oms-security/cryptoKeys/member-account-fingerprint";
    environment.GCP_KMS_REFUND_KEY_NAME =
      "projects/configured/locations/asia-east1/keyRings/astera-oms-security/cryptoKeys/refund-account-vault";
    Object.assign(environment, {
      GOOGLE_CLOUD_PROJECT: "astera-oms-prod",
      GCP_PROJECT_ID: "astera-oms-prod",
      GCP_PROJECT_NUMBER: "1032606875618",
      GCP_WORKLOAD_IDENTITY_POOL_ID: "vercel-oidc",
      GCP_WORKLOAD_IDENTITY_PROVIDER_ID: "vercel",
      GCP_SERVICE_ACCOUNT_EMAIL:
        "astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com",
      GCP_WORKLOAD_IDENTITY_AUDIENCE:
        "//iam.googleapis.com/projects/1032606875618/locations/global/workloadIdentityPools/vercel-oidc/providers/vercel",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "astera-oms-prod",
      GCP_KMS_HMAC_KEY_NAME:
        "projects/astera-oms-prod/locations/asia-east1/keyRings/astera-oms-security/cryptoKeys/member-account-fingerprint",
      GCP_KMS_REFUND_KEY_NAME:
        "projects/astera-oms-prod/locations/asia-east1/keyRings/astera-oms-security/cryptoKeys/refund-account-vault",
    });

    expect(parseProductionEnvironmentArgs(["--scope", "security", "--strict"]))
      .toEqual({ scope: "security", strict: true });
    expect(getMissingEnvironmentNames(environment, "security")).toEqual([]);
    expect(validateProductionEnvironment(environment, "security")).toEqual([]);
    expect(getMissingEnvironmentNames(environment)).toEqual([
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "RESEND_REPLY_TO_EMAIL",
    ]);
  });

  it.each([
    { PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true" },
    { FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" },
    { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" },
    { FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199" },
  ])("rejects private emulator configuration in production: %o", (unsafe) => {
    expect(() => assertProductionFlags(unsafe)).toThrow("unsafe_production_runtime");
  });

  it("allows absent OIDC resources to fall through to their create commands on Windows", () => {
    const source = readFileSync("scripts/setup-vercel-gcp-oidc.ps1", "utf8");

    expect(source).toContain("function Test-GcloudResource");
    expect(source).toContain("return $false");
    expect(source).toContain("if (-not (Test-GcloudResource" );
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

describe("product projection sync", () => {
  it("requires exact project confirmation and explicit apply", () => {
    expect(() => parseSyncArgs([
      "--project", "astera-oms-prod",
      "--confirm-project", "astera-oms-prod",
    ])).toThrow("apply_confirmation_required");
    expect(() => parseSyncArgs([
      "--project", "astera-oms-prod",
      "--confirm-project", "astera-oms-dev-b2b2e",
      "--apply",
    ])).toThrow("project_confirmation_required");
  });

  it("builds desired public projections from joined internal product records without private fields", () => {
    const plan = buildProductProjectionSyncPlan([{
      id: "prod_1",
      name: "Internal product",
      publicDescription: "Description from internal",
      publishState: "published",
      sku: "AST-P000001",
      internalNote: "private",
      images: [{ objectPath: "product-images/prod_1/a.webp", sortOrder: 1, url: "https://cdn.example/a.webp", createdBy: "system" }],
      variants: [{ id: "var_1", productId: "prod_1", name: "Default", priceTwd: 500, sku: "AST-P000001-V001", originalCost: 200 }],
      campaigns: [{ id: "campaign_1", productId: "prod_1", title: "Open", saleType: "inStock", status: "open", requiresSupplement: false, internalNote: "private" }],
    }], []);

    expect(plan.desiredPublicProducts).toEqual([{
      id: "prod_1",
      name: "Internal product",
      publicDescription: "Description from internal",
      publishState: "published",
      images: [{ objectPath: "product-images/prod_1/a.webp", sortOrder: 1, url: "https://cdn.example/a.webp" }],
      variants: [{ id: "var_1", productId: "prod_1", name: "Default", priceTwd: 500 }],
      campaigns: [{ id: "campaign_1", productId: "prod_1", title: "Open", saleType: "inStock", status: "open", requiresSupplement: false }],
    }]);
    expect(plan.operations).toEqual([{
      type: "set",
      id: "prod_1",
      data: {
        id: "prod_1",
        name: "Internal product",
        publicDescription: "Description from internal",
        publishState: "published",
        images: [{ objectPath: "product-images/prod_1/a.webp", sortOrder: 1, url: "https://cdn.example/a.webp" }],
        variants: [{ id: "var_1", productId: "prod_1", name: "Default", priceTwd: 500 }],
        campaigns: [{ id: "campaign_1", productId: "prod_1", title: "Open", saleType: "inStock", status: "open", requiresSupplement: false }],
      },
    }]);
  });

  it("sets missing or stale projections from internal records and deletes orphan public records", () => {
    const plan = buildProductProjectionSyncPlan(
      [
        { id: "prod_1", name: "Fresh one", publicDescription: "Fresh description", publishState: "published", sku: "AST-P000001", variants: [], campaigns: [] },
        { id: "prod_2", name: "Missing two", publicDescription: "Second description", publishState: "draft", sku: "AST-P000002", variants: [], campaigns: [] },
      ],
      [
        { id: "prod_1", name: "Stale public name", publicDescription: "Stale", publishState: "archived", variants: [], campaigns: [] },
        { id: "prod_orphan", name: "Orphan", publicDescription: "Orphan", publishState: "published", variants: [], campaigns: [] },
      ],
    );

    expect(plan.operations).toEqual([
      {
        type: "set",
        id: "prod_1",
        data: { id: "prod_1", name: "Fresh one", publicDescription: "Fresh description", publishState: "published", variants: [], campaigns: [] },
      },
      {
        type: "set",
        id: "prod_2",
        data: { id: "prod_2", name: "Missing two", publicDescription: "Second description", publishState: "draft", variants: [], campaigns: [] },
      },
      { type: "delete", id: "prod_orphan" },
    ]);
  });

  it("derives the sync write set from internal products rather than stale public documents", () => {
    const desired = buildDesiredPublicProducts([{
      id: "prod_1",
      name: "Internal authoritative name",
      publicDescription: "Current internal description",
      publishState: "published",
      sku: "AST-P000001",
      internalNote: "never public",
      variants: [{
        id: "var_1",
        productId: "prod_1",
        name: "Default",
        priceTwd: 500,
        sku: "AST-P000001-V001",
      }],
      campaigns: [],
      images: [],
    }]);

    expect(desired).toEqual([{
      id: "prod_1",
      name: "Internal authoritative name",
      publicDescription: "Current internal description",
      publishState: "published",
      variants: [{
        id: "var_1",
        productId: "prod_1",
        name: "Default",
        priceTwd: 500,
      }],
      campaigns: [],
      images: [],
    }]);
  });

  it("removes orphan public projections while preserving internal document ids", () => {
    const plan = buildProjectionSyncPlan(
      [{
        id: "prod_1",
        name: "Internal",
        publicDescription: "Current",
        publishState: "published",
        variants: [],
        campaigns: [],
        images: [],
      }],
      [{ id: "prod_orphan" }, { id: "prod_1", name: "Stale" }],
    );

    expect(plan.desiredPublicProducts.map((product: { id: string }) => product.id)).toEqual(["prod_1"]);
    expect(plan.deletePublicProductIds).toEqual(["prod_orphan"]);
  });

  it("keeps the audit script read-only while sync is the only writer", () => {
    const auditSource = readFileSync("scripts/audit-product-projection.mjs", "utf8");
    const syncSource = readFileSync("scripts/sync-product-projection.mjs", "utf8");
    expect(auditSource).not.toMatch(/\.set\s*\(/);
    expect(syncSource).toContain("--apply");
    expect(syncSource).toContain("createBackup");
  });
});

describe("anonymous production smoke", () => {
  it("requires an https base URL", () => {
    expect(() => parseSmokeArgs(["--base-url", "http://example.com"]))
      .toThrow("https_base_url_required");
  });

  it("accepts an explicit product id for hydrated storefront pages", () => {
    expect(parseSmokeArgs([
      "--base-url", "https://example.com",
      "--product-id", "prod_002",
    ])).toEqual({ baseUrl: "https://example.com", productId: "prod_002" });
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

  it("checks an explicit hydrated product detail route", async () => {
    const fetcher = vi.fn(async () => new Response("ok", { status: 200 }));
    const report = await runAnonymousSmoke("https://example.com", fetcher, "prod_002");

    expect(report.ok).toBe(true);
    expect(report.checks).toContainEqual({
      path: "/products/prod_002",
      status: 200,
      ok: true,
    });
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
