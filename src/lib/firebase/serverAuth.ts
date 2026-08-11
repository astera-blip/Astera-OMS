import "server-only";

type IdentityToolkitUser = {
  localId?: string;
  email?: string;
  displayName?: string;
  customAttributes?: string;
};

type AccountsLookupResponse = {
  users?: IdentityToolkitUser[];
  error?: unknown;
};

export type FirebaseUserClaims = Record<string, unknown> & {
  uid: string;
  email?: string;
  name?: string;
};

function getFirebaseApiKey() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error("firebase_api_key_not_configured");
  }

  return apiKey;
}

function getAccountsLookupUrl() {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (emulatorHost) {
    return `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(getFirebaseApiKey())}`;
  }

  return `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(getFirebaseApiKey())}`;
}

function parseCustomClaims(customAttributes: string | undefined) {
  if (!customAttributes) {
    return {};
  }

  try {
    const parsed = JSON.parse(customAttributes) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseUserClaims> {
  const response = await fetch(getAccountsLookupUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ idToken }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("invalid_token");
  }

  const payload = await response.json() as AccountsLookupResponse;
  const user = payload.users?.[0];

  if (!user?.localId) {
    throw new Error("invalid_token");
  }

  return {
    ...parseCustomClaims(user.customAttributes),
    uid: user.localId,
    ...(user.email ? { email: user.email } : {}),
    ...(user.displayName ? { name: user.displayName } : {}),
  };
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
