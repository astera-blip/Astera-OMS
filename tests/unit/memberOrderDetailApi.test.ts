import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireFirebaseUser: vi.fn(),
}));

const firestore = vi.hoisted(() => ({
  getAdminFirestore: vi.fn(),
}));

vi.mock("@/lib/firebase/serverAuth", () => ({
  requireFirebaseUser: auth.requireFirebaseUser,
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: firestore.getAdminFirestore,
}));

import { GET } from "@/app/api/orders/[id]/route";

describe("GET /api/orders/[id]", () => {
  it("returns only the signed-in member's order detail through the Admin API", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-a" });
    const order = {
      id: "order-a",
      memberUid: "member-a",
      status: "awaitingPayment",
      totalTwd: 1,
      recipientName: "Preview Test",
      recipientPhone: "0900000000",
      shippingMethod: "address",
      createdAt: { seconds: 1785369600, nanoseconds: 0 },
      createdBy: "member-a",
    };
    const items = [{
      id: "item-a",
      orderId: "order-a",
      memberUid: "member-a",
      status: "awaitingPayment",
      quantity: 1,
      snapshot: { productName: "Test", variantName: "Default", sku: "AST-P000003-V001", unitPriceTwd: 1 },
      createdAt: { seconds: 1785369600, nanoseconds: 0 },
      createdBy: "member-a",
    }];
    const paymentRequests = [{
      id: "request-a",
      orderId: "order-a",
      memberUid: "member-a",
      amountTwd: 1,
      status: "open",
      method: "bankTransfer",
      createdAt: { seconds: 1785369600, nanoseconds: 0 },
      createdBy: "system",
    }];
    const cancellationRequests = [{
      id: "cancel-a",
      orderId: "order-a",
      memberUid: "member-a",
      orderItemIds: ["item-a"],
      reason: "test",
      status: "pending",
      createdAt: { seconds: 1785369600, nanoseconds: 0 },
      createdBy: "member-a",
    }];
    const payments = [{
      id: "payment-a",
      memberUid: "member-a",
      paymentRequestId: "request-a",
      status: "confirmed",
      receivedAmountTwd: 1,
      memberPaymentAccount: {
        bankCode: "012",
        accountNumberLast5: "56789",
        payerName: "Preview Test",
        accountFingerprint: "must-not-leak",
        fingerprintKeyVersion: 3,
      },
    }];
    const orderDoc = { get: vi.fn().mockResolvedValue({ exists: true, data: () => order }) };
    const querySnapshot = (records: unknown[]) => ({
      get: vi.fn().mockResolvedValue({ docs: records.map((data) => ({ data: () => data })) }),
    });
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn((name: string) => {
        if (name === "orders") {
          return { doc: vi.fn(() => orderDoc) };
        }
        if (name === "orderItems") {
          return { where: vi.fn(() => querySnapshot(items)) };
        }
        if (name === "paymentRequests") {
          return { where: vi.fn(() => querySnapshot(paymentRequests)) };
        }
        if (name === "payments") {
          return { where: vi.fn(() => querySnapshot(payments)) };
        }
        return { where: vi.fn(() => querySnapshot(cancellationRequests)) };
      }),
    });

    const response = await GET(new Request("https://example.test/api/orders/order-a"), {
      params: Promise.resolve({ id: "order-a" }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      order: { id: "order-a", createdAt: "2026-07-30T00:00:00.000Z" },
      items: [{ id: "item-a", createdAt: "2026-07-30T00:00:00.000Z" }],
      paymentRequest: { id: "request-a", status: "open" },
      cancellationRequests: [{ id: "cancel-a", createdAt: "2026-07-30T00:00:00.000Z" }],
      confirmedPayments: [{
        id: "payment-a",
        paymentRequestId: "request-a",
        receivedAmountTwd: 1,
        bankCode: "012",
        accountNumberLast5: "56789",
        payerName: "Preview Test",
      }],
    });
    expect(JSON.stringify(payload)).not.toContain("must-not-leak");
  });

  it("rejects another member before returning any order detail", async () => {
    auth.requireFirebaseUser.mockResolvedValue({ uid: "member-b" });
    firestore.getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ id: "order-a", memberUid: "member-a" }),
          }),
        })),
      })),
    });

    const response = await GET(new Request("https://example.test/api/orders/order-a"), {
      params: Promise.resolve({ id: "order-a" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "forbidden" });
  });
});
