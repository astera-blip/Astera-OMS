import { describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  getDocs: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  doc: vi.fn(),
  getDocs: firestore.getDocs,
  query: vi.fn((source: unknown) => source),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));

import { listMemberCancellationRequests, listMemberOrders } from "@/lib/order/repository";

describe("listMemberOrders", () => {
  it("normalizes Firestore timestamps before exposing order records to React", async () => {
    firestore.getDocs
      .mockResolvedValueOnce({
        docs: [{
          data: () => ({
            id: "order_timestamp",
            memberUid: "member-a",
            status: "awaitingPayment",
            totalTwd: 1,
            recipientName: "Preview Test",
            recipientPhone: "0900000000",
            shippingMethod: "address",
            createdAt: {
              toDate: () => new Date("2026-07-30T00:00:00.000Z"),
            },
            createdBy: "member-a",
          }),
        }],
      })
      .mockResolvedValueOnce({
        docs: [{
          data: () => ({
            id: "order_timestamp-item-1",
            orderId: "order_timestamp",
            memberUid: "member-a",
            productId: "product-a",
            variantId: "variant-a",
            saleCampaignId: "campaign-a",
            quantity: 1,
            status: "awaitingPayment",
            snapshot: {
              productName: "Test Product",
              variantName: "Test Variant",
              sku: "AST-P000003-V001",
              unitPriceTwd: 1,
            },
            createdAt: { seconds: 1785369600, nanoseconds: 0 },
            createdBy: "member-a",
          }),
        }],
      });

    const bundles = await listMemberOrders({} as never, "member-a");

    expect(bundles).toHaveLength(1);
    expect(bundles[0]?.order.createdAt).toBe("2026-07-30T00:00:00.000Z");
    expect(bundles[0]?.items[0]?.createdAt).toBe("2026-07-30T00:00:00.000Z");
  });

  it("sorts unpaid orders ahead of paid and cancelled orders, newest first within each status", async () => {
    firestore.getDocs.mockReset();
    firestore.getDocs
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ id: "paid", memberUid: "member-a", status: "paid", totalTwd: 520, recipientName: "A", recipientPhone: "0900000000", shippingMethod: "seven_eleven", createdAt: "2026-08-13T04:00:00.000Z", createdBy: "member-a" }) },
          { data: () => ({ id: "cancelled", memberUid: "member-a", status: "cancelled", totalTwd: 520, recipientName: "A", recipientPhone: "0900000000", shippingMethod: "seven_eleven", createdAt: "2026-08-13T05:00:00.000Z", createdBy: "member-a" }) },
          { data: () => ({ id: "unpaid-old", memberUid: "member-a", status: "awaitingPayment", totalTwd: 520, recipientName: "A", recipientPhone: "0900000000", shippingMethod: "seven_eleven", createdAt: "2026-08-13T01:00:00.000Z", createdBy: "member-a" }) },
          { data: () => ({ id: "partial", memberUid: "member-a", status: "partiallyPaid", totalTwd: 520, recipientName: "A", recipientPhone: "0900000000", shippingMethod: "seven_eleven", createdAt: "2026-08-13T02:00:00.000Z", createdBy: "member-a" }) },
          { data: () => ({ id: "unpaid-new", memberUid: "member-a", status: "awaitingPayment", totalTwd: 520, recipientName: "A", recipientPhone: "0900000000", shippingMethod: "seven_eleven", createdAt: "2026-08-13T03:00:00.000Z", createdBy: "member-a" }) },
        ],
      })
      .mockResolvedValueOnce({ docs: [] });

    const bundles = await listMemberOrders({} as never, "member-a");

    expect(bundles.map((bundle) => bundle.order.id)).toEqual([
      "unpaid-new",
      "unpaid-old",
      "partial",
      "paid",
      "cancelled",
    ]);
  });
});

describe("listMemberCancellationRequests", () => {
  it("normalizes Firestore timestamps before exposing cancellation records to React", async () => {
    firestore.getDocs.mockReset();
    firestore.getDocs.mockResolvedValueOnce({
      docs: [{
        data: () => ({
          id: "cancel_timestamp",
          orderId: "order_timestamp",
          orderItemIds: ["order_timestamp-item-1"],
          memberUid: "member-a",
          reason: "Preview test cancellation",
          status: "approved",
          createdAt: { seconds: 1785369600, nanoseconds: 0 },
          createdBy: "member-a",
          reviewedAt: {
            toDate: () => new Date("2026-07-30T00:01:00.000Z"),
          },
          refundCompletedAt: { seconds: 1785369720, nanoseconds: 0 },
        }),
      }],
    });

    const requests = await listMemberCancellationRequests({} as never, "member-a");

    expect(requests).toHaveLength(1);
    expect(requests[0]?.createdAt).toBe("2026-07-30T00:00:00.000Z");
    expect(requests[0]?.reviewedAt).toBe("2026-07-30T00:01:00.000Z");
    expect(requests[0]?.refundCompletedAt).toBe("2026-07-30T00:02:00.000Z");
  });
});
