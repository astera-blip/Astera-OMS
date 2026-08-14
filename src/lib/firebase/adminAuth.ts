import "server-only";

import { createRequire } from "node:module";
import { getAdminApp } from "@/lib/firebase/admin";

// Turbopack's dynamic external import path cannot load firebase-admin/auth on
// Vercel because jwks-rsa currently requires jose as CommonJS. Keep this as a
// Node external require so Firebase Admin's own module resolution is used.
const requireFirebaseAdminAuth = createRequire(import.meta.url);
const { getAuth } = requireFirebaseAdminAuth("firebase-admin/auth") as typeof import("firebase-admin/auth");

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
