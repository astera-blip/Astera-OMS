"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { loadAuditLogs } from "@/lib/order/localStore";
import type { LocalAuditLog } from "@/lib/payment/manualBankTransfer";

export function AuditLogBoard() {
  const { role } = useAuth();
  const [logs, setLogs] = useState<LocalAuditLog[]>(() => loadAuditLogs());

  useEffect(() => {
    async function loadFirestoreAuditLogs() {
      if (role !== "owner") {
        return;
      }

      const [{ db }, { listAuditLogs }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/audit/repository"),
      ]);
      setLogs(await listAuditLogs(db));
    }

    void loadFirestoreAuditLogs();
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
        {logs.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            目前沒有稽核紀錄。
          </div>
        ) : (
          logs.map((log) => (
            <article key={log.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{log.action}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {log.targetType} · {log.targetId}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {log.actorUid}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">理由：{log.reason}</p>
              <p className="mt-2 text-xs text-slate-500">{log.createdAt}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
