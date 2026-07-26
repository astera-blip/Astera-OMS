import type { OrderItemRecord, OrderRecord } from "@/lib/order/checkout";
import type { StoredOrderBundle } from "@/lib/order/localStore";

export type LocalPaymentRequest = {
  id: string;
  memberUid: string;
  orderId: string;
  amountTwd: number;
  status: "open" | "partiallyPaid" | "paid" | "cancelled";
  method: "bankTransfer";
  dueAt?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type LocalPayment = {
  id: string;
  memberUid: string;
  paymentRequestId: string;
  receivedAmountTwd: number;
  receivedAt: string;
  status: "pendingReview" | "confirmed" | "rejected";
  adminNote?: string;
  createdAt: string;
  createdBy: string;
};

export type LocalPaymentAllocation = {
  id: string;
  paymentId: string;
  targetType: "paymentRequest" | "order" | "orderItem" | "receivable" | "wallet";
  targetId: string;
  amountTwd: number;
  createdAt: string;
  createdBy: string;
};

export type LocalAuditLog = {
  id: string;
  action: "payment.confirmed" | "order.status.updated";
  actorUid: string;
  targetType: "paymentRequest" | "order";
  targetId: string;
  reason: string;
  createdAt: string;
};

export function createPaymentRequestForOrder(
  orderBundle: StoredOrderBundle,
  context: { paymentRequestId: string; createdAt: string; dueAt?: string },
): LocalPaymentRequest {
  return {
    id: context.paymentRequestId,
    memberUid: orderBundle.order.memberUid,
    orderId: orderBundle.order.id,
    amountTwd: orderBundle.order.totalTwd,
    status: "open",
    method: "bankTransfer",
    ...(context.dueAt ? { dueAt: context.dueAt } : {}),
    createdAt: context.createdAt,
    createdBy: "system",
  };
}

export function confirmBankTransfer(input: {
  orderBundle: StoredOrderBundle;
  paymentRequest: LocalPaymentRequest;
  receivedAmountTwd: number;
  receivedAt: string;
  confirmedBy: string;
  reason: string;
}): {
  orderBundle: StoredOrderBundle;
  paymentRequest: LocalPaymentRequest;
  payment: LocalPayment;
  allocation: LocalPaymentAllocation;
  auditLog: LocalAuditLog;
} {
  const paymentId = `pay_${input.paymentRequest.id}`;
  const orderStatus = input.receivedAmountTwd >= input.paymentRequest.amountTwd ? "paid" : "partiallyPaid";
  const itemStatus = orderStatus === "paid" ? "paid" : "awaitingPayment";

  return {
    orderBundle: {
      order: updateOrder(input.orderBundle.order, orderStatus, input.receivedAt, input.confirmedBy),
      items: input.orderBundle.items.map((item) =>
        item.status === "cancelled"
          ? item
          : updateOrderItem(item, itemStatus, input.receivedAt, input.confirmedBy),
      ),
    },
    paymentRequest: {
      ...input.paymentRequest,
      status: orderStatus === "paid" ? "paid" : "partiallyPaid",
      updatedAt: input.receivedAt,
      updatedBy: input.confirmedBy,
    },
    payment: {
      id: paymentId,
      memberUid: input.paymentRequest.memberUid,
      paymentRequestId: input.paymentRequest.id,
      receivedAmountTwd: input.receivedAmountTwd,
      receivedAt: input.receivedAt,
      status: "confirmed",
      adminNote: input.reason,
      createdAt: input.receivedAt,
      createdBy: input.confirmedBy,
    },
    allocation: {
      id: `alloc_${paymentId}`,
      paymentId,
      targetType: "paymentRequest",
      targetId: input.paymentRequest.id,
      amountTwd: Math.min(input.receivedAmountTwd, input.paymentRequest.amountTwd),
      createdAt: input.receivedAt,
      createdBy: input.confirmedBy,
    },
    auditLog: {
      id: `audit_${paymentId}`,
      action: "payment.confirmed",
      actorUid: input.confirmedBy,
      targetType: "paymentRequest",
      targetId: input.paymentRequest.id,
      reason: input.reason,
      createdAt: input.receivedAt,
    },
  };
}

function updateOrder(
  order: OrderRecord,
  status: "paid" | "partiallyPaid",
  updatedAt: string,
  updatedBy: string,
): OrderRecord {
  return {
    ...order,
    status,
    updatedAt,
    updatedBy,
  };
}

function updateOrderItem(
  item: OrderItemRecord,
  status: "paid" | "awaitingPayment",
  updatedAt: string,
  updatedBy: string,
): OrderItemRecord {
  return {
    ...item,
    status,
    updatedAt,
    updatedBy,
  };
}
