"use client";

import { useEffect, useState } from "react";
import { loadOrderItems, loadOrders, type OrderAdminRecord } from "@/lib/order/adminRepository";

export default function WorkspaceOrdersPage() {
  const [orders, setOrders] = useState<OrderAdminRecord[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>();
  const [items, setItems] = useState<Awaited<ReturnType<typeof loadOrderItems>>>([]);

  useEffect(() => {
    let active = true;

    void import("@/lib/firebase/client")
      .then(({ db }) => loadOrders(db))
      .then((items) => {
        if (active) {
          setOrders(items);
          setSelectedOrderId((current) => current ?? items[0]?.id);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!selectedOrderId) {
      return;
    }

    void import("@/lib/firebase/client")
      .then(({ db }) => loadOrderItems(db, selectedOrderId))
      .then((loaded) => {
        if (active) {
          setItems(loaded);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedOrderId]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Orders</h1>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Order list</h2>
            <div className="mt-4 grid gap-3">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    selectedOrderId === order.id
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{order.id}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {order.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">NT$ {order.totalTwd.toLocaleString("zh-TW")}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Order items</h2>
            <div className="mt-4 grid gap-3">
              {items.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">沒有可顯示的訂單項目。</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold">{item.snapshot.productName}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.snapshot.variantName} · {item.snapshot.sku}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      數量 {item.quantity} · NT$ {item.snapshot.unitPriceTwd.toLocaleString("zh-TW")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
