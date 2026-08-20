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

  it("groups rejected payments into a collapsed history section", () => {
    expect(source).toContain('payment.status === "pendingReview"');
    expect(source).toContain('payment.status === "rejected"');
    expect(source).toContain("pendingPayments");
    expect(source).toContain("rejectedPayments");
    expect(source).toContain("已拒絕");
    expect(source).toContain("<details");
    expect(source).toContain("<summary");
  });
});
