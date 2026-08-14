import { defineConfig, devices } from "@playwright/test";

const useFirebaseEmulators =
  process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "3000";
const localBaseUrl = `http://127.0.0.1:${playwrightPort}`;
const playwrightTurbopackRoot = process.env.PLAYWRIGHT_TURBOPACK_ROOT;
const configuredWorkers = Number(process.env.PLAYWRIGHT_WORKERS);

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  // Emulator acceptance tests share seeded Auth, Firestore, and Storage state.
  // Keep those flows serial while retaining parallel smoke tests elsewhere.
  fullyParallel: !useFirebaseEmulators,
  workers: Number.isInteger(configuredWorkers) && configuredWorkers > 0
    ? configuredWorkers
    : useFirebaseEmulators
      ? 1
      : undefined,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? localBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
      ? undefined
      : {
        command: `npm.cmd run dev -- --port ${playwrightPort}`,
        url: localBaseUrl,
        reuseExistingServer: !useFirebaseEmulators,
        timeout: 120_000,
        env: {
          ...(process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true"
            ? {
              NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
              NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH: "true",
              FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
              FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
              FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
              GCLOUD_PROJECT: "demo-astera-oms",
              GOOGLE_CLOUD_PROJECT: "demo-astera-oms",
              REFUND_RATE_LIMIT_HASH_SECRET:
                "e2e-refund-rate-limit-secret-32-characters",
              }
            : {}),
          ...(playwrightTurbopackRoot
            ? { NEXT_TURBOPACK_ROOT: playwrightTurbopackRoot }
            : {}),
        },
      },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
