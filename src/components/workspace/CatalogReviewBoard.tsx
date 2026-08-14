"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { CatalogChangeRequest } from "@/lib/catalog-change/catalogChangeRequest";

const statusLabels: Record<CatalogChangeRequest["status"], string> = {
  submitted: "Submitted（待審核）",
  rejected: "Rejected（已駁回）",
  approved: "Approved（已核准）",
};

export function CatalogReviewBoard() {
  const router = useRouter();
  const { role, user } = useAuth();
  const loadedForUid = useRef("");
  const [requests, setRequests] = useState<CatalogChangeRequest[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("草稿資料載入中。");

  const load = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch("/api/workspace/catalog-change-requests", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("load_failed");
    const payload = await response.json() as { requests?: CatalogChangeRequest[] };
    const next = payload.requests ?? [];
    setRequests(next);
    setMessage(next.length ? `共 ${next.length} 筆商品草稿。` : "目前沒有商品草稿。");
  }, [user]);

  useEffect(() => {
    if (!user || (role !== "owner" && role !== "partner") || loadedForUid.current === user.uid) return;
    loadedForUid.current = user.uid;
    void load().catch(() => {
      loadedForUid.current = "";
      setMessage("無法載入商品草稿，請稍後重試。");
    });
  }, [load, role, user]);

  async function review(id: string, decision: "approve" | "reject") {
    const reason = reasons[id]?.trim() ?? "";
    if (!user || !reason) {
      setMessage("請先填寫審核原因。");
      return;
    }
    setBusyId(id);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/workspace/catalog-change-requests/${id}/review`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision, reason }),
      });
      if (!response.ok) throw new Error("review_failed");
      const payload = await response.json() as { request: CatalogChangeRequest };
      setRequests((current) => current.map((item) => item.id === id ? payload.request : item));
      setMessage(decision === "approve" ? "草稿已核准並套用正式商品。" : "草稿已駁回，可由原建立者修正後再送審。");
    } catch {
      setMessage("草稿審核失敗，請重新整理後再試一次。");
    } finally {
      setBusyId("");
    }
  }

  function editRejected(request: CatalogChangeRequest) {
    window.sessionStorage.setItem("astera.catalogChangeRequest.edit", JSON.stringify(request));
    router.push("/workspace/products");
  }

  return (
    <section className="grid gap-5">
      <header className="rounded-xl border border-astera-border bg-astera-surface p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-astera-service">
          Catalog Reviews
        </p>
        <h2 className="mt-2 font-serif text-3xl">商品草稿審核</h2>
        <p className="mt-3 text-sm leading-6 text-astera-secondary">
          Partner 草稿在 Owner 核准前不會影響公開商品、售價或結帳。
        </p>
        <p className="mt-3 text-sm text-astera-secondary" aria-live="polite">{message}</p>
      </header>

      <div className="grid gap-4">
        {requests.map((request) => (
          <article key={request.id} className="rounded-xl border border-astera-border bg-astera-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-astera-brand">
                  Revision {request.revision}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{request.title}</h3>
                <p className="mt-2 text-sm text-astera-secondary">{request.changeReason}</p>
              </div>
              <span className="rounded-full bg-astera-brand-soft px-3 py-2 text-sm font-medium text-astera-ink">
                {statusLabels[request.status]}
              </span>
            </div>

            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-astera-secondary">商品</dt><dd>{request.product.product.name}</dd></div>
              <div><dt className="text-astera-secondary">建立者</dt><dd className="break-all">{request.createdBy}</dd></div>
              <div><dt className="text-astera-secondary">Variants</dt><dd>{request.product.variants.length}</dd></div>
              <div><dt className="text-astera-secondary">Campaigns</dt><dd>{request.product.campaigns.length}</dd></div>
            </dl>

            {request.reviewReason ? (
              <p className="mt-4 rounded-xl bg-astera-page p-3 text-sm text-astera-secondary">
                審核原因：{request.reviewReason}
              </p>
            ) : null}

            {role === "owner" && request.status === "submitted" ? (
              <div className="mt-5 grid gap-3">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">審核原因</span>
                  <textarea
                    value={reasons[request.id] ?? ""}
                    onChange={(event) => setReasons((current) => ({ ...current, [request.id]: event.target.value }))}
                    className="min-h-24 rounded-xl border border-astera-border px-4 py-3"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() => void review(request.id, "approve")}
                    className="min-h-11 rounded-lg bg-astera-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {busyId === request.id ? "處理中…" : "核准並套用"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() => void review(request.id, "reject")}
                    className="min-h-11 rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
                  >
                    駁回草稿
                  </button>
                </div>
              </div>
            ) : null}
            {role === "partner" && request.status === "rejected" && request.createdBy === user?.uid ? (
              <button
                type="button"
                onClick={() => editRejected(request)}
                className="mt-5 min-h-11 rounded-lg border border-astera-brand px-4 py-2 text-sm font-medium text-astera-brand"
              >
                載入並修改草稿
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
