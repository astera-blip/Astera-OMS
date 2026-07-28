"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  emptyBrandContent,
  fallbackBrandContent,
  getChannelTitle,
  type BrandAnnouncement,
  type BrandChannel,
  type BrandChannelKey,
  type BrandContentBundle,
  type BrandFaq,
  type SiteSettings,
} from "@/lib/content/brandContent";

const channelKeys: BrandChannelKey[] = ["lineCommunity", "lineOfficial", "instagram"];

export function ContentOperationsBoard() {
  const { role, user } = useAuth();
  const [content, setContent] = useState<BrandContentBundle>(emptyBrandContent);
  const [message, setMessage] = useState("品牌內容載入中。");

  useEffect(() => {
    async function loadFirestoreContent() {
      const [{ db }, { loadBrandContent }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/content/repository"),
      ]);
      const next = await loadBrandContent(db);
      setContent({
        siteSettings: next.siteSettings ?? buildDefaultSiteSettings(),
        channels: mergeChannels(next.channels),
        faqs: next.faqs,
        announcements: next.announcements,
      });
      setMessage("已載入 Firestore 品牌內容。");
    }

    void loadFirestoreContent().catch(() => {
      setContent({
        siteSettings: buildDefaultSiteSettings(),
        channels: mergeChannels([]),
        faqs: [],
        announcements: [],
      });
      setMessage("無法載入 Firestore 品牌內容，請確認權限或稍後再試。");
    });
  }, []);

  async function saveCurrentContent() {
    if (role !== "owner") {
      setMessage("需要 owner 權限才能儲存。");
      return;
    }

    if (!content.siteSettings) {
      setMessage("請先填寫 site settings。");
      return;
    }

    try {
      const token = await user?.getIdToken();

      if (!token) {
        setMessage("請重新登入後再儲存。");
        return;
      }

      const response = await fetch("/api/workspace/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: {
            siteSettings: {
              ...content.siteSettings,
              updatedAt: new Date().toISOString(),
            },
            channels: content.channels,
            faqs: content.faqs,
            announcements: content.announcements,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("save_content_failed");
      }

      setMessage("已儲存品牌內容。");
    } catch {
      setMessage("儲存品牌內容失敗。");
    }
  }

  function applyTemplate() {
    setContent({
      ...fallbackBrandContent,
      siteSettings: fallbackBrandContent.siteSettings
        ? { ...fallbackBrandContent.siteSettings, updatedAt: new Date().toISOString() }
        : buildDefaultSiteSettings(),
      channels: mergeChannels(fallbackBrandContent.channels),
    });
    setMessage("已套用草稿範本，尚未儲存。");
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Content</p>
        <h2 className="mt-2 text-2xl font-semibold">品牌與公告內容</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          管理前台品牌頁與 Footer 會讀取的 siteSettings、社群入口、FAQ 與公告。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void saveCurrentContent()}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
          >
            儲存內容
          </button>
          <button
            type="button"
            onClick={applyTemplate}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            套用草稿範本
          </button>
          <p className="text-sm text-slate-500">{message}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Site settings</h3>
        {content.siteSettings ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField label="品牌名稱" value={content.siteSettings.brandName} onChange={(value) => updateSiteSettings(setContent, { brandName: value })} />
            <TextField label="客服信箱" value={content.siteSettings.contactEmail} onChange={(value) => updateSiteSettings(setContent, { contactEmail: value })} />
            <TextField label="主標" value={content.siteSettings.heroTitle} onChange={(value) => updateSiteSettings(setContent, { heroTitle: value })} />
            <TextField label="回覆時間" value={content.siteSettings.supportHours} onChange={(value) => updateSiteSettings(setContent, { supportHours: value })} />
            <TextArea label="主說明" value={content.siteSettings.heroDescription} onChange={(value) => updateSiteSettings(setContent, { heroDescription: value })} />
            <TextArea label="配送提示" value={content.siteSettings.shippingNote} onChange={(value) => updateSiteSettings(setContent, { shippingNote: value })} />
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Social links</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {content.channels.map((channel) => (
            <article key={channel.key} className="rounded-2xl border border-slate-200 p-4">
              <TextField label="標題" value={channel.title} onChange={(value) => updateChannel(setContent, channel.key, { title: value })} />
              <TextField label="URL" value={channel.url} onChange={(value) => updateChannel(setContent, channel.key, { url: value })} />
              <TextArea label="說明" value={channel.description} onChange={(value) => updateChannel(setContent, channel.key, { description: value })} />
              <label className="mt-3 grid gap-2 text-sm">
                <span className="font-medium">狀態</span>
                <select
                  value={channel.status}
                  onChange={(event) => updateChannel(setContent, channel.key, { status: event.target.value as BrandChannel["status"] })}
                  className="rounded-2xl border border-slate-300 px-4 py-3"
                >
                  <option value="active">active</option>
                  <option value="planned">planned</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>
            </article>
          ))}
        </div>
      </section>

      <EditableList
        title="Announcements"
        emptyText="目前沒有公告。"
        onAdd={() =>
          setContent((current) => ({
            ...current,
            announcements: [
              ...current.announcements,
              {
                id: `ann-${current.announcements.length + 1}`,
                title: "",
                body: "",
                publishedAt: new Date().toISOString(),
                status: "draft",
              },
            ],
          }))
        }
      >
        {content.announcements.map((item, index) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
            <TextField label="ID" value={item.id} onChange={(value) => updateAnnouncement(setContent, index, { id: value })} />
            <TextField label="標題" value={item.title} onChange={(value) => updateAnnouncement(setContent, index, { title: value })} />
            <TextArea label="內容" value={item.body} onChange={(value) => updateAnnouncement(setContent, index, { body: value })} />
            <TextField label="發布時間" value={item.publishedAt} onChange={(value) => updateAnnouncement(setContent, index, { publishedAt: value })} />
            <StatusSelect value={item.status} options={["published", "draft"]} onChange={(value) => updateAnnouncement(setContent, index, { status: value as BrandAnnouncement["status"] })} />
          </article>
        ))}
      </EditableList>

      <EditableList
        title="FAQ"
        emptyText="目前沒有 FAQ。"
        onAdd={() =>
          setContent((current) => ({
            ...current,
            faqs: [
              ...current.faqs,
              {
                id: `faq-${current.faqs.length + 1}`,
                question: "",
                answer: "",
                order: current.faqs.length + 1,
                status: "draft",
              },
            ],
          }))
        }
      >
        {content.faqs.map((item, index) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
            <TextField label="ID" value={item.id} onChange={(value) => updateFaq(setContent, index, { id: value })} />
            <TextField label="問題" value={item.question} onChange={(value) => updateFaq(setContent, index, { question: value })} />
            <TextArea label="答案" value={item.answer} onChange={(value) => updateFaq(setContent, index, { answer: value })} />
            <TextField label="排序" value={String(item.order)} onChange={(value) => updateFaq(setContent, index, { order: Number(value) || 0 })} />
            <StatusSelect value={item.status} options={["published", "draft"]} onChange={(value) => updateFaq(setContent, index, { status: value as BrandFaq["status"] })} />
          </article>
        ))}
      </EditableList>

      {role !== "owner" ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          目前只讀模式。儲存內容需要 owner 權限。
        </div>
      ) : null}
    </section>
  );
}

function buildDefaultSiteSettings(): SiteSettings {
  return {
    id: "site-default",
    brandName: "Astera",
    heroTitle: "品牌中心",
    heroDescription: "品牌、社群、客服與公告內容整理中。",
    contactEmail: "尚未設定",
    supportHours: "尚未設定",
    shippingNote: "尚未設定",
    updatedAt: new Date().toISOString(),
  };
}

function mergeChannels(channels: BrandChannel[]) {
  return channelKeys.map((key) => {
    const existing = channels.find((channel) => channel.key === key);
    return existing ?? {
      key,
      title: getChannelTitle(key),
      url: "",
      description: "尚未設定",
      status: "planned" as const,
    };
  });
}

function updateSiteSettings(
  setContent: React.Dispatch<React.SetStateAction<BrandContentBundle>>,
  patch: Partial<SiteSettings>,
) {
  setContent((current) => ({
    ...current,
    siteSettings: { ...(current.siteSettings ?? buildDefaultSiteSettings()), ...patch },
  }));
}

function updateChannel(
  setContent: React.Dispatch<React.SetStateAction<BrandContentBundle>>,
  key: BrandChannelKey,
  patch: Partial<BrandChannel>,
) {
  setContent((current) => ({
    ...current,
    channels: mergeChannels(current.channels).map((channel) =>
      channel.key === key ? { ...channel, ...patch } : channel,
    ),
  }));
}

function updateAnnouncement(
  setContent: React.Dispatch<React.SetStateAction<BrandContentBundle>>,
  index: number,
  patch: Partial<BrandAnnouncement>,
) {
  setContent((current) => ({
    ...current,
    announcements: current.announcements.map((item, currentIndex) =>
      currentIndex === index ? { ...item, ...patch } : item,
    ),
  }));
}

function updateFaq(
  setContent: React.Dispatch<React.SetStateAction<BrandContentBundle>>,
  index: number,
  patch: Partial<BrandFaq>,
) {
  setContent((current) => ({
    ...current,
    faqs: current.faqs.map((item, currentIndex) =>
      currentIndex === index ? { ...item, ...patch } : item,
    ),
  }));
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-2xl border border-slate-300 px-4 py-3" />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24 rounded-2xl border border-slate-300 px-4 py-3" />
    </label>
  );
}

function StatusSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="mt-3 grid gap-2 text-sm">
      <span className="font-medium">狀態</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-2xl border border-slate-300 px-4 py-3">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditableList({
  title,
  emptyText,
  onAdd,
  children,
}: {
  title: string;
  emptyText: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button type="button" onClick={onAdd} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
          新增
        </button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {hasChildren ? children : <p className="text-sm text-slate-600">{emptyText}</p>}
      </div>
    </section>
  );
}
