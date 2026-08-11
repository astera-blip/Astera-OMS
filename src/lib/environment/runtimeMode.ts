export type RuntimeEnvironment = {
  NODE_ENV?: string;
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS?: string;
  NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH?: string;
};

export function assertSafeRuntimeMode(env: RuntimeEnvironment) {
  const exposesTestRuntime =
    env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
    || env.NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH === "true";

  if (env.NODE_ENV === "production" && exposesTestRuntime) {
    throw new Error("unsafe_production_runtime");
  }
}
