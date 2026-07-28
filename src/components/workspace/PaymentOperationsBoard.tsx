"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { NotificationEvent } from "@/lib/notification/events";
import type { StoredOrderBundle } from "@/lib/order/localStore";
import type { LocalPayment, LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";

export function PaymentOperationsBoard() {
  const { role } = useAuth();
  const [orders, setOrders] = useState<StoredOrderBundle[]>([]);
  const [requests, setRequests] = useState<LocalPaymentRequest[]>([]);
  const [payments, setPayments] = useState<LocalPayment[]>([]);
  const [notificationEvents, setNotificationEvents] = useState<NotificationEvent[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("等待付款確認。");

  const selectedPayment = useMemo(
    () => payments.find((payment) => payment.id === selectedPaymentId) ?? null,
    [payments, selectedPaymentId],
  );
  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedPayment?.paymentRequestId) ?? null,
    [requests, selectedPayment],
  );
  const overpaidRequests = useMemo(
    () => requests.filter((request) => (request.unallocatedAmountTwd ?? 0) > 0),
    [requests],
  );
  const totalUnallocatedAmountTwd = useMemo(
    () => overpaidRequests.reduce((total, request) => total + (request.unallocatedAmountTwd ?? 0), 0),
    [overpaidRequests],
  );

  useEffect(() => {
    async function loadFirestoreData() {
      if (role !== "owner") {
        setOrders([]);
        setRequests([]);
        setPayments([]);
        setNotificationEvents([]);
        setStatus("idle");
        return;
      }

      setStatus("loading");
      const [{ collection, getDocs }, { db }, { listAllOrders }, { listAllPaymentRequests, listAllPayments }] = await Promise.all([
        import("firebase/firestore"),
        import("@/lib/firebase/client"),
        import("@/lib/order/repository"),
        import("@/lib/payment/repository"),
      ]);
      const [firestoreOrders, firestoreRequests, firestorePayments, notificationSnapshot] = await Promise.all([
        listAllOrders(db),
        listAllPaymentRequests(db),
        listAllPayments(db),
        getDocs(collection(db, "notificationEvents")),
      ]);

      setOrders(firestoreOrders);
      setRequests(firestoreRequests);
      setPayments(firestorePayments);
      setNotificationEvents(notificationSnapshot.docs.map((document) => document.data() as NotificationEvent));
      setSelectedPaymentId(firestorePayments.find((payment) => payment.status === "pendingReview")?.id ?? firestorePayments[0]?.id ?? "");
      setStatus("ready");
    }

    void loadFirestoreData().catch(() => {
      setOrders([]);
      setRequests([]);
      setNotificationEvents([]);
      setStatus("error");
      setMessage("付款資料讀取失敗，請稍後再試。");
    });
  }, [role]);

  function selectPayment(payment: LocalPayment) {
    setSelectedPaymentId(payment.id);
    setReason("");
    setMessage(`已選擇 ${payment.id}。`);
  }

  if (role !== "owner") {
    return <OwnerOnlyMessage text="僅 owner 可確認付款。" />;
  }

  async function confirmSelectedRequest() {
    if (!selectedPayment || !selectedRequest) {
      setMessage("請先選擇待審付款。");
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

    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setMessage("請重新登入後再確認付款。");
        return;
      }

      const response = await fetch(`/api/workspace/payments/${selectedPayment.id}/confirm`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("confirm_failed");
      }

      const receivedAt = selectedPayment.receivedAt;
      const nextRequestStatus = selectedPayment.receivedAmountTwd >= selectedRequest.amountTwd ? "paid" : "partiallyPaid";
      const nextOrderStatus = selectedPayment.receivedAmountTwd >= selectedRequest.amountTwd ? "paid" : "partiallyPaid";
      setPayments((current) =>
        current.map((payment) =>
          payment.id === selectedPayment.id
            ? { ...payment, status: "confirmed", adminNote: reason.trim(), updatedAt: receivedAt }
            : payment,
        ),
      );
      setRequests((current) =>
        current.map((request) =>
          request.id === selectedRequest.id
            ? {
                ...request,
                status: nextRequestStatus,
                unallocatedAmountTwd: Math.max(selectedPayment.receivedAmountTwd - selectedRequest.amountTwd, 0),
                updatedAt: receivedAt,
              }
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
      setMessage(`已確認 ${selectedPayment.id}，並建立分配與稽核紀錄。`);
    } catch {
      setMessage("付款確認失敗，請稍後再試。");
    }
  }

  async function reverseSelectedPayment() {
    if (!selectedPayment || selectedPayment.status !== "confirmed") {
      setMessage("請先選擇已確認付款。");
      return;
    }

    if (!reason.trim()) {
      setMessage("請填寫撤銷理由。");
      return;
    }

    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setMessage("請重新登入後再撤銷付款。");
        return;
      }

      const response = await fetch(`/api/workspace/payments/${selectedPayment.id}/reverse`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("reverse_failed");
      }

      setPayments((current) =>
        current.map((payment) =>
          payment.id === selectedPayment.id
            ? { ...payment, status: "reversed", adminNote: reason.trim(), updatedAt: new Date().toISOString() }
            : payment,
        ),
      );
      setRequests((current) =>
        current.map((request) =>
          request.id === selectedPayment.paymentRequestId
            ? { ...request, status: "open", unallocatedAmountTwd: 0, updatedAt: new Date().toISOString() }
            : request,
        ),
      );
      setMessage(`已撤銷 ${selectedPayment.id}，並建立負向 adjustment 與 audit log。`);
    } catch {
      setMessage("付款撤銷失敗，請稍後再試。");
    }
  }

  async function retryNotification(event: NotificationEvent) {
    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setMessage("請重新登入後再重試通知。");
        return;
      }

      const response = await fetch(`/api/workspace/notifications/${event.id}/retry`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });

      const payload = (await response.json().catch(() => null)) as Partial<NotificationEvent> & { error?: string } | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "retry_failed");
      }

      setNotificationEvents((current) =>
        current.map((item) =>
          item.id === event.id
            ? {
                ...item,
                status: payload.status ?? item.status,
                attemptCount: payload.attemptCount ?? item.attemptCount,
                ...(payload.providerMessageId ? { providerMessageId: payload.providerMessageId } : {}),
                ...(payload.lastError ? { lastError: payload.lastError } : {}),
              }
            : item,
        ),
      );
      setMessage(
        payload.status === "sent"
          ? `通知 ${event.id} 已送出。`
          : `通知 ${event.id} 尚未送出：${payload.lastError ?? "請確認 Resend 設定。"}`,
      );
    } catch {
      setMessage("通知重試失敗，請稍後再試。");
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
            會員先送出匯款回報，owner 只確認待審付款；分配與稽核紀錄會分開保存。
          </p>
        </div>

        {payments.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            目前沒有會員付款回報。
          </div>
        ) : (
          payments.map((payment) => {
            const request = requests.find((item) => item.id === payment.paymentRequestId);

            return (
            <button
              key={payment.id}
              type="button"
              onClick={() => selectPayment(payment)}
              className={[
                "rounded-3xl border p-5 text-left shadow-sm transition-colors",
                selectedPaymentId === payment.id
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-300",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{payment.id}</p>
                  <p className="mt-1 text-sm opacity-80">
                    {payment.paymentRequestId} · {payment.memberUid}
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                  {payment.status}
                </span>
              </div>
              <p className="mt-4 text-sm">
                回報 NT$ {payment.receivedAmountTwd.toLocaleString()} / 應收 NT$ {request?.amountTwd.toLocaleString() ?? "?"}
              </p>
              {(request?.unallocatedAmountTwd ?? 0) > 0 ? (
                <p className="mt-1 text-sm font-semibold text-amber-600">
                  未分配超額 NT$ {request?.unallocatedAmountTwd?.toLocaleString()}
                </p>
              ) : null}
              <p className="mt-1 text-sm opacity-80">
                末五碼 {payment.transferAccountLast5 ?? "未填"} · 匯款人 {payment.payerName ?? "未填"}
              </p>
            </button>
            );
          })
        )}
      </div>

      <aside className="grid gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">確認付款</h3>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">回報金額</span>
              <input
                value={selectedPayment ? `NT$ ${selectedPayment.receivedAmountTwd.toLocaleString()}` : "未選擇"}
                readOnly
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600"
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
              disabled={selectedPayment?.status !== "pendingReview"}
              className="rounded-full bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              確認匯款
            </button>
            <button
              type="button"
              onClick={() => void reverseSelectedPayment()}
              disabled={selectedPayment?.status !== "confirmed"}
              className="rounded-full border border-rose-300 px-4 py-3 text-sm font-semibold text-rose-700 disabled:border-slate-200 disabled:text-slate-400"
            >
              撤銷確認
            </button>
            <p className="text-sm leading-6 text-slate-600">{message}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Ledger</h3>
          <div className="mt-4 grid gap-2 text-sm text-slate-600">
            <p>Orders：{orders.length}</p>
            <p>Payment requests：{requests.length}</p>
            <p>Payment reports：{payments.length}</p>
            <p>未分配超額：NT$ {totalUnallocatedAmountTwd.toLocaleString()}</p>
            <p>資料來源：Firestore / API</p>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h3 className="text-lg font-semibold">超額待處理</h3>
          {overpaidRequests.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">目前沒有未分配超額。</p>
          ) : (
            <div className="mt-4 grid gap-3 text-sm">
              {overpaidRequests.map((request) => (
                <div key={request.id} className="rounded-2xl bg-white p-3">
                  <p className="font-semibold">{request.id}</p>
                  <p className="mt-1 text-slate-600">
                    {request.memberUid} · 訂單 {request.orderId}
                  </p>
                  <p className="mt-1 text-amber-700">
                    未分配 NT$ {(request.unallocatedAmountTwd ?? 0).toLocaleString()}；需人工銀行退款。
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Email 通知</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            訂單與付款交易會先成立；Email 失敗只更新通知狀態，不回滾交易。
          </p>
          {notificationEvents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">目前沒有通知事件。</p>
          ) : (
            <div className="mt-4 grid gap-3 text-sm">
              {notificationEvents.map((event) => (
                <div key={event.id} className="rounded-2xl bg-slate-50 p-3">
                  <p className="font-semibold">{event.type}</p>
                  <p className="mt-1 text-slate-600">
                    {event.status} · attempts {event.attemptCount} · {event.recipientEmail}
                  </p>
                  {event.lastError ? (
                    <p className="mt-1 text-rose-700">{event.lastError}</p>
                  ) : null}
                  {event.status !== "sent" ? (
                    <button
                      type="button"
                      onClick={() => void retryNotification(event)}
                      className="mt-3 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                    >
                      重試寄送
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
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
