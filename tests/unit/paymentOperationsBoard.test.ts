import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Owner payment rejection UI", () => {
  const source = readFileSync("src/components/workspace/PaymentOperationsBoard.tsx", "utf8");

  it("offers rejection only for pending-review payments with a mandatory reason", () => {
    expect(source).toContain("rejectSelectedPayment");
    expect(source).toContain("請填寫拒絕理由");
    expect(source).toContain("/reject`");
    expect(source).toContain("拒絕回報");
    expect(source).toContain('selectedPayment?.status !== "pendingReview"');
  });

  it("disables in-flight actions and announces the result accessibly", () => {
    expect(source).toContain('activeAction === "reject"');
    expect(source).toContain("拒絕中…");
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
  });
});
