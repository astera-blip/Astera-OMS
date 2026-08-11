import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateMemberProfileDraft } from "../../src/lib/member/profile";

describe("validateMemberProfileDraft", () => {
  it("trims profile fields and normalizes a Taiwan mobile number", () => {
    expect(
      validateMemberProfileDraft({
        displayName: "  Ting  ",
        communityId: "  astera-01  ",
        mobilePhone: "+886 912-345-678",
        birthday: "1995-09-20",
      }),
    ).toEqual({
      ok: true,
      value: {
        displayName: "Ting",
        communityId: "astera-01",
        mobilePhone: "0912345678",
        birthday: "1995-09-20",
      },
    });
  });

  it("accepts an omitted birthday", () => {
    const result = validateMemberProfileDraft({
      displayName: "Ting",
      communityId: "astera-01",
      mobilePhone: "0912345678",
      birthday: "",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        displayName: "Ting",
        communityId: "astera-01",
        mobilePhone: "0912345678",
      },
    });
  });

  it("returns field errors for incomplete or malformed input", () => {
    expect(
      validateMemberProfileDraft({
        displayName: " ",
        communityId: " ",
        mobilePhone: "not-a-phone",
        birthday: "2025-02-30",
      }),
    ).toEqual({
      ok: false,
      errors: {
        displayName: "請填寫姓名。",
        communityId: "請填寫社群內 ID。",
        mobilePhone: "請輸入有效的台灣手機號碼。",
        birthday: "請輸入有效日期。",
      },
    });
  });
});

describe("member profile persistence diagnostics", () => {
  it("records a safe server diagnostic when profile persistence fails", () => {
    const routeSource = readFileSync("src/app/api/member/profile/route.ts", "utf8");

    expect(routeSource).toContain('console.error("member_profile_save_failed", { message })');
  });

  it("preserves the original storefront route through profile completion", () => {
    const authSource = readFileSync("src/components/auth/AuthProvider.tsx", "utf8");
    const pageSource = readFileSync("src/app/account/profile/page.tsx", "utf8");
    expect(authSource).toContain("returnTo");
    expect(pageSource).toContain("useSearchParams");
    expect(pageSource).toContain("router.replace(returnTo)");
  });

  it("does not redirect to profile completion when profile loading failed", () => {
    const authSource = readFileSync("src/components/auth/AuthProvider.tsx", "utf8");

    expect(authSource).toMatch(
      /const \{ status, profile, error \} = useAuth\(\)/,
    );
    expect(authSource).toMatch(
      /status === "signedIn"\s*&&\s*!error\s*&&\s*!profile/,
    );
  });
});
