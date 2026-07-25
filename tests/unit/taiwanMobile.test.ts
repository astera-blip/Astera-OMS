import { describe, expect, it } from "vitest";
import {
  isTaiwanMobile,
  normalizeTaiwanMobile,
  requireTaiwanMobile,
} from "@/lib/phone/taiwanMobile";

describe("normalizeTaiwanMobile", () => {
  it.each([
    ["0912-345-678", "0912345678"],
    ["0912 345 678", "0912345678"],
    ["+886912345678", "0912345678"],
    ["886912345678", "0912345678"],
    ["(0912) 345-678", "0912345678"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeTaiwanMobile(input)).toBe(expected);
  });

  it.each(["", "912345678", "0812345678", "+886812345678", "091234567"])(
    "rejects %s",
    (input) => {
      expect(normalizeTaiwanMobile(input)).toBeNull();
      expect(isTaiwanMobile(input)).toBe(false);
    },
  );

  it("throws a clear error when a required phone number is invalid", () => {
    expect(() => requireTaiwanMobile("not-a-phone")).toThrow(
      "Invalid Taiwan mobile phone number.",
    );
  });
});
