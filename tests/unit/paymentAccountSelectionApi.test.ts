import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("payment report account selection contract", () => {
  it("requires and stores both member source and Astera destination account snapshots", () => {
    const source = readFileSync("src/app/api/payments/route.ts", "utf8");
    expect(source).toContain("memberPaymentAccountId");
    expect(source).toContain("memberPaymentAccounts");
    expect(source).toContain("receivingPaymentAccountId");
    expect(source).toContain("memberPaymentAccount");
    expect(source).toContain("buildMemberPaymentAccountIdentitySnapshot");
    expect(source).toContain("payment_account_member_required");
    expect(source).toContain("memberPaymentAccount.payerName");
    expect(source).not.toContain("const payerName = body.payerName");
  });
});
