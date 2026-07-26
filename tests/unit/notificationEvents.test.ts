import { describe, expect, it } from "vitest";
import {
  createOrderCreatedNotificationEvent,
  createPaymentConfirmedNotificationEvent,
} from "../../src/lib/notification/events";

describe("notification events", () => {
  it("creates a non-sending order-created notification event", () => {
    expect(
      createOrderCreatedNotificationEvent({
        id: "notif_order_001",
        memberUid: "member-a",
        orderId: "order_001",
        paymentRequestId: "pr_order_001",
        createdAt: "2026-07-26T00:00:00.000Z",
      }),
    ).toEqual({
      id: "notif_order_001",
      type: "order.created",
      channel: "email",
      status: "recorded",
      memberUid: "member-a",
      orderId: "order_001",
      paymentRequestId: "pr_order_001",
      createdAt: "2026-07-26T00:00:00.000Z",
      provider: "manual",
      message: "訂單 order_001 已成立，付款請求 pr_order_001 已建立。",
    });
  });

  it("creates a non-sending payment-confirmed notification event", () => {
    expect(
      createPaymentConfirmedNotificationEvent({
        id: "notif_payment_001",
        memberUid: "member-a",
        orderId: "order_001",
        paymentRequestId: "pr_order_001",
        paymentId: "pay_pr_order_001",
        createdAt: "2026-07-26T00:00:00.000Z",
      }),
    ).toMatchObject({
      id: "notif_payment_001",
      type: "payment.confirmed",
      channel: "email",
      status: "recorded",
      provider: "manual",
      memberUid: "member-a",
      orderId: "order_001",
      paymentRequestId: "pr_order_001",
      paymentId: "pay_pr_order_001",
    });
  });
});
