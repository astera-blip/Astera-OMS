import { describe, expect, it } from "vitest";
import { isEmulatorKmsProviderEnabled } from "@/lib/security/emulatorKmsProvider";

describe("emulator KMS provider guard", () => {
  it("enables only when the Playwright emulator flag and demo project both match", () => {
    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      GCP_PROJECT_ID: "demo-astera-oms",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    })).toBe(true);

    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "false",
      GCP_PROJECT_ID: "demo-astera-oms",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    })).toBe(false);
    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      GCP_PROJECT_ID: "astera-oms-prod",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    })).toBe(false);
    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    })).toBe(false);
  });

  it("accepts the server-side Google project variable for the same demo project only", () => {
    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      GOOGLE_CLOUD_PROJECT: "demo-astera-oms",
      FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099",
      FIRESTORE_EMULATOR_HOST: "localhost:8080",
    })).toBe(true);

    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      GOOGLE_CLOUD_PROJECT: "astera-oms-prod",
      FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099",
      FIRESTORE_EMULATOR_HOST: "localhost:8080",
    })).toBe(false);
  });

  it("rejects mixed project aliases even when one alias names the demo project", () => {
    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      GCP_PROJECT_ID: "demo-astera-oms",
      GOOGLE_CLOUD_PROJECT: "astera-oms-prod",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    })).toBe(false);
  });

  it("requires both expected local Firebase emulator hosts", () => {
    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      GOOGLE_CLOUD_PROJECT: "demo-astera-oms",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    })).toBe(false);
    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      GOOGLE_CLOUD_PROJECT: "demo-astera-oms",
      FIREBASE_AUTH_EMULATOR_HOST: "firebase.example.com:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    })).toBe(false);
  });

  it.each([
    { NODE_ENV: "production" },
    { VERCEL: "1" },
    { VERCEL_ENV: "preview" },
  ])("rejects production or deployment runtime markers: %o", (runtime) => {
    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      GOOGLE_CLOUD_PROJECT: "demo-astera-oms",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      ...runtime,
    })).toBe(false);
  });
});
