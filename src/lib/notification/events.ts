export type NotificationEventType = "order.created" | "payment.confirmed";

export type NotificationEvent = {
  id: string;
  type: NotificationEventType;
  channel: "email";
  status: "recorded";
  provider: "manual";
  memberUid: string;
  orderId: string;
  paymentRequestId: string;
  paymentId?: string;
  createdAt: string;
  message: string;
};

export function createOrderCreatedNotificationEvent(input: {
  id: string;
  memberUid: string;
  orderId: string;
  paymentRequestId: string;
  createdAt: string;
}): NotificationEvent {
  return {
    id: input.id,
    type: "order.created",
    channel: "email",
    status: "recorded",
    provider: "manual",
    memberUid: input.memberUid,
    orderId: input.orderId,
    paymentRequestId: input.paymentRequestId,
    createdAt: input.createdAt,
    message: `訂單 ${input.orderId} 已成立，付款請求 ${input.paymentRequestId} 已建立。`,
  };
}

export function createPaymentConfirmedNotificationEvent(input: {
  id: string;
  memberUid: string;
  orderId: string;
  paymentRequestId: string;
  paymentId: string;
  createdAt: string;
}): NotificationEvent {
  return {
    id: input.id,
    type: "payment.confirmed",
    channel: "email",
    status: "recorded",
    provider: "manual",
    memberUid: input.memberUid,
    orderId: input.orderId,
    paymentRequestId: input.paymentRequestId,
    paymentId: input.paymentId,
    createdAt: input.createdAt,
    message: `付款 ${input.paymentId} 已確認，訂單 ${input.orderId} 付款狀態已更新。`,
  };
}
