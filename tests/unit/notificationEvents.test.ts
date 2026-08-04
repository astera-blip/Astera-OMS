import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDuplicateAccountNotificationEvent,
  buildDuplicateAccountOutcomeTransition,
  createOrderCreatedNotificationEvent,
  createPaymentConfirmedNotificationEvent,
  markNotificationEventFailed,
  markNotificationEventSent,
  sanitizeOwnerNotificationEvent,
} from "../../src/lib/notification/events";
import { POST as updateNotification } from "../../src/app/api/workspace/notifications/[id]/retry/route";

const notificationRoute = vi.hoisted(() => ({
  getAdminFirestore: vi.fn(),
  requireFirebaseUser: vi.fn(),
  isOwnerClaim: vi.fn(),
  attemptNotificationDelivery: vi.fn(),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: notificationRoute.getAdminFirestore,
}));

vi.mock("@/lib/firebase/serverAuth", () => ({
  requireFirebaseUser: notificationRoute.requireFirebaseUser,
  isOwnerClaim: notificationRoute.isOwnerClaim,
}));

vi.mock("@/lib/notification/delivery", () => ({
  attemptNotificationDelivery: notificationRoute.attemptNotificationDelivery,
}));

describe("notification events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
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

  it("builds a duplicate-account event with only account IDs and masked identity metadata", () => {
    const event = buildDuplicateAccountNotificationEvent({
      id: "duplicate-1",
      type: "memberPaymentAccount.last5Collision",
      accountIds: ["account-old", "account-new"],
      bankCode: "012",
      accountNumberLast5: "56789",
      actorUid: "member-a",
      createdAt: "2026-08-04T00:00:00.000Z",
    });

    expect(event).toEqual({
      id: "duplicate-1",
      type: "memberPaymentAccount.last5Collision",
      audience: "owner",
      status: "pendingReview",
      payload: {
        accountIds: ["account-old", "account-new"],
        bankCode: "012",
        accountNumberLast5: "56789",
      },
      createdAt: "2026-08-04T00:00:00.000Z",
      createdBy: "member-a",
      updatedAt: "2026-08-04T00:00:00.000Z",
      updatedBy: "member-a",
    });
    expect(JSON.stringify(event)).not.toMatch(
      /accountNumberFull|accountFingerprint|canonical|ciphertext|encryptionKey/i,
    );
  });

  it.each(["confirmedDifferent", "confirmedDuplicate"] as const)(
    "creates an immutable duplicate outcome transition for %s",
    (outcome) => {
      const original = buildDuplicateAccountNotificationEvent({
        id: "duplicate-1",
        type: "memberPaymentAccount.exactDuplicate",
        accountIds: ["account-old", "account-new"],
        bankCode: "012",
        accountNumberLast5: "56789",
        actorUid: "member-a",
        createdAt: "2026-08-04T00:00:00.000Z",
      });

      const transition = buildDuplicateAccountOutcomeTransition(original, {
        outcome,
        actorUid: "owner-a",
        actedAt: "2026-08-04T00:05:00.000Z",
      });

      expect(transition.eventUpdate).toEqual({
        status: outcome,
        outcome,
        reviewedAt: "2026-08-04T00:05:00.000Z",
        reviewedBy: "owner-a",
        updatedAt: "2026-08-04T00:05:00.000Z",
        updatedBy: "owner-a",
      });
      expect(transition.audit).toEqual({
        action: "memberPaymentAccount.duplicateReviewed",
        actorUid: "owner-a",
        targetType: "notificationEvent",
        targetId: "duplicate-1",
        result: outcome,
        createdAt: "2026-08-04T00:05:00.000Z",
      });
      expect(original.status).toBe("pendingReview");
      expect(transition).not.toHaveProperty("memberPaymentAccountUpdate");
    },
  );

  it("sanitizes Owner notification lists without provider diagnostics or private duplicate fields", () => {
    const emailSnapshot = sanitizeOwnerNotificationEvent({
      ...createOrderCreatedNotificationEvent({
        id: "notif-order",
        memberUid: "member-a",
        recipientEmail: "member@example.com",
        orderId: "order-a",
        paymentRequestId: "request-a",
        createdAt: "2026-08-04T00:00:00.000Z",
      }),
      status: "failed",
      lastError: "raw provider response with Bearer secret",
      providerMessageId: "provider-message-id",
      deliveryLockId: "private-lock",
      deliveryLockUntil: "2026-08-04T00:10:00.000Z",
    });
    const duplicateSnapshot = sanitizeOwnerNotificationEvent({
      ...buildDuplicateAccountNotificationEvent({
        id: "duplicate-1",
        type: "memberPaymentAccount.exactDuplicate",
        accountIds: ["account-old", "account-new"],
        bankCode: "012",
        accountNumberLast5: "56789",
        actorUid: "member-a",
        createdAt: "2026-08-04T00:00:00.000Z",
      }),
      unexpectedCiphertext: "kms-ciphertext",
      canonicalInput: "astera:bank-account:v1|012|00123456789",
    });

    expect(emailSnapshot).toMatchObject({
      id: "notif-order",
      type: "order.created",
      status: "failed",
      deliveryIssue: "deliveryFailed",
    });
    expect(emailSnapshot).not.toHaveProperty("provider");
    expect(emailSnapshot).not.toHaveProperty("lastError");
    expect(emailSnapshot).not.toHaveProperty("providerMessageId");
    expect(emailSnapshot).not.toHaveProperty("deliveryLockId");
    expect(duplicateSnapshot).toEqual({
      id: "duplicate-1",
      type: "memberPaymentAccount.exactDuplicate",
      status: "pendingReview",
      accountIds: ["account-old", "account-new"],
      bankCode: "012",
      accountNumberLast5: "56789",
      createdAt: "2026-08-04T00:00:00.000Z",
      updatedAt: "2026-08-04T00:00:00.000Z",
    });
    expect(JSON.stringify(duplicateSnapshot)).not.toMatch(
      /ciphertext|canonical|fingerprint|accountNumberFull/i,
    );
  });
});

describe("Owner duplicate-account notification API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationRoute.requireFirebaseUser.mockResolvedValue({ uid: "owner-a", role: "owner" });
    notificationRoute.isOwnerClaim.mockReturnValue(true);
  });

  it("records an Owner outcome as an event transition plus immutable audit without touching accounts", async () => {
    const event = buildDuplicateAccountNotificationEvent({
      id: "duplicate-1",
      type: "memberPaymentAccount.exactDuplicate",
      accountIds: ["account-old", "account-new"],
      bankCode: "012",
      accountNumberLast5: "56789",
      actorUid: "member-a",
      createdAt: "2026-08-04T00:00:00.000Z",
    });
    const refs: string[] = [];
    const eventUpdate = vi.fn();
    const auditCreate = vi.fn();
    const db = {
      collection: vi.fn((name: string) => {
        refs.push(name);
        return {
          doc: vi.fn((id = `generated-${name}`) => ({ collection: name, id })),
        };
      }),
      runTransaction: vi.fn(async (callback: (transaction: unknown) => unknown) =>
        callback({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => event,
          }),
          update: eventUpdate,
          create: auditCreate,
        })),
    };
    notificationRoute.getAdminFirestore.mockReturnValue(db);

    const response = await updateNotification(
      new Request("https://example.test/api/workspace/notifications/duplicate-1/retry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome: "confirmedDuplicate" }),
      }),
      { params: Promise.resolve({ id: "duplicate-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "duplicate-1",
      status: "confirmedDuplicate",
      outcome: "confirmedDuplicate",
    });
    expect(eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "notificationEvents", id: "duplicate-1" }),
      expect.objectContaining({
        status: "confirmedDuplicate",
        outcome: "confirmedDuplicate",
        reviewedBy: "owner-a",
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "auditLogs" }),
      expect.objectContaining({
        action: "memberPaymentAccount.duplicateReviewed",
        actorUid: "owner-a",
        targetId: "duplicate-1",
        result: "confirmedDuplicate",
      }),
    );
    expect(refs).not.toContain("memberPaymentAccounts");
  });

  it("requires the Owner custom claim for duplicate outcomes", async () => {
    notificationRoute.requireFirebaseUser.mockResolvedValue({ uid: "helper-a", role: "helper" });
    notificationRoute.isOwnerClaim.mockReturnValue(false);

    const response = await updateNotification(
      new Request("https://example.test/api/workspace/notifications/duplicate-1/retry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome: "confirmedDifferent" }),
      }),
      { params: Promise.resolve({ id: "duplicate-1" }) },
    );

    expect(response.status).toBe(403);
    expect(notificationRoute.getAdminFirestore).not.toHaveBeenCalled();
  });
});

describe("Owner notification list API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationRoute.requireFirebaseUser.mockResolvedValue({ uid: "owner-a", role: "owner" });
    notificationRoute.isOwnerClaim.mockReturnValue(true);
  });

  it("returns an allowlisted list through the custom-claim protected Server API", async () => {
    notificationRoute.getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          docs: [{
            id: "notif-order",
            data: () => ({
              ...createOrderCreatedNotificationEvent({
                id: "notif-order",
                memberUid: "member-a",
                recipientEmail: "member@example.com",
                orderId: "order-a",
                paymentRequestId: "request-a",
                createdAt: "2026-08-04T00:00:00.000Z",
              }),
              status: "failed",
              lastError: "raw provider response",
              providerMessageId: "provider-id",
            }),
          }],
        }),
      })),
    });
    const { GET } = await import("../../src/app/api/workspace/notifications/route");

    const response = await GET(new Request("https://example.test/api/workspace/notifications"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.notifications).toEqual([
      expect.objectContaining({
        id: "notif-order",
        status: "failed",
        deliveryIssue: "deliveryFailed",
      }),
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/raw provider response|provider-id|lastError/);
  });
});
