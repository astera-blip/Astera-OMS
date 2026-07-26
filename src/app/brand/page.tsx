import Link from "next/link";
import { loadBrandContentServer } from "@/lib/content/serverRepository";
import { fallbackBrandContent, sortBrandFaqs } from "@/lib/content/brandContent";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  let content = fallbackBrandContent;

  try {
    content = await loadBrandContentServer();
  } catch {
    content = fallbackBrandContent;
  }

  const siteSettings = content.siteSettings ?? fallbackBrandContent.siteSettings!;
  const visibleAnnouncements = content.announcements.filter((item) => item.status === "published");
  const visibleFaqs = sortBrandFaqs(content.faqs.filter((item) => item.status === "published"));
  const visibleChannels = content.channels.filter((item) => item.status !== "disabled");

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#0f172a_0%,_#111827_48%,_#f8fafc_48%,_#f8fafc_100%)] text-slate-900">
      <section className="mx-auto w-full max-w-7xl px-6 py-6 sm:px-8 lg:px-10">
        <div className="rounded-[2rem] border border-slate-800 bg-slate-950 p-8 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">Brand center</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">{siteSettings.heroTitle}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{siteSettings.heroDescription}</p>
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
              channel.url ? (
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
              ) : (
                <div key={channel.key} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">{channel.title}</p>
                  <h2 className="mt-2 text-xl font-semibold">{channel.description}</h2>
                  <p className="mt-3 text-sm text-slate-500">尚未開放</p>
                </div>
              )
            ))}

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
              </div>
            </div>
          </section>

          <aside className="grid gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">客服資訊</h2>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                <p>客服信箱：{siteSettings.contactEmail}</p>
                <p>回覆時間：{siteSettings.supportHours}</p>
                <p>配送提示：{siteSettings.shippingNote}</p>
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
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
