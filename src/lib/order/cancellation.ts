import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";
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
};

export function getPendingCancellationRequestId(orderId: string, orderItemIds: string[]) {
  return `cancel_${orderId}_${orderItemIds.join("_")}`;
}

export function createCancellationRequest(input: {
  id: string;
  orderId: string;
  orderItemIds: string[];
  memberUid: string;
  reason: string;
  createdAt: string;
  createdBy: string;
}): CancellationRequestRecord {
  return {
    id: input.id,
    orderId: input.orderId,
    orderItemIds: [...input.orderItemIds],
    memberUid: input.memberUid,
    reason: input.reason,
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
  },
): {
  order: OrderRecord;
  items: OrderItemRecord[];
  paymentRequests: LocalPaymentRequest[];
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

    return {
      ...item,
      status: input.status === "approved" ? "cancelled" : "awaitingPayment",
      updatedAt: input.updatedAt,
      updatedBy: input.updatedBy,
    } satisfies OrderItemRecord;
  });
  const remainingTotalTwd = reviewedItems
    .filter((item) => item.status !== "cancelled")
    .reduce((total, item) => total + item.snapshot.unitPriceTwd * item.quantity, 0);
  const nextOrderStatus = remainingTotalTwd === 0
    ? "cancelled"
    : order.status === "cancelled"
      ? "awaitingPayment"
      : order.status;
  const nextPaymentStatus = remainingTotalTwd === 0 ? "cancelled" : "open";

  return {
    order: {
      ...order,
      status: nextOrderStatus,
      totalTwd: remainingTotalTwd,
      updatedAt: input.updatedAt,
      updatedBy: input.updatedBy,
    },
    items: reviewedItems,
    paymentRequests: paymentRequests.map((paymentRequest) => ({
      ...paymentRequest,
      amountTwd: remainingTotalTwd,
      status: nextPaymentStatus,
      updatedAt: input.updatedAt,
      updatedBy: input.updatedBy,
    })),
  };
}
