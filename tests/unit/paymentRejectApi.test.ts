import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireFirebaseUser: vi.fn(),
  isOwnerClaim: vi.fn(),
}));
const firestore = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));

vi.mock("@/lib/firebase/serverAuth", () => ({
  requireFirebaseUser: auth.requireFirebaseUser,
  isOwnerClaim: auth.isOwnerClaim,
}));
vi.mock("@/lib/firebase/admin", () => ({ getAdminFirestore: firestore.getAdminFirestore }));

import { POST } from "@/app/api/workspace/payments/[id]/reject/route";

function request(reason = "重複付款回報") {
  return new Request("https://example.test/api/workspace/payments/payment-1/reject", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

function context() {
  return { params: Promise.resolve({ id: "payment-1" }) };
}

function createDb(status: string = "pendingReview", exists = true) {
  const update = vi.fn();
  const set = vi.fn();
  const transaction = {
    get: vi.fn(async () => ({
      exists,
      id: "payment-1",
      data: () => ({ status, paymentRequestId: "pr-1", memberUid: "member-a" }),
    })),
    update,
    set,
  };
  const db = {
    collection: vi.fn((collection: string) => ({
      doc: vi.fn((id: string) => ({ collection, id })),
    })),
    runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
  };
  return { db, transaction, update, set };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireFirebaseUser.mockResolvedValue({ uid: "owner-a", role: "owner" });
  auth.isOwnerClaim.mockReturnValue(true);
});

describe("POST /api/workspace/payments/[id]/reject", () => {
  it("requires authentication", async () => {
    auth.requireFirebaseUser.mockRejectedValue(new Error("missing_token"));
    const response = await POST(request(), context());
    expect(response.status).toBe(401);
  });

  it("denies Member and Helper claims", async () => {
    auth.isOwnerClaim.mockReturnValue(false);
    const response = await POST(request(), context());
    expect(response.status).toBe(403);
  });

  it("requires a reason", async () => {
    const response = await POST(request("   "), context());
    expect(response.status).toBe(400);
  });

  it("returns not found for a missing payment", async () => {
    const state = createDb("pendingReview", false);
    firestore.getAdminFirestore.mockReturnValue(state.db);
    const response = await POST(request(), context());
    expect(response.status).toBe(404);
  });

  it("rejects only a pending report and appends a safe immutable audit log", async () => {
    const state = createDb();
    firestore.getAdminFirestore.mockReturnValue(state.db);

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      paymentId: "payment-1",
      paymentStatus: "rejected",
      alreadyRejected: false,
    });
    expect(state.update).toHaveBeenCalledWith(
      { collection: "payments", id: "payment-1" },
      expect.objectContaining({ status: "rejected", rejectionReason: "重複付款回報", rejectedBy: "owner-a" }),
    );
    expect(state.set).toHaveBeenCalledWith(
      { collection: "auditLogs", id: "audit_reject_payment-1" },
      expect.objectContaining({
        action: "payment.rejected",
        actorUid: "owner-a",
        targetType: "payment",
        targetId: "payment-1",
        reason: "重複付款回報",
      }),
    );
    expect(JSON.stringify(state.set.mock.calls)).not.toContain("accountFingerprint");
    expect(state.db.collection).not.toHaveBeenCalledWith("paymentAllocations");
    expect(state.db.collection).not.toHaveBeenCalledWith("paymentRequests");
    expect(state.db.collection).not.toHaveBeenCalledWith("orders");
  });

  it("treats a repeated rejection as an idempotent success without another audit", async () => {
    const state = createDb("rejected");
    firestore.getAdminFirestore.mockReturnValue(state.db);
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ alreadyRejected: true });
    expect(state.update).not.toHaveBeenCalled();
    expect(state.set).not.toHaveBeenCalled();
  });

  it.each(["confirmed", "reversed"])("refuses to reject a %s payment", async (status) => {
    const state = createDb(status);
    firestore.getAdminFirestore.mockReturnValue(state.db);
    const response = await POST(request(), context());
    expect(response.status).toBe(409);
    expect(state.update).not.toHaveBeenCalled();
  });
});
