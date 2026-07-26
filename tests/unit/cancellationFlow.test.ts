import { describe, expect, it } from "vitest";
import {
  applyCancellationReview,
  createCancellationRequest,
  markCancellationRequested,
} from "../../src/lib/order/cancellation";
import type { OrderItemRecord, OrderRecord } from "../../src/lib/order/checkout";
import type { LocalPaymentRequest } from "../../src/lib/payment/manualBankTransfer";

const order: OrderRecord = {
  id: "order_001",
  memberUid: "member-a",
  status: "awaitingPayment",
  totalTwd: 1200,
  recipientName: "測試收件人",
  recipientPhone: "0912345678",
  shippingMethod: "address",
  shippingAddress: "台北市信義區測試路 1 號",
  createdAt: "2026-07-26T00:00:00.000Z",
  createdBy: "member-a",
};

const items: OrderItemRecord[] = [
  {
    id: "order_001-item-1",
    orderId: "order_001",
    memberUid: "member-a",
    productId: "prod_001",
    variantId: "var_001",
    saleCampaignId: "camp_001",
    quantity: 1,
    status: "awaitingPayment",
    snapshot: {
      productName: "星星耳環",
      variantName: "Default Variant",
      sku: "STAR-001",
      unitPriceTwd: 800,
    },
    createdAt: "2026-07-26T00:00:00.000Z",
    createdBy: "member-a",
  },
  {
    id: "order_001-item-2",
    orderId: "order_001",
    memberUid: "member-a",
    productId: "prod_002",
    variantId: "var_002",
    saleCampaignId: "camp_001",
    quantity: 1,
    status: "awaitingPayment",
    snapshot: {
      productName: "髮夾",
      variantName: "Default Variant",
      sku: "HAIR-001",
      unitPriceTwd: 400,
    },
    createdAt: "2026-07-26T00:00:00.000Z",
    createdBy: "member-a",
  },
];

const request = createCancellationRequest({
  id: "cancel_001",
  orderId: "order_001",
  orderItemIds: ["order_001-item-2"],
  memberUid: "member-a",
  reason: "尚未付款，想取消其中一項",
  createdAt: "2026-07-26T01:00:00.000Z",
  createdBy: "member-a",
});

const paymentRequest: LocalPaymentRequest = {
  id: "pr_order_001",
  memberUid: "member-a",
  orderId: "order_001",
  amountTwd: 1200,
  status: "open",
  method: "bankTransfer",
  createdAt: "2026-07-26T00:00:00.000Z",
  createdBy: "system",
};

describe("markCancellationRequested", () => {
  it("marks only selected awaiting-payment order items as cancelRequested", () => {
    expect(
      markCancellationRequested(items, request, {
        updatedAt: "2026-07-26T01:00:00.000Z",
        updatedBy: "member-a",
      }).map((item) => ({ id: item.id, status: item.status })),
    ).toEqual([
      { id: "order_001-item-1", status: "awaitingPayment" },
      { id: "order_001-item-2", status: "cancelRequested" },
    ]);
  });

  it("rejects a cancellation request for a paid item", () => {
    expect(() =>
      markCancellationRequested(
        [{ ...items[1], status: "paid" }],
        request,
        {
          updatedAt: "2026-07-26T01:00:00.000Z",
          updatedBy: "member-a",
        },
      ),
    ).toThrow("invalid_items");
  });
});

describe("applyCancellationReview", () => {
  it("approves a partial cancellation and recalculates the unpaid amount", () => {
    const requestedItems = markCancellationRequested(items, request, {
      updatedAt: "2026-07-26T01:00:00.000Z",
      updatedBy: "member-a",
    });

    expect(
      applyCancellationReview(order, requestedItems, [paymentRequest], request, {
        status: "approved",
        updatedAt: "2026-07-26T02:00:00.000Z",
        updatedBy: "owner-a",
      }),
    ).toMatchObject({
      order: {
        status: "awaitingPayment",
        totalTwd: 800,
      },
      items: [
        { id: "order_001-item-1", status: "awaitingPayment" },
        { id: "order_001-item-2", status: "cancelled" },
      ],
      paymentRequests: [
        {
          id: "pr_order_001",
          amountTwd: 800,
          status: "open",
        },
      ],
    });
  });

  it("rejects a cancellation and restores selected items to awaitingPayment", () => {
    const requestedItems = markCancellationRequested(items, request, {
      updatedAt: "2026-07-26T01:00:00.000Z",
      updatedBy: "member-a",
    });

    expect(
      applyCancellationReview(order, requestedItems, [paymentRequest], request, {
        status: "rejected",
        updatedAt: "2026-07-26T02:00:00.000Z",
        updatedBy: "owner-a",
      }).items.map((item) => ({ id: item.id, status: item.status })),
    ).toEqual([
      { id: "order_001-item-1", status: "awaitingPayment" },
      { id: "order_001-item-2", status: "awaitingPayment" },
    ]);
  });
});
