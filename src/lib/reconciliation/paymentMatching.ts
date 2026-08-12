import type { LocalPayment } from "@/lib/payment/manualBankTransfer";
import { getPaymentAccountLast5 } from "@/lib/payment/manualBankTransfer";
import type { TaishinTransaction } from "@/lib/reconciliation/taishin";

export type PendingPaymentGroup = {
  paymentGroupId: string;
  paymentIds: string[];
  paymentRequestIds: string[];
  memberUid: string;
  amountTwd: number;
  accountLast5: string;
  payerName: string;
  receivedAt: string;
};

export type ReconciliationCategory =
  | "unique_match"
  | "ambiguous"
  | "unmatched"
  | "insufficient_data"
  | "duplicate";

export type ReconciliationMatchResult = {
  reconciliationItemId: string;
  category: ReconciliationCategory;
  selectable: boolean;
  selectedByDefault: boolean;
  reason: string;
  transactionFingerprint?: string;
  transactionAt?: string;
  accountingDate?: string;
  method?: string;
  amountTwd: number;
  accountLast5: string;
  paymentGroupId?: string;
  paymentIds: string[];
  paymentRequestIds: string[];
  memberUid?: string;
  payerName?: string;
};

export type ReconciliationSummary = {
  sourceRowCount: number;
  pendingPaymentGroupCount: number;
  uniqueMatchCount: number;
  ambiguousCount: number;
  unmatchedCount: number;
  insufficientDataCount: number;
  duplicateCount: number;
  selectableCount: number;
};

export function buildPendingPaymentGroups(
  payments: ReadonlyArray<LocalPayment>,
): PendingPaymentGroup[] {
  const grouped = new Map<string, LocalPayment[]>();

  for (const payment of payments) {
    if (payment.status !== "pendingReview") {
      continue;
    }
    const paymentGroupId = payment.paymentGroupId ?? payment.id;
    grouped.set(paymentGroupId, [...(grouped.get(paymentGroupId) ?? []), payment]);
  }

  return [...grouped.entries()].map(([paymentGroupId, groupPayments]) => {
    const accountLast5Values = new Set(
      groupPayments.map((payment) => getPaymentAccountLast5(payment) ?? ""),
    );
    const memberUidValues = new Set(groupPayments.map((payment) => payment.memberUid));
    const payerNameValues = new Set(
      groupPayments.map((payment) => payment.payerName?.trim() ?? "").filter(Boolean),
    );

    return {
      paymentGroupId,
      paymentIds: groupPayments.map((payment) => payment.id).sort(),
      paymentRequestIds: groupPayments.map((payment) => payment.paymentRequestId).sort(),
      memberUid: memberUidValues.size === 1 ? groupPayments[0]?.memberUid ?? "" : "",
      amountTwd: groupPayments.reduce(
        (total, payment) => total + Math.trunc(payment.receivedAmountTwd),
        0,
      ),
      accountLast5: accountLast5Values.size === 1
        ? getPaymentAccountLast5(groupPayments[0]!) ?? ""
        : "",
      payerName: payerNameValues.size === 1 ? [...payerNameValues][0] ?? "" : "",
      receivedAt: groupPayments.map((payment) => payment.receivedAt).sort()[0] ?? "",
    };
  }).sort((left, right) => left.paymentGroupId.localeCompare(right.paymentGroupId));
}

export function matchTaishinTransactions(input: {
  transactions: ReadonlyArray<TaishinTransaction>;
  payments: ReadonlyArray<LocalPayment>;
  claimedFingerprints: ReadonlySet<string>;
}): {
  pendingPaymentGroups: PendingPaymentGroup[];
  results: ReconciliationMatchResult[];
  summary: ReconciliationSummary;
} {
  const pendingPaymentGroups = buildPendingPaymentGroups(input.payments);
  const fingerprintCounts = countValues(
    input.transactions.map((transaction) => transaction.transactionFingerprint),
  );
  const eligibleTransactions = input.transactions.filter((transaction) =>
    transaction.accountLast5
      && fingerprintCounts.get(transaction.transactionFingerprint) === 1
      && !input.claimedFingerprints.has(transaction.transactionFingerprint),
  );
  const candidateTransactionsByGroup = new Map<string, TaishinTransaction[]>();

  for (const group of pendingPaymentGroups) {
    candidateTransactionsByGroup.set(
      group.paymentGroupId,
      group.accountLast5
        ? eligibleTransactions.filter((transaction) =>
          transaction.amountTwd === group.amountTwd
            && transaction.accountLast5 === group.accountLast5)
        : [],
    );
  }

  const results = input.transactions.map((transaction, index) => {
    const base = transactionResultBase(transaction, index);
    if (fingerprintCounts.get(transaction.transactionFingerprint)! > 1) {
      return blockedResult(base, "duplicate", "Excel 內有無法唯一區分的重複交易。");
    }
    if (input.claimedFingerprints.has(transaction.transactionFingerprint)) {
      return blockedResult(base, "duplicate", "這筆銀行交易已被認列。");
    }
    if (!transaction.accountLast5) {
      return blockedResult(base, "insufficient_data", "無法從銀行備註解析帳號末五碼。");
    }

    const candidateGroups = pendingPaymentGroups.filter((group) =>
      group.accountLast5 === transaction.accountLast5
        && group.amountTwd === transaction.amountTwd,
    );
    if (candidateGroups.length === 0) {
      return blockedResult(base, "unmatched", "找不到金額與帳號末五碼皆相符的待審付款。");
    }
    if (candidateGroups.length > 1) {
      return blockedResult(base, "ambiguous", "同一銀行交易對應多筆待審付款。");
    }

    const group = candidateGroups[0]!;
    const groupCandidates = candidateTransactionsByGroup.get(group.paymentGroupId) ?? [];
    if (groupCandidates.length !== 1) {
      return blockedResult(
        withPaymentGroup(base, group),
        "ambiguous",
        "同一待審付款對應多筆銀行交易。",
      );
    }

    return {
      ...withPaymentGroup(base, group),
      category: "unique_match" as const,
      selectable: true,
      selectedByDefault: true,
      reason: "金額與帳號末五碼唯一吻合，可由 Owner 復核認列。",
    };
  });

  for (const group of pendingPaymentGroups) {
    const hasTransactionCandidate = eligibleTransactions.some((transaction) =>
      transaction.amountTwd === group.amountTwd
        && transaction.accountLast5 === group.accountLast5,
    );
    if (!hasTransactionCandidate) {
      results.push({
        reconciliationItemId: `payment:${group.paymentGroupId}`,
        category: "unmatched",
        selectable: false,
        selectedByDefault: false,
        reason: group.accountLast5
          ? "待審付款找不到對應的銀行交易。"
          : "待審付款缺少可比對的帳號末五碼。",
        amountTwd: group.amountTwd,
        accountLast5: group.accountLast5,
        paymentGroupId: group.paymentGroupId,
        paymentIds: group.paymentIds,
        paymentRequestIds: group.paymentRequestIds,
        memberUid: group.memberUid,
        payerName: group.payerName,
      });
    }
  }

  return {
    pendingPaymentGroups,
    results,
    summary: summarize(input.transactions.length, pendingPaymentGroups.length, results),
  };
}

function transactionResultBase(
  transaction: TaishinTransaction,
  index: number,
): Omit<ReconciliationMatchResult, "category" | "selectable" | "selectedByDefault" | "reason"> {
  return {
    reconciliationItemId: `transaction:${transaction.transactionFingerprint}:${index}`,
    transactionFingerprint: transaction.transactionFingerprint,
    transactionAt: transaction.transactionAt,
    accountingDate: transaction.accountingDate,
    method: transaction.method,
    amountTwd: transaction.amountTwd,
    accountLast5: transaction.accountLast5,
    paymentIds: [],
    paymentRequestIds: [],
  };
}

function withPaymentGroup(
  base: Omit<ReconciliationMatchResult, "category" | "selectable" | "selectedByDefault" | "reason">,
  group: PendingPaymentGroup,
) {
  return {
    ...base,
    paymentGroupId: group.paymentGroupId,
    paymentIds: group.paymentIds,
    paymentRequestIds: group.paymentRequestIds,
    memberUid: group.memberUid,
    payerName: group.payerName,
  };
}

function blockedResult(
  base: Omit<ReconciliationMatchResult, "category" | "selectable" | "selectedByDefault" | "reason">,
  category: Exclude<ReconciliationCategory, "unique_match">,
  reason: string,
): ReconciliationMatchResult {
  return { ...base, category, selectable: false, selectedByDefault: false, reason };
}

function countValues(values: ReadonlyArray<string>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function summarize(
  sourceRowCount: number,
  pendingPaymentGroupCount: number,
  results: ReadonlyArray<ReconciliationMatchResult>,
): ReconciliationSummary {
  return {
    sourceRowCount,
    pendingPaymentGroupCount,
    uniqueMatchCount: countCategory(results, "unique_match"),
    ambiguousCount: countCategory(results, "ambiguous"),
    unmatchedCount: countCategory(results, "unmatched"),
    insufficientDataCount: countCategory(results, "insufficient_data"),
    duplicateCount: countCategory(results, "duplicate"),
    selectableCount: results.filter((result) => result.selectable).length,
  };
}

function countCategory(
  results: ReadonlyArray<ReconciliationMatchResult>,
  category: ReconciliationCategory,
) {
  return results.filter((result) => result.category === category).length;
}
