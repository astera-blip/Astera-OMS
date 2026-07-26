import { describe, expect, it } from "vitest";
import { getRoleFromClaims, getRoleFromToken } from "../../src/lib/member/role";

describe("getRoleFromClaims", () => {
  it.each([
    [{ role: "owner" }, "owner"],
    [{ role: "helper" }, "helper"],
    [{ role: "member" }, "member"],
    [{ role: "admin" }, "member"],
    [{}, "member"],
  ])("maps claims %j to %s", (claims, expected) => {
    expect(getRoleFromClaims(claims)).toBe(expected);
  });
});

describe("getRoleFromToken", () => {
  it("treats the bootstrap owner email as owner before custom claims are configured", () => {
    expect(getRoleFromToken({ email: "astera.0920@gmail.com" })).toBe("owner");
  });

  it("keeps unknown emails as members without a role claim", () => {
    expect(getRoleFromToken({ email: "member@example.com" })).toBe("member");
  });
});
