"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createCancellationRequest, getPendingCancellationRequestId } from "@/lib/order/cancellation";
import type { OrderBundle } from "@/lib/order/checkout";
import type { CancellationRequestRecord } from "@/lib/order/cancellation";

type Props = {
  orderId: string;
};

export function OrderDetailBoard({ orderId }: Props) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [bundles, setBundles] = useState<OrderBundle[]>([]);
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequestRecord[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    async function loadFirestoreOrder() {
      if (!user) {
        setBundles([]);
        setCancellationRequests([]);
        setStatus("idle");
        return;
      }

      setStatus("loading");
      const [{ db }, { listMemberOrders, listMemberCancellationRequests }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/order/repository"),
      ]);

      const [nextBundles, nextCancellationRequests] = await Promise.all([
        listMemberOrders(db, user.uid),
        listMemberCancellationRequests(db, user.uid),
      ]);
      setBundles(nextBundles);
      setCancellationRequests(nextCancellationRequests);
      setStatus("ready");
    }

    void loadFirestoreOrder().catch(() => {
      setBundles([]);
      setCancellationRequests([]);
      setStatus("error");
      setMessage("無法讀取雲端訂單，請稍後再試。");
    });
  }, [user]);

  const order = useMemo(() => bundles.find((bundle) => bundle.order.id === orderId) ?? null, [bundles, orderId]);
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
        setSelectedItemIds(order.items.filter((item) => item.status === "awaitingPayment").map((item) => item.id));
      });
    }
  }, [order]);

  async function submitCancellationRequest() {
    if (!user || !order) {
      setMessage("請先登入再送出取消申請。");
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setMessage("請填寫取消原因。");
      return;
    }

    const selectable = order.items.filter((item) => item.status === "awaitingPayment").map((item) => item.id);
    const itemIds = selectedItemIds.filter((itemId) => selectable.includes(itemId));
    if (itemIds.length === 0) {
      setMessage("請至少選擇一個尚未付款的項目。");
      return;
    }

    const request = createCancellationRequest({
      id: getPendingCancellationRequestId(orderId, itemIds),
      orderId,
      orderItemIds: itemIds,
      memberUid: user.uid,
      reason: trimmedReason,
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
    });

    try {
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
        }),
      });

      if (!response.ok) {
        throw new Error("request_failed");
      }

      setCancellationRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
      setBundles((current) =>
        current.map((bundle) =>
          bundle.order.id === orderId
            ? {
                ...bundle,
                items: bundle.items.map((item) =>
                  itemIds.includes(item.id) ? { ...item, status: "cancelRequested" } : item,
                ),
              }
            : bundle,
        ),
      );
      setMessage("已送出取消申請，等待 owner 審核。");
    } catch {
      setMessage("取消申請送出失敗，請稍後再試。");
    }
  }

  if (!order) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-lg font-semibold">找不到這張訂單</p>
        <p className="mt-2 text-sm text-slate-600">如果你剛下單，請先確認已登入同一個帳號。</p>
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
        訂單讀取失敗，請稍後再試。
      </div>
    );
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
              Order
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{order.order.id}</h2>
            <p className="mt-2 text-sm text-slate-600">
              狀態：{order.order.status} · NT$ {order.order.totalTwd.toLocaleString()}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {order.items.length} items
          </span>
        </div>

        <div className="mt-6 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
          <p>收件人：{order.order.recipientName}</p>
          <p>電話：{order.order.recipientPhone}</p>
          <p>配送方式：{order.order.shippingMethod}</p>
          {order.order.shippingAddress ? <p className="md:col-span-2">地址：{order.order.shippingAddress}</p> : null}
          {order.order.shippingStoreInfo ? <p className="md:col-span-2">門市資訊：{order.order.shippingStoreInfo}</p> : null}
        </div>

        <div className="mt-6 grid gap-3">
          {order.items.map((item) => {
            const canCancel = item.status === "awaitingPayment";
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
                  <p className="mt-1 text-slate-500">狀態：{item.status}</p>
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
          <p className="text-sm font-semibold text-slate-500">Actions</p>
          <h3 className="mt-2 text-2xl font-semibold">取消申請</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            未付款項目可直接取消；已付款項目會送出取消申請，待客服審核退款資訊。
          </p>
          {existingRequest ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium">已送出取消申請</p>
              <p className="mt-1">狀態：{existingRequest.status}</p>
            </div>
          ) : user ? (
            <div className="mt-5 grid gap-3">
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-28 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="請說明取消原因"
              />
              <button
                type="button"
                onClick={() => void submitCancellationRequest()}
                className="rounded-full border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
              >
                申請取消
              </button>
              {message ? <p className="text-sm text-slate-600">{message}</p> : null}
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
