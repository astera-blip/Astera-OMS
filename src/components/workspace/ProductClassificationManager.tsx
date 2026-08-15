"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { ProductClassificationKey } from "@/lib/product/catalog";
import { classificationSaveFeedback } from "@/lib/workspace/operationsPresentation";
import type {
  CatalogClassification,
  CatalogClassificationStatus,
} from "@/lib/product/classifications";
import { classificationStatusLabels } from "@/lib/product/workspaceLabels";

type ClassificationMasters = Record<ProductClassificationKey, CatalogClassification[]>;

const labels: Record<ProductClassificationKey, string> = {
  company: "Company（公司）",
  artist: "Artist（藝人）",
  cp: "CP（螢幕搭檔）",
  brand: "Brand（品牌）",
  series: "Series（系列）",
};

export function ProductClassificationManager({
  classifications,
  activeKey,
  onActiveKeyChange,
  onChanged,
}: {
  classifications: ClassificationMasters;
  activeKey: ProductClassificationKey;
  onActiveKeyChange: (key: ProductClassificationKey) => void;
  onChanged: (key: ProductClassificationKey, value: CatalogClassification) => void;
}) {
  const { user } = useAuth();
  const [newLabel, setNewLabel] = useState("");
  const [message, setMessage] = useState("");

  async function createClassification() {
    const token = await user?.getIdToken();
    if (!token) {
      setMessage("需要 Owner 權限才能新增分類。");
      return;
    }
    const response = await fetch("/api/workspace/classifications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key: activeKey, label: newLabel }),
    });
    const payload = (await response.json().catch(() => null)) as {
      classification?: CatalogClassification;
      error?: string;
    } | null;
    if (!response.ok || !payload?.classification) {
      setMessage(classificationErrorMessage(payload?.error));
      return;
    }
    onChanged(activeKey, payload.classification);
    setNewLabel("");
    setMessage(`已新增 ${payload.classification.label}。`);
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-amber-700">Classification Master（分類主檔）</p>
        <h2 className="mt-2 text-2xl font-semibold">Classifications（分類管理）</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          集中維護共用名稱，避免商品出現拼字或大小寫不一致。歷史分類只封存，不直接刪除。
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(labels) as ProductClassificationKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onActiveKeyChange(key)}
            className={[
              "rounded-full px-4 py-2 text-sm font-medium",
              activeKey === key
                ? "bg-slate-950 text-white"
                : "border border-slate-300 text-slate-700",
            ].join(" ")}
          >
            {labels[key]}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="grid min-w-0 flex-1 gap-2 text-sm">
          <span className="font-medium">Display Name（顯示名稱）</span>
          <input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            className="rounded-2xl border border-slate-300 px-4 py-3"
            placeholder={`新增${labels[activeKey]}`}
          />
        </label>
        <button
          type="button"
          onClick={() => void createClassification()}
          className="self-end rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          新增分類
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}

      <div className="mt-5 grid gap-3">
        {classifications[activeKey].length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">此群組尚無分類。</p>
        ) : (
          classifications[activeKey].map((entry) => (
            <ClassificationRow
              key={entry.id}
              classificationKey={activeKey}
              entry={entry}
              onChanged={(value) => {
                onChanged(activeKey, value);
                setMessage(`已更新 ${value.label}。`);
              }}
              onError={setMessage}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ClassificationRow({
  classificationKey,
  entry,
  onChanged,
  onError,
}: {
  classificationKey: ProductClassificationKey;
  entry: CatalogClassification;
  onChanged: (entry: CatalogClassification) => void;
  onError: (message: string) => void;
}) {
  const { user } = useAuth();
  const [label, setLabel] = useState(entry.label);
  const [status, setStatus] = useState<CatalogClassificationStatus>(entry.status);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState("");

  async function save() {
    if (isSaving) return;
    const token = await user?.getIdToken();
    if (!token) {
      const message = "需要 Owner 權限才能更新分類。";
      setSaveFeedback(message);
      onError(message);
      return;
    }
    setIsSaving(true);
    setSaveFeedback(classificationSaveFeedback({ state: "saving" }));
    try {
      const response = await fetch("/api/workspace/classifications", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key: classificationKey, id: entry.id, label, status }),
      });
      const payload = (await response.json().catch(() => null)) as {
        classification?: CatalogClassification;
        error?: string;
      } | null;
      if (!response.ok || !payload?.classification) {
        const message = classificationSaveFeedback({ state: "error", error: payload?.error });
        setSaveFeedback(message);
        onError(message);
        return;
      }
      onChanged(payload.classification);
      setSaveFeedback(classificationSaveFeedback({
        state: "saved",
        label: payload.classification.label,
      }));
    } catch {
      const message = classificationSaveFeedback({ state: "error" });
      setSaveFeedback(message);
      onError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      data-classification-id={entry.id}
      className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_190px_auto]"
    >
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Display Name（顯示名稱）</span>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
        />
      </label>
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Status（狀態）</span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as CatalogClassificationStatus)}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
        >
          {Object.entries(classificationStatusLabels).map(([value, text]) => (
            <option key={value} value={value}>{text}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={isSaving}
        className="min-h-11 self-end rounded-full border border-slate-300 px-4 py-3 text-sm font-medium disabled:cursor-wait disabled:opacity-60"
      >
        {isSaving ? "儲存中…" : "儲存變更"}
      </button>
      {saveFeedback ? (
        <p className="md:col-span-3" role="status" aria-live="polite">{saveFeedback}</p>
      ) : null}
    </div>
  );
}

function classificationErrorMessage(error?: string) {
  return classificationSaveFeedback({ state: "error", error });
}
