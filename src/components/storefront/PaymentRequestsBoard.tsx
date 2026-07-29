"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";
import { paymentRequestStatusLabel } from "@/lib/storefront/customerLabels";

export function PaymentRequestsBoard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LocalPaymentRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [amount, setAmount] = useState("");
  const [last5, setLast5] = useState("");
  const [payerName, setPayerName] = useState("");
  const [memberNote, setMemberNote] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    try {
      const [{ db }, { listMemberPaymentRequests }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/payment/repository"),
      ]);
      const nextRequests = await listMemberPaymentRequests(db, user.uid);
      setRequests(nextRequests);
      setSelectedRequestId(nextRequests[0]?.id ?? "");
      setAmount(nextRequests[0] ? String(nextRequests[0].amountTwd) : "");
      setStatus("ready");
    } catch {
      setRequests([]);
      setStatus("error");
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRequests();
    });
  }, [loadRequests]);

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        請先登入，才能查看自己的付款請求。
      </div>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        付款請求載入中。
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
        <p role="alert">付款請求讀取失敗，請確認網路後再試一次。</p>
        <button
          type="button"
          onClick={() => void loadRequests()}
          className="mt-4 min-h-11 rounded-full border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100"
        >
          重新載入
        </button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">匯款回報</h2>
        <p className="mt-2 text-sm text-slate-600">目前沒有待付款資料。</p>
      </div>
    );
  }

  async function reportPayment() {
    if (!user || !selectedRequestId) {
      setMessage("請先選擇付款請求。");
      return;
    }

    if (isSubmitting) {
      return;
    }

    const receivedAmountTwd = Number(amount);
    if (!receivedAt || !Number.isInteger(receivedAmountTwd) || receivedAmountTwd <= 0 || !/^[0-9]{5}$/.test(last5) || !payerName.trim()) {
      setMessage("請填寫日期、金額、帳號末五碼與匯款人。");
      return;
    }

    try {
      setIsSubmitting(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentRequestId: selectedRequestId,
          receivedAt,
          receivedAmountTwd,
          transferAccountLast5: last5,
          payerName: payerName.trim(),
          memberNote: memberNote.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("report_failed");
      }

      setMessage("已送出付款回報，等待客服對帳確認。");
      setLast5("");
      setPayerName("");
      setMemberNote("");
    } catch {
      setMessage("付款回報送出失敗，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">匯款回報</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">付款請求</span>
            <select
              value={selectedRequestId}
              onChange={(event) => {
                const request = requests.find((item) => item.id === event.target.value);
                setSelectedRequestId(event.target.value);
                setAmount(request ? String(request.amountTwd) : "");
              }}
              className="rounded-2xl border border-slate-300 px-4 py-3"
            >
              {requests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.id} / NT$ {request.amountTwd.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">匯款日期</span>
            <input
              type="date"
              value={receivedAt}
              onChange={(event) => setReceivedAt(event.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-3"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">匯款金額</span>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-3"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">帳號末五碼</span>
            <input
              inputMode="numeric"
              maxLength={5}
              value={last5}
              onChange={(event) => setLast5(event.target.value.replace(/\D/g, "").slice(0, 5))}
              className="rounded-2xl border border-slate-300 px-4 py-3"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">匯款人</span>
            <input
              value={payerName}
              onChange={(event) => setPayerName(event.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-3"
            />
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            <span className="font-medium">備註</span>
            <textarea
              value={memberNote}
              onChange={(event) => setMemberNote(event.target.value)}
              className="min-h-20 rounded-2xl border border-slate-300 px-4 py-3"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void reportPayment()}
          disabled={isSubmitting}
          className="mt-4 min-h-11 rounded-full bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "送出中…" : "送出付款回報"}
        </button>
        {message ? <p aria-live="polite" className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </div>
      {requests.map((request) => (
          <article key={request.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{request.id}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  訂單：{request.orderId} · 狀態：{paymentRequestStatusLabel(request.status)}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                銀行匯款
              </span>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <p>應付金額：NT$ {request.amountTwd.toLocaleString()}</p>
              <p>付款方式：銀行匯款</p>
              <p>建立時間：{request.createdAt}</p>
            </div>
          </article>
        ))}
    </section>
  );
}
