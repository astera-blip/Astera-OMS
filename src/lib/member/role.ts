import type { RoleKey } from "@/domain/identity";

const bootstrapOwnerEmails = new Set(["astera.0920@gmail.com"]);

export function getRoleFromClaims(claims: Record<string, unknown>): RoleKey {
  const role = claims.role;

  if (role === "owner" || role === "helper" || role === "member") {
    return role;
  }

  return "member";
}

export function getRoleFromToken(token: { email?: string | null; role?: unknown }): RoleKey {
  const claimRole = getRoleFromClaims({ role: token.role });

  if (claimRole !== "member") {
    return claimRole;
  }

  return token.email && bootstrapOwnerEmails.has(token.email) ? "owner" : "member";
}
