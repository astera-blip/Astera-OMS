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

export function formatEnvironmentReport(env) {
  return productionEnvironmentNames
    .map((name) => `${name}=${String(env[name] ?? "").trim() ? "configured" : "missing"}`)
    .join("\n");
}

export function getMissingEnvironmentNames(env) {
  return productionEnvironmentNames.filter((name) => !String(env[name] ?? "").trim());
}

export function validateProductionEnvironment(env) {
  const issues = getMissingEnvironmentNames(env).map((name) => `${name}=missing`);
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
  return issues;
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
  ) {
    throw new Error("unsafe_production_runtime");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assertProductionFlags(process.env);
    console.log(formatEnvironmentReport(process.env));
    if (process.argv.includes("--strict") && validateProductionEnvironment(process.env).length > 0) {
      throw new Error("production_environment_incomplete");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "environment_check_failed");
    process.exitCode = 1;
  }
}
