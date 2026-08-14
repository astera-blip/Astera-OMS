import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const routeAuth = vi.hoisted(() => ({
  requireFirebaseUser: vi.fn(),
  isOwnerClaim: vi.fn(),
  getAdminAuth: vi.fn(),
  getAdminFirestore: vi.fn(),
}));

vi.mock("@/lib/firebase/serverAuth", () => ({
  requireFirebaseUser: routeAuth.requireFirebaseUser,
  isOwnerClaim: routeAuth.isOwnerClaim,
}));
vi.mock("@/lib/firebase/adminAuth", () => ({ getAdminAuth: routeAuth.getAdminAuth }));
vi.mock("@/lib/firebase/admin", () => ({ getAdminFirestore: routeAuth.getAdminFirestore }));

import { PUT } from "@/app/api/workspace/members/[uid]/role/route";
import { GET as listMembers } from "@/app/api/workspace/members/route";
import { assignMemberRole } from "@/lib/member/roleAssignment";

type Stored = Record<string, unknown>;

function createDependencies(input?: {
  memberExists?: boolean;
  member?: Stored;
  claims?: Stored;
  transactionFails?: boolean;
}) {
  const writes: Array<{ collection: string; id: string; value: Stored }> = [];
  const memberExists = input?.memberExists ?? true;
  const member = input?.member ?? {
    displayName: "測試會員",
    communityId: "member-a",
    mobilePhone: "0912345678",
  };
  const auth = {
    getUser: vi.fn(async () => ({ uid: "member-a", customClaims: input?.claims ?? { existingClaim: true, role: "member" } })),
    setCustomUserClaims: vi.fn(async () => undefined),
    revokeRefreshTokens: vi.fn(async () => undefined),
  };
  const transaction = {
    set: vi.fn((ref: { collection: string; id: string }, value: Stored) => {
      writes.push({ ...ref, value });
    }),
  };
  const db = {
    collection: vi.fn((collection: string) => ({
      doc: vi.fn((id = `${collection}-generated`) => ({
        collection,
        id,
        get: vi.fn(async () => ({ exists: memberExists, data: () => member })),
      })),
    })),
    runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => {
      if (input?.transactionFails) throw new Error("firestore_unavailable");
      return callback(transaction);
    }),
  };
  return { auth, db, writes };
}

describe("Owner member role assignment", () => {
  it("preserves claims, revokes sessions, and appends audit plus notice", async () => {
    const state = createDependencies();

    const result = await assignMemberRole({
      actorClaims: { uid: "owner-a", role: "owner" },
      targetUid: "member-a",
      nextRole: "partner",
      auth: state.auth,
      db: state.db as never,
    });

    expect(result).toMatchObject({ uid: "member-a", previousRole: "member", nextRole: "partner" });
    expect(state.auth.setCustomUserClaims).toHaveBeenCalledWith("member-a", {
      existingClaim: true,
      role: "partner",
    });
    expect(state.auth.revokeRefreshTokens).toHaveBeenCalledWith("member-a");
    expect(state.writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        collection: "auditLogs",
        value: expect.objectContaining({
          action: "auth.role.updated",
          actorUid: "owner-a",
          targetId: "member-a",
          reason: "role_assignment",
          previousRole: "member",
          nextRole: "partner",
        }),
      }),
      expect.objectContaining({
        collection: "roleChangeNotifications",
        value: expect.objectContaining({
          memberUid: "member-a",
          type: "role_changed",
          previousRole: "member",
          nextRole: "partner",
          acknowledgedAt: null,
        }),
      }),
    ]));
  });

  it("restores claims and revokes sessions again if audit persistence fails", async () => {
    const state = createDependencies({ transactionFails: true });

    await expect(assignMemberRole({
      actorClaims: { uid: "owner-a", role: "owner" },
      targetUid: "member-a",
      nextRole: "helper",
      auth: state.auth,
      db: state.db as never,
    })).rejects.toThrow("role_assignment_persistence_failed");

    expect(state.auth.setCustomUserClaims).toHaveBeenNthCalledWith(1, "member-a", {
      existingClaim: true,
      role: "helper",
    });
    expect(state.auth.setCustomUserClaims).toHaveBeenNthCalledWith(2, "member-a", {
      existingClaim: true,
      role: "member",
    });
    expect(state.auth.revokeRefreshTokens).toHaveBeenCalledTimes(2);
  });

  it("restores claims when the first session revocation fails", async () => {
    const state = createDependencies();
    state.auth.revokeRefreshTokens
      .mockRejectedValueOnce(new Error("auth_unavailable"))
      .mockResolvedValueOnce(undefined);

    await expect(assignMemberRole({
      actorClaims: { uid: "owner-a", role: "owner" },
      targetUid: "member-a",
      nextRole: "partner",
      auth: state.auth,
      db: state.db as never,
    })).rejects.toThrow("role_assignment_auth_failed");

    expect(state.auth.setCustomUserClaims).toHaveBeenNthCalledWith(2, "member-a", {
      existingClaim: true,
      role: "member",
    });
    expect(state.db.runTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ["forbidden", { actorClaims: { uid: "partner-a", role: "partner" }, nextRole: "helper" }],
    ["owner_assignment_forbidden", { nextRole: "owner" }],
    ["self_assignment_forbidden", { targetUid: "owner-a", nextRole: "member" }],
    ["role_unchanged", { nextRole: "member" }],
  ])("rejects %s before changing Auth", async (error, overrides) => {
    const state = createDependencies();
    const input = Object.assign({
      actorClaims: { uid: "owner-a", role: "owner" },
      targetUid: "member-a",
      nextRole: "helper",
      auth: state.auth,
      db: state.db as never,
    }, overrides);
    await expect(assignMemberRole(input)).rejects.toThrow(error);
    expect(state.auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("rejects an incomplete profile before changing Auth", async () => {
    const state = createDependencies({ member: { displayName: "" } });
    await expect(assignMemberRole({
      actorClaims: { uid: "owner-a", role: "owner" },
      targetUid: "member-a",
      nextRole: "helper",
      auth: state.auth,
      db: state.db as never,
    })).rejects.toThrow("member_profile_incomplete");
    expect(state.auth.setCustomUserClaims).not.toHaveBeenCalled();
  });
});

describe("PUT /api/workspace/members/[uid]/role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeAuth.requireFirebaseUser.mockResolvedValue({ uid: "owner-a", role: "owner" });
    routeAuth.isOwnerClaim.mockReturnValue(true);
  });

  it("denies non-Owner callers before resolving Admin dependencies", async () => {
    routeAuth.isOwnerClaim.mockReturnValue(false);
    const response = await PUT(new Request("https://example.test", {
      method: "PUT",
      body: JSON.stringify({ role: "helper" }),
    }), { params: Promise.resolve({ uid: "member-a" }) });
    expect(response.status).toBe(403);
    expect(routeAuth.getAdminAuth).not.toHaveBeenCalled();
  });

  it("returns 401 for a revoked or otherwise invalid token", async () => {
    routeAuth.requireFirebaseUser.mockRejectedValue(new Error("invalid_token"));
    const response = await PUT(new Request("https://example.test", {
      method: "PUT",
      body: JSON.stringify({ role: "helper" }),
    }), { params: Promise.resolve({ uid: "member-a" }) });
    expect(response.status).toBe(401);
  });
});

describe("GET /api/workspace/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeAuth.requireFirebaseUser.mockResolvedValue({ uid: "owner-a", role: "owner" });
    routeAuth.isOwnerClaim.mockReturnValue(true);
  });

  it("returns Auth custom-claim roles without copying them into member documents", async () => {
    const memberDocs = [
      { id: "partner-a", data: () => ({ uid: "partner-a", displayName: "Partner A" }) },
      { id: "member-a", data: () => ({ uid: "member-a", displayName: "Member A" }) },
    ];
    routeAuth.getAdminFirestore.mockReturnValue({
      collection: (name: string) => ({
        get: async () => ({ docs: name === "members" ? memberDocs : [] }),
      }),
    });
    const getUsers = vi.fn(async () => ({
      users: [
        { uid: "partner-a", customClaims: { role: "partner" } },
        { uid: "member-a", customClaims: {} },
      ],
    }));
    routeAuth.getAdminAuth.mockReturnValue({ getUsers });

    const response = await listMembers(new Request("https://example.test", {
      headers: { authorization: "Bearer owner-token" },
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as { members: Array<{ uid: string; role: string }> };
    expect(payload.members).toEqual([
      expect.objectContaining({ uid: "partner-a", role: "partner" }),
      expect.objectContaining({ uid: "member-a", role: "member" }),
    ]);
    expect(getUsers).toHaveBeenCalledWith([
      { uid: "partner-a" },
      { uid: "member-a" },
    ]);
  });
});
