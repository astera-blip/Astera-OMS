import { describe, expect, it } from "vitest";
import {
  buildPendingPaymentGroups,
  matchTaishinTransactions,
} from "@/lib/reconciliation/paymentMatching";
import type { TaishinTransaction } from "@/lib/reconciliation/taishin";
import type { LocalPayment } from "@/lib/payment/manualBankTransfer";

function transaction(overrides: Partial<TaishinTransaction> = {}): TaishinTransaction {
  return {
    transactionAt: "2026/08/13 09:30:00",
    accountingDate: "2026/08/13",
    method: "CD轉入",
    amountTwd: 520,
    accountLast5: "00001",
    transactionFingerprint: "a".repeat(64),
    ...overrides,
  };
}

function payment(overrides: Partial<LocalPayment> = {}): LocalPayment {
  return {
    id: "payment-1",
    memberUid: "member-1",
    paymentRequestId: "request-1",
    paymentGroupId: "group-1",
    receivedAmountTwd: 520,
    receivedAt: "2026-08-13T01:25:00.000Z",
    status: "pendingReview",
    memberPaymentAccountId: "member-account-1",
    memberPaymentAccount: {
      bankCode: "001",
      accountNumberLast5: "00001",
      payerName: "測試匯款人",
    },
    payerName: "測試匯款人",
    createdAt: "2026-08-13T01:26:00.000Z",
    createdBy: "member-1",
    ...overrides,
  };
}

describe("payment reconciliation matching", () => {
  it("groups every Payment from the same member report before comparing amounts", () => {
    const groups = buildPendingPaymentGroups([
      payment({ id: "payment-a", paymentRequestId: "request-a", receivedAmountTwd: 300 }),
      payment({ id: "payment-b", paymentRequestId: "request-b", receivedAmountTwd: 220 }),
    ]);

    expect(groups).toEqual([
      expect.objectContaining({
        paymentGroupId: "group-1",
        paymentIds: ["payment-a", "payment-b"],
        paymentRequestIds: ["request-a", "request-b"],
        amountTwd: 520,
        accountLast5: "00001",
      }),
    ]);
  });

  it("marks a one-to-one transaction and payment group as selected and safe", () => {
    const result = matchTaishinTransactions({
      transactions: [transaction()],
      payments: [payment()],
      claimedFingerprints: new Set(),
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        category: "unique_match",
        selectable: true,
        selectedByDefault: true,
        transactionFingerprint: "a".repeat(64),
        paymentGroupId: "group-1",
        paymentIds: ["payment-1"],
      }),
    ]);
    expect(result.summary).toMatchObject({ uniqueMatchCount: 1, selectableCount: 1 });
  });

  it("does not select ambiguous candidates on either side", () => {
    const twoPaymentCandidates = matchTaishinTransactions({
      transactions: [transaction()],
      payments: [
        payment(),
        payment({ id: "payment-2", paymentGroupId: "group-2", paymentRequestId: "request-2" }),
      ],
      claimedFingerprints: new Set(),
    });
    expect(twoPaymentCandidates.results[0]).toMatchObject({
      category: "ambiguous",
      selectable: false,
      selectedByDefault: false,
    });

    const twoBankCandidates = matchTaishinTransactions({
      transactions: [
        transaction(),
        transaction({ transactionFingerprint: "b".repeat(64), transactionAt: "2026/08/13 09:31:00" }),
      ],
      payments: [payment()],
      claimedFingerprints: new Set(),
    });
    expect(twoBankCandidates.results.every((item) => item.category === "ambiguous")).toBe(true);
    expect(twoBankCandidates.summary.selectableCount).toBe(0);
  });

  it("classifies missing account data and unmatched payment groups", () => {
    const result = matchTaishinTransactions({
      transactions: [transaction({ accountLast5: "", transactionFingerprint: "c".repeat(64) })],
      payments: [payment()],
      claimedFingerprints: new Set(),
    });

    expect(result.results.map((item) => item.category).sort()).toEqual([
      "insufficient_data",
      "unmatched",
    ]);
    expect(result.summary).toMatchObject({ insufficientDataCount: 1, unmatchedCount: 1 });
  });

  it("blocks claimed and duplicate transaction fingerprints", () => {
    const claimed = matchTaishinTransactions({
      transactions: [transaction()],
      payments: [payment()],
      claimedFingerprints: new Set(["a".repeat(64)]),
    });
    expect(claimed.results[0]).toMatchObject({ category: "duplicate", selectable: false });

    const duplicatedInFile = matchTaishinTransactions({
      transactions: [transaction(), transaction()],
      payments: [payment()],
      claimedFingerprints: new Set(),
    });
    expect(duplicatedInFile.results.filter((item) => item.transactionFingerprint))
      .toHaveLength(2);
    expect(duplicatedInFile.results.filter((item) => item.transactionFingerprint)
      .every((item) => item.category === "duplicate")).toBe(true);
  });

  it("ignores non-pending payments", () => {
    const result = matchTaishinTransactions({
      transactions: [transaction()],
      payments: [payment({ status: "confirmed" })],
      claimedFingerprints: new Set(),
    });

    expect(result.pendingPaymentGroups).toHaveLength(0);
    expect(result.results[0]).toMatchObject({ category: "unmatched", selectable: false });
  });
});
