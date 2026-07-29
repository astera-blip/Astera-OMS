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

  test("uses Firebase Admin-compatible Application Default Credentials for Vercel OIDC", () => {
    const adminSource = readFileSync("src/lib/firebase/admin.ts", "utf8");

    expect(adminSource).toContain("@vercel/oidc");
    expect(adminSource).toContain("applicationDefault");
    expect(adminSource).toContain("getVercelOidcTokenSync");
    expect(adminSource).toContain("GCP_PROJECT_NUMBER");
    expect(adminSource).toContain("GCP_WORKLOAD_IDENTITY_POOL_ID");
    expect(adminSource).toContain("GCP_WORKLOAD_IDENTITY_PROVIDER_ID");
    expect(adminSource).toContain("GCP_SERVICE_ACCOUNT_EMAIL");
    expect(adminSource).toContain("credential_source");
    expect(adminSource).toContain("service_account_impersonation_url");
    expect(adminSource).not.toContain("IdentityPoolClient");
    expect(adminSource).not.toContain("GCP_SERVICE_ACCOUNT_PRIVATE_KEY");
  });
});
