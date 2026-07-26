import Link from "next/link";
import { AccountActions } from "@/components/auth/AccountActions";
import { FeaturedProductsBoard } from "@/components/storefront/FeaturedProductsBoard";

const highlights = [
  {
    title: "熟客小圈測試",
    description: "Google 登入、補資料、下單、付款確認、訂單追蹤。",
  },
  {
    title: "清楚商品入口",
    description: "公開商品、活動與規格分開，先看詳情再加入購物車。",
  },
  {
    title: "人工營運流程",
    description: "先保留手動匯款與 owner 確認機制，穩定後再逐步自動化。",
  },
];

const quickLinks = [
  {
    href: "/products",
    title: "商品列表",
    detail: "查看已發布商品與活動。",
  },
  {
    href: "/brand",
    title: "品牌中心",
    detail: "社群入口、公告、客服與 FAQ。",
  },
  {
    href: "/account/profile",
    title: "會員資料",
    detail: "補齊姓名、社群內 ID 與手機。",
  },
  {
    href: "/workspace",
    title: "Owner 後台",
    detail: "商品、訂單、付款與內容管理。",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.24),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(15,23,42,0.12),_transparent_24%),linear-gradient(180deg,_#fffaf0_0%,_#f8fafc_45%,_#eef2ff_100%)] text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-700">
              Astera OMS
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
              泰國 GL / 藝人周邊代購
            </h1>
          </div>
          <AccountActions />
        </header>

        <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="flex flex-col gap-6">
            <div className="rounded-[2rem] border border-amber-200 bg-white/90 p-7 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-sm font-medium text-amber-700">Small-circle MVP</p>
              <p className="mt-4 max-w-3xl text-2xl font-semibold leading-10 sm:text-4xl">
                先讓熟客可以安全地下單、看訂單、追付款，之後才擴成完整營運系統。
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                目前已支援 Google 登入、會員資料補齊、公開商品、購物車、訂單、付款請求、
                owner 付款確認與 audit log。公開頁面現在以真實商品詳情與品牌入口為主。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="inline-flex h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  立即看商品
                </Link>
                <Link
                  href="/brand"
                  className="inline-flex h-11 items-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  品牌中心
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {highlights.map((item) => (
                <article
                  key={item.title}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h2 className="text-base font-semibold">{item.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-slate-300"
                >
                  <p className="text-sm font-medium text-slate-500">{item.title}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{item.detail}</p>
                </Link>
              ))}
            </div>

            <div className="grid gap-4">
              <FeaturedProductsBoard />
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-slate-50 shadow-sm">
              <p className="text-sm font-medium text-slate-400">Current status</p>
              <div className="mt-5 grid gap-4">
                <div className="rounded-2xl bg-white/6 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                    Products
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    商品列表與詳情頁已接上 Firestore 公開資料，但仍以小圈測試驗證為主。
                  </p>
                </div>
                <div className="rounded-2xl bg-white/6 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                    Checkout
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    加入購物車後可建立訂單與付款請求，正式流程已改成受保護 API。
                  </p>
                </div>
                <div className="rounded-2xl bg-white/6 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                    Owner
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    owner custom claim 已上線，後台權限不再依賴 email 後門。
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">小圈測試重點</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                <li className="rounded-2xl bg-slate-50 p-4">商品、活動與結單資訊以後台發布資料為準</li>
                <li className="rounded-2xl bg-slate-50 p-4">下單、付款與取消申請會保存 Firestore 紀錄</li>
                <li className="rounded-2xl bg-slate-50 p-4">未設定的社群入口不會顯示可點擊連結</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
