"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { OwnerAuditLogSnapshot } from "@/lib/audit/repository";

type RefundMismatchAudit = Extract<
  OwnerAuditLogSnapshot,
  { requestReference: string }
>;

function isRefundMismatchAudit(
  log: OwnerAuditLogSnapshot,
): log is RefundMismatchAudit {
  return log.action === "refund.account.mismatch" && "requestReference" in log;
}

export function AuditLogBoard() {
  const { role } = useAuth();
  const [logs, setLogs] = useState<OwnerAuditLogSnapshot[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadFirestoreAuditLogs() {
      if (role !== "owner") {
        return;
      }

      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("missing_token");
      }
      const response = await fetch("/api/workspace/audit-logs", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("audit_list_failed");
      }
      const payload = await response.json() as { logs?: OwnerAuditLogSnapshot[] };
      setLogs(payload.logs ?? []);
    }

    void loadFirestoreAuditLogs().catch(() =>
      setMessage("無法載入稽核紀錄，請確認網路後再試一次。"),
    );
  }, [role]);

  if (role !== "owner") {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">需要 owner 權限</h2>
        <p className="mt-2 text-sm text-slate-600">僅 owner 可查看稽核紀錄。</p>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Safety
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Audit Logs</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          高風險操作會留下 actor、target、reason 與時間，MVP 先記錄付款確認。
        </p>
      </div>

      <div className="grid gap-4">
        {message ? <p className="text-sm text-rose-700">{message}</p> : null}
        {logs.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            目前沒有稽核紀錄。
          </div>
        ) : (
          logs.map((log) => {
            const isMismatch = isRefundMismatchAudit(log);
            return (
              <article key={log.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{log.action}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {isMismatch
                      ? `驗證參考 · ${log.requestReference}`
                      : `${log.targetType} · ${log.targetId}`}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {log.actorUid}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">
                {isMismatch
                  ? `結果：${log.result} · 嘗試次數 ${log.attemptCount}`
                  : `理由：${log.reason ?? "未提供"}`}
              </p>
              <p className="mt-2 text-xs text-slate-500">{String(log.createdAt)}</p>
            </article>
            );
          })
        )}
      </div>
    </section>
  );
}
