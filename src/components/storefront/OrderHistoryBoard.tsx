"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import type { OrderBundle } from "@/lib/order/checkout";
import { orderStatusLabel, shippingMethodLabel } from "@/lib/storefront/customerLabels";

export function OrderHistoryBoard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderBundle[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const loadOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    try {
      const [{ db }, { listMemberOrders }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/order/repository"),
      ]);
      const next = await listMemberOrders(db, user.uid);
      setOrders(next);
      setStatus("ready");
    } catch {
      setOrders([]);
      setStatus("error");
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOrders();
    });
  }, [loadOrders]);

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
          onClick={() => void loadOrders()}
          className="mt-4 min-h-11 rounded-full border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100"
        >
          重新載入
        </button>
      </div>
    );
  }

  return (
    <section className="grid gap-4">
      {orders.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          還沒有建立任何訂單。
        </div>
      ) : (
        orders.map((bundle) => (
          <article key={bundle.order.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{bundle.order.orderNumber ?? bundle.order.id}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  狀態：{orderStatusLabel(bundle.order.status)} · 總額：NT$ {bundle.order.totalTwd.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  收件人：{bundle.order.recipientName ?? "未填寫"} · {shippingMethodLabel(bundle.order.shippingMethod)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">{bundle.order.createdAt}</p>
                <Link href={`/orders/${bundle.order.id}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-amber-700">
                  查看詳情
                </Link>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              {bundle.items.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-medium">{item.snapshot.productName}</p>
                  <p className="mt-1 text-slate-600">
                    {item.snapshot.variantName} · {item.snapshot.sku} · NT$ {item.snapshot.unitPriceTwd.toLocaleString()}
                  </p>
                  {item.snapshot.publicSaleNotes ? (
                    <p className="mt-1 text-slate-500">備註：{item.snapshot.publicSaleNotes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
