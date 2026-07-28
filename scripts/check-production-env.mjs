import { pathToFileURL } from "node:url";

export const productionEnvironmentNames = [
  "GOOGLE_CLOUD_PROJECT",
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
  } catch (error) {
    console.error(error instanceof Error ? error.message : "environment_check_failed");
    process.exitCode = 1;
  }
}
