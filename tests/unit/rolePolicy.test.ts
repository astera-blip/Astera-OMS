import { describe, expect, it } from "vitest";
import {
  getRoleFromClaims,
  roleLabels,
  validateRoleAssignment,
} from "@/lib/member/rolePolicy";

describe("role policy", () => {
  it("recognizes all formal claims and falls back to member", () => {
    expect(getRoleFromClaims({ role: "owner" })).toBe("owner");
    expect(getRoleFromClaims({ role: "partner" })).toBe("partner");
    expect(getRoleFromClaims({ role: "helper" })).toBe("helper");
    expect(getRoleFromClaims({ role: "unexpected" })).toBe("member");
    expect(roleLabels.partner).toBe("Partner（合作人）");
  });

  it("allows Owner to assign Partner, Helper, and Member", () => {
    for (const [targetRole, nextRole] of [
      ["member", "partner"],
      ["member", "helper"],
      ["partner", "member"],
    ] as const) {
      expect(validateRoleAssignment({
        actorUid: "owner-a",
        targetUid: "member-a",
        actorRole: "owner",
        targetRole,
        nextRole,
        targetHasCompletedProfile: true,
      })).toEqual({ ok: true, value: { nextRole } });
    }
  });

  it.each<[
    string,
    Partial<Parameters<typeof validateRoleAssignment>[0]>,
  ]>([
    ["forbidden", { actorRole: "partner", nextRole: "helper" }],
    ["owner_assignment_forbidden", { nextRole: "owner" }],
    ["owner_target_forbidden", { targetRole: "owner", nextRole: "member" }],
    ["self_assignment_forbidden", { targetUid: "owner-a", nextRole: "member" }],
    ["member_profile_incomplete", { nextRole: "helper", targetHasCompletedProfile: false }],
    ["invalid_role", { nextRole: "admin" }],
    ["role_unchanged", { nextRole: "member" }],
  ])("returns %s", (error, overrides) => {
    expect(validateRoleAssignment({
      actorUid: "owner-a",
      targetUid: "member-a",
      actorRole: "owner",
      targetRole: "member",
      nextRole: "helper",
      targetHasCompletedProfile: true,
      ...overrides,
    })).toEqual({ ok: false, error });
  });
});
