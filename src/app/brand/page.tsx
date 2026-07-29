import Link from "next/link";
import { loadBrandContentServer } from "@/lib/content/serverRepository";
import { emptyBrandContent, sortBrandFaqs } from "@/lib/content/brandContent";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  let content = emptyBrandContent;

  try {
    content = await loadBrandContentServer();
  } catch {
    content = emptyBrandContent;
  }

  const siteSettings = content.siteSettings;
  const visibleAnnouncements = content.announcements.filter((item) => item.status === "published");
  const visibleFaqs = sortBrandFaqs(content.faqs.filter((item) => item.status === "published"));
  const visibleChannels = content.channels.filter(
    (item) => item.status === "active" && item.url.trim().length > 0,
  );

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,_#0f172a_0%,_#111827_48%,_#f8fafc_48%,_#f8fafc_100%)] text-slate-900">
      <section className="mx-auto w-full max-w-7xl px-6 py-6 sm:px-8 lg:px-10">
        <div className="rounded-[2rem] border border-slate-800 bg-slate-950 p-8 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
          <p className="text-sm font-semibold text-amber-300">品牌中心</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            {siteSettings?.heroTitle || "品牌中心"}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            {siteSettings?.heroDescription || "品牌、社群、客服與公告內容整理中。"}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="inline-flex h-11 items-center rounded-full bg-amber-400 px-5 text-sm font-semibold text-slate-950"
            >
              看商品
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-full border border-slate-700 bg-white/5 px-5 text-sm font-medium text-slate-50"
            >
              回首頁
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <section className="grid gap-4">
            {visibleChannels.map((channel) => (
              <a
                key={channel.key}
                href={channel.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-slate-300"
              >
                <p className="text-sm font-medium text-slate-500">{channel.title}</p>
                <h2 className="mt-2 text-xl font-semibold">{channel.description}</h2>
                <p className="mt-3 text-sm text-slate-500">前往社群</p>
              </a>
            ))}
            {visibleChannels.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
                {siteSettings?.contactEmail
                  ? "如需協助，請查看品牌公告、登入後的訂單頁，或使用客服信箱聯繫我們。"
                  : "如需協助，請查看品牌公告或登入後的訂單頁。"}
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">公告</p>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                {visibleAnnouncements.map((item) => (
                  <article key={item.id} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="mt-2 text-slate-600">{item.body}</p>
                    <p className="mt-2 text-xs text-slate-500">{item.publishedAt}</p>
                  </article>
                ))}
                {visibleAnnouncements.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-slate-600">目前沒有公告。</p>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="grid gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">客服資訊</h2>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                {siteSettings?.contactEmail ? <p>客服信箱：{siteSettings.contactEmail}</p> : null}
                {siteSettings?.supportHours ? <p>回覆時間：{siteSettings.supportHours}</p> : null}
                <p>{siteSettings?.shippingNote || "配送與付款說明會依商品與訂單狀態更新，若有問題請先查看訂單頁。"}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/terms">服務條款</Link>
                <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/privacy">隱私權政策</Link>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">FAQ</h2>
              <div className="mt-4 grid gap-3">
                {visibleFaqs.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">{item.question}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                  </div>
                ))}
                {visibleFaqs.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">FAQ 尚未發布。</p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
