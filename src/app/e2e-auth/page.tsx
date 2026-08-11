import { notFound } from "next/navigation";
import { E2EAuthForm } from "./E2EAuthForm";
import { assertSafeRuntimeMode } from "@/lib/environment/runtimeMode";

export default function E2EAuthPage() {
  assertSafeRuntimeMode({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS:
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS,
    NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH:
      process.env.NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH,
  });

  if (process.env.NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH !== "true") {
    notFound();
  }

  return <E2EAuthForm />;
}
