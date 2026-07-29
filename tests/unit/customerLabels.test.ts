import { describe, expect, it } from "vitest";
import {
  cancellationRequestStatusLabel,
  orderItemStatusLabel,
  orderStatusLabel,
  paymentRequestStatusLabel,
  shippingMethodLabel,
} from "@/lib/storefront/customerLabels";

describe("storefront customer labels", () => {
  it("translates stored order, payment, cancellation, and shipping values for buyers", () => {
    expect(orderStatusLabel("awaitingPayment")).toBe("待付款");
    expect(orderStatusLabel("partiallyPaid")).toBe("部分付款");
    expect(orderItemStatusLabel("cancelRequested")).toBe("取消審核中");
    expect(paymentRequestStatusLabel("open")).toBe("待付款");
    expect(cancellationRequestStatusLabel("approved")).toBe("已核准");
    expect(shippingMethodLabel("seven_eleven")).toBe("7-Eleven 賣貨便");
  });
});
