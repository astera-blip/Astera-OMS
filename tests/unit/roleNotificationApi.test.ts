import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireFirebaseUser: vi.fn() }));
const firestore = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));

vi.mock("@/lib/firebase/serverAuth", () => ({ requireFirebaseUser: auth.requireFirebaseUser }));
vi.mock("@/lib/firebase/admin", () => ({ getAdminFirestore: firestore.getAdminFirestore }));

import { GET, POST } from "@/app/api/member/role-notifications/route";

function createDb(input?: { ownerUid?: string; acknowledged?: boolean }) {
  const update = vi.fn();
  const document = {
    id: "role-notice-a",
    exists: true,
    data: () => ({
      memberUid: input?.ownerUid ?? "member-a",
      previousRole: "member",
      nextRole: "partner",
      changedAt: { toDate: () => new Date("2026-08-14T09:00:00.000Z") },
      acknowledgedAt: input?.acknowledged ? {} : null,
    }),
  };
  const query = {
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: vi.fn(async () => ({ docs: input?.acknowledged ? [] : [document] })),
  };
  const transaction = {
    get: vi.fn(async () => document),
    update,
  };
  return {
    db: {
      collection: vi.fn(() => ({ ...query, doc: vi.fn(() => ({ id: document.id })) })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    },
    update,
  };
}

describe("member role change notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
  });

  it("returns only the signed-in member's newest unacknowledged notice", async () => {
    const state = createDb();
    firestore.getAdminFirestore.mockReturnValue(state.db);
    const response = await GET(new Request("https://example.test"));
    await expect(response.json()).resolves.toEqual({
      notification: {
        id: "role-notice-a",
        previousRole: "member",
        nextRole: "partner",
        changedAt: "2026-08-14T09:00:00.000Z",
      },
    });
  });

  it("returns null after the notice is acknowledged", async () => {
    const state = createDb({ acknowledged: true });
    firestore.getAdminFirestore.mockReturnValue(state.db);
    const response = await GET(new Request("https://example.test"));
    await expect(response.json()).resolves.toEqual({ notification: null });
  });

  it("does not let one member acknowledge another member's notice", async () => {
    const state = createDb({ ownerUid: "member-b" });
    firestore.getAdminFirestore.mockReturnValue(state.db);
    const response = await POST(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ id: "role-notice-a" }),
    }));
    expect(response.status).toBe(404);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("acknowledges its own notice and treats a replay as success", async () => {
    const state = createDb();
    firestore.getAdminFirestore.mockReturnValue(state.db);
    const response = await POST(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ id: "role-notice-a" }),
    }));
    expect(response.status).toBe(200);
    expect(state.update).toHaveBeenCalledOnce();
  });
});
