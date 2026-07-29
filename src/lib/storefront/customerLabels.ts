import type { CancellationRequestRecord } from "@/lib/order/cancellation";
import type { OrderItemRecord, OrderRecord, ShippingMethod } from "@/lib/order/checkout";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";

const orderStatusLabels: Record<OrderRecord["status"], string> = {
  awaitingPayment: "待付款",
  partiallyPaid: "部分付款",
  paid: "已付款",
  cancelled: "已取消",
};

const orderItemStatusLabels: Record<OrderItemRecord["status"], string> = {
  awaitingPayment: "待付款",
  paid: "已付款",
  cancelRequested: "取消審核中",
  cancelled: "已取消",
};

const paymentRequestStatusLabels: Record<LocalPaymentRequest["status"], string> = {
  open: "待付款",
  partiallyPaid: "部分付款",
  paid: "已付款",
  cancelled: "已取消",
};

const cancellationRequestStatusLabels: Record<CancellationRequestRecord["status"], string> = {
  pending: "審核中",
  approved: "已核准",
  rejected: "未核准",
};

const shippingMethodLabels: Record<ShippingMethod, string> = {
  address: "宅配地址",
  seven_eleven: "7-Eleven 賣貨便",
  family_mart: "全家好賣+／店到店",
};

export function orderStatusLabel(status: OrderRecord["status"]) {
  return orderStatusLabels[status];
}

export function orderItemStatusLabel(status: OrderItemRecord["status"]) {
  return orderItemStatusLabels[status];
}

export function paymentRequestStatusLabel(status: LocalPaymentRequest["status"]) {
  return paymentRequestStatusLabels[status];
}

export function cancellationRequestStatusLabel(status: CancellationRequestRecord["status"]) {
  return cancellationRequestStatusLabels[status];
}

export function shippingMethodLabel(method: ShippingMethod) {
  return shippingMethodLabels[method];
}
