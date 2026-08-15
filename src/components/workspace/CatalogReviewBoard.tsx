"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { CatalogChangeRequest } from "@/lib/catalog-change/catalogChangeRequest";
import {
  campaignStatusLabels,
  currencyOptions,
  publishStateLabels,
  saleTypeLabels,
} from "@/lib/product/workspaceLabels";

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
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState("草稿資料載入中。");

  const load = useCallback(async () => {
    if (!user) return;
    setLoadFailed(false);
    setMessage("草稿資料載入中。");
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
      setLoadFailed(true);
      setMessage("無法載入商品草稿，請稍後重試。");
    });
  }, [load, role, user]);

  function retryLoad() {
    loadedForUid.current = "";
    void load().catch(() => {
      setLoadFailed(true);
      setMessage("無法載入商品草稿，請稍後重試。");
    });
  }

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
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errorPayload.error || "review_failed");
      }
      const payload = await response.json() as { request: CatalogChangeRequest };
      setRequests((current) => current.map((item) => item.id === id ? payload.request : item));
      setMessage(decision === "approve" ? "草稿已核准並套用正式商品。" : "草稿已駁回，可由原建立者修正後再送審。");
    } catch (error) {
      setMessage(reviewErrorMessage(error));
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
        {loadFailed ? (
          <button
            type="button"
            onClick={retryLoad}
            className="mt-3 min-h-11 rounded-lg border border-astera-brand px-4 py-2 text-sm font-medium text-astera-brand"
          >
            重新載入
          </button>
        ) : null}
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

            <CatalogReviewDetails request={request} />

            <div className="mt-4 grid gap-4 rounded-xl bg-astera-page p-4 text-sm">
              <section>
                <h4 className="font-semibold">商品提案內容</h4>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div><dt className="text-astera-secondary">公開說明</dt><dd className="whitespace-pre-wrap">{request.product.product.publicDescription}</dd></div>
                  <div><dt className="text-astera-secondary">內部備註</dt><dd className="whitespace-pre-wrap">{request.internalNote || "未填寫"}</dd></div>
                  <div><dt className="text-astera-secondary">分類</dt><dd>{formatClassifications(request)}</dd></div>
                  <div><dt className="text-astera-secondary">圖片</dt><dd>維持正式商品設定（Partner 不可修改）</dd></div>
                </dl>
              </section>

              <section>
                <h4 className="font-semibold">商品規格</h4>
                <div className="mt-2 grid gap-2">
                  {request.product.variants.length ? request.product.variants.map((variant, index) => (
                    <div key={`${variant.id || "new-variant"}-${index}`} className="rounded-lg border border-astera-border bg-astera-surface p-3">
                      <p className="font-medium">{variant.name}{variant.isDefault ? "（預設）" : ""}</p>
                      <p className="mt-1 text-astera-secondary">售價 NT$ {variant.priceTwd.toLocaleString("zh-TW")}</p>
                      <p className="text-astera-secondary">
                        原幣成本：{formatOriginalCost(variant.originalCurrency, variant.originalCost)}
                      </p>
                    </div>
                  )) : <p className="text-astera-secondary">沒有商品規格。</p>}
                </div>
              </section>

              <section>
                <h4 className="font-semibold">販售活動</h4>
                <div className="mt-2 grid gap-2">
                  {request.product.campaigns.length ? request.product.campaigns.map((campaign, index) => (
                    <div key={`${campaign.id || "new-campaign"}-${index}`} className="rounded-lg border border-astera-border bg-astera-surface p-3">
                      <p className="font-medium">{campaign.title}</p>
                      <p className="mt-1 text-astera-secondary">
                        {saleTypeLabels[campaign.saleType]}・{campaignStatusLabels[campaign.status]}
                      </p>
                      <p className="text-astera-secondary">
                        活動售價：{typeof campaign.salePriceTwd === "number" ? `NT$ ${campaign.salePriceTwd.toLocaleString("zh-TW")}` : "沿用規格售價"}
                      </p>
                      <p className="text-astera-secondary">開始：{campaign.startsAt ?? "未設定"}｜結束：{campaign.endsAt ?? "未設定"}</p>
                      <p className="text-astera-secondary">二補：{campaign.requiresSupplement ? "可能需要" : "不需要"}</p>
                      {campaign.publicNotice ? <p className="mt-1 whitespace-pre-wrap text-astera-secondary">公開公告：{campaign.publicNotice}</p> : null}
                      {campaign.supplementNote ? <p className="whitespace-pre-wrap text-astera-secondary">二補說明：{campaign.supplementNote}</p> : null}
                    </div>
                  )) : <p className="text-astera-secondary">沒有販售活動。</p>}
                </div>
              </section>
            </div>

            <ArchiveImpact request={request} />

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

export function CatalogReviewDetails({ request }: { request: CatalogChangeRequest }) {
  return (
    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-astera-secondary">商品</dt><dd>{request.product.product.name}</dd></div>
      <div><dt className="text-astera-secondary">目標 Product ID</dt><dd className="break-all">{request.product.product.id}</dd></div>
      <div><dt className="text-astera-secondary">建立者</dt><dd>{request.creatorDisplayName ?? "未完成會員資料"}</dd></div>
      <div><dt className="text-astera-secondary">刊登狀態</dt><dd>{publishStateLabels[request.product.product.publishState]}</dd></div>
      <div className="sm:col-span-2">
        <dt className="text-astera-secondary">送審時版本</dt>
        <dd>{request.baseProductVersion
          ? "以送審當下的正式商品為準；若之後被更新，系統會阻止核准並要求重新送審。"
          : "新商品草稿，尚無既有正式版本。"}</dd>
      </div>
    </dl>
  );
}

function formatClassifications(request: CatalogChangeRequest) {
  const classifications = request.product.product.classifications;
  if (!classifications) return "未設定";
  const labels = Object.values(classifications).map((entry) => entry.label);
  return labels.length ? labels.join("／") : "未設定";
}

function formatOriginalCost(currency: string | undefined, cost: number | undefined) {
  if (!currency || typeof cost !== "number") return "未填寫";
  const label = currencyOptions.find((option) => option.value === currency)?.label ?? currency;
  return `${label} ${cost.toLocaleString("zh-TW")}`;
}

function reviewErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "catalog_change_stale_base") {
    return "正式商品已被更新，這份草稿已過期；請 Partner 重新載入最新商品後再送審。";
  }
  if (code === "catalog_change_review_conflict" || code === "catalog_change_not_reviewable") {
    return "此草稿的審核狀態已變更，請重新載入後確認。";
  }
  if (code === "catalog_change_child_id_conflict" || code === "catalog_change_classification_conflict") {
    return "商品規格、活動或分類主檔已變更；請駁回草稿，讓 Partner 重新載入正式商品後送審。";
  }
  return "草稿審核失敗，請重新整理後再試一次。";
}

function ArchiveImpact({ request }: { request: CatalogChangeRequest }) {
  const proposedVariantIds = new Set(request.product.variants.map((variant) => variant.id));
  const proposedCampaignIds = new Set(request.product.campaigns.map((campaign) => campaign.id));
  const removedVariants = (request.baseVariants ?? []).filter((variant) => !proposedVariantIds.has(variant.id));
  const removedCampaigns = (request.baseCampaigns ?? []).filter((campaign) => !proposedCampaignIds.has(campaign.id));
  if (!removedVariants.length && !removedCampaigns.length) return null;
  return (
    <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <h4 className="font-semibold">核准後將封存</h4>
      <p className="mt-1">請確認下列既有規格或活動確實不再使用；核准後不會硬刪除歷史資料。</p>
      {removedVariants.length ? (
        <p className="mt-2">商品規格：{removedVariants.map((variant) => `${variant.name}（${variant.id}）`).join("、")}</p>
      ) : null}
      {removedCampaigns.length ? (
        <p className="mt-1">販售活動：{removedCampaigns.map((campaign) => `${campaign.title}（${campaign.id}）`).join("、")}</p>
      ) : null}
    </section>
  );
}
