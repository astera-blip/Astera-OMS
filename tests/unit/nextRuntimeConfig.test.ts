import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("Next server runtime config", () => {
  test("keeps firebase-admin external in server bundles", () => {
    const configSource = readFileSync("next.config.ts", "utf8");

    expect(configSource).toContain("serverExternalPackages");
    expect(configSource).toMatch(/serverExternalPackages:\s*\[[\s\S]*"firebase-admin"/);
  });

  test("does not load firebase-admin auth from the shared Admin SDK module", () => {
    const adminSource = readFileSync("src/lib/firebase/admin.ts", "utf8");
    const serverAuthSource = readFileSync("src/lib/firebase/serverAuth.ts", "utf8");

    expect(adminSource).not.toContain("firebase-admin/auth");
    expect(serverAuthSource).not.toContain("firebase-admin/auth");
  });

  test("supports Vercel OIDC for Admin SDK credentials without service account keys", () => {
    const adminSource = readFileSync("src/lib/firebase/admin.ts", "utf8");

    expect(adminSource).toContain("@vercel/oidc");
    expect(adminSource).toContain("IdentityPoolClient");
    expect(adminSource).toContain("GCP_PROJECT_NUMBER");
    expect(adminSource).toContain("GCP_WORKLOAD_IDENTITY_POOL_ID");
    expect(adminSource).toContain("GCP_WORKLOAD_IDENTITY_PROVIDER_ID");
    expect(adminSource).toContain("GCP_SERVICE_ACCOUNT_EMAIL");
    expect(adminSource).toContain("getVercelOidcToken");
    expect(adminSource).toContain("getSubjectToken: () => getVercelOidcToken()");
    expect(adminSource).not.toContain("getVercelOidcToken({");
    expect(adminSource).not.toContain("GCP_SERVICE_ACCOUNT_PRIVATE_KEY");
  });
});
