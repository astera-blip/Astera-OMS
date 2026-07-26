"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { reviewCancellationRequest } from "@/lib/order/cancellation";
import {
  loadCancellationRequests,
  loadOrders,
  saveCancellationRequests,
  type StoredOrderBundle,
} from "@/lib/order/localStore";

export function OrderOperationsBoard() {
  const { user } = useAuth();
  const [orders] = useState<StoredOrderBundle[]>(() => loadOrders());
  const [cancellationRequests, setCancellationRequests] = useState(() => loadCancellationRequests());

  async function reviewRequest(
    requestId: string,
    status: "approved" | "rejected",
    reviewNote: string,
  ) {
    const current = cancellationRequests.find((item) => item.id === requestId);
    if (!current || !user) {
      return;
    }

    const reviewed = reviewCancellationRequest(current, {
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: user.uid,
      reviewNote,
    });
    const next = cancellationRequests.map((item) => (item.id === requestId ? reviewed : item));
    setCancellationRequests(next);
    saveCancellationRequests(next);

    try {
      const [{ auth }] = await Promise.all([import("@/lib/firebase/client")]);
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        return;
      }

      const response = await fetch(`/api/workspace/cancellations/${requestId}/review`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, reviewNote }),
      });

      if (!response.ok) {
        throw new Error("review_failed");
      }
    } catch {
      // Keep the local decision; Firestore sync can be retried later.
    }
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Phase 4
        </p>
        <h2 className="mt-2 text-2xl font-semibold">後台訂單管理</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          後台可查看訂單容器、逐項 snapshot、付款狀態與待處理項目。
        </p>
      </div>

      <div className="grid gap-4">
        {orders.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            目前沒有訂單。
          </div>
        ) : (
          orders.map((bundle) => (
            <article key={bundle.order.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{bundle.order.id}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {bundle.order.memberUid} · {bundle.order.status} · NT$ {bundle.order.totalTwd.toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {bundle.items.length} items
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                {bundle.items.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <p className="font-medium">{item.snapshot.productName}</p>
                    <p className="mt-1 text-slate-600">
                      {item.snapshot.variantName} · {item.snapshot.sku} · qty {item.quantity}
                    </p>
                    <p className="mt-1 text-slate-500">狀態：{item.status}</p>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">取消申請</h3>
        <div className="mt-4 grid gap-3">
          {cancellationRequests.length === 0 ? (
            <p className="text-sm text-slate-600">目前沒有取消申請。</p>
          ) : (
            cancellationRequests.map((request) => (
              <div key={request.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="font-medium">{request.orderId}</p>
                <p className="mt-1 text-slate-600">
                  {request.memberUid} · {request.status} · {request.reason}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void reviewRequest(request.id, "approved", "owner approved")}
                    className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-medium text-white"
                  >
                    批准
                  </button>
                  <button
                    type="button"
                    onClick={() => void reviewRequest(request.id, "rejected", "owner rejected")}
                    className="rounded-full bg-rose-600 px-3 py-2 text-xs font-medium text-white"
                  >
                    拒絕
                  </button>
                </div>
                {request.reviewNote ? (
                  <p className="mt-2 text-slate-500">備註：{request.reviewNote}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
