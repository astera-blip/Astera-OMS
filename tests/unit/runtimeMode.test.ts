import { describe, expect, it } from "vitest";
import { assertSafeRuntimeMode } from "@/lib/environment/runtimeMode";

describe("assertSafeRuntimeMode", () => {
  it("rejects Firebase emulators in production", () => {
    expect(() =>
      assertSafeRuntimeMode({
        NODE_ENV: "production",
        NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
      }),
    ).toThrow("unsafe_production_runtime");
  });

  it("rejects the E2E auth route in production", () => {
    expect(() =>
      assertSafeRuntimeMode({
        NODE_ENV: "production",
        NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH: "true",
      }),
    ).toThrow("unsafe_production_runtime");
  });

  it("allows explicit emulator flags outside production", () => {
    expect(() =>
      assertSafeRuntimeMode({
        NODE_ENV: "test",
        NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
        NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH: "true",
      }),
    ).not.toThrow();
  });
});
