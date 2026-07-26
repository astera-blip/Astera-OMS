import "server-only";

import { getAdminAuth } from "./admin";

export async function requireFirebaseUser(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("missing_token");
  }

  const idToken = authorization.slice("Bearer ".length).trim();

  if (!idToken) {
    throw new Error("missing_token");
  }

  return getAdminAuth().verifyIdToken(idToken, true);
}

export function isOwnerClaim(claims: Record<string, unknown>) {
  return claims.role === "owner";
}
