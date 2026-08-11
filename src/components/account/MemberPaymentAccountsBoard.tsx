"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type {
  PublicMemberPaymentAccount,
} from "@/lib/payment/memberBankAccounts";

type ApiPayload = {
  accounts?: PublicMemberPaymentAccount[];
  account?: PublicMemberPaymentAccount;
  error?: string;
  message?: string;
  warning?: string;
};

export function MemberPaymentAccountsBoard() {
  const { user, status, signInWithGoogle } = useAuth();
  const [accounts, setAccounts] = useState<PublicMemberPaymentAccount[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumberFull, setAccountNumberFull] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerNameDrafts, setPayerNameDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingId, setPendingId] = useState("");
  const [payerNamePendingId, setPayerNamePendingId] = useState("");

  const loadAccounts = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      return;
    }
    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/member/payment-accounts", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok) {
        throw new Error(payload.message ?? "帳戶讀取失敗。");
      }
      setAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "帳戶讀取失敗，請稍後再試。");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => void loadAccounts());
  }, [loadAccounts]);

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || isSaving || countableAccounts.length >= 5) {
      return;
    }
    setIsSaving(true);
    setMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/member/payment-accounts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bankCode, accountNumberFull, payerName }),
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.account) {
        throw new Error(payload.message ?? "匯款帳戶新增失敗，請檢查資料。");
      }
      setAccounts((current) => [...current, payload.account as PublicMemberPaymentAccount]);
      setBankCode("");
      setAccountNumberFull("");
      setPayerName("");
      setMessage(payload.warning === "member_payment_account_duplicate_review_pending"
        ? "匯款帳戶已新增；系統發現相同帳號識別，已通知 Owner 核對，帳戶仍已新增。"
        : "匯款帳戶已新增。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "匯款帳戶新增失敗，請稍後再試。");
    } finally {
      setIsSaving(false);
    }
  }

  async function completePayerName(
    event: FormEvent<HTMLFormElement>,
    account: PublicMemberPaymentAccount,
  ) {
    event.preventDefault();
    if (!user || payerNamePendingId) {
      return;
    }
    setPayerNamePendingId(account.id);
    setMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/member/payment-accounts/${encodeURIComponent(account.id)}/payer-name`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ payerName: payerNameDrafts[account.id] ?? "" }),
        },
      );
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.account) {
        throw new Error(payload.message ?? "匯款人姓名補填失敗。");
      }
      setAccounts((current) => current.map((item) => (
        item.id === account.id ? payload.account as PublicMemberPaymentAccount : item
      )));
      setPayerNameDrafts((current) => ({ ...current, [account.id]: "" }));
      setMessage("匯款人姓名已補填，這個帳戶現在可以用於付款回報。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "匯款人姓名補填失敗，請稍後再試。");
    } finally {
      setPayerNamePendingId("");
    }
  }

  async function requestDeletion(account: PublicMemberPaymentAccount) {
    if (!user || pendingId) {
      return;
    }
    setPendingId(account.id);
    setMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/member/payment-accounts/${encodeURIComponent(account.id)}/deletion-request`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.account) {
        throw new Error(payload.message ?? "封存申請送出失敗。");
      }
      setAccounts((current) => current.map((item) => item.id === account.id ? payload.account as PublicMemberPaymentAccount : item));
      setMessage("已提出封存申請，待 Owner 審核後可再新增帳戶。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "封存申請送出失敗，請稍後再試。");
    } finally {
      setPendingId("");
    }
  }

  if (status === "loading") {
    return <p className="rounded-3xl bg-white p-6 text-[#6C6B70]">帳戶資料載入中…</p>;
  }

  if (!user) {
    return (
      <section className="rounded-3xl border border-[#DED7D6] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">登入後管理匯款帳戶</h2>
        <p className="mt-2 text-sm text-[#6C6B70]">請使用 Google 登入，才能保存自己的匯款帳戶。</p>
        <button type="button" onClick={() => void signInWithGoogle()} className="mt-5 min-h-11 rounded-full bg-[#6E4E64] px-5 text-sm font-semibold text-white">
          使用 Google 登入
        </button>
      </section>
    );
  }

  const countableAccounts = accounts.filter((account) => account.status === "active" || account.status === "pendingDeletion");
  const canAdd = countableAccounts.length < 5;

  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-[#DED7D6] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">已登記帳戶（{countableAccounts.length} / 5）</h2>
            <p className="mt-2 text-sm text-[#6C6B70]">最多 5 筆；畫面只顯示遮罩帳號，完整帳號不會回傳到瀏覽器。</p>
          </div>
          <a href="/payments" className="min-h-11 rounded-full border border-[#466060] px-4 py-2 text-sm font-semibold text-[#466060]">前往付款回報</a>
        </div>
        {isLoading ? <p className="mt-5 text-sm text-[#6C6B70]">重新整理帳戶中…</p> : null}
        <div className="mt-5 grid gap-3">
          {accounts.length === 0 && !isLoading ? <p className="rounded-2xl bg-[#F7F3F2] p-4 text-sm text-[#6C6B70]">尚未登記匯款帳戶。</p> : null}
          {accounts.map((account) => (
            <article key={account.id} className="rounded-2xl border border-[#DED7D6] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  {account.verificationStatus === "needsReverification" ? (
                    <>
                      <h3 className="font-semibold">舊匯款帳戶需要重新驗證</h3>
                      <p className="mt-1 text-sm text-[#6C6B70]">帳號 {account.accountNumberMasked}</p>
                      <p className="mt-1 text-sm text-[#6C6B70]">此筆資料缺少目前驗證所需資訊，無法用於付款；請重新新增帳戶。</p>
                    </>
                  ) : (
                    <>
                      <h3 className="font-semibold">銀行代碼 {account.bankCode}</h3>
                      <p className="mt-1 text-sm text-[#6C6B70]">帳號 {account.accountNumberMasked}</p>
                      {account.payerName ? (
                        <p className="mt-1 text-sm text-[#6C6B70]">匯款人 {account.payerName}</p>
                      ) : null}
                      {account.needsPayerName ? (
                        <form onSubmit={(event) => void completePayerName(event, account)} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <label className="grid gap-1 text-sm font-medium">
                            需要補填匯款人姓名
                            <input
                              required
                              name="payerName"
                              autoComplete="name"
                              value={payerNameDrafts[account.id] ?? ""}
                              onChange={(event) => setPayerNameDrafts((current) => ({
                                ...current,
                                [account.id]: event.target.value,
                              }))}
                              className="min-h-11 rounded-2xl border border-[#DED7D6] px-4"
                            />
                          </label>
                          <button
                            type="submit"
                            disabled={Boolean(payerNamePendingId)}
                            className="min-h-11 self-end rounded-full bg-[#466060] px-4 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {payerNamePendingId === account.id ? "保存中…" : "保存姓名"}
                          </button>
                        </form>
                      ) : null}
                    </>
                  )}
                </div>
                {account.verificationStatus === "needsReverification" ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">需要重新驗證</span>
                ) : account.status === "active" ? (
                  <button type="button" onClick={() => void requestDeletion(account)} disabled={Boolean(pendingId)} className="min-h-11 rounded-full border border-[#DED7D6] px-4 text-sm font-semibold text-[#6C6B70] disabled:opacity-50">
                    {pendingId === account.id ? "送出中…" : "提出封存申請"}
                  </button>
                ) : <span className="rounded-full bg-[#E7DDDF] px-3 py-1 text-xs font-semibold text-[#6E4E64]">{account.status === "pendingDeletion" ? "等待封存審核" : "已封存"}</span>}
              </div>
            </article>
          ))}
        </div>
      </div>

      {canAdd ? (
        <form onSubmit={addAccount} className="grid gap-4 rounded-3xl border border-[#DED7D6] bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold">新增匯款帳戶</h2>
            <p className="mt-2 text-sm text-[#6C6B70]">完整帳號只用於建立不可逆識別；保存後只顯示銀行代碼與遮罩末五碼。</p>
          </div>
          <label className="grid gap-2 text-sm font-medium">銀行代碼<input required inputMode="numeric" maxLength={3} value={bankCode} onChange={(event) => setBankCode(event.target.value)} className="min-h-11 rounded-2xl border border-[#DED7D6] px-4" /></label>
          <label className="grid gap-2 text-sm font-medium">完整銀行帳號<input required inputMode="numeric" autoComplete="off" value={accountNumberFull} onChange={(event) => setAccountNumberFull(event.target.value)} className="min-h-11 rounded-2xl border border-[#DED7D6] px-4" /></label>
          <label className="grid gap-2 text-sm font-medium">匯款人姓名<input required name="payerName" autoComplete="name" value={payerName} onChange={(event) => setPayerName(event.target.value)} className="min-h-11 rounded-2xl border border-[#DED7D6] px-4" /></label>
          <button type="submit" disabled={isSaving} className="min-h-11 rounded-full bg-[#6E4E64] px-5 text-sm font-semibold text-white disabled:opacity-50">{isSaving ? "保存中…" : "保存匯款帳戶"}</button>
        </form>
      ) : <p className="rounded-3xl bg-[#E7DDDF] p-5 text-sm leading-6 text-[#6E4E64]">已達 5 筆帳戶上限；請對舊帳戶提出封存申請，Owner 核准後才能新增。</p>}

      {message ? <p role="status" aria-live="polite" className="rounded-2xl bg-white p-4 text-sm text-[#466060]">{message}</p> : null}
    </section>
  );
}
