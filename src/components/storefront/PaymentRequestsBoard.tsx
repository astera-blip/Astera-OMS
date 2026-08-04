"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";
import type { PublicPaymentAccount } from "@/lib/payment/bankAccounts";
import {
  isMemberPaymentAccountUsableForPayment,
  type PublicMemberPaymentAccount,
} from "@/lib/payment/memberBankAccounts";
import { paymentRequestStatusLabel } from "@/lib/storefront/customerLabels";

export function PaymentRequestsBoard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LocalPaymentRequest[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PublicPaymentAccount[]>([]);
  const [selectedPaymentAccountId, setSelectedPaymentAccountId] = useState("");
  const [memberPaymentAccounts, setMemberPaymentAccounts] = useState<PublicMemberPaymentAccount[]>([]);
  const [selectedMemberPaymentAccountId, setSelectedMemberPaymentAccountId] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
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
      const token = await user.getIdToken();
      const [accountsResponse, memberAccountsResponse] = await Promise.all([
        fetch("/api/payment-accounts", {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch("/api/member/payment-accounts", {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);
      const accountsPayload = accountsResponse.ok
        ? await accountsResponse.json() as { accounts?: PublicPaymentAccount[] }
        : { accounts: [] };
      const memberAccountsPayload = memberAccountsResponse.ok
        ? await memberAccountsResponse.json() as { accounts?: PublicMemberPaymentAccount[] }
        : { accounts: [] };
      const nextAccounts = Array.isArray(accountsPayload.accounts) ? accountsPayload.accounts : [];
      const nextMemberAccounts = Array.isArray(memberAccountsPayload.accounts)
        ? memberAccountsPayload.accounts.filter(isMemberPaymentAccountUsableForPayment)
        : [];
      setRequests(nextRequests);
      setPaymentAccounts(nextAccounts);
      setSelectedPaymentAccountId(nextAccounts[0]?.id ?? "");
      setMemberPaymentAccounts(nextMemberAccounts);
      setSelectedMemberPaymentAccountId(nextMemberAccounts[0]?.id ?? "");
      setLast5(nextMemberAccounts[0]?.accountNumberLast5 ?? "");
      const firstRequest = nextRequests.find((request) => request.status !== "paid" && request.status !== "cancelled");
      setSelectedRequestIds(firstRequest ? [firstRequest.id] : []);
      setAmount(firstRequest ? String(firstRequest.amountTwd - (firstRequest.allocatedAmountTwd ?? 0)) : "");
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
      <div className="rounded-xl border border-astera-border bg-astera-surface p-6">
        請先登入，才能查看自己的付款請求。
      </div>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div className="rounded-xl border border-astera-border bg-astera-surface p-6">
        付款請求載入中。
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <p role="alert">付款請求讀取失敗，請確認網路後再試一次。</p>
        <button
          type="button"
          onClick={() => void loadRequests()}
          className="mt-4 min-h-11 rounded-lg border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100"
        >
          重新載入
        </button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-astera-border bg-astera-surface p-6">
        <h2 className="text-xl font-semibold">匯款回報</h2>
        <p className="mt-2 text-sm text-astera-secondary">目前沒有待付款資料。</p>
      </div>
    );
  }

  async function reportPayment() {
    if (!user || selectedRequestIds.length === 0) {
      setMessage("請至少選擇一筆付款請求。");
      return;
    }

    if (isSubmitting) {
      return;
    }

    if (!selectedPaymentAccountId) {
      setMessage("請選擇實際匯入的 Astera 收款帳戶。");
      return;
    }
    if (!selectedMemberPaymentAccountId) {
      setMessage("請先在會員設定登記匯款帳戶，再送出付款回報。");
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
          paymentRequestIds: selectedRequestIds,
          receivedAt,
          receivedAmountTwd,
          receivingPaymentAccountId: selectedPaymentAccountId,
          memberPaymentAccountId: selectedMemberPaymentAccountId,
          payerName: payerName.trim(),
          memberNote: memberNote.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("report_failed");
      }

      setMessage(`已送出 ${selectedRequestIds.length} 筆付款回報，等待客服對帳確認。`);
      setSelectedRequestIds([]);
      setAmount("");
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
      <div className="rounded-xl border border-astera-border bg-astera-surface p-5">
        <h2 className="text-xl font-semibold">匯款回報</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <fieldset className="grid gap-2 text-sm md:col-span-2">
            <legend className="font-medium">付款請求（可複選）</legend>
            <div className="grid gap-2 rounded-lg border border-astera-border p-3">
              {requests.map((request) => {
                const disabled = request.status === "paid" || request.status === "cancelled";
                const checked = selectedRequestIds.includes(request.id);
                return (
                  <label key={request.id} className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 hover:bg-astera-page">
                    <input
                      type="checkbox"
                      name="paymentRequestIds"
                      value={request.id}
                      checked={checked}
                      disabled={disabled || isSubmitting}
                      onChange={(event) => {
                        const nextIds = event.target.checked
                          ? [...selectedRequestIds, request.id]
                          : selectedRequestIds.filter((id) => id !== request.id);
                        setSelectedRequestIds(nextIds);
                        const nextTotal = requests
                          .filter((item) => nextIds.includes(item.id))
                          .reduce((total, item) => total + item.amountTwd - (item.allocatedAmountTwd ?? 0), 0);
                        setAmount(nextTotal > 0 ? String(nextTotal) : "");
                      }}
                    />
                    <span>{request.orderId}／NT$ {request.amountTwd.toLocaleString()} · {paymentRequestStatusLabel(request.status)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <label className="grid gap-2 text-sm md:col-span-2">
            <span className="font-medium">匯入 Astera 的收款帳戶</span>
            {paymentAccounts.length > 0 ? (
              <select
                id="receiving-payment-account"
                name="receivingPaymentAccountId"
                value={selectedPaymentAccountId}
                onChange={(event) => setSelectedPaymentAccountId(event.target.value)}
                className="min-h-11 rounded-lg border border-astera-border px-4 py-3"
              >
                {paymentAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bankName}{account.branchName ? `／${account.branchName}` : ""} · {account.accountName} · 末五碼 {account.accountNumberLast5}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg bg-astera-page px-4 py-3 text-sm text-astera-secondary">
                目前尚未設定收款帳戶；請依客服提供的帳戶匯款，並在備註中註明。
              </p>
            )}
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            <span className="font-medium">匯出匯款的會員帳戶</span>
            {memberPaymentAccounts.length > 0 ? (
              <select
                id="member-payment-account"
                name="memberPaymentAccountId"
                value={selectedMemberPaymentAccountId}
                onChange={(event) => {
                  const selected = memberPaymentAccounts.find((account) => account.id === event.target.value);
                  setSelectedMemberPaymentAccountId(event.target.value);
                  setLast5(selected?.accountNumberLast5 ?? "");
                }}
                className="min-h-11 rounded-lg border border-astera-border px-4 py-3"
              >
                {memberPaymentAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    銀行代碼 {account.bankCode} · {account.accountNumberMasked}
                  </option>
                ))}
              </select>
            ) : (
              <a href="/account/bank-accounts" className="min-h-11 rounded-lg bg-astera-service/10 px-4 py-3 text-sm font-semibold text-astera-service underline">
                尚未登記匯款帳戶，請先新增自己的銀行帳戶。
              </a>
            )}
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">匯款日期</span>
            <input
              type="date"
              value={receivedAt}
              onChange={(event) => setReceivedAt(event.target.value)}
              className="min-h-11 rounded-lg border border-astera-border px-4 py-3"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">匯款金額</span>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="min-h-11 rounded-lg border border-astera-border px-4 py-3"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">匯款帳號末五碼</span>
            <input
              inputMode="numeric"
              maxLength={5}
              readOnly={memberPaymentAccounts.length > 0}
              value={last5}
              onChange={(event) => setLast5(event.target.value.replace(/\D/g, "").slice(0, 5))}
              className="min-h-11 rounded-lg border border-astera-border px-4 py-3"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">匯款人</span>
            <input
              value={payerName}
              onChange={(event) => setPayerName(event.target.value)}
              className="min-h-11 rounded-lg border border-astera-border px-4 py-3"
            />
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            <span className="font-medium">備註</span>
            <textarea
              value={memberNote}
              onChange={(event) => setMemberNote(event.target.value)}
              className="min-h-20 rounded-lg border border-astera-border px-4 py-3"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void reportPayment()}
          disabled={isSubmitting}
          className="mt-4 min-h-11 rounded-lg bg-astera-brand px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "送出中…" : "送出付款回報"}
        </button>
        {message ? <p role="status" aria-live="polite" className="mt-3 text-sm text-astera-service">{message}</p> : null}
      </div>
      {requests.map((request) => (
          <article key={request.id} className="rounded-xl border border-astera-border bg-astera-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{request.id}</h2>
                <p className="mt-1 text-sm text-astera-secondary">
                  訂單：{request.orderId} · 狀態：{paymentRequestStatusLabel(request.status)}
                </p>
              </div>
              <span className="rounded-full bg-astera-service/10 px-3 py-1 text-xs font-medium text-astera-service">
                銀行匯款
              </span>
            </div>
            <div className="mt-4 rounded-lg bg-astera-page p-4 text-sm leading-6 text-astera-ink">
              <p>應付金額：NT$ {request.amountTwd.toLocaleString()}</p>
              <p>付款方式：銀行匯款</p>
              <p>建立時間：{request.createdAt}</p>
            </div>
          </article>
        ))}
    </section>
  );
}
