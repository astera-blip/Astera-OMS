import type { OrderRecord } from "@/lib/order/checkout";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";

export type OrderAction = {
  title: "待付款" | "目前無需處理";
  description: string;
  href?: string;
};

export function getOrderAction(
  order: Pick<OrderRecord, "status">,
  paymentRequest: Pick<LocalPaymentRequest, "id" | "status"> | null,
): OrderAction {
  const isPaymentActionable = paymentRequest?.status === "open" || paymentRequest?.status === "partiallyPaid";
  if (order.status === "awaitingPayment" || order.status === "partiallyPaid") {
    return {
      title: "待付款",
      description: "請完成匯款後送出付款回報。",
      ...(isPaymentActionable && paymentRequest
        ? { href: `/payments?paymentRequestId=${encodeURIComponent(paymentRequest.id)}` }
        : {}),
    };
  }

  return {
    title: "目前無需處理",
    description: "訂單將依目前進度繼續安排。",
  };
}

export function resolvePreselectedRequestIds(
  requests: ReadonlyArray<Pick<LocalPaymentRequest, "id" | "status">>,
  requestedId: string | null,
  pendingReviewRequestIds: ReadonlySet<string> = new Set(),
): string[] {
  if (!requestedId) {
    return [];
  }

  const request = requests.find((entry) => entry.id === requestedId);
  return request
    && !pendingReviewRequestIds.has(request.id)
    && (request.status === "open" || request.status === "partiallyPaid")
    ? [request.id]
    : [];
}
