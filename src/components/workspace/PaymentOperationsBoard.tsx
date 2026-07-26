"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { StoredOrderBundle } from "@/lib/order/localStore";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";

export function PaymentOperationsBoard() {
  const { role } = useAuth();
  const [orders, setOrders] = useState<StoredOrderBundle[]>([]);
  const [requests, setRequests] = useState<LocalPaymentRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("等待付款確認。");

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  useEffect(() => {
    async function loadFirestoreData() {
      if (role !== "owner") {
        setOrders([]);
        setRequests([]);
        setStatus("idle");
        return;
      }

      setStatus("loading");
      const [{ db }, { listAllOrders }, { listAllPaymentRequests }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/order/repository"),
        import("@/lib/payment/repository"),
      ]);
      const [firestoreOrders, firestoreRequests] = await Promise.all([
        listAllOrders(db),
        listAllPaymentRequests(db),
      ]);

      setOrders(firestoreOrders);
      setRequests(firestoreRequests);
      setSelectedRequestId(firestoreRequests[0]?.id ?? "");
      setAmount(firestoreRequests[0] ? String(firestoreRequests[0].amountTwd) : "");
      setStatus("ready");
    }

    void loadFirestoreData().catch(() => {
      setOrders([]);
      setRequests([]);
      setStatus("error");
      setMessage("付款資料讀取失敗，請稍後再試。");
    });
  }, [role]);

  function selectRequest(request: LocalPaymentRequest) {
    setSelectedRequestId(request.id);
    setAmount(String(request.amountTwd));
    setReason("");
    setMessage(`已選擇 ${request.id}。`);
  }

  if (role !== "owner") {
    return <OwnerOnlyMessage text="僅 owner 可確認付款。" />;
  }

  async function confirmSelectedRequest() {
    if (!selectedRequest) {
      setMessage("請先選擇付款請求。");
      return;
    }

    const orderBundle = orders.find((order) => order.order.id === selectedRequest.orderId);
    if (!orderBundle) {
      setMessage("找不到對應訂單。");
      return;
    }

    if (!reason.trim()) {
      setMessage("請填寫確認理由。");
      return;
    }

    const receivedAmountTwd = Number(amount);
    if (!Number.isInteger(receivedAmountTwd) || receivedAmountTwd <= 0) {
      setMessage("請輸入有效付款金額。");
      return;
    }

    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setMessage("請重新登入後再確認付款。");
        return;
      }

      const receivedAt = new Date().toISOString();
      const response = await fetch(`/api/workspace/payments/${selectedRequest.id}/confirm`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receivedAmountTwd,
          receivedAt,
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("confirm_failed");
      }

      const nextRequestStatus = receivedAmountTwd >= selectedRequest.amountTwd ? "paid" : "partiallyPaid";
      const nextOrderStatus = receivedAmountTwd >= selectedRequest.amountTwd ? "paid" : "partiallyPaid";
      setRequests((current) =>
        current.map((request) =>
          request.id === selectedRequest.id
            ? { ...request, status: nextRequestStatus, updatedAt: receivedAt }
            : request,
        ),
      );
      setOrders((current) =>
        current.map((bundle) =>
          bundle.order.id === orderBundle.order.id
            ? {
                order: { ...bundle.order, status: nextOrderStatus, updatedAt: receivedAt },
                items: bundle.items.map((item) =>
                  item.status === "cancelled" ? item : { ...item, status: nextOrderStatus === "paid" ? "paid" : "awaitingPayment" },
                ),
              }
            : bundle,
        ),
      );
      setMessage(`已確認 ${selectedRequest.id}，並建立付款與稽核紀錄。`);
    } catch {
      setMessage("付款確認失敗，請稍後再試。");
    }
  }

  if (status === "loading" || status === "idle") {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        付款資料載入中。
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
        付款資料讀取失敗，請稍後再試。
      </section>
    );
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Phase 4
          </p>
          <h2 className="mt-2 text-2xl font-semibold">手動匯款確認</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            付款請求、實收款、分配與稽核紀錄會分開保存，不用單一 paid flag。
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            目前沒有付款請求。
          </div>
        ) : (
          requests.map((request) => (
            <button
              key={request.id}
              type="button"
              onClick={() => selectRequest(request)}
              className={[
                "rounded-3xl border p-5 text-left shadow-sm transition-colors",
                selectedRequestId === request.id
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-300",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{request.id}</p>
                  <p className="mt-1 text-sm opacity-80">
                    {request.orderId} · {request.memberUid}
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                  {request.status}
                </span>
              </div>
              <p className="mt-4 text-sm">應收 NT$ {request.amountTwd.toLocaleString()}</p>
            </button>
          ))
        )}
      </div>

      <aside className="grid gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">確認付款</h3>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">實收金額</span>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="rounded-2xl border border-slate-300 px-4 py-3"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">確認理由</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-24 rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="例如：對帳末五碼 12345"
              />
            </label>
            <button
              type="button"
              onClick={() => void confirmSelectedRequest()}
              className="rounded-full bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              確認匯款
            </button>
            <p className="text-sm leading-6 text-slate-600">{message}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Ledger</h3>
          <div className="mt-4 grid gap-2 text-sm text-slate-600">
            <p>Orders：{orders.length}</p>
            <p>Payment requests：{requests.length}</p>
            <p>資料來源：Firestore / API</p>
          </div>
        </div>
      </aside>
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
