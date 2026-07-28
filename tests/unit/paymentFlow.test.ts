import { describe, expect, it } from "vitest";
import {
  confirmBankTransfer,
  createPaymentRequestForOrder,
  reverseConfirmedPayment,
} from "../../src/lib/payment/manualBankTransfer";
import type { OrderBundle } from "../../src/lib/order/checkout";

const orderBundle: OrderBundle = {
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

describe("reverseConfirmedPayment", () => {
  it("marks payment reversed and appends a negative adjustment", () => {
    const request = createPaymentRequestForOrder(orderBundle, {
      paymentRequestId: "pr_001",
      createdAt: "2026-07-26T00:00:00.000Z",
    });
    const confirmation = confirmBankTransfer({
      orderBundle,
      paymentRequest: request,
      receivedAmountTwd: 1760,
      receivedAt: "2026-07-26T01:00:00.000Z",
      confirmedBy: "owner-a",
      reason: "對帳末五碼 12345",
    });

    expect(
      reverseConfirmedPayment({
        orderBundle: confirmation.orderBundle,
        paymentRequest: confirmation.paymentRequest,
        payment: confirmation.payment,
        reversedAt: "2026-07-26T02:00:00.000Z",
        reversedBy: "owner-a",
        reason: "銀行通知入錯帳",
      }),
    ).toMatchObject({
      orderBundle: {
        order: { status: "awaitingPayment" },
        items: [{ status: "awaitingPayment" }],
      },
      paymentRequest: {
        status: "open",
        unallocatedAmountTwd: 0,
      },
      payment: {
        status: "reversed",
        adminNote: "銀行通知入錯帳",
      },
      adjustment: {
        kind: "adjustment",
        paymentId: "pay_pr_001",
        amountTwd: -1760,
      },
      auditLog: {
        action: "payment.reversed",
        reason: "銀行通知入錯帳",
      },
    });
  });

  it("reopens only the amount allocated by the reversed payment", () => {
    const request = createPaymentRequestForOrder(orderBundle, {
      paymentRequestId: "pr_multi_reverse",
      createdAt: "2026-07-26T00:00:00.000Z",
    });
    const first = confirmBankTransfer({
      orderBundle,
      paymentRequest: request,
      payment: {
        id: "pay_multi_1",
        memberUid: "member-a",
        paymentRequestId: request.id,
        receivedAmountTwd: 600,
        receivedAt: "2026-07-26T01:00:00.000Z",
        status: "pendingReview",
        createdAt: "2026-07-26T01:00:00.000Z",
        createdBy: "member-a",
      },
      receivedAmountTwd: 600,
      receivedAt: "2026-07-26T01:00:00.000Z",
      confirmedBy: "owner-a",
      reason: "第一筆",
    });
    const second = confirmBankTransfer({
      orderBundle: first.orderBundle,
      paymentRequest: first.paymentRequest,
      payment: {
        id: "pay_multi_2",
        memberUid: "member-a",
        paymentRequestId: request.id,
        receivedAmountTwd: 1160,
        receivedAt: "2026-07-26T02:00:00.000Z",
        status: "pendingReview",
        createdAt: "2026-07-26T02:00:00.000Z",
        createdBy: "member-a",
      },
      receivedAmountTwd: 1160,
      receivedAt: "2026-07-26T02:00:00.000Z",
      confirmedBy: "owner-a",
      reason: "第二筆",
    });
    const reversal = reverseConfirmedPayment({
      orderBundle: second.orderBundle,
      paymentRequest: second.paymentRequest,
      payment: second.payment,
      allocatedAmountTwd: second.allocation.amountTwd,
      reversedAt: "2026-07-26T03:00:00.000Z",
      reversedBy: "owner-a",
      reason: "撤銷第二筆",
    });

    expect(reversal.paymentRequest).toMatchObject({
      status: "partiallyPaid",
      allocatedAmountTwd: 600,
    });
    expect(reversal.orderBundle.order.status).toBe("partiallyPaid");
    expect(reversal.adjustment.amountTwd).toBe(-1160);
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
        allocatedAmountTwd: 1760,
        unallocatedAmountTwd: 0,
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
        updatedAt: "2026-07-26T01:00:00.000Z",
        updatedBy: "owner-a",
      },
      allocation: {
        id: "alloc_pay_pr_001",
        paymentId: "pay_pr_001",
        kind: "payment",
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

  it("records overpayment as unallocated without creating wallet behavior", () => {
    const request = createPaymentRequestForOrder(orderBundle, {
      paymentRequestId: "pr_001",
      createdAt: "2026-07-26T00:00:00.000Z",
    });

    const confirmation = confirmBankTransfer({
      orderBundle,
      paymentRequest: request,
      receivedAmountTwd: 2000,
      receivedAt: "2026-07-26T01:00:00.000Z",
      confirmedBy: "owner-a",
      reason: "會員多匯，待人工退款",
    });

    expect(confirmation.paymentRequest).toMatchObject({
      status: "paid",
      unallocatedAmountTwd: 240,
    });
    expect(confirmation.allocation).toMatchObject({
      targetType: "paymentRequest",
      amountTwd: 1760,
    });
  });

  it("accumulates multiple confirmed payments until the request is fully paid", () => {
    const request = createPaymentRequestForOrder(orderBundle, {
      paymentRequestId: "pr_cumulative",
      createdAt: "2026-07-26T00:00:00.000Z",
    });
    const first = confirmBankTransfer({
      orderBundle,
      paymentRequest: request,
      payment: {
        id: "pay_partial_1",
        memberUid: "member-a",
        paymentRequestId: request.id,
        receivedAmountTwd: 600,
        receivedAt: "2026-07-26T01:00:00.000Z",
        status: "pendingReview",
        createdAt: "2026-07-26T01:00:00.000Z",
        createdBy: "member-a",
      },
      receivedAmountTwd: 600,
      receivedAt: "2026-07-26T01:00:00.000Z",
      confirmedBy: "owner-a",
      reason: "第一筆",
    });
    const second = confirmBankTransfer({
      orderBundle: first.orderBundle,
      paymentRequest: first.paymentRequest,
      payment: {
        id: "pay_partial_2",
        memberUid: "member-a",
        paymentRequestId: request.id,
        receivedAmountTwd: 1160,
        receivedAt: "2026-07-26T02:00:00.000Z",
        status: "pendingReview",
        createdAt: "2026-07-26T02:00:00.000Z",
        createdBy: "member-a",
      },
      receivedAmountTwd: 1160,
      receivedAt: "2026-07-26T02:00:00.000Z",
      confirmedBy: "owner-a",
      reason: "第二筆",
    });

    expect(first.paymentRequest).toMatchObject({
      status: "partiallyPaid",
      allocatedAmountTwd: 600,
    });
    expect(second.paymentRequest).toMatchObject({
      status: "paid",
      allocatedAmountTwd: 1760,
      unallocatedAmountTwd: 0,
    });
    expect(second.orderBundle.order.status).toBe("paid");
  });
});
