import { describe, expect, it } from "vitest";
import { createOrderCreatedNotificationEvent } from "../../src/lib/notification/events";
import { deliverNotificationEvent } from "../../src/lib/notification/resend";

const pendingEvent = createOrderCreatedNotificationEvent({
  id: "notif_order_001",
  memberUid: "member-a",
  recipientEmail: "member@example.com",
  orderId: "order_001",
  orderNumber: "AST-20260727-0001",
  paymentRequestId: "pr_order_001",
  createdAt: "2026-07-27T00:00:00.000Z",
});

describe("Resend notification delivery", () => {
  it("does not send when Resend config is missing and records a safe failed attempt", async () => {
    const result = await deliverNotificationEvent(pendingEvent, {
      attemptedAt: "2026-07-27T00:01:00.000Z",
      config: {},
    });

    expect(result).toMatchObject({
      status: "failed",
      attemptCount: 1,
      lastAttemptAt: "2026-07-27T00:01:00.000Z",
      lastError: "Resend is not configured.",
    });
  });

  it("sends with verified sender config and records provider message id", async () => {
    const result = await deliverNotificationEvent(pendingEvent, {
      attemptedAt: "2026-07-27T00:01:00.000Z",
      config: {
        apiKey: "re_test_key",
        from: "Astera <orders@updates.asteratw.com>",
        replyTo: "support@example.com",
      },
      send: async (payload) => {
        expect(payload).toMatchObject({
          from: "Astera <orders@updates.asteratw.com>",
          to: "member@example.com",
          replyTo: "support@example.com",
          subject: "Astera 訂單 AST-20260727-0001 已成立",
        });

        return { id: "resend_msg_001" };
      },
    });

    expect(result).toMatchObject({
      status: "sent",
      attemptCount: 1,
      providerMessageId: "resend_msg_001",
      lastAttemptAt: "2026-07-27T00:01:00.000Z",
    });
  });
});
