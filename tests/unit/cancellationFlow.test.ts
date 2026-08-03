import { describe, expect, it, vi } from "vitest";
import {
  applyDirectUnpaidCancellation,
  applyCancellationReview,
  createCancellationRequest,
  markCancellationRequested,
  verifyRefundAccountForPayment,
} from "../../src/lib/order/cancellation";
import type { OrderItemRecord, OrderRecord } from "../../src/lib/order/checkout";
import type { LocalPaymentRequest } from "../../src/lib/payment/manualBankTransfer";
import { sanitizeCancellationRequest } from "../../src/lib/order/repository";

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

  it("marks paid items as cancelRequested for owner refund review", () => {
    expect(
      markCancellationRequested(
        [{ ...items[1], status: "paid" }],
        request,
        {
          updatedAt: "2026-07-26T01:00:00.000Z",
          updatedBy: "member-a",
        },
      )[0].status,
    ).toBe("cancelRequested");
  });
});

describe("applyCancellationReview", () => {
  it("directly cancels unpaid items and recalculates the unpaid amount", () => {
    expect(
      applyDirectUnpaidCancellation(order, items, [paymentRequest], {
        orderItemIds: ["order_001-item-2"],
        updatedAt: "2026-07-26T01:00:00.000Z",
        updatedBy: "member-a",
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
        },
      ],
    });
  });

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

  it("approves a paid cancellation with refund adjustment metadata", () => {
    const paidItems = items.map((item) => ({ ...item, status: "paid" as const }));
    const paidOrder = { ...order, status: "paid" as const };
    const paidRequest = { ...paymentRequest, status: "paid" as const };
    const paidCancelRequest = createCancellationRequest({
      id: "cancel_paid_001",
      orderId: "order_001",
      orderItemIds: ["order_001-item-2"],
      memberUid: "member-a",
      reason: "已付款取消其中一項",
      targetPaymentId: "payment-original",
      targetPaymentRequestId: "pr_order_001",
      refundRequestedAmountTwd: 400,
      createdAt: "2026-07-26T01:00:00.000Z",
      createdBy: "member-a",
    });
    const requestedItems = markCancellationRequested(paidItems, paidCancelRequest, {
      updatedAt: "2026-07-26T01:00:00.000Z",
      updatedBy: "member-a",
    });

    expect(
      applyCancellationReview(paidOrder, requestedItems, [paidRequest], paidCancelRequest, {
        status: "approved",
        updatedAt: "2026-07-26T02:00:00.000Z",
        updatedBy: "owner-a",
        refundAmountTwd: 400,
        refundCompletedAt: "2026-07-26",
        refundReference: "BANK-001",
      }),
    ).toMatchObject({
      order: {
        status: "paid",
        totalTwd: 800,
      },
      adjustment: {
        kind: "adjustment",
        amountTwd: -400,
        paymentId: "payment-original",
        targetId: "pr_order_001",
      },
      auditLog: {
        reason: "refund 400 at 2026-07-26 ref BANK-001",
      },
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

  it("marks a fully refunded paid order as refunded so vault ciphertext can be deleted", () => {
    const paidItems = items.map((item) => ({ ...item, status: "cancelRequested" as const }));
    const paidRequest = { ...paymentRequest, status: "paid" as const };
    const paidCancelRequest = createCancellationRequest({
      id: "cancel-paid-full",
      orderId: order.id,
      orderItemIds: paidItems.map((item) => item.id),
      memberUid: "member-a",
      reason: "full refund",
      targetPaymentId: "payment-original",
      refundBankCode: "012",
      refundAccountLast5: "56789",
      createdAt: "2026-07-26T01:00:00.000Z",
      createdBy: "member-a",
    });

    expect(applyCancellationReview(
      { ...order, status: "paid" },
      paidItems,
      [paidRequest],
      paidCancelRequest,
      {
        status: "approved",
        updatedAt: "2026-07-26T02:00:00.000Z",
        updatedBy: "owner-a",
        refundAmountTwd: 1200,
        refundCompletedAt: "2026-07-26",
        refundReference: "BANK-002",
      },
    ).order.status).toBe("refunded");
  });
});

describe("verifyRefundAccountForPayment", () => {
  it("uses the target payment snapshot's historical key version", async () => {
    const macClient = {
      signCanonicalAccount: vi.fn().mockResolvedValue({
        mac: Buffer.from("historical-match").toString("base64"),
        keyVersion: 3,
      }),
    };

    await expect(verifyRefundAccountForPayment({
      refundBankCode: "012",
      refundAccountNumberFull: "00123456789",
      payment: {
        memberPaymentAccount: {
          bankCode: "012",
          accountNumberLast5: "56789",
          accountFingerprint: Buffer.from("historical-match").toString("base64"),
          fingerprintKeyVersion: 3,
        },
      },
      macClient,
    })).resolves.toBe("match");
    expect(macClient.signCanonicalAccount).toHaveBeenCalledWith(
      "astera:bank-account:v1|012|00123456789",
      3,
    );
  });

  it("fails safely when a legacy payment snapshot has no fingerprint", async () => {
    const macClient = { signCanonicalAccount: vi.fn() };

    await expect(verifyRefundAccountForPayment({
      refundBankCode: "012",
      refundAccountNumberFull: "00123456789",
      payment: {
        memberPaymentAccount: {
          bankCode: "012",
          accountNumberLast5: "56789",
        },
      },
      macClient,
    })).resolves.toBe("needsReverification");
    expect(macClient.signCanonicalAccount).not.toHaveBeenCalled();
  });
});

describe("cancellation repository privacy", () => {
  it("strips vault ciphertext from normal cancellation reads while retaining permanent metadata", () => {
    expect(sanitizeCancellationRequest({
      id: "cancel-private",
      orderId: "order-1",
      orderItemIds: ["item-1"],
      memberUid: "member-a",
      reason: "refund",
      status: "pending",
      targetPaymentId: "payment-original",
      refundBankCode: "012",
      refundAccountLast5: "56789",
      refundAccountCiphertext: "ciphertext-secret",
      refundEncryptionKeyVersion: 4,
      refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
      createdAt: "2026-08-04T00:00:00.000Z",
      createdBy: "member-a",
    })).toEqual(expect.objectContaining({
      id: "cancel-private",
      targetPaymentId: "payment-original",
      refundBankCode: "012",
      refundAccountLast5: "56789",
    }));
    expect(JSON.stringify(sanitizeCancellationRequest({
      id: "cancel-private",
      orderId: "order-1",
      orderItemIds: ["item-1"],
      memberUid: "member-a",
      reason: "refund",
      status: "pending",
      refundAccountCiphertext: "ciphertext-secret",
      refundEncryptionKeyVersion: 4,
      refundAccountExpiresAt: "2026-08-18T00:00:00.000Z",
      createdAt: "2026-08-04T00:00:00.000Z",
      createdBy: "member-a",
    }))).not.toContain("refundAccountCiphertext");
  });
});
