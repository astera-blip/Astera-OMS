import { pathToFileURL } from "node:url";

export const productionEnvironmentNames = [
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
];

export const productionSecurityEnvironmentNames = productionEnvironmentNames
  .filter((name) => !name.startsWith("RESEND_"));

export function formatEnvironmentReport(env, scope = "default") {
  return getEnvironmentNamesForScope(scope)
    .map((name) => `${name}=${String(env[name] ?? "").trim() ? "configured" : "missing"}`)
    .join("\n");
}

export function getMissingEnvironmentNames(env, scope = "default") {
  return getEnvironmentNamesForScope(scope)
    .filter((name) => !String(env[name] ?? "").trim());
}

export function validateProductionEnvironment(env, scope = "default") {
  const issues = getMissingEnvironmentNames(env, scope).map((name) => `${name}=missing`);
  const projectIds = [
    env.GOOGLE_CLOUD_PROJECT,
    env.GCP_PROJECT_ID,
    env.GCLOUD_PROJECT,
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  ].map((value) => String(value ?? "").trim()).filter(Boolean);
  if (new Set(projectIds).size > 1) {
    issues.push("PROJECT_ID_ALIASES=conflict");
  }
  const projectId = String(env.GCP_PROJECT_ID ?? "").trim();
  for (const name of ["GCP_KMS_HMAC_KEY_NAME", "GCP_KMS_REFUND_KEY_NAME"]) {
    const keyName = String(env[name] ?? "").trim();
    if (keyName && !isCryptoKeyNameForProject(keyName, projectId)) {
      issues.push(`${name}=invalid`);
    }
  }
  const fingerprintKeyVersion = String(env.GCP_KMS_HMAC_KEY_VERSION ?? "").trim();
  if (
    fingerprintKeyVersion
    && (!/^[1-9]\d*$/.test(fingerprintKeyVersion)
      || !Number.isSafeInteger(Number(fingerprintKeyVersion)))
  ) {
    issues.push("GCP_KMS_HMAC_KEY_VERSION=invalid");
  }
  const rateLimitSecret = String(env.REFUND_RATE_LIMIT_HASH_SECRET ?? "");
  if (rateLimitSecret && rateLimitSecret.length < 32) {
    issues.push("REFUND_RATE_LIMIT_HASH_SECRET=invalid");
  }
  if (scope === "security") validateSecurityResourceIdentity(env, issues);
  return issues;
}

export function parseProductionEnvironmentArgs(argv) {
  let scope = "default";
  let strict = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--strict") {
      if (strict) throw new Error("invalid_arguments");
      strict = true;
      continue;
    }
    if (token !== "--scope" || scope !== "default") {
      throw new Error("invalid_arguments");
    }
    const value = argv[index + 1];
    if (value !== "security") throw new Error("invalid_environment_scope");
    scope = value;
    index += 1;
  }
  return { scope, strict };
}

function getEnvironmentNamesForScope(scope) {
  if (scope === "default") return productionEnvironmentNames;
  if (scope === "security") return productionSecurityEnvironmentNames;
  throw new Error("invalid_environment_scope");
}

function validateSecurityResourceIdentity(env, issues) {
  const exactValues = {
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
  };
  for (const [name, expected] of Object.entries(exactValues)) {
    const value = String(env[name] ?? "").trim();
    if (value && value !== expected) issues.push(`${name}=invalid`);
  }
}

function isCryptoKeyNameForProject(keyName, projectId) {
  const parts = keyName.split("/");
  return Boolean(
    projectId
    && parts.length === 8
    && parts[0] === "projects"
    && parts[1] === projectId
    && parts[2] === "locations"
    && parts[3]
    && parts[4] === "keyRings"
    && parts[5]
    && parts[6] === "cryptoKeys"
    && parts[7],
  );
}

export function assertProductionFlags(env) {
  if (
    env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
    || env.NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH === "true"
    || env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true"
    || String(env.FIREBASE_AUTH_EMULATOR_HOST ?? "").trim()
    || String(env.FIRESTORE_EMULATOR_HOST ?? "").trim()
    || String(env.FIREBASE_STORAGE_EMULATOR_HOST ?? "").trim()
  ) {
    throw new Error("unsafe_production_runtime");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseProductionEnvironmentArgs(process.argv.slice(2));
    assertProductionFlags(process.env);
    console.log(formatEnvironmentReport(process.env, options.scope));
    if (
      options.strict
      && validateProductionEnvironment(process.env, options.scope).length > 0
    ) {
      throw new Error("production_environment_incomplete");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "environment_check_failed");
    process.exitCode = 1;
  }
}
