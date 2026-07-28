import { notFound } from "next/navigation";
import { E2EAuthForm } from "./E2EAuthForm";

export default function E2EAuthPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH !== "true") {
    notFound();
  }

  return <E2EAuthForm />;
}
