import Link from "next/link";

const channels = [
  {
    title: "LINE 社群",
    href: "",
    detail: "熟客討論、上新通知與小圈測試公告。",
  },
  {
    title: "LINE 官方帳號",
    href: "",
    detail: "客服入口、付款提醒與重要通知。",
  },
  {
    title: "Instagram",
    href: "",
    detail: "商品預告、開團視覺與品牌日常。",
  },
];

const faqs = [
  {
    q: "下單後多久會出貨？",
    a: "依商品是現貨、預購或二補狀態而不同，商品頁會標示 sale type 與活動狀態。",
  },
  {
    q: "可以取消訂單嗎？",
    a: "目前先走人工流程，之後會有 `/orders/[id]` 與取消申請頁。",
  },
  {
    q: "付款方式有哪些？",
    a: "小圈測試先以銀行匯款為主，付款請求與人工確認會同步記錄。",
  },
];

export default function BrandPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#0f172a_0%,_#111827_48%,_#f8fafc_48%,_#f8fafc_100%)] text-slate-900">
      <section className="mx-auto w-full max-w-7xl px-6 py-6 sm:px-8 lg:px-10">
        <div className="rounded-[2rem] border border-slate-800 bg-slate-950 p-8 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">
            Brand center
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            代購品牌中心
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            這裡先集中放品牌入口、社群、客服與公告。後續會改成由 Firestore 管理的內容區。
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
            {channels.map((channel) => (
              <div
                key={channel.title}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-slate-300"
              >
                <p className="text-sm font-medium text-slate-500">{channel.title}</p>
                <h2 className="mt-2 text-xl font-semibold">{channel.detail}</h2>
                <p className="mt-3 text-sm text-slate-500">尚未開放</p>
              </div>
            ))}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                公告
              </p>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                <p className="rounded-2xl bg-slate-50 p-4">
                  小圈測試 MVP 已開放。請先以公開商品與會員資料補齊流程進行驗收。
                </p>
                <p className="rounded-2xl bg-slate-50 p-4">
                  目前 Email 仍以 notificationEvents 記錄，不會自動寄信。
                </p>
                <p className="rounded-2xl bg-slate-50 p-4">
                  若商品頁顯示找不到資料，代表尚未發布或尚未建立公開 projection。
                </p>
              </div>
            </div>
          </section>

          <aside className="grid gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">客服資訊</h2>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                <p>客服信箱：astera.0920@gmail.com</p>
                <p>回覆時間：平日晚上與週末為主</p>
                <p>處理方式：以 LINE / Email / 訂單內訊息人工確認</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">FAQ</h2>
              <div className="mt-4 grid gap-3">
                {faqs.map((item) => (
                  <div key={item.q} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">{item.q}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.a}</p>
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
