import { describe, expect, it } from "vitest";
import {
  createOrderCreatedNotificationEvent,
  createPaymentConfirmedNotificationEvent,
  markNotificationEventFailed,
  markNotificationEventSent,
} from "../../src/lib/notification/events";

describe("notification events", () => {
  it("creates a pending Resend order-created notification event", () => {
    expect(
      createOrderCreatedNotificationEvent({
        id: "notif_order_001",
        memberUid: "member-a",
        recipientEmail: "member@example.com",
        orderId: "order_001",
        orderNumber: "AST-20260727-0001",
        paymentRequestId: "pr_order_001",
        createdAt: "2026-07-26T00:00:00.000Z",
      }),
    ).toEqual({
      id: "notif_order_001",
      type: "order.created",
      channel: "email",
      status: "pending",
      memberUid: "member-a",
      recipientEmail: "member@example.com",
      orderId: "order_001",
      orderNumber: "AST-20260727-0001",
      paymentRequestId: "pr_order_001",
      createdAt: "2026-07-26T00:00:00.000Z",
      provider: "resend",
      attemptCount: 0,
      message: "訂單 AST-20260727-0001 已成立，付款請求 pr_order_001 已建立。",
    });
  });

  it("creates a pending Resend payment-confirmed notification event", () => {
    expect(
      createPaymentConfirmedNotificationEvent({
        id: "notif_payment_001",
        memberUid: "member-a",
        recipientEmail: "member@example.com",
        orderId: "order_001",
        orderNumber: "AST-20260727-0001",
        paymentRequestId: "pr_order_001",
        paymentId: "pay_pr_order_001",
        createdAt: "2026-07-26T00:00:00.000Z",
      }),
    ).toMatchObject({
      id: "notif_payment_001",
      type: "payment.confirmed",
      channel: "email",
      status: "pending",
      provider: "resend",
      attemptCount: 0,
      memberUid: "member-a",
      recipientEmail: "member@example.com",
      orderId: "order_001",
      orderNumber: "AST-20260727-0001",
      paymentRequestId: "pr_order_001",
      paymentId: "pay_pr_order_001",
    });
  });

  it("marks failed attempts with sanitized error and retry count without leaking provider payload", () => {
    const event = createOrderCreatedNotificationEvent({
      id: "notif_order_001",
      memberUid: "member-a",
      recipientEmail: "member@example.com",
      orderId: "order_001",
      orderNumber: "AST-20260727-0001",
      paymentRequestId: "pr_order_001",
      createdAt: "2026-07-26T00:00:00.000Z",
    });

    expect(
      markNotificationEventFailed(event, {
        attemptedAt: "2026-07-26T00:01:00.000Z",
        error: "401 invalid api key: re_very_secret_token",
      }),
    ).toMatchObject({
      status: "failed",
      attemptCount: 1,
      lastAttemptAt: "2026-07-26T00:01:00.000Z",
      lastError: "401 invalid api key: [redacted]",
    });
  });

  it("marks sent attempts with provider id and clears previous error", () => {
    const failed = markNotificationEventFailed(
      createOrderCreatedNotificationEvent({
        id: "notif_order_001",
        memberUid: "member-a",
        recipientEmail: "member@example.com",
        orderId: "order_001",
        orderNumber: "AST-20260727-0001",
        paymentRequestId: "pr_order_001",
        createdAt: "2026-07-26T00:00:00.000Z",
      }),
      {
        attemptedAt: "2026-07-26T00:01:00.000Z",
        error: "temporary provider failure",
      },
    );

    const sent = markNotificationEventSent(failed, {
      attemptedAt: "2026-07-26T00:02:00.000Z",
      providerMessageId: "resend_msg_001",
    });

    expect(sent).toMatchObject({
      status: "sent",
      attemptCount: 2,
      lastAttemptAt: "2026-07-26T00:02:00.000Z",
      providerMessageId: "resend_msg_001",
    });
    expect(sent).not.toHaveProperty("lastError");
  });
});
