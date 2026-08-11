"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { TaishinTransaction } from "@/lib/reconciliation/taishin";

type ReconciliationResponse = {
  sourceRowCount?: number;
  transactions?: TaishinTransaction[];
  matches?: TaishinTransaction[];
  matchStatus?: "awaiting_payment_data" | "matched" | "not_found";
  message?: string;
};

export function TaishinReconciliationBoard() {
  const { role } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [paymentAmountTwd, setPaymentAmountTwd] = useState("");
  const [transferAccountLast5, setTransferAccountLast5] = useState("");
  const [result, setResult] = useState<ReconciliationResponse | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (role !== "owner") {
    return null;
  }

  async function importTransactions() {
    if (!file || isSubmitting) {
      setMessage("請先選擇台新銀行 .xlsx 交易明細。 ");
      return;
    }
    setIsSubmitting(true);
    setMessage("");
    setResult(null);
    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("請重新登入後再匯入對帳檔。 ");
      }
      const formData = new FormData();
      formData.set("file", file);
      if (paymentAmountTwd.trim()) {
        formData.set("paymentAmountTwd", paymentAmountTwd.trim());
      }
      if (transferAccountLast5.trim()) {
        formData.set("transferAccountLast5", transferAccountLast5.trim());
      }
      const response = await fetch("/api/workspace/reconciliation/taishin", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const payload = await response.json() as ReconciliationResponse;
      if (!response.ok) {
        throw new Error(payload.message ?? "台新交易明細匯入失敗。 ");
      }
      setResult(payload);
      setMessage(`已解析 ${payload.sourceRowCount ?? 0} 筆交易。原始檔案未保存。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "台新交易明細匯入失敗。 ");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-astera-border bg-astera-surface p-5" aria-labelledby="taishin-reconciliation-heading">
      <div>
        <p className="text-sm font-semibold text-astera-service">銀行對帳</p>
        <h2 id="taishin-reconciliation-heading" className="mt-1 font-serif text-2xl">台新交易明細</h2>
        <p className="mt-2 text-sm leading-6 text-astera-secondary">
          上傳台新銀行 .xlsx 明細後，依匯款金額與帳號末五碼尋找可能交易。這個工具只回傳安全化摘要，不會覆寫付款歷史。
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="grid gap-2 text-sm md:col-span-3">
          <span className="font-medium">台新銀行交易明細（.xlsx）</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="min-h-11 rounded-lg border border-astera-border bg-astera-surface px-3 py-2"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">比對匯款金額（選填）</span>
          <input id="taishin-payment-amount" name="paymentAmountTwd" inputMode="numeric" value={paymentAmountTwd} onChange={(event) => setPaymentAmountTwd(event.target.value.replace(/\D/g, ""))} className="min-h-11 rounded-lg border border-astera-border px-3 py-2" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">匯款帳號末五碼（選填）</span>
          <input id="taishin-last5" name="transferAccountLast5" inputMode="numeric" maxLength={5} value={transferAccountLast5} onChange={(event) => setTransferAccountLast5(event.target.value.replace(/\D/g, "").slice(0, 5))} className="min-h-11 rounded-lg border border-astera-border px-3 py-2" />
        </label>
      </div>
      <button type="button" onClick={() => void importTransactions()} disabled={isSubmitting} className="mt-4 min-h-11 rounded-lg bg-astera-brand px-4 py-3 text-sm font-semibold text-white hover:bg-astera-ink disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "解析中…" : "匯入並比對"}
      </button>
      {message ? <p className="mt-3 text-sm text-astera-secondary" aria-live="polite">{message}</p> : null}
      {result ? (
        <div className="mt-5 grid gap-4">
          <div className="rounded-lg bg-[#D7E4E4] p-4 text-sm text-astera-ink">
            <p className="font-semibold">比對結果：{result.matchStatus === "matched" ? "找到可能交易" : result.matchStatus === "not_found" ? "未找到相符交易" : "等待付款資料"}</p>
            {result.matches?.length ? <p className="mt-1">相符筆數：{result.matches.length}</p> : null}
          </div>
          <div className="overflow-x-auto rounded-lg border border-astera-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-astera-page text-astera-secondary"><tr><th className="px-3 py-2">交易時間</th><th className="px-3 py-2">摘要</th><th className="px-3 py-2">金額</th><th className="px-3 py-2">末五碼</th></tr></thead>
              <tbody>{(result.transactions ?? []).slice(0, 100).map((transaction, index) => <tr key={`${transaction.matchKey}-${index}`} className="border-t border-astera-border"><td className="px-3 py-2">{transaction.transactionAt}</td><td className="px-3 py-2">{transaction.method}</td><td className="px-3 py-2 tabular-nums">NT$ {transaction.amountTwd.toLocaleString()}</td><td className="px-3 py-2 font-mono">{transaction.accountLast5 || "—"}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
