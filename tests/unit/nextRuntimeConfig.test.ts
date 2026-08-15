import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("Next server runtime config", () => {
  test("pins Firebase Admin to the Vercel-compatible CommonJS JWKS line", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies?.["firebase-admin"]).toBe("13.10.0");
  });

  test("keeps firebase-admin external in server bundles", () => {
    const configSource = readFileSync("next.config.ts", "utf8");

    expect(configSource).toContain("serverExternalPackages");
    expect(configSource).toMatch(/serverExternalPackages:\s*\[[\s\S]*"firebase-admin"/);
  });

  test("proxies Firebase Auth helpers before application routes", () => {
    const configSource = readFileSync("next.config.ts", "utf8");

    expect(configSource).toContain("async rewrites()");
    expect(configSource).toContain("beforeFiles");
    expect(configSource).toContain('source: "/__/auth/:path*"');
    expect(configSource).toContain(
      'destination: "https://astera-oms-prod.firebaseapp.com/__/auth/:path*"',
    );
  });

  test("isolates firebase-admin auth in the dedicated server adapter", () => {
    const adminSource = readFileSync("src/lib/firebase/admin.ts", "utf8");
    const adminAuthSource = readFileSync("src/lib/firebase/adminAuth.ts", "utf8");
    const serverAuthSource = readFileSync("src/lib/firebase/serverAuth.ts", "utf8");

    expect(adminSource).not.toContain("firebase-admin/auth");
    expect(adminAuthSource).toContain("firebase-admin/auth");
    expect(serverAuthSource).not.toContain("firebase-admin/auth");
    expect(serverAuthSource).toContain("@/lib/firebase/adminAuth");
  });

  test("imports Firebase Admin Auth directly after pinning its compatible dependency line", () => {
    const adminAuthSource = readFileSync("src/lib/firebase/adminAuth.ts", "utf8");

    expect(adminAuthSource).toContain('import { getAuth } from "firebase-admin/auth"');
    expect(adminAuthSource).not.toContain("createRequire");
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
