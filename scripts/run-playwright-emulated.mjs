import { spawn } from "node:child_process";
import { join } from "node:path";

const playwrightCli = join(process.cwd(), "node_modules", "@playwright", "test", "cli.js");
const defaultBrowserPath = process.env.USERPROFILE
  ? join(process.env.USERPROFILE, "AppData", "Local", "ms-playwright")
  : undefined;
const env = {
  ...process.env,
  ...(defaultBrowserPath && !process.env.PLAYWRIGHT_BROWSERS_PATH
    ? { PLAYWRIGHT_BROWSERS_PATH: defaultBrowserPath }
    : {}),
  PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
  NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH: "true",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-astera-oms",
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-astera-oms.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-astera-oms.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:000000000000:web:demo",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  GCLOUD_PROJECT: "demo-astera-oms",
  GOOGLE_CLOUD_PROJECT: "demo-astera-oms",
};

const child = spawn(process.execPath, [playwrightCli, "test"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Playwright exited with signal ${signal}.`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
