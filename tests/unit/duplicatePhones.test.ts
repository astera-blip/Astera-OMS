import { describe, expect, it } from "vitest";
import { groupDuplicatePhones } from "@/lib/member/duplicatePhones";

const member = (uid: string, mobilePhone: string) => ({ uid, mobilePhone });

describe("groupDuplicatePhones", () => {
  it("groups two or more members by normalized Taiwan mobile number", () => {
    expect(groupDuplicatePhones([
      member("a", "0912-345-678"),
      member("b", "+886 912 345 678"),
      member("c", "0987654321"),
    ])).toEqual([{ mobilePhone: "0912345678", memberUids: ["a", "b"] }]);
  });

  it("does not warn for unique or invalid phone values", () => {
    expect(groupDuplicatePhones([
      member("a", "0912345678"),
      member("b", "0987654321"),
      member("c", ""),
    ])).toEqual([]);
  });
});
