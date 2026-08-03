"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { PublicMemberPaymentAccount } from "@/lib/payment/memberBankAccounts";

type ApiPayload = { accounts?: PublicMemberPaymentAccount[]; account?: PublicMemberPaymentAccount; error?: string };

export function MemberPaymentAccountRequestsBoard() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<PublicMemberPaymentAccount[]>([]);
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState("");

  const loadRequests = useCallback(async () => {
    if (!user) {
      return;
    }
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/workspace/member-payment-account-requests", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok) {
        throw new Error("讀取會員封存申請失敗。");
      }
      setAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
    } catch {
      setMessage("會員匯款帳戶申請讀取失敗，請重新載入。");
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => void loadRequests());
  }, [loadRequests]);

  async function approve(account: PublicMemberPaymentAccount) {
    if (!user || pendingId) {
      return;
    }
    setPendingId(account.id);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/workspace/member-payment-account-requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: account.id, approve: true }),
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.account) {
        throw new Error("核准失敗。");
      }
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setMessage("已核准封存，會員可重新新增帳戶。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "核准失敗，請稍後再試。");
    } finally {
      setPendingId("");
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">會員帳戶管理</p>
          <h2 className="mt-1 text-xl font-semibold">匯款帳戶封存申請</h2>
          <p className="mt-2 text-sm text-slate-600">核准後只會標記為已封存，不刪除帳戶或付款歷史。</p>
        </div>
        <button type="button" onClick={() => void loadRequests()} className="min-h-11 rounded-full border border-slate-300 px-4 text-sm font-semibold">重新載入</button>
      </div>
      {accounts.length === 0 ? <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">目前沒有待審核申請。</p> : (
        <div className="mt-5 grid gap-3">
          {accounts.map((account) => (
            <article key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
              <div>
                <h3 className="font-semibold">銀行代碼 {account.bankCode}</h3>
                <p className="mt-1 text-sm text-slate-600">{account.accountNumberMasked} · memberPaymentAccountId：{account.id}</p>
              </div>
              <button type="button" onClick={() => void approve(account)} disabled={Boolean(pendingId)} className="min-h-11 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
                {pendingId === account.id ? "處理中…" : "核准封存"}
              </button>
            </article>
          ))}
        </div>
      )}
      {message ? <p role="status" aria-live="polite" className="mt-4 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
