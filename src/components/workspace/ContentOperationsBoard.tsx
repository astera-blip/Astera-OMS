"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { fallbackBrandContent, type BrandContentBundle } from "@/lib/content/brandContent";
import { saveBrandContent } from "@/lib/content/repository";

export function ContentOperationsBoard() {
  const { role } = useAuth();
  const [content, setContent] = useState<BrandContentBundle>(fallbackBrandContent);
  const [message, setMessage] = useState("品牌內容草案已載入。");

  useEffect(() => {
    async function loadFirestoreContent() {
      try {
        const [{ db }, { loadBrandContent }] = await Promise.all([
          import("@/lib/firebase/client"),
          import("@/lib/content/repository"),
        ]);
        const next = await loadBrandContent(db);
        setContent(next);
      } catch {
        setContent(fallbackBrandContent);
        setMessage("無法載入 Firestore 品牌內容，先使用本機草案。");
      }
    }

    void loadFirestoreContent();
  }, []);

  async function syncDraftContent() {
    try {
      const [{ db }] = await Promise.all([import("@/lib/firebase/client")]);
      await saveBrandContent(db, fallbackBrandContent);
      setContent(fallbackBrandContent);
      setMessage("已同步品牌內容草案到 Firestore。");
    } catch {
      setMessage("同步品牌內容失敗。");
    }
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Content</p>
        <h2 className="mt-2 text-2xl font-semibold">品牌與公告內容</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          這裡管理品牌頁會讀到的社群入口、FAQ 與公告。小圈測試先以草案同步為主。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void syncDraftContent()}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
          >
            同步草案內容
          </button>
          <p className="text-sm text-slate-500">{message}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Site settings</h3>
          <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-700">
            <p>品牌：{content.siteSettings?.brandName ?? "未設定"}</p>
            <p>主標：{content.siteSettings?.heroTitle ?? "未設定"}</p>
            <p>客服：{content.siteSettings?.contactEmail ?? "未設定"}</p>
            <p>時段：{content.siteSettings?.supportHours ?? "未設定"}</p>
            <p>配送：{content.siteSettings?.shippingNote ?? "未設定"}</p>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">社群入口</h3>
          <div className="mt-4 grid gap-3">
            {content.channels.map((channel) => (
              <div key={channel.key} className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="font-medium">{channel.title}</p>
                <p className="mt-1 text-slate-600">{channel.description}</p>
                <p className="mt-1 text-xs text-slate-500">{channel.status}</p>
                <p className="mt-1 break-all text-xs text-slate-500">{channel.url || "尚未設定"}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">公告</h3>
          <div className="mt-4 grid gap-3">
            {content.announcements.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-slate-600">{item.body}</p>
                <p className="mt-1 text-xs text-slate-500">{item.publishedAt}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">FAQ</h3>
          <div className="mt-4 grid gap-3">
            {content.faqs.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="font-medium">{item.question}</p>
                <p className="mt-1 text-slate-600">{item.answer}</p>
                <p className="mt-1 text-xs text-slate-500">順序：{item.order}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      {role !== "owner" ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          目前只讀模式。要同步草案內容需要 owner 權限。
        </div>
      ) : null}
    </section>
  );
}
