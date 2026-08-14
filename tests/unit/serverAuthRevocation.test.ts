import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/firebase/adminAuth", () => ({
  getAdminAuth: () => auth,
}));

import { requireFirebaseUser } from "@/lib/firebase/serverAuth";

describe("revocation-aware Firebase server authentication", () => {
  beforeEach(() => {
    auth.verifyIdToken.mockReset();
  });

  it("verifies revocation and returns only normalized claims", async () => {
    auth.verifyIdToken.mockResolvedValue({
      uid: "owner-a",
      email: "owner@example.test",
      name: "Owner",
      role: "owner",
      aud: "astera-oms-prod",
    });

    const claims = await requireFirebaseUser(new Request("https://example.test", {
      headers: { authorization: "Bearer token-a" },
    }));

    expect(auth.verifyIdToken).toHaveBeenCalledWith("token-a", true);
    expect(claims).toEqual({
      uid: "owner-a",
      email: "owner@example.test",
      name: "Owner",
      role: "owner",
    });
  });

  it("normalizes a revoked token to invalid_token", async () => {
    auth.verifyIdToken.mockRejectedValue(new Error("auth/id-token-revoked"));

    await expect(requireFirebaseUser(new Request("https://example.test", {
      headers: { authorization: "Bearer revoked-token" },
    }))).rejects.toThrow("invalid_token");
  });

  it("rejects a decoded token without a uid", async () => {
    auth.verifyIdToken.mockResolvedValue({ role: "member" });

    await expect(requireFirebaseUser(new Request("https://example.test", {
      headers: { authorization: "Bearer malformed-token" },
    }))).rejects.toThrow("invalid_token");
  });

  it("rejects a missing bearer token without calling Firebase Admin", async () => {
    await expect(requireFirebaseUser(new Request("https://example.test")))
      .rejects.toThrow("missing_token");
    expect(auth.verifyIdToken).not.toHaveBeenCalled();
  });
});
