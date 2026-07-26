import { describe, expect, it } from "vitest";
import { getRoleFromClaims } from "@/lib/member/role";

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
