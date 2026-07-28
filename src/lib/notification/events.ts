export type NotificationEventType = "order.created" | "payment.confirmed";

export type NotificationEvent = {
  id: string;
  type: NotificationEventType;
  channel: "email";
  status: "pending" | "sent" | "failed";
  provider: "resend";
  memberUid: string;
  recipientEmail: string;
  orderId: string;
  orderNumber?: string;
  paymentRequestId: string;
  paymentId?: string;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
  providerMessageId?: string;
  lastError?: string;
  deliveryLockId?: string;
  deliveryLockUntil?: string;
  message: string;
};

export function createOrderCreatedNotificationEvent(input: {
  id: string;
  memberUid: string;
  recipientEmail: string;
  orderId: string;
  orderNumber?: string;
  paymentRequestId: string;
  createdAt: string;
}): NotificationEvent {
  const orderLabel = input.orderNumber ?? input.orderId;

  return {
    id: input.id,
    type: "order.created",
    channel: "email",
    status: "pending",
    provider: "resend",
    memberUid: input.memberUid,
    recipientEmail: input.recipientEmail,
    orderId: input.orderId,
    ...(input.orderNumber ? { orderNumber: input.orderNumber } : {}),
    paymentRequestId: input.paymentRequestId,
    createdAt: input.createdAt,
    attemptCount: 0,
    message: `訂單 ${orderLabel} 已成立，付款請求 ${input.paymentRequestId} 已建立。`,
  };
}

export function createPaymentConfirmedNotificationEvent(input: {
  id: string;
  memberUid: string;
  recipientEmail: string;
  orderId: string;
  orderNumber?: string;
  paymentRequestId: string;
  paymentId: string;
  createdAt: string;
}): NotificationEvent {
  return {
    id: input.id,
    type: "payment.confirmed",
    channel: "email",
    status: "pending",
    provider: "resend",
    memberUid: input.memberUid,
    recipientEmail: input.recipientEmail,
    orderId: input.orderId,
    ...(input.orderNumber ? { orderNumber: input.orderNumber } : {}),
    paymentRequestId: input.paymentRequestId,
    paymentId: input.paymentId,
    createdAt: input.createdAt,
    attemptCount: 0,
    message: `付款 ${input.paymentId} 已確認，訂單 ${input.orderId} 付款狀態已更新。`,
  };
}

export function markNotificationEventFailed(
  event: NotificationEvent,
  input: { attemptedAt: string; error: string },
): NotificationEvent {
  return {
    ...event,
    status: "failed",
    attemptCount: event.attemptCount + 1,
    lastAttemptAt: input.attemptedAt,
    lastError: sanitizeNotificationError(input.error),
  };
}

export function markNotificationEventSent(
  event: NotificationEvent,
  input: { attemptedAt: string; providerMessageId: string },
): NotificationEvent {
  return {
    ...omitLastError(event),
    status: "sent",
    attemptCount: event.attemptCount + 1,
    lastAttemptAt: input.attemptedAt,
    providerMessageId: input.providerMessageId,
  };
}

function omitLastError(event: NotificationEvent) {
  const next: NotificationEvent = { ...event };

  delete next.lastError;

  return next;
}

function sanitizeNotificationError(error: string) {
  return error
    .replace(/re_[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/g, "Bearer [redacted]")
    .slice(0, 300);
}
