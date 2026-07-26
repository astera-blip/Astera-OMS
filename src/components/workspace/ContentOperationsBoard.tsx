"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { legalDocumentVersions, type ConsentRecord, type LegalDocumentVersion } from "@/lib/legal/documents";
import { loadConsentRecords } from "@/lib/order/localStore";

export function ContentOperationsBoard() {
  const { role } = useAuth();
  const [documents, setDocuments] = useState<LegalDocumentVersion[]>(legalDocumentVersions);
  const [consents, setConsents] = useState<ConsentRecord[]>(() => loadConsentRecords());
  const [message, setMessage] = useState("法務草案已載入。");

  useEffect(() => {
    async function loadFirestoreContent() {
      const [{ db }, { listConsentRecords, listLegalDocumentVersions }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/order/repository"),
      ]);
      const [versions, records] = await Promise.all([
        listLegalDocumentVersions(db),
        role === "owner" ? listConsentRecords(db) : Promise.resolve([]),
      ]);

      if (versions.length > 0) {
        setDocuments(versions);
      }
      setConsents(records.length > 0 ? records : loadConsentRecords());
    }

    void loadFirestoreContent().catch(() => setMessage("無法載入 Firestore 法務資料，先使用本機草案。"));
  }, [role]);

  async function publishDraftVersions() {
    try {
      const [{ db }, { saveLegalDocumentVersion }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/order/repository"),
      ]);
      await Promise.all(
        legalDocumentVersions.map((version) => saveLegalDocumentVersion(db, version)),
      );
      setDocuments(legalDocumentVersions);
      setMessage("已同步法務版本到 Firestore。");
    } catch {
      setMessage("同步法務版本失敗。");
    }
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Content
        </p>
        <h2 className="mt-2 text-2xl font-semibold">法務與內容版本</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          小圈測試先使用營運草案，正式公開前需要進行台灣法規審閱。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void publishDraftVersions()}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
          >
            同步草案版本
          </button>
          <p className="text-sm text-slate-500">{message}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {documents.map((document) => (
          <article key={document.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">{document.documentType}</p>
            <h3 className="mt-2 text-lg font-semibold">{document.title}</h3>
            <p className="mt-1 text-sm text-slate-500">版本：{document.version}</p>
            <p className="mt-4 text-sm leading-7 text-slate-700">{document.body}</p>
          </article>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Consent records</h3>
        <div className="mt-4 grid gap-3">
          {consents.length === 0 ? (
            <p className="text-sm text-slate-600">目前沒有下單同意紀錄。</p>
          ) : (
            consents.map((record) => (
              <div key={record.id} className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <p>{record.orderId} · {record.memberUid}</p>
                <p>版本：{record.legalVersionIds.join(", ")}</p>
                <p>{record.acceptedAt}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
