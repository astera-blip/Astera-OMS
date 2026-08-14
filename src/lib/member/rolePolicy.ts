import type { RoleKey } from "@/domain/identity";

export const ROLE_KEYS = ["owner", "partner", "helper", "member"] as const;
export const ASSIGNABLE_ROLE_KEYS = ["partner", "helper", "member"] as const;

export type AssignableRoleKey = typeof ASSIGNABLE_ROLE_KEYS[number];
export type RoleAssignmentError =
  | "forbidden"
  | "invalid_role"
  | "owner_assignment_forbidden"
  | "owner_target_forbidden"
  | "self_assignment_forbidden"
  | "member_profile_incomplete"
  | "role_unchanged";

export const roleLabels: Record<RoleKey, string> = {
  owner: "Owner（最高管理者）",
  partner: "Partner（合作人）",
  helper: "Helper（小幫手）",
  member: "Member（會員）",
};

export function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === "string" && ROLE_KEYS.some((role) => role === value);
}

export function isAssignableRole(value: unknown): value is AssignableRoleKey {
  return typeof value === "string"
    && ASSIGNABLE_ROLE_KEYS.some((role) => role === value);
}

export function getRoleFromClaims(claims: Record<string, unknown>): RoleKey {
  return isRoleKey(claims.role) ? claims.role : "member";
}

export function validateRoleAssignment(input: {
  actorUid: string;
  targetUid: string;
  actorRole: RoleKey;
  targetRole: RoleKey;
  nextRole: unknown;
  targetHasCompletedProfile: boolean;
}):
  | { ok: true; value: { nextRole: AssignableRoleKey } }
  | { ok: false; error: RoleAssignmentError } {
  if (input.actorRole !== "owner") {
    return { ok: false, error: "forbidden" };
  }
  if (input.nextRole === "owner") {
    return { ok: false, error: "owner_assignment_forbidden" };
  }
  if (!isAssignableRole(input.nextRole)) {
    return { ok: false, error: "invalid_role" };
  }
  if (input.targetRole === "owner") {
    return { ok: false, error: "owner_target_forbidden" };
  }
  if (input.actorUid === input.targetUid) {
    return { ok: false, error: "self_assignment_forbidden" };
  }
  if (!input.targetHasCompletedProfile) {
    return { ok: false, error: "member_profile_incomplete" };
  }
  if (input.targetRole === input.nextRole) {
    return { ok: false, error: "role_unchanged" };
  }
  return { ok: true, value: { nextRole: input.nextRole } };
}
