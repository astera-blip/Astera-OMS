import type { OrderItemRecord, OrderRecord } from "@/lib/order/checkout";
import type { OrderBundle } from "@/lib/order/checkout";

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
  unallocatedAmountTwd?: number;
};

export type LocalPayment = {
  id: string;
  memberUid: string;
  paymentRequestId: string;
  receivedAmountTwd: number;
  receivedAt: string;
  status: "pendingReview" | "confirmed" | "rejected" | "reversed";
  transferAccountLast5?: string;
  payerName?: string;
  memberNote?: string;
  adminNote?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type LocalPaymentAllocation = {
  id: string;
  paymentId: string;
  kind?: "payment" | "adjustment";
  targetType: "paymentRequest" | "order" | "orderItem" | "receivable" | "wallet";
  targetId: string;
  amountTwd: number;
  createdAt: string;
  createdBy: string;
};

export type LocalAuditLog = {
  id: string;
  action: "payment.confirmed" | "payment.reversed" | "order.status.updated";
  actorUid: string;
  targetType: "paymentRequest" | "order";
  targetId: string;
  reason: string;
  createdAt: string;
};

export function createPaymentRequestForOrder(
  orderBundle: OrderBundle,
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
  orderBundle: OrderBundle;
  paymentRequest: LocalPaymentRequest;
  payment?: LocalPayment;
  receivedAmountTwd: number;
  receivedAt: string;
  confirmedBy: string;
  reason: string;
}): {
  orderBundle: OrderBundle;
  paymentRequest: LocalPaymentRequest;
  payment: LocalPayment;
  allocation: LocalPaymentAllocation;
  auditLog: LocalAuditLog;
} {
  const paymentId = input.payment?.id ?? `pay_${input.paymentRequest.id}`;
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
      unallocatedAmountTwd: Math.max(input.receivedAmountTwd - input.paymentRequest.amountTwd, 0),
      updatedAt: input.receivedAt,
      updatedBy: input.confirmedBy,
    },
    payment: {
      ...input.payment,
      id: paymentId,
      memberUid: input.paymentRequest.memberUid,
      paymentRequestId: input.paymentRequest.id,
      receivedAmountTwd: input.receivedAmountTwd,
      receivedAt: input.receivedAt,
      status: "confirmed",
      adminNote: input.reason,
      createdAt: input.payment?.createdAt ?? input.receivedAt,
      createdBy: input.payment?.createdBy ?? input.confirmedBy,
      updatedAt: input.receivedAt,
      updatedBy: input.confirmedBy,
    },
    allocation: {
      id: `alloc_${paymentId}`,
      paymentId,
      kind: "payment",
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

export function reverseConfirmedPayment(input: {
  orderBundle: OrderBundle;
  paymentRequest: LocalPaymentRequest;
  payment: LocalPayment;
  reversedAt: string;
  reversedBy: string;
  reason: string;
}): {
  orderBundle: OrderBundle;
  paymentRequest: LocalPaymentRequest;
  payment: LocalPayment;
  adjustment: LocalPaymentAllocation;
  auditLog: LocalAuditLog;
} {
  if (input.payment.status !== "confirmed") {
    throw new Error("invalid_payment");
  }

  return {
    orderBundle: {
      order: updateOrder(input.orderBundle.order, "awaitingPayment", input.reversedAt, input.reversedBy),
      items: input.orderBundle.items.map((item) =>
        item.status === "cancelled"
          ? item
          : updateOrderItem(item, "awaitingPayment", input.reversedAt, input.reversedBy),
      ),
    },
    paymentRequest: {
      ...input.paymentRequest,
      status: "open",
      unallocatedAmountTwd: 0,
      updatedAt: input.reversedAt,
      updatedBy: input.reversedBy,
    },
    payment: {
      ...input.payment,
      status: "reversed",
      adminNote: input.reason,
      updatedAt: input.reversedAt,
      updatedBy: input.reversedBy,
    },
    adjustment: {
      id: `adj_${input.payment.id}_${input.reversedAt.replace(/[^0-9]/g, "")}`,
      paymentId: input.payment.id,
      kind: "adjustment",
      targetType: "paymentRequest",
      targetId: input.paymentRequest.id,
      amountTwd: -Math.min(input.payment.receivedAmountTwd, input.paymentRequest.amountTwd),
      createdAt: input.reversedAt,
      createdBy: input.reversedBy,
    },
    auditLog: {
      id: `audit_reverse_${input.payment.id}`,
      action: "payment.reversed",
      actorUid: input.reversedBy,
      targetType: "paymentRequest",
      targetId: input.paymentRequest.id,
      reason: input.reason,
      createdAt: input.reversedAt,
    },
  };
}

function updateOrder(
  order: OrderRecord,
  status: OrderRecord["status"],
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
