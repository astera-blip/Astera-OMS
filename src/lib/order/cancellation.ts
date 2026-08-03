import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";
import type { LocalAuditLog, LocalPaymentAllocation } from "@/lib/payment/manualBankTransfer";
import {
  normalizeAccountNumber,
  normalizeBankCode,
  verifyAccountIdentity,
  type CloudKmsMacClient,
} from "@/lib/payment/accountIdentity";
import { hasUsableFingerprint, type LocalPayment } from "@/lib/payment/manualBankTransfer";
import type { OrderItemRecord, OrderRecord } from "./checkout";

export type CancellationRequestRecord = {
  id: string;
  orderId: string;
  orderItemIds: string[];
  memberUid: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  createdBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  refundAmountTwd?: number;
  refundCompletedAt?: string;
  refundReference?: string;
  targetPaymentId?: string;
  targetPaymentRequestId?: string;
  refundRequestedAmountTwd?: number;
  refundBankCode?: string;
  refundAccountLast5?: string;
  refundAccountCiphertext?: string;
  refundEncryptionKeyVersion?: number;
  refundAccountExpiresAt?: string;
};

export type CancellationReviewOrder = Omit<OrderRecord, "status"> & {
  status: OrderRecord["status"] | "refunded";
};

export function getPendingCancellationRequestId(orderId: string, orderItemIds: string[]) {
  return `cancel_${orderId}_${orderItemIds.join("_")}`;
}

export function splitCancellationItems(items: readonly OrderItemRecord[], orderItemIds: readonly string[]) {
  const targetItemIds = new Set(orderItemIds);
  const selectedItems = items.filter((item) => targetItemIds.has(item.id));

  if (selectedItems.length !== targetItemIds.size) {
    throw new Error("invalid_items");
  }

  return {
    unpaidItems: selectedItems.filter((item) => item.status === "awaitingPayment"),
    paidItems: selectedItems.filter((item) => item.status === "paid"),
  };
}

export function applyDirectUnpaidCancellation(
  order: OrderRecord,
  items: readonly OrderItemRecord[],
  paymentRequests: readonly LocalPaymentRequest[],
  input: {
    orderItemIds: string[];
    updatedAt: string;
    updatedBy: string;
  },
): {
  order: OrderRecord;
  items: OrderItemRecord[];
  paymentRequests: LocalPaymentRequest[];
} {
  const targetItemIds = new Set(input.orderItemIds);
  const updatedItems = items.map((item) => {
    if (!targetItemIds.has(item.id)) {
      return item;
    }
    if (item.status !== "awaitingPayment") {
      throw new Error("invalid_items");
    }

    return {
      ...item,
      status: "cancelled" as const,
      updatedAt: input.updatedAt,
      updatedBy: input.updatedBy,
    };
  });

  return recalculateOrderAfterCancellation(order, updatedItems, paymentRequests, input);
}

export function createCancellationRequest(input: {
  id: string;
  orderId: string;
  orderItemIds: string[];
  memberUid: string;
  reason: string;
  targetPaymentId?: string;
  targetPaymentRequestId?: string;
  refundRequestedAmountTwd?: number;
  refundBankCode?: string;
  refundAccountLast5?: string;
  createdAt: string;
  createdBy: string;
}): CancellationRequestRecord {
  return {
    id: input.id,
    orderId: input.orderId,
    orderItemIds: [...input.orderItemIds],
    memberUid: input.memberUid,
    reason: input.reason,
    ...(input.targetPaymentId ? { targetPaymentId: input.targetPaymentId } : {}),
    ...(input.targetPaymentRequestId ? { targetPaymentRequestId: input.targetPaymentRequestId } : {}),
    ...(input.refundRequestedAmountTwd
      ? { refundRequestedAmountTwd: input.refundRequestedAmountTwd }
      : {}),
    ...(input.refundBankCode ? { refundBankCode: input.refundBankCode } : {}),
    ...(input.refundAccountLast5 ? { refundAccountLast5: input.refundAccountLast5 } : {}),
    status: "pending",
    createdAt: input.createdAt,
    createdBy: input.createdBy,
  };
}

export function reviewCancellationRequest(
  request: CancellationRequestRecord,
  input: {
    status: "approved" | "rejected";
    reviewedAt: string;
    reviewedBy: string;
    reviewNote?: string;
  },
): CancellationRequestRecord {
  return {
    ...request,
    status: input.status,
    reviewedAt: input.reviewedAt,
    reviewedBy: input.reviewedBy,
    ...(input.reviewNote ? { reviewNote: input.reviewNote } : {}),
  };
}

export function markCancellationRequested(
  items: readonly OrderItemRecord[],
  request: CancellationRequestRecord,
  input: { updatedAt: string; updatedBy: string },
): OrderItemRecord[] {
  const targetItemIds = new Set(request.orderItemIds);
  const matchedItemCount = items.filter((item) => targetItemIds.has(item.id)).length;
  if (matchedItemCount !== targetItemIds.size) {
    throw new Error("invalid_items");
  }

  return items.map((item) => {
    if (!targetItemIds.has(item.id)) {
      return item;
    }

    if (item.status !== "awaitingPayment") {
      if (item.status === "paid") {
        return {
          ...item,
          status: "cancelRequested",
          updatedAt: input.updatedAt,
          updatedBy: input.updatedBy,
        };
      }
      throw new Error("invalid_items");
    }

    return {
      ...item,
      status: "cancelRequested",
      updatedAt: input.updatedAt,
      updatedBy: input.updatedBy,
    };
  });
}

export function applyCancellationReview(
  order: OrderRecord,
  items: readonly OrderItemRecord[],
  paymentRequests: readonly LocalPaymentRequest[],
  request: CancellationRequestRecord,
  input: {
    status: "approved" | "rejected";
    updatedAt: string;
    updatedBy: string;
    refundAmountTwd?: number;
    refundCompletedAt?: string;
    refundReference?: string;
  },
): {
  order: CancellationReviewOrder;
  items: OrderItemRecord[];
  paymentRequests: LocalPaymentRequest[];
  adjustment?: LocalPaymentAllocation;
  auditLog?: LocalAuditLog;
} {
  const targetItemIds = new Set(request.orderItemIds);
  const matchedItemCount = items.filter((item) => targetItemIds.has(item.id)).length;
  if (matchedItemCount !== targetItemIds.size) {
    throw new Error("invalid_items");
  }

  const reviewedItems = items.map((item) => {
    if (!targetItemIds.has(item.id)) {
      return item;
    }

    if (item.status !== "cancelRequested") {
      throw new Error("invalid_items");
    }

    const nextStatus = input.status === "approved"
      ? "cancelled"
      : item.status === "cancelRequested"
        ? order.status === "paid"
          ? "paid"
          : "awaitingPayment"
        : "awaitingPayment";

    return {
      ...item,
      status: nextStatus,
      updatedAt: input.updatedAt,
      updatedBy: input.updatedBy,
    } satisfies OrderItemRecord;
  });
  const recalculated = recalculateOrderAfterCancellation(order, reviewedItems, paymentRequests, input);
  const refundAmountTwd = input.refundAmountTwd ?? 0;
  if (
    input.status === "approved"
    && request.refundRequestedAmountTwd
    && refundAmountTwd > request.refundRequestedAmountTwd
  ) {
    throw new Error("refund_payment_allocation_exceeded");
  }
  const needsRefundAdjustment = input.status === "approved" && refundAmountTwd > 0;
  const reviewedOrder = needsRefundAdjustment && recalculated.order.totalTwd === 0
    ? { ...recalculated.order, status: "refunded" as const }
    : recalculated.order;

  return {
    ...recalculated,
    order: reviewedOrder,
    ...(needsRefundAdjustment
      ? {
          adjustment: {
            id: `adj_refund_${request.id}`,
            paymentId: request.targetPaymentId ?? `manual_refund_${request.id}`,
            kind: "adjustment" as const,
            targetType: "paymentRequest" as const,
            targetId: request.targetPaymentRequestId ?? paymentRequests[0]?.id ?? request.orderId,
            amountTwd: -refundAmountTwd,
            createdAt: input.updatedAt,
            createdBy: input.updatedBy,
          },
          auditLog: {
            id: `audit_refund_${request.id}`,
            action: "order.status.updated" as const,
            actorUid: input.updatedBy,
            targetType: "order" as const,
            targetId: request.orderId,
            reason: `refund ${refundAmountTwd} at ${input.refundCompletedAt ?? input.updatedAt} ref ${input.refundReference ?? ""}`.trim(),
            createdAt: input.updatedAt,
          },
        }
      : {}),
  };
}

export async function verifyRefundAccountForPayment(input: {
  refundBankCode: unknown;
  refundAccountNumberFull: unknown;
  payment: Pick<LocalPayment, "memberPaymentAccount">;
  macClient: CloudKmsMacClient;
}): Promise<"match" | "mismatch" | "needsReverification"> {
  const expected = input.payment.memberPaymentAccount;
  if (!expected || !hasUsableFingerprint(expected)) {
    return "needsReverification";
  }

  const bankCode = normalizeBankCode(input.refundBankCode);
  const accountNumber = normalizeAccountNumber(input.refundAccountNumberFull);
  if (bankCode !== expected.bankCode || accountNumber.slice(-5) !== expected.accountNumberLast5) {
    return "mismatch";
  }

  const matches = await verifyAccountIdentity(
    { bankCode, accountNumber },
    {
      bankCode: expected.bankCode,
      accountNumberLast5: expected.accountNumberLast5,
      accountFingerprint: expected.accountFingerprint!,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: expected.fingerprintKeyVersion!,
    },
    input.macClient,
  );
  return matches ? "match" : "mismatch";
}

function recalculateOrderAfterCancellation(
  order: OrderRecord,
  items: readonly OrderItemRecord[],
  paymentRequests: readonly LocalPaymentRequest[],
  input: { updatedAt: string; updatedBy: string },
) {
  const remainingTotalTwd = items
    .filter((item) => item.status !== "cancelled")
    .reduce((total, item) => total + item.snapshot.unitPriceTwd * item.quantity, 0);
  const nextOrderStatus: OrderRecord["status"] = remainingTotalTwd === 0
    ? "cancelled"
    : order.status === "cancelled"
      ? "awaitingPayment"
      : order.status;
  const nextPaymentStatus: LocalPaymentRequest["status"] = remainingTotalTwd === 0
    ? "cancelled"
    : paymentRequests[0]?.status ?? "open";

  return {
    order: {
      ...order,
      status: nextOrderStatus,
      totalTwd: remainingTotalTwd,
      updatedAt: input.updatedAt,
      updatedBy: input.updatedBy,
    },
    items: [...items],
    paymentRequests: paymentRequests.map((paymentRequest) => ({
      ...paymentRequest,
      amountTwd: remainingTotalTwd,
      status: nextPaymentStatus,
      updatedAt: input.updatedAt,
      updatedBy: input.updatedBy,
    })),
  };
}
