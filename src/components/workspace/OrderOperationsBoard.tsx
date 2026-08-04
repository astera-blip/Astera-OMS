"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { reviewCancellationRequest } from "@/lib/order/cancellation";
import type { OrderBundle } from "@/lib/order/checkout";
import type { CancellationRequestRecord } from "@/lib/order/cancellation";

export function OrderOperationsBoard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderBundle[]>([]);
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequestRecord[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("等待資料載入。");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
  const [refundDates, setRefundDates] = useState<Record<string, string>>({});
  const [refundReferences, setRefundReferences] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadFirestoreData() {
      if (!user) {
        setOrders([]);
        setCancellationRequests([]);
        setStatus("idle");
        return;
      }

      setStatus("loading");
      const [{ auth, db }, { listAllOrders }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/order/repository"),
      ]);
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("missing_token");
      }
      const [nextOrders, cancellationResponse] = await Promise.all([
        listAllOrders(db),
        fetch("/api/workspace/cancellations", {
          headers: { authorization: `Bearer ${token}` },
        }),
      ]);
      if (!cancellationResponse.ok) {
        throw new Error("cancellation_list_failed");
      }
      const cancellationPayload = await cancellationResponse.json() as {
        requests?: CancellationRequestRecord[];
      };
      setOrders(nextOrders);
      setCancellationRequests(cancellationPayload.requests ?? []);
      setStatus("ready");
    }

    void loadFirestoreData().catch(() => {
      setStatus("error");
      setMessage("資料讀取失敗，請稍後再試。");
    });
  }, [user]);

  async function reviewRequest(
    requestId: string,
    status: "approved" | "rejected",
    reviewNote: string,
  ) {
    const current = cancellationRequests.find((item) => item.id === requestId);
    if (!current || !user) {
      return;
    }
    const trimmedReviewNote = reviewNote.trim();
    if (!trimmedReviewNote) {
      setMessage("請先填寫審核理由。");
      return;
    }
    const refundAmountTwd = Number(refundAmounts[requestId] ?? "");
    const refundCompletedAt = refundDates[requestId]?.trim() ?? "";
    const refundReference = refundReferences[requestId]?.trim() ?? "";
    if (
      status === "approved"
      && (!Number.isInteger(refundAmountTwd) || refundAmountTwd <= 0 || !refundCompletedAt || !refundReference)
    ) {
      setMessage("核准已付款取消時，請填寫退款日期、金額與參考資訊。");
      return;
    }

    const reviewed = reviewCancellationRequest(current, {
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: user.uid,
      reviewNote: trimmedReviewNote,
    });

    try {
      const { auth } = await import("@/lib/firebase/client");
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
        body: JSON.stringify({
          status,
          reviewNote: trimmedReviewNote,
          ...(status === "approved"
            ? { refundAmountTwd, refundCompletedAt, refundReference }
            : {}),
        }),
      });

      if (!response.ok) {
        throw new Error("review_failed");
      }
      const result = (await response.json()) as {
        orderStatus?: OrderBundle["order"]["status"];
        amountTwd?: number;
      };

      setCancellationRequests((currentRequests) =>
        currentRequests.map((item) => (item.id === requestId ? reviewed : item)),
      );
      setOrders((currentOrders) =>
        currentOrders.map((bundle) =>
          bundle.order.id === reviewed.orderId
            ? {
                order: {
                  ...bundle.order,
                  status: result.orderStatus ?? bundle.order.status,
                  totalTwd: result.amountTwd ?? bundle.order.totalTwd,
                },
                items: bundle.items.map((item) =>
                  reviewed.orderItemIds.includes(item.id)
                    ? {
                        ...item,
                        status: status === "approved" ? "cancelled" : "awaitingPayment",
                      }
                    : item,
                ),
              }
            : bundle,
        ),
      );
      setMessage(`已${status === "approved" ? "批准" : "拒絕"}取消申請。`);
    } catch {
      setMessage("審核送出失敗，請稍後再試。");
    }
  }

  if (!user) {
    return <OwnerOnlyMessage text="僅 owner 可查看與審核取消申請。" />;
  }

  if (status === "loading" || status === "idle") {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        訂單與取消申請載入中。
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm text-rose-700">
        資料讀取失敗，請稍後再試。
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          訂單管理
        </p>
        <h2 className="mt-2 text-2xl font-semibold">後台訂單管理</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          查看訂單明細、付款狀態與待處理項目。
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
                      {item.snapshot.variantName} · {item.snapshot.sku} · 數量 {item.quantity}
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
        <p className="mt-2 text-sm text-slate-600">{message}</p>
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
                <label className="mt-3 grid gap-2">
                  <span className="font-medium text-slate-700">審核理由</span>
                  <textarea
                    value={reviewNotes[request.id] ?? ""}
                    onChange={(event) =>
                      setReviewNotes((current) => ({ ...current, [request.id]: event.target.value }))
                    }
                    disabled={request.status !== "pending"}
                    className="min-h-20 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="例如：尚未付款，批准取消"
                  />
                </label>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="font-medium text-slate-700">退款日期</span>
                    <input
                      type="date"
                      value={refundDates[request.id] ?? ""}
                      onChange={(event) =>
                        setRefundDates((current) => ({ ...current, [request.id]: event.target.value }))
                      }
                      disabled={request.status !== "pending"}
                      className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-medium text-slate-700">退款金額</span>
                    <input
                      type="number"
                      min="1"
                      value={refundAmounts[request.id] ?? ""}
                      onChange={(event) =>
                        setRefundAmounts((current) => ({ ...current, [request.id]: event.target.value }))
                      }
                      disabled={request.status !== "pending"}
                      className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-medium text-slate-700">退款參考</span>
                    <input
                      value={refundReferences[request.id] ?? ""}
                      onChange={(event) =>
                        setRefundReferences((current) => ({ ...current, [request.id]: event.target.value }))
                      }
                      disabled={request.status !== "pending"}
                      className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder="銀行轉帳序號"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void reviewRequest(request.id, "approved", reviewNotes[request.id] ?? "")}
                    disabled={request.status !== "pending"}
                    className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-medium text-white"
                  >
                    批准
                  </button>
                  <button
                    type="button"
                    onClick={() => void reviewRequest(request.id, "rejected", reviewNotes[request.id] ?? "")}
                    disabled={request.status !== "pending"}
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

function OwnerOnlyMessage({ text }: { text: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">需要 owner 權限</h2>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </section>
  );
}
