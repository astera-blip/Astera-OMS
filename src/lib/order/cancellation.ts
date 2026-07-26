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
