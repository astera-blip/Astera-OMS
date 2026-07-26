import { describe, expect, it } from "vitest";
import { confirmBankTransfer, createPaymentRequestForOrder } from "../../src/lib/payment/manualBankTransfer";
import type { StoredOrderBundle } from "../../src/lib/order/localStore";

const orderBundle: StoredOrderBundle = {
  order: {
    id: "order_001",
    memberUid: "member-a",
    status: "awaitingPayment",
    totalTwd: 1760,
    recipientName: "測試收件人",
    recipientPhone: "0912345678",
    shippingMethod: "address",
    shippingAddress: "台北市信義區測試路 1 號",
    createdAt: "2026-07-26T00:00:00.000Z",
    createdBy: "member-a",
  },
  items: [
    {
      id: "order_001-item-1",
      orderId: "order_001",
      memberUid: "member-a",
      productId: "prod_001",
      variantId: "var_001",
      saleCampaignId: "camp_001",
      quantity: 2,
      status: "awaitingPayment",
      snapshot: {
        productName: "星星耳環",
        variantName: "Default Variant",
        sku: "STAR-001",
        unitPriceTwd: 880,
        publicSaleNotes: "七夕檔期",
      },
      createdAt: "2026-07-26T00:00:00.000Z",
      createdBy: "member-a",
    },
  ],
};

describe("createPaymentRequestForOrder", () => {
  it("creates an open bank transfer request for the order total", () => {
    expect(
      createPaymentRequestForOrder(orderBundle, {
        paymentRequestId: "pr_001",
        createdAt: "2026-07-26T00:00:00.000Z",
      }),
    ).toEqual({
      id: "pr_001",
      memberUid: "member-a",
      orderId: "order_001",
      amountTwd: 1760,
      status: "open",
      method: "bankTransfer",
      createdAt: "2026-07-26T00:00:00.000Z",
      createdBy: "system",
    });
  });
});

describe("confirmBankTransfer", () => {
  it("creates payment allocation and audit log when payment is confirmed", () => {
    const request = createPaymentRequestForOrder(orderBundle, {
      paymentRequestId: "pr_001",
      createdAt: "2026-07-26T00:00:00.000Z",
    });

    expect(
      confirmBankTransfer({
        orderBundle,
        paymentRequest: request,
        receivedAmountTwd: 1760,
        receivedAt: "2026-07-26T01:00:00.000Z",
        confirmedBy: "owner-a",
        reason: "對帳末五碼 12345",
      }),
    ).toEqual({
      orderBundle: {
        order: {
          ...orderBundle.order,
          status: "paid",
          updatedAt: "2026-07-26T01:00:00.000Z",
          updatedBy: "owner-a",
        },
        items: [
          {
            ...orderBundle.items[0],
            status: "paid",
            updatedAt: "2026-07-26T01:00:00.000Z",
            updatedBy: "owner-a",
          },
        ],
      },
      paymentRequest: {
        ...request,
        status: "paid",
        updatedAt: "2026-07-26T01:00:00.000Z",
        updatedBy: "owner-a",
      },
      payment: {
        id: "pay_pr_001",
        memberUid: "member-a",
        paymentRequestId: "pr_001",
        receivedAmountTwd: 1760,
        receivedAt: "2026-07-26T01:00:00.000Z",
        status: "confirmed",
        adminNote: "對帳末五碼 12345",
        createdAt: "2026-07-26T01:00:00.000Z",
        createdBy: "owner-a",
      },
      allocation: {
        id: "alloc_pay_pr_001",
        paymentId: "pay_pr_001",
        targetType: "paymentRequest",
        targetId: "pr_001",
        amountTwd: 1760,
        createdAt: "2026-07-26T01:00:00.000Z",
        createdBy: "owner-a",
      },
      auditLog: {
        id: "audit_pay_pr_001",
        action: "payment.confirmed",
        actorUid: "owner-a",
        targetType: "paymentRequest",
        targetId: "pr_001",
        reason: "對帳末五碼 12345",
        createdAt: "2026-07-26T01:00:00.000Z",
      },
    });
  });
});
