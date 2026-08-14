import "server-only";
import { getAdminAuth } from "@/lib/firebase/adminAuth";
import { isRoleKey } from "@/lib/member/rolePolicy";

export type FirebaseUserClaims = Record<string, unknown> & {
  uid: string;
  email?: string;
  name?: string;
};

async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseUserClaims> {
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken, true);
    if (!decodedToken.uid) {
      throw new Error("invalid_token");
    }

    return {
      uid: decodedToken.uid,
      ...(typeof decodedToken.email === "string" ? { email: decodedToken.email } : {}),
      ...(typeof decodedToken.name === "string" ? { name: decodedToken.name } : {}),
      ...(isRoleKey(decodedToken.role) ? { role: decodedToken.role } : {}),
    };
  } catch {
    throw new Error("invalid_token");
  }
}

export async function requireFirebaseUser(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("missing_token");
  }

  const idToken = authorization.slice("Bearer ".length).trim();

  if (!idToken) {
    throw new Error("missing_token");
  }

  return verifyFirebaseIdToken(idToken);
}

export function isOwnerClaim(claims: Record<string, unknown>) {
  return claims.role === "owner";
}
