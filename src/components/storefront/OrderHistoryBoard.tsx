"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { loadOrders, type StoredOrderBundle } from "@/lib/order/localStore";

export function OrderHistoryBoard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<StoredOrderBundle[]>(() => loadOrders());

  useEffect(() => {
    async function loadFirestoreOrders() {
      if (!user) {
        return;
      }

      const [{ db }, { listMemberOrders }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/order/repository"),
      ]);
      setOrders(await listMemberOrders(db, user.uid));
    }

    void loadFirestoreOrders();
  }, [user]);

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
                <h2 className="text-xl font-semibold">{bundle.order.id}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  狀態：{bundle.order.status} · 總額：NT$ {bundle.order.totalTwd.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  收件人：{bundle.order.recipientName ?? "未填寫"} · {bundle.order.shippingMethod ?? "未選擇"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">{bundle.order.createdAt}</p>
                <Link href={`/orders/${bundle.order.id}`} className="mt-2 inline-flex text-sm font-medium text-amber-700">
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
