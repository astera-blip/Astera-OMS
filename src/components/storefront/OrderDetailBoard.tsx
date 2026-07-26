"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createCancellationRequest, getPendingCancellationRequestId } from "@/lib/order/cancellation";
import { loadCancellationRequests, loadOrders, saveCancellationRequests } from "@/lib/order/localStore";
import type { StoredOrderBundle } from "@/lib/order/localStore";

type Props = {
  orderId: string;
};

export function OrderDetailBoard({ orderId }: Props) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [bundles, setBundles] = useState<StoredOrderBundle[]>(() => loadOrders());
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadFirestoreOrder() {
      if (!user) {
        return;
      }

      const [{ db }, { listMemberOrders }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/order/repository"),
      ]);

      const next = await listMemberOrders(db, user.uid);
      setBundles(next);
    }

    void loadFirestoreOrder().catch(() => setMessage("無法讀取雲端訂單，先顯示本機資料。"));
  }, [user]);

  const order = useMemo(() => bundles.find((bundle) => bundle.order.id === orderId) ?? null, [bundles, orderId]);
  const existingRequest = useMemo(
    () => loadCancellationRequests().find((request) => request.orderId === orderId && request.memberUid === user?.uid) ?? null,
    [orderId, user?.uid],
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

    const next = [request, ...loadCancellationRequests().filter((item) => item.id !== request.id)];
    saveCancellationRequests(next);
    setMessage("已送出取消申請，等待 owner 審核。");

    try {
      const [{ db }, { saveCancellationRequest }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/order/repository"),
      ]);
      await saveCancellationRequest(db, request);
    } catch {
      setMessage("取消申請已暫存於本機，但 Firestore 同步失敗。");
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
                  disabled={!canCancel || !!existingRequest}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.snapshot.productName}</p>
                  <p className="mt-1 text-slate-600">
                    {item.snapshot.variantName} · {item.snapshot.sku} · qty {item.quantity}
                  </p>
                  <p className="mt-1 text-slate-500">狀態：{item.status}</p>
                  {!canCancel ? <p className="mt-1 text-xs text-amber-700">已付款項目請聯絡客服。</p> : null}
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
            只允許尚未付款的項目提出申請。已付款項目會保留在訂單內。
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
