"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type {
  ReconciliationMatchResult,
  ReconciliationSummary,
} from "@/lib/reconciliation/paymentMatching";

type PreviewResponse = {
  summary?: ReconciliationSummary;
  results?: ReconciliationMatchResult[];
  message?: string;
};

type RecognitionResult = {
  reconciliationItemId: string;
  status: "confirmed" | "failed";
  error?: string;
};

const categoryLabels = {
  unique_match: "唯一吻合",
  ambiguous: "多筆可能",
  unmatched: "未找到",
  insufficient_data: "資料不足",
  duplicate: "疑似重複",
} as const;

export function TaishinReconciliationBoard() {
  const { role } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recognitionResults, setRecognitionResults] = useState<Record<string, RecognitionResult>>({});
  const [message, setMessage] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const selectableResults = useMemo(
    () => (preview?.results ?? []).filter((result) => result.selectable),
    [preview],
  );

  if (role !== "owner") return null;

  async function ownerToken() {
    const { auth } = await import("@/lib/firebase/client");
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("請重新登入後再執行對帳。");
    return token;
  }

  async function previewReconciliation() {
    if (!file || isPreviewing) {
      setMessage("請先選擇台新銀行 .xlsx 交易明細。");
      return;
    }
    setIsPreviewing(true);
    setMessage("");
    setPreview(null);
    setRecognitionResults({});
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/workspace/reconciliation/taishin", {
        method: "POST",
        headers: { authorization: `Bearer ${await ownerToken()}` },
        body: formData,
      });
      const payload = await response.json() as PreviewResponse;
      if (!response.ok) throw new Error(payload.message ?? "對帳檔案無法處理。");
      setPreview(payload);
      setSelectedIds(new Set((payload.results ?? [])
        .filter((result) => result.selectedByDefault)
        .map((result) => result.reconciliationItemId)));
      setMessage(`已比對 ${payload.summary?.sourceRowCount ?? 0} 筆銀行交易，可安全勾選 ${payload.summary?.selectableCount ?? 0} 筆。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "對帳檔案無法處理。");
    } finally {
      setIsPreviewing(false);
    }
  }

  function toggleResult(result: ReconciliationMatchResult) {
    if (!result.selectable) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(result.reconciliationItemId)) next.delete(result.reconciliationItemId);
      else next.add(result.reconciliationItemId);
      return next;
    });
  }

  async function confirmSelected() {
    if (!file || !preview?.results || selectedIds.size === 0 || isConfirming) return;
    if (!window.confirm(`即將認列 ${selectedIds.size} 筆付款並更新訂單狀態，確定繼續？`)) return;
    const selected = preview.results.filter((result) =>
      result.selectable && selectedIds.has(result.reconciliationItemId));
    const selections = selected.map((result) => ({
      transactionFingerprint: result.transactionFingerprint,
      paymentGroupId: result.paymentGroupId,
      paymentIds: result.paymentIds,
    }));
    setIsConfirming(true);
    setMessage("正在逐筆認列已勾選付款…");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("reason", "台新 Excel 批次對帳認列");
      formData.set("selections", JSON.stringify(selections));
      const response = await fetch("/api/workspace/reconciliation/taishin/confirm", {
        method: "POST",
        headers: { authorization: `Bearer ${await ownerToken()}` },
        body: formData,
      });
      const payload = await response.json() as {
        summary?: { succeeded: number; failed: number };
        results?: RecognitionResult[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "批次認列失敗。");
      setRecognitionResults(Object.fromEntries((payload.results ?? [])
        .map((result) => [result.reconciliationItemId, result])));
      setSelectedIds(new Set());
      setMessage(`批次認列完成：${payload.summary?.succeeded ?? 0} 筆成功，${payload.summary?.failed ?? 0} 筆失敗。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批次認列失敗。");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <section className="rounded-xl border border-astera-border bg-astera-surface p-5" aria-labelledby="taishin-reconciliation-heading">
      <p className="text-sm font-semibold text-astera-service">銀行對帳</p>
      <h2 id="taishin-reconciliation-heading" className="mt-1 font-serif text-2xl">台新 Excel 批次對帳</h2>
      <p className="mt-2 text-sm leading-6 text-astera-secondary">
        系統會以金額與匯款帳號末五碼比對所有待審付款。原始 Excel、餘額與完整備註不會保存。
      </p>
      <label className="mt-4 grid gap-2 text-sm">
        <span className="font-medium">台新銀行交易明細（.xlsx）</span>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setSelectedIds(new Set()); }}
          className="min-h-11 rounded-lg border border-astera-border bg-astera-surface px-3 py-2" />
      </label>
      <button type="button" onClick={() => void previewReconciliation()} disabled={!file || isPreviewing || isConfirming}
        className="mt-4 min-h-11 rounded-lg bg-astera-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {isPreviewing ? "比對中…" : "解析並批次比對"}
      </button>
      {message ? <p className="mt-3 text-sm text-astera-secondary" aria-live="polite">{message}</p> : null}

      {preview?.summary ? (
        <div className="mt-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Summary label="銀行交易" value={preview.summary.sourceRowCount} />
          <Summary label="待審付款群組" value={preview.summary.pendingPaymentGroupCount} />
          <Summary label="唯一吻合" value={preview.summary.uniqueMatchCount} />
          <Summary label="需人工處理" value={preview.summary.ambiguousCount + preview.summary.unmatchedCount + preview.summary.insufficientDataCount + preview.summary.duplicateCount} />
        </div>
      ) : null}

      {preview?.results ? (
        <div className="mt-5 grid gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-astera-page p-3">
            <button type="button" onClick={() => setSelectedIds(new Set(selectableResults.map((result) => result.reconciliationItemId)))}
              className="min-h-11 rounded-lg border border-astera-brand px-3 py-2 text-sm font-medium text-astera-brand">全選可認列項目</button>
            <button type="button" onClick={() => setSelectedIds(new Set())}
              className="min-h-11 rounded-lg border border-astera-border px-3 py-2 text-sm">全部取消</button>
            <span className="text-sm text-astera-secondary">已選 {selectedIds.size} 筆</span>
            <button type="button" onClick={() => void confirmSelected()} disabled={selectedIds.size === 0 || isConfirming}
              className="min-h-11 rounded-lg bg-astera-service px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {isConfirming ? "認列中…" : "批次確認認列"}
            </button>
          </div>
          <div className="grid gap-3">
            {preview.results.map((result) => {
              const recognition = recognitionResults[result.reconciliationItemId];
              return (
                <article key={result.reconciliationItemId} className="rounded-xl border border-astera-border p-4">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" aria-label={`選取 ${result.reconciliationItemId}`}
                      checked={selectedIds.has(result.reconciliationItemId)} disabled={!result.selectable}
                      onChange={() => toggleResult(result)} className="mt-1 h-5 w-5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{categoryLabels[result.category]}</strong>
                        {recognition ? <span className="text-sm">{recognition.status === "confirmed" ? "已認列" : "認列失敗"}</span> : null}
                      </div>
                      <p className="mt-1 text-sm text-astera-secondary">{result.reason}</p>
                      <p className="mt-2 text-sm tabular-nums">{result.transactionAt ?? "無銀行交易時間"} · NT$ {result.amountTwd.toLocaleString()} · 末五碼 {result.accountLast5 || "—"}</p>
                      {result.payerName ? <p className="mt-1 text-sm">匯款人：{result.payerName}</p> : null}
                      {result.paymentRequestIds.length ? <p className="mt-1 break-all text-xs text-astera-secondary">付款請求：{result.paymentRequestIds.join("、")}</p> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-astera-border p-3"><p className="text-astera-secondary">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>;
}
