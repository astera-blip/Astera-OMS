import "server-only";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { loadBrandContent } from "./repository";
import type { Firestore } from "firebase/firestore";

export async function loadBrandContentServer() {
  return loadBrandContent(getAdminFirestore() as unknown as Firestore);
}
