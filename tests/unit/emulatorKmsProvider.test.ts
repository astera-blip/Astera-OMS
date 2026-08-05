import { describe, expect, it } from "vitest";
import { isEmulatorKmsProviderEnabled } from "@/lib/security/emulatorKmsProvider";

describe("emulator KMS provider guard", () => {
  it("enables only when the Playwright emulator flag and demo project both match", () => {
    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      GCP_PROJECT_ID: "demo-astera-oms",
    })).toBe(true);

    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "false",
      GCP_PROJECT_ID: "demo-astera-oms",
    })).toBe(false);
    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      GCP_PROJECT_ID: "astera-oms-prod",
    })).toBe(false);
    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
    })).toBe(false);
  });

  it("accepts the server-side Google project variable for the same demo project only", () => {
    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      GOOGLE_CLOUD_PROJECT: "demo-astera-oms",
    })).toBe(true);

    expect(isEmulatorKmsProviderEnabled({
      PLAYWRIGHT_USE_FIREBASE_EMULATORS: "true",
      GOOGLE_CLOUD_PROJECT: "astera-oms-prod",
    })).toBe(false);
  });
});
