"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createCancellationRequest, getPendingCancellationRequestId } from "@/lib/order/cancellation";
import type { OrderBundle } from "@/lib/order/checkout";
import type { CancellationRequestRecord } from "@/lib/order/cancellation";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";
import {
  cancellationRequestStatusLabel,
  orderItemStatusLabel,
  orderStatusLabel,
  paymentRequestStatusLabel,
  shippingMethodLabel,
} from "@/lib/storefront/customerLabels";

type Props = {
  orderId: string;
};

type MemberOrderDetailResponse = OrderBundle & {
  paymentRequest: LocalPaymentRequest | null;
  cancellationRequests: CancellationRequestRecord[];
  confirmedPayments: ConfirmedPaymentOption[];
};

type ConfirmedPaymentOption = {
  id: string;
  paymentRequestId: string;
  receivedAmountTwd: number;
  bankCode: string;
  accountNumberLast5: string;
  payerName: string;
};

export function OrderDetailBoard({ orderId }: Props) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [bundle, setBundle] = useState<OrderBundle | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<LocalPaymentRequest | null>(null);
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequestRecord[]>([]);
  const [confirmedPayments, setConfirmedPayments] = useState<ConfirmedPaymentOption[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [targetPaymentId, setTargetPaymentId] = useState("");
  const [refundBankCode, setRefundBankCode] = useState("");
  const [refundAccountNumberFull, setRefundAccountNumberFull] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!user) {
      setBundle(null);
      setPaymentRequest(null);
      setCancellationRequests([]);
      setConfirmedPayments([]);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("missing_token");
      }
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("order_detail_fetch_failed");
      }
      const detail = await response.json() as MemberOrderDetailResponse;
      setBundle({ order: detail.order, items: detail.items });
      setPaymentRequest(detail.paymentRequest);
      setCancellationRequests(detail.cancellationRequests);
      setConfirmedPayments(detail.confirmedPayments ?? []);
      setTargetPaymentId(detail.confirmedPayments?.[0]?.id ?? "");
      setRefundBankCode(detail.confirmedPayments?.[0]?.bankCode ?? "");
      setStatus("ready");
    } catch (error) {
      console.warn("member_order_detail_load_failed", error instanceof Error ? error.message : "unknown");
      setBundle(null);
      setPaymentRequest(null);
      setCancellationRequests([]);
      setConfirmedPayments([]);
      setStatus("error");
      setMessage("無法讀取雲端訂單，請稍後再試。");
    }
  }, [orderId, user]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOrder();
    });
  }, [loadOrder]);

  const order = bundle;
  const existingRequest = useMemo(
    () => cancellationRequests.find((request) => request.orderId === orderId && request.status === "pending") ?? null,
    [cancellationRequests, orderId],
  );
  const pendingItemIds = useMemo(
    () =>
      new Set(
        cancellationRequests
          .filter((request) => request.orderId === orderId && request.status === "pending")
          .flatMap((request) => request.orderItemIds),
      ),
    [cancellationRequests, orderId],
  );

  useEffect(() => {
    if (order) {
      queueMicrotask(() => {
        setSelectedItemIds(order.items.filter((item) =>
          item.status === "awaitingPayment" || item.status === "paid"
        ).map((item) => item.id));
      });
    }
  }, [order]);

  async function submitCancellationRequest() {
    if (!user || !order) {
      setMessage("請先登入再送出取消申請。");
      return;
    }

    if (isSubmitting) {
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setMessage("請填寫取消原因。");
      return;
    }

    const selectable = order.items.filter((item) =>
      item.status === "awaitingPayment" || item.status === "paid"
    ).map((item) => item.id);
    const itemIds = selectedItemIds.filter((itemId) => selectable.includes(itemId));
    if (itemIds.length === 0) {
      setMessage("請至少選擇一個可取消的項目。");
      return;
    }
    const hasPaidItems = order.items.some((item) => itemIds.includes(item.id) && item.status === "paid");
    if (hasPaidItems && (!targetPaymentId || !refundBankCode.trim() || !refundAccountNumberFull.trim())) {
      setMessage("已付款項目請選擇原付款紀錄，並填寫退款銀行代碼與完整銀行帳號。");
      return;
    }

    const request = createCancellationRequest({
      id: getPendingCancellationRequestId(orderId, itemIds),
      orderId,
      orderItemIds: itemIds,
      memberUid: user.uid,
      reason: trimmedReason,
      ...(hasPaidItems
        ? {
            targetPaymentId,
            refundBankCode: refundBankCode.trim(),
            refundAccountLast5: refundAccountNumberFull.replace(/[ -]/g, "").slice(-5),
          }
        : {}),
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
    });

    try {
      setIsSubmitting(true);
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setMessage("請重新登入後再送出取消申請。");
        return;
      }

      const response = await fetch("/api/cancellations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          orderItemIds: itemIds,
          reason: trimmedReason,
          idempotencyKey: `${orderId}_${itemIds.join("_")}`,
          ...(hasPaidItems
            ? {
                targetPaymentId,
                refundBankCode: refundBankCode.trim(),
                refundAccountNumberFull: refundAccountNumberFull.trim(),
              }
            : {}),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "request_failed" })) as { error?: string };
        if (payload.error === "refund_account_mismatch") {
          setMessage("退款帳號與原付款帳號不一致，請確認銀行代碼與完整帳號。");
          return;
        }
        if (payload.error === "refund_account_rate_limited") {
          setMessage("退款帳號驗證嘗試次數過多，請稍後再試或聯繫客服。");
          return;
        }
        if (payload.error === "refund_account_reverification_required") {
          setMessage("原付款帳戶需要重新驗證，請聯繫客服協助處理。");
          return;
        }
        throw new Error("request_failed");
      }

      setCancellationRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
      setRefundAccountNumberFull("");
      await loadOrder();
      setMessage("取消申請已處理，訂單狀態已更新。");
    } catch {
      setMessage("取消申請送出失敗，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        請先登入，才能查看自己的訂單。
      </div>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        訂單載入中。
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm text-rose-700">
        <p role="alert">訂單讀取失敗，請確認網路後再試一次。</p>
        <button
          type="button"
          onClick={() => void loadOrder()}
          className="mt-4 min-h-11 rounded-full border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100"
        >
          重新載入
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-lg font-semibold">找不到這張訂單</p>
        <p className="mt-2 text-sm text-slate-600">如果你剛下單，請先確認已登入同一個帳號。</p>
      </div>
    );
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
              訂單
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{order.order.orderNumber ?? order.order.id}</h2>
            <p className="mt-2 text-sm text-slate-600">
              狀態：{orderStatusLabel(order.order.status)} · NT$ {order.order.totalTwd.toLocaleString()}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            共 {order.items.length} 項商品
          </span>
        </div>

        <div className="mt-6 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
          <p>收件人：{order.order.recipientName}</p>
          <p>電話：{order.order.recipientPhone}</p>
          <p>配送方式：{shippingMethodLabel(order.order.shippingMethod)}</p>
          {order.order.shippingAddress ? <p className="md:col-span-2">地址：{order.order.shippingAddress}</p> : null}
        </div>

        {paymentRequest ? (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="font-medium">付款請求</p>
            <p className="mt-1">
              狀態：{paymentRequestStatusLabel(paymentRequest.status)} · 應付 NT$ {paymentRequest.amountTwd.toLocaleString()}
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          {order.items.map((item) => {
            const canCancel = item.status === "awaitingPayment" || item.status === "paid";
            const hasPendingRequest = pendingItemIds.has(item.id);

            return (
              <label key={item.id} className="flex gap-4 rounded-2xl bg-slate-50 p-4 text-sm">
                <input
                  type="checkbox"
                  checked={selectedItemIds.includes(item.id)}
                  onChange={(event) => {
                    setSelectedItemIds((current) =>
                      event.target.checked
                        ? [...current, item.id]
                        : current.filter((value) => value !== item.id),
                    );
                  }}
                  disabled={!canCancel || hasPendingRequest}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.snapshot.productName}</p>
                  <p className="mt-1 text-slate-600">
                    {item.snapshot.variantName} · {item.snapshot.sku} · 數量 {item.quantity}
                  </p>
                  <p className="mt-1 text-slate-500">狀態：{orderItemStatusLabel(item.status)}</p>
                  {hasPendingRequest ? <p className="mt-1 text-xs text-amber-700">這個項目已有待審核取消申請。</p> : null}
                  {!canCancel ? <p className="mt-1 text-xs text-amber-700">此項目目前不可再次申請取消。</p> : null}
                </div>
              </label>
            );
          })}
        </div>
      </article>

      <aside className="grid gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">訂單操作</p>
          <h3 className="mt-2 text-2xl font-semibold">取消申請</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            未付款項目可直接取消；已付款項目會送出取消申請，待客服審核退款資訊。
          </p>
          {existingRequest ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium">已送出取消申請</p>
              <p className="mt-1">狀態：{cancellationRequestStatusLabel(existingRequest.status)}</p>
            </div>
          ) : user ? (
            <div className="mt-5 grid gap-3">
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-28 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="請說明取消原因"
              />
              {order.items.some((item) => selectedItemIds.includes(item.id) && item.status === "paid") ? (
                <div className="grid gap-3 rounded-2xl border border-astera-service/30 bg-astera-service/5 p-4">
                  <p className="text-sm leading-6 text-astera-secondary">
                    已付款項目需重新輸入原匯款帳號進行比對。完整帳號只會加密暫存最多 14 天；完成退款後立即刪除。
                  </p>
                  <label className="grid gap-2 text-sm font-medium">
                    原付款紀錄
                    {confirmedPayments.length > 0 ? (
                      <select
                        value={targetPaymentId}
                        onChange={(event) => {
                          const paymentId = event.target.value;
                          setTargetPaymentId(paymentId);
                          setRefundBankCode(confirmedPayments.find((payment) => payment.id === paymentId)?.bankCode ?? "");
                        }}
                        className="min-h-11 rounded-2xl border border-astera-border bg-white px-4"
                      >
                        {confirmedPayments.map((payment) => (
                          <option key={payment.id} value={payment.id}>
                            NT$ {payment.receivedAmountTwd.toLocaleString()} · 銀行 {payment.bankCode} · ***{payment.accountNumberLast5} · {payment.payerName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">
                        找不到可用的已確認付款紀錄，請聯繫客服。
                      </span>
                    )}
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    退款銀行代碼
                    <input
                      inputMode="numeric"
                      value={refundBankCode}
                      onChange={(event) => setRefundBankCode(event.target.value)}
                      className="min-h-11 rounded-2xl border border-astera-border bg-white px-4"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    退款完整銀行帳號
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      value={refundAccountNumberFull}
                      onChange={(event) => setRefundAccountNumberFull(event.target.value)}
                      className="min-h-11 rounded-2xl border border-astera-border bg-white px-4"
                    />
                  </label>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void submitCancellationRequest()}
                disabled={isSubmitting}
                className="min-h-11 rounded-full border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "送出中…" : "申請取消"}
              </button>
              {message ? <p aria-live="polite" className="text-sm text-slate-600">{message}</p> : null}
            </div>
          ) : (
            <Link
              href="/"
              className="mt-5 inline-flex w-full justify-center rounded-full border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
            >
              登入後再操作
            </Link>
          )}
        </div>
      </aside>
    </section>
  );
}
