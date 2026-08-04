export type NotificationEventType = "order.created" | "payment.confirmed";
export type DuplicateAccountNotificationType =
  | "memberPaymentAccount.exactDuplicate"
  | "memberPaymentAccount.last5Collision";
export type DuplicateAccountNotificationOutcome =
  | "confirmedDifferent"
  | "confirmedDuplicate";
export type DuplicateAccountNotificationStatus =
  | "pendingReview"
  | DuplicateAccountNotificationOutcome;

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

export type DuplicateAccountNotificationEvent = {
  id: string;
  type: DuplicateAccountNotificationType;
  audience: "owner";
  status: DuplicateAccountNotificationStatus;
  payload: {
    accountIds: string[];
    bankCode: string;
    accountNumberLast5: string;
  };
  createdAt: unknown;
  createdBy: string;
  updatedAt: unknown;
  updatedBy: string;
  outcome?: DuplicateAccountNotificationOutcome;
  reviewedAt?: unknown;
  reviewedBy?: string;
};

export type OwnerEmailNotificationSnapshot = {
  id: string;
  type: NotificationEventType;
  status: NotificationEvent["status"];
  memberUid: string;
  recipientEmail: string;
  orderId: string;
  orderNumber?: string;
  paymentRequestId: string;
  paymentId?: string;
  createdAt: unknown;
  attemptCount: number;
  lastAttemptAt?: unknown;
  message: string;
  deliveryIssue?: "deliveryFailed";
};

export type OwnerDuplicateNotificationSnapshot = {
  id: string;
  type: DuplicateAccountNotificationType;
  status: DuplicateAccountNotificationStatus;
  accountIds: string[];
  bankCode: string;
  accountNumberLast5: string;
  createdAt: unknown;
  updatedAt: unknown;
  outcome?: DuplicateAccountNotificationOutcome;
  reviewedAt?: unknown;
  reviewedBy?: string;
};

export type OwnerNotificationSnapshot =
  | OwnerEmailNotificationSnapshot
  | OwnerDuplicateNotificationSnapshot;

export function buildDuplicateAccountNotificationEvent(input: {
  id: string;
  type: DuplicateAccountNotificationType;
  accountIds: string[];
  bankCode: string;
  accountNumberLast5: string;
  actorUid: string;
  createdAt: unknown;
}): DuplicateAccountNotificationEvent {
  if (!/^\d{3}$/.test(input.bankCode) || !/^\d{5}$/.test(input.accountNumberLast5)) {
    throw new Error("invalid_duplicate_account_identity");
  }

  return {
    id: input.id,
    type: input.type,
    audience: "owner",
    status: "pendingReview",
    payload: {
      accountIds: [...new Set(input.accountIds)],
      bankCode: input.bankCode,
      accountNumberLast5: input.accountNumberLast5,
    },
    createdAt: input.createdAt,
    createdBy: input.actorUid,
    updatedAt: input.createdAt,
    updatedBy: input.actorUid,
  };
}

export function buildDuplicateAccountOutcomeTransition(
  event: DuplicateAccountNotificationEvent,
  input: {
    outcome: DuplicateAccountNotificationOutcome;
    actorUid: string;
    actedAt: string;
  },
) {
  if (event.status !== "pendingReview") {
    throw new Error("notification_already_reviewed");
  }

  return {
    eventUpdate: {
      status: input.outcome,
      outcome: input.outcome,
      reviewedAt: input.actedAt,
      reviewedBy: input.actorUid,
      updatedAt: input.actedAt,
      updatedBy: input.actorUid,
    },
    audit: {
      action: "memberPaymentAccount.duplicateReviewed" as const,
      actorUid: input.actorUid,
      targetType: "notificationEvent" as const,
      targetId: event.id,
      result: input.outcome,
      createdAt: input.actedAt,
    },
  };
}

export function sanitizeOwnerNotificationEvent(
  value: NotificationEvent | DuplicateAccountNotificationEvent | Record<string, unknown>,
): OwnerNotificationSnapshot {
  if (
    value.type === "memberPaymentAccount.exactDuplicate"
    || value.type === "memberPaymentAccount.last5Collision"
  ) {
    const event = value as DuplicateAccountNotificationEvent;
    return {
      id: event.id,
      type: event.type,
      status: event.status,
      accountIds: [...event.payload.accountIds],
      bankCode: event.payload.bankCode,
      accountNumberLast5: event.payload.accountNumberLast5,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      ...(event.outcome ? { outcome: event.outcome } : {}),
      ...(event.reviewedAt ? { reviewedAt: event.reviewedAt } : {}),
      ...(event.reviewedBy ? { reviewedBy: event.reviewedBy } : {}),
    };
  }

  const event = value as NotificationEvent;
  return {
    id: event.id,
    type: event.type,
    status: event.status,
    memberUid: event.memberUid,
    recipientEmail: event.recipientEmail,
    orderId: event.orderId,
    ...(event.orderNumber ? { orderNumber: event.orderNumber } : {}),
    paymentRequestId: event.paymentRequestId,
    ...(event.paymentId ? { paymentId: event.paymentId } : {}),
    createdAt: event.createdAt,
    attemptCount: event.attemptCount,
    ...(event.lastAttemptAt ? { lastAttemptAt: event.lastAttemptAt } : {}),
    message: event.message,
    ...(event.status === "failed" ? { deliveryIssue: "deliveryFailed" as const } : {}),
  };
}

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
