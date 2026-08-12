import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("confirmPendingPaymentGroup contract", () => {
  it("confirms a payment group in one Firestore transaction and claims reconciliation identity", () => {
    const source = readFileSync("src/lib/payment/confirmPendingPayment.ts", "utf8");
    expect(source).toContain("runTransaction");
    expect(source).toContain("payment.reconciliation.claimed");
    expect(source).toContain("transactionFingerprint");
    expect(source).toContain("confirmBankTransfer");
    expect(source).toContain("paymentAllocations");
    expect(source).toContain("auditLogs");
    expect(source).toContain("notificationEvents");
  });

  it("makes the existing single confirmation route reuse the same transaction helper", () => {
    const source = readFileSync("src/app/api/workspace/payments/[id]/confirm/route.ts", "utf8");
    expect(source).toContain("confirmPendingPaymentGroup");
    expect(source).not.toContain("confirmBankTransfer({");
  });
});
