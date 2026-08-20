"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  isOwnerEmailNotification,
  isOwnerJobFailureNotification,
} from "@/lib/notification/events";
import type {
  DuplicateAccountNotificationOutcome,
  OwnerDuplicateNotificationSnapshot,
  OwnerEmailNotificationSnapshot,
  OwnerNotificationSnapshot,
} from "@/lib/notification/events";
import type { OrderBundle } from "@/lib/order/checkout";
import { getPaymentAccountLast5 } from "@/lib/payment/manualBankTransfer";
import type { LocalPayment, LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";
import {
  formatOperationsOrderReference,
  formatOperationsRecipientName,
  paymentReviewStatusLabel,
} from "@/lib/workspace/operationsPresentation";

export function PaymentOperationsBoard() {
  const { role } = useAuth();
  const [orders, setOrders] = useState<OrderBundle[]>([]);
  const [requests, setRequests] = useState<LocalPaymentRequest[]>([]);
  const [payments, setPayments] = useState<LocalPayment[]>([]);
  const [notificationEvents, setNotificationEvents] = useState<OwnerNotificationSnapshot[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("等待付款確認。");
  const [activeAction, setActiveAction] = useState<"confirm" | "reverse" | "reject" | null>(null);

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
  const pendingPayments = useMemo(
    () => payments.filter((payment) => payment.status === "pendingReview"),
    [payments],
  );
  const rejectedPayments = useMemo(
    () => payments.filter((payment) => payment.status === "rejected"),
    [payments],
  );
  const historicalPayments = useMemo(
    () => payments.filter((payment) => payment.status === "confirmed" || payment.status === "reversed"),
    [payments],
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
      const [{ auth, db }, { listAllOrders }, { listAllPaymentRequests, listAllPayments }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/order/repository"),
        import("@/lib/payment/repository"),
      ]);
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("missing_token");
      }
      const [firestoreOrders, firestoreRequests, firestorePayments, notificationResponse] = await Promise.all([
        listAllOrders(db),
        listAllPaymentRequests(db),
        listAllPayments(db),
        fetch("/api/workspace/notifications", {
          headers: { authorization: `Bearer ${token}` },
        }),
      ]);
      if (!notificationResponse.ok) {
        throw new Error("notification_list_failed");
      }
      const notificationPayload = await notificationResponse.json() as {
        notifications?: OwnerNotificationSnapshot[];
      };

      setOrders(firestoreOrders);
      setRequests(firestoreRequests);
      setPayments(firestorePayments);
      setNotificationEvents(notificationPayload.notifications ?? []);
      setSelectedPaymentId(firestorePayments.find((payment) => payment.status === "pendingReview")?.id ?? "");
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
    const request = requests.find((item) => item.id === payment.paymentRequestId);
    const order = request ? orders.find((item) => item.order.id === request.orderId)?.order : undefined;
    setMessage(`已選擇${order ? ` ${formatOperationsOrderReference(order)}` : "這筆付款回報"}。`);
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
      setMessage(`已確認 ${formatOperationsOrderReference(orderBundle.order)} 的付款回報，並建立分配與稽核紀錄。`);
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
      setMessage("已撤銷付款確認，並建立負向調整與稽核紀錄。");
    } catch {
      setMessage("付款撤銷失敗，請稍後再試。");
    }
  }

  async function rejectSelectedPayment() {
    if (!selectedPayment || selectedPayment.status !== "pendingReview") {
      setMessage("請先選擇待審付款回報。");
      return;
    }
    if (!reason.trim()) {
      setMessage("請填寫拒絕理由。");
      return;
    }

    setActiveAction("reject");
    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setMessage("請重新登入後再拒絕付款回報。");
        return;
      }
      const response = await fetch(`/api/workspace/payments/${selectedPayment.id}/reject`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!response.ok) {
        throw new Error("reject_failed");
      }
      const nextPendingPayment = payments.find(
        (payment) => payment.id !== selectedPayment.id && payment.status === "pendingReview",
      );
      setPayments((current) => current.map((payment) => (
        payment.id === selectedPayment.id
          ? {
              ...payment,
              status: "rejected",
              adminNote: reason.trim(),
              updatedAt: new Date().toISOString(),
            }
          : payment
      )));
      setSelectedPaymentId(nextPendingPayment?.id ?? "");
      setMessage("已拒絕付款回報，並建立稽核紀錄。");
      setReason("");
    } catch {
      setMessage("拒絕付款回報失敗，請稍後再試。");
    } finally {
      setActiveAction(null);
    }
  }

  async function retryNotification(event: OwnerEmailNotificationSnapshot) {
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

      const payload = (await response.json().catch(() => null)) as {
        status?: "pending" | "sent" | "failed";
        attemptCount?: number;
        error?: string;
      } | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "retry_failed");
      }

      setNotificationEvents((current) =>
        current.map((item) => {
          if (item.id !== event.id || !isOwnerEmailNotification(item)) {
            return item;
          }
          return {
            ...item,
            status: payload.status ?? item.status,
            attemptCount: payload.attemptCount ?? item.attemptCount,
          };
        }),
      );
      setMessage(
        payload.status === "sent"
          ? "通知已送出。"
          : "通知尚未送出，請確認寄送設定。",
      );
    } catch {
      setMessage("通知重試失敗，請稍後再試。");
    }
  }

  async function reviewDuplicateNotification(
    eventId: string,
    outcome: DuplicateAccountNotificationOutcome,
  ) {
    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setMessage("請重新登入後再處理帳戶提醒。");
        return;
      }
      const response = await fetch(`/api/workspace/notifications/${eventId}/retry`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ outcome }),
      });
      if (!response.ok) {
        throw new Error("duplicate_review_failed");
      }
      const payload = await response.json() as OwnerNotificationSnapshot;
      setNotificationEvents((current) =>
        current.map((event) => event.id === eventId ? payload : event));
      setMessage(
        outcome === "confirmedDuplicate"
          ? "已記錄為重複帳戶；帳戶狀態未自動變更。"
          : "已記錄為不同帳戶。",
      );
    } catch {
      setMessage("帳戶提醒處理失敗，請稍後再試。");
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

  function renderPaymentCard(payment: LocalPayment) {
    const request = requests.find((item) => item.id === payment.paymentRequestId);
    const order = request ? orders.find((item) => item.order.id === request.orderId)?.order : undefined;

    return (
      <button
        key={payment.id}
        type="button"
        onClick={() => selectPayment(payment)}
        className={[
          "w-full min-w-0 rounded-3xl border p-5 text-left shadow-sm transition-colors",
          selectedPaymentId === payment.id
            ? "border-slate-950 bg-slate-950 text-white"
            : "border-slate-200 bg-white text-slate-900 hover:border-slate-300",
        ].join(" ")}
      >
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold">
              {order ? formatOperationsOrderReference(order) : "歷史付款回報"}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {order ? formatOperationsRecipientName(order.recipientName) : "找不到對應訂單"}
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
            {paymentReviewStatusLabel(payment.status)}
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
          末五碼 {getPaymentAccountLast5(payment) ?? "未填"} · 匯款人 {payment.payerName ?? "未填"}
        </p>
      </button>
    );
  }

  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            付款管理
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
          <>
            <div className="grid gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                <h3 className="text-lg font-semibold">待確認</h3>
                <span className="text-sm text-slate-500">{pendingPayments.length} 筆</span>
              </div>
              {pendingPayments.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
                  目前沒有待確認付款。
                </div>
              ) : pendingPayments.map(renderPaymentCard)}
            </div>

            <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer list-none text-lg font-semibold">
                已拒絕（{rejectedPayments.length}）
              </summary>
              <div className="mt-4 grid gap-3">
                {rejectedPayments.length === 0 ? (
                  <p className="text-sm text-slate-600">目前沒有已拒絕付款。</p>
                ) : rejectedPayments.map(renderPaymentCard)}
              </div>
            </details>

            {historicalPayments.length > 0 ? (
              <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer list-none text-lg font-semibold">
                  已處理紀錄（{historicalPayments.length}）
                </summary>
                <div className="mt-4 grid gap-3">{historicalPayments.map(renderPaymentCard)}</div>
              </details>
            ) : null}
          </>
        )}
      </div>

      <aside className="grid min-w-0 gap-4">
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
              <span className="font-medium">處理理由</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-24 rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="例如：對帳末五碼相符，或重複付款回報"
              />
            </label>
            <button
              type="button"
              onClick={() => void confirmSelectedRequest()}
              disabled={selectedPayment?.status !== "pendingReview" || activeAction !== null}
              className="rounded-full bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              確認匯款
            </button>
            <button
              type="button"
              onClick={() => void rejectSelectedPayment()}
              disabled={selectedPayment?.status !== "pendingReview" || activeAction !== null}
              className="rounded-full border border-rose-300 px-4 py-3 text-sm font-semibold text-rose-700 disabled:border-slate-200 disabled:text-slate-400"
            >
              {activeAction === "reject" ? "拒絕中…" : "拒絕回報"}
            </button>
            <button
              type="button"
              onClick={() => void reverseSelectedPayment()}
              disabled={selectedPayment?.status !== "confirmed" || activeAction !== null}
              className="rounded-full border border-rose-300 px-4 py-3 text-sm font-semibold text-rose-700 disabled:border-slate-200 disabled:text-slate-400"
            >
              撤銷確認
            </button>
            <p role="status" aria-live="polite" className="text-sm leading-6 text-slate-600">{message}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">營運統計</h3>
          <div className="mt-4 grid gap-2 text-sm text-slate-600">
            <p>訂單：{orders.length}</p>
            <p>付款請求：{requests.length}</p>
            <p>付款回報：{payments.length}</p>
            <p>未分配超額：NT$ {totalUnallocatedAmountTwd.toLocaleString()}</p>
            <p>付款與訂單狀態會以系統紀錄為準。</p>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h3 className="text-lg font-semibold">超額待處理</h3>
          {overpaidRequests.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">目前沒有未分配超額。</p>
          ) : (
            <div className="mt-4 grid gap-3 text-sm">
              {overpaidRequests.map((request) => {
                const order = orders.find((bundle) => bundle.order.id === request.orderId)?.order;
                return (
                <div key={request.id} className="rounded-2xl bg-white p-3">
                  <p className="font-semibold">
                    {order ? formatOperationsOrderReference(order) : "歷史付款請求"}
                  </p>
                  <p className="mt-1 text-slate-600">
                    {order ? formatOperationsRecipientName(order.recipientName) : "找不到對應訂單"}
                  </p>
                  <p className="mt-1 text-amber-700">
                    未分配 NT$ {(request.unallocatedAmountTwd ?? 0).toLocaleString()}；需人工銀行退款。
                  </p>
                </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">營運與 Email 通知</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            訂單與付款交易會先成立；Email 失敗只更新通知狀態，不回滾交易。
          </p>
          {notificationEvents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">目前沒有通知事件。</p>
          ) : (
            <div className="mt-4 grid gap-3 text-sm">
              {notificationEvents.map((event) => {
                if (isOwnerJobFailureNotification(event)) {
                  return (
                    <div key={event.id} className="rounded-2xl bg-rose-50 p-3">
                      <p className="font-semibold text-rose-800">排程工作失敗</p>
                      <p className="mt-1 text-slate-700">
                        {event.job === "refundAccountCleanup" ? "退款帳號到期清理" : "指紋金鑰月報"}
                        {" · "}
                        {event.project}
                      </p>
                      <p className="mt-1 text-rose-700">
                        代碼 {event.errorCode}；不提供 Email 重試，請檢查排程與監控告警。
                      </p>
                    </div>
                  );
                }
                if (isDuplicateNotification(event)) {
                  return (
                    <div key={event.id} className="rounded-2xl bg-amber-100 p-3">
                      <p className="font-semibold">可能重複匯款帳戶</p>
                      <p className="mt-1 text-slate-700">
                        銀行 {event.bankCode} · 末五碼 {event.accountNumberLast5}
                      </p>
                      <p className="mt-1 text-slate-600">
                        涉及 {event.accountIds.length} 筆會員帳戶，請確認是否為同一匯款來源。
                      </p>
                      {event.status === "pendingReview" ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void reviewDuplicateNotification(event.id, "confirmedDifferent")}
                            className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                          >
                            確認為不同帳戶
                          </button>
                          <button
                            type="button"
                            onClick={() => void reviewDuplicateNotification(event.id, "confirmedDuplicate")}
                            className="rounded-full border border-amber-400 bg-white px-3 py-2 text-xs font-medium"
                          >
                            確認為重複帳戶
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs font-medium text-amber-800">
                          {event.status === "confirmedDuplicate" ? "已確認重複" : "已確認不同"}
                        </p>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={event.id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="font-semibold">
                      {event.type === "order.created" ? "訂單成立通知" : "付款確認通知"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {event.status === "pending"
                        ? "等待寄送"
                        : event.status === "sent"
                          ? "已寄送"
                          : "寄送失敗"}
                      {" · 嘗試次數 "}
                      {event.attemptCount}
                      {" · "}
                      {event.recipientEmail}
                    </p>
                    {event.deliveryIssue ? (
                      <p className="mt-1 text-rose-700">寄送失敗，詳細資訊僅保留於伺服器紀錄。</p>
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
                );
              })}
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

function isDuplicateNotification(
  event: OwnerNotificationSnapshot,
): event is OwnerDuplicateNotificationSnapshot {
  return event.type === "memberPaymentAccount.exactDuplicate"
    || event.type === "memberPaymentAccount.last5Collision";
}
