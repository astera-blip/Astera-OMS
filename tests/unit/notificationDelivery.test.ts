import { describe, expect, it } from "vitest";
import { acquireNotificationDeliveryLock } from "../../src/lib/notification/delivery";
import { createOrderCreatedNotificationEvent } from "../../src/lib/notification/events";

const event = createOrderCreatedNotificationEvent({
  id: "notif_1",
  memberUid: "member-a",
  recipientEmail: "member@example.com",
  orderId: "order-a",
  paymentRequestId: "pr-a",
  createdAt: "2026-07-29T00:00:00.000Z",
});

describe("notification delivery locking", () => {
  it("acquires a lock for pending delivery", () => {
    const locked = acquireNotificationDeliveryLock(
      event,
      "lock-a",
      new Date("2026-07-29T00:01:00.000Z"),
    );
    expect(locked).toMatchObject({
      acquired: true,
      deliveryLockId: "lock-a",
      deliveryLockUntil: "2026-07-29T00:06:00.000Z",
    });
  });

  it("does not acquire sent or active locked events", () => {
    expect(acquireNotificationDeliveryLock(
      { ...event, status: "sent", providerMessageId: "msg-a" },
      "lock-b",
      new Date("2026-07-29T00:01:00.000Z"),
    ).acquired).toBe(false);
    expect(acquireNotificationDeliveryLock(
      { ...event, deliveryLockId: "lock-a", deliveryLockUntil: "2026-07-29T00:05:00.000Z" },
      "lock-b",
      new Date("2026-07-29T00:01:00.000Z"),
    ).acquired).toBe(false);
  });

  it("permits retry after an expired lock", () => {
    const locked = acquireNotificationDeliveryLock(
      { ...event, deliveryLockId: "old", deliveryLockUntil: "2026-07-29T00:00:00.000Z" },
      "new",
      new Date("2026-07-29T00:01:00.000Z"),
    );
    expect(locked.acquired).toBe(true);
  });
});
