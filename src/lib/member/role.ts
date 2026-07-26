import type { RoleKey } from "@/domain/identity";

export function getRoleFromClaims(claims: Record<string, unknown>): RoleKey {
  const role = claims.role;

  if (role === "owner" || role === "helper" || role === "member") {
    return role;
  }

  return "member";
}
