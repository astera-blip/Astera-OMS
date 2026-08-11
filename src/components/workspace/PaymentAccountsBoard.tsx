"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { PaymentAccount } from "@/lib/payment/bankAccounts";

export function PaymentAccountsBoard() {
  const { role } = useAuth();
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [bankName, setBankName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumberLast5, setAccountNumberLast5] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAccounts = useCallback(async () => {
    if (role !== "owner") {
      setAccounts([]);
      return;
    }
    const { auth } = await import("@/lib/firebase/client");
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("missing_token");
    }
    const response = await fetch("/api/workspace/payment-accounts", {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("payment_accounts_load_failed");
    }
    const payload = await response.json() as { accounts?: PaymentAccount[] };
    setAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
  }, [role]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadAccounts().catch(() => setMessage("收款帳戶讀取失敗，請重新整理。"));
    });
  }, [loadAccounts]);

  if (role !== "owner") {
    return null;
  }

  async function createAccount() {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setMessage("");
    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("missing_token");
      }
      const response = await fetch("/api/workspace/payment-accounts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bankName, branchName, accountName, accountNumberLast5 }),
      });
      const payload = await response.json() as { account?: PaymentAccount; message?: string };
      if (!response.ok || !payload.account) {
        throw new Error(payload.message ?? "payment_account_create_failed");
      }
      setAccounts((current) => [...current, payload.account as PaymentAccount]);
      setBankName("");
      setBranchName("");
      setAccountName("");
      setAccountNumberLast5("");
      setMessage("收款帳戶已新增。會員將只能看到啟用中的帳戶資訊。 ");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "收款帳戶新增失敗。 ");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleAccount(account: PaymentAccount) {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("missing_token");
      }
      const response = await fetch("/api/workspace/payment-accounts", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: account.id, status: account.status === "active" ? "inactive" : "active" }),
      });
      const payload = await response.json() as { account?: PaymentAccount; message?: string };
      if (!response.ok || !payload.account) {
        throw new Error(payload.message ?? "payment_account_update_failed");
      }
      setAccounts((current) => current.map((item) => item.id === account.id ? payload.account as PaymentAccount : item));
      setMessage("收款帳戶狀態已更新。歷史付款仍保留原本的帳戶快照。 ");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "收款帳戶更新失敗。 ");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section id="payment-accounts" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="payment-accounts-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="payment-accounts-heading" className="text-xl font-semibold">收款銀行帳戶</h2>
          <p className="mt-1 text-sm text-slate-600">會員付款回報會選擇實際匯入的帳戶；只保存末五碼，不保存完整帳號。</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">銀行名稱</span>
          <input id="payment-bank-name" name="bankName" value={bankName} onChange={(event) => setBankName(event.target.value)} className="rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">分行名稱（選填）</span>
          <input id="payment-branch-name" name="branchName" value={branchName} onChange={(event) => setBranchName(event.target.value)} className="rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">戶名</span>
          <input id="payment-account-name" name="accountName" value={accountName} onChange={(event) => setAccountName(event.target.value)} className="rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">帳號末五碼</span>
          <input id="payment-account-last5" name="accountNumberLast5" inputMode="numeric" maxLength={5} value={accountNumberLast5} onChange={(event) => setAccountNumberLast5(event.target.value.replace(/\D/g, "").slice(0, 5))} className="rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
      </div>
      <button type="button" onClick={() => void createAccount()} disabled={isSubmitting} className="mt-4 min-h-11 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "儲存中…" : "新增收款帳戶"}
      </button>
      {message ? <p className="mt-3 text-sm text-slate-600" aria-live="polite">{message}</p> : null}
      <div className="mt-5 grid gap-3">
        {accounts.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">尚未設定收款帳戶。</p> : accounts.map((account) => (
          <article key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
            <div className="text-sm">
              <p className="font-semibold">{account.bankName}{account.branchName ? `／${account.branchName}` : ""}</p>
              <p className="mt-1 text-slate-600">{account.accountName} · 帳號末五碼 {account.accountNumberLast5} · {account.status === "active" ? "Active（啟用）" : "Inactive（停用）"}</p>
            </div>
            <button type="button" onClick={() => void toggleAccount(account)} disabled={isSubmitting} className="min-h-11 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
              {account.status === "active" ? "停用帳戶" : "重新啟用"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
