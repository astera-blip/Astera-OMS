import { describe, expect, it } from "vitest";
import { getOrderAction, resolvePreselectedRequestIds } from "@/lib/storefront/orderActions";
import type { OrderRecord } from "@/lib/order/checkout";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";

const order: OrderRecord = {
  id: "order_1", memberUid: "member_1", status: "awaitingPayment", totalTwd: 520,
  recipientName: "測試會員", recipientPhone: "0912345678", shippingMethod: "seven_eleven",
  createdAt: "2026-08-12T00:00:00.000Z", createdBy: "member_1",
};

const request: LocalPaymentRequest = {
  id: "request_1", memberUid: "member_1", orderId: "order_1", amountTwd: 520,
  status: "open", method: "bankTransfer", createdAt: "2026-08-12T00:00:00.000Z", createdBy: "system",
};

describe("member order action", () => {
  it("sends an awaiting-payment order to its owned payment request", () => {
    expect(getOrderAction(order, request)).toMatchObject({
      title: "待付款",
      href: "/payments?paymentRequestId=request_1",
    });
  });

  it("uses a calm no-action summary once no member action remains", () => {
    expect(getOrderAction({ ...order, status: "paid" }, { ...request, status: "paid" }).title).toBe("目前無需處理");
  });

  it("only preselects an actionable request from the already-owned request list", () => {
    expect(resolvePreselectedRequestIds([request], "request_1")).toEqual(["request_1"]);
    expect(resolvePreselectedRequestIds([request], "foreign_request")).toEqual([]);
    expect(resolvePreselectedRequestIds([{ ...request, status: "paid" }], "request_1")).toEqual([]);
  });

  it("does not preselect a request that already has a payment awaiting review", () => {
    expect(resolvePreselectedRequestIds(
      [request],
      "request_1",
      new Set(["request_1"]),
    )).toEqual([]);
  });
});
