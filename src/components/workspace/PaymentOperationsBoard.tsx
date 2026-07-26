"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  loadAuditLogs,
  loadOrders,
  loadPaymentAllocations,
  loadPaymentRequests,
  loadPayments,
  saveAuditLogs,
  saveOrders,
  savePaymentAllocations,
  savePaymentRequests,
  savePayments,
  type StoredOrderBundle,
} from "@/lib/order/localStore";
import {
  confirmBankTransfer,
  type LocalPaymentRequest,
} from "@/lib/payment/manualBankTransfer";
import { createPaymentConfirmedNotificationEvent } from "@/lib/notification/events";

export function PaymentOperationsBoard() {
  const { role } = useAuth();
  const [orders, setOrders] = useState<StoredOrderBundle[]>(() => loadOrders());
  const [requests, setRequests] = useState<LocalPaymentRequest[]>(() => loadPaymentRequests());
  const [payments, setPayments] = useState(() => loadPayments());
  const [allocations, setAllocations] = useState(() => loadPaymentAllocations());
  const [auditLogs, setAuditLogs] = useState(() => loadAuditLogs());
  const [selectedRequestId, setSelectedRequestId] = useState(requests[0]?.id ?? "");
  const [amount, setAmount] = useState(requests[0] ? String(requests[0].amountTwd) : "");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("等待付款確認。");

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  useEffect(() => {
    async function loadFirestoreRequests() {
      if (role !== "owner") {
        return;
      }

      const [{ db }, { listAllPaymentRequests }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/payment/repository"),
      ]);
      const firestoreRequests = await listAllPaymentRequests(db);

      if (firestoreRequests.length > 0) {
        setRequests(firestoreRequests);
        setSelectedRequestId(firestoreRequests[0].id);
        setAmount(String(firestoreRequests[0].amountTwd));
      }
    }

    void loadFirestoreRequests();
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

    const result = confirmBankTransfer({
      orderBundle,
      paymentRequest: selectedRequest,
      receivedAmountTwd,
      receivedAt: new Date().toISOString(),
      confirmedBy: "owner-local",
      reason: reason.trim(),
    });
    const notificationEvent = createPaymentConfirmedNotificationEvent({
      id: `notif_${result.payment.id}`,
      memberUid: result.paymentRequest.memberUid,
      orderId: result.paymentRequest.orderId,
      paymentRequestId: result.paymentRequest.id,
      paymentId: result.payment.id,
      createdAt: result.payment.createdAt,
    });
    const nextOrders = orders.map((bundle) =>
      bundle.order.id === result.orderBundle.order.id ? result.orderBundle : bundle,
    );
    const nextRequests = requests.map((request) =>
      request.id === result.paymentRequest.id ? result.paymentRequest : request,
    );
    const nextPayments = [result.payment, ...payments];
    const nextAllocations = [result.allocation, ...allocations];
    const nextAuditLogs = [result.auditLog, ...auditLogs];

    setOrders(nextOrders);
    setRequests(nextRequests);
    setPayments(nextPayments);
    setAllocations(nextAllocations);
    setAuditLogs(nextAuditLogs);
    saveOrders(nextOrders);
    savePaymentRequests(nextRequests);
    savePayments(nextPayments);
    savePaymentAllocations(nextAllocations);
    saveAuditLogs(nextAuditLogs);
    if (role === "owner") {
      try {
        const [{ db }, { confirmPaymentBundle }] = await Promise.all([
          import("@/lib/firebase/client"),
          import("@/lib/payment/repository"),
        ]);
        await confirmPaymentBundle(db, {
          orderBundle: result.orderBundle,
          paymentRequest: result.paymentRequest,
          payment: result.payment,
          allocation: result.allocation,
          auditLog: result.auditLog,
          notificationEvent,
        });
      } catch {
        setMessage("付款已暫存於本機，但 Firestore 確認失敗。");
        return;
      }
    }
    setMessage(`已確認 ${selectedRequest.id}，並建立付款與稽核紀錄。`);
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
            <p>Payments：{payments.length}</p>
            <p>Allocations：{allocations.length}</p>
            <p>Audit logs：{auditLogs.length}</p>
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
