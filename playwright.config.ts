import { defineConfig, devices } from "@playwright/test";

const useFirebaseEmulators =
  process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true";

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
  workers: useFirebaseEmulators ? 1 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm.cmd run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 120_000,
        env: process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true"
          ? {
              NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
              NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH: "true",
              FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
              FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
              FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
              GCLOUD_PROJECT: "demo-astera-oms",
              GOOGLE_CLOUD_PROJECT: "demo-astera-oms",
            }
          : undefined,
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
