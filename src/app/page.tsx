import Link from "next/link";
import { AccountActions } from "@/components/auth/AccountActions";
import { FeaturedProductsBoard } from "@/components/storefront/FeaturedProductsBoard";

const highlights = [
  {
    title: "泰國周邊代購",
    description: "整理 GL / 藝人周邊開團、預購、代搶與候補商品資訊。",
  },
  {
    title: "活動與規格清楚",
    description: "商品頁會標示販售活動、規格、價格、結單資訊與二補提醒。",
  },
  {
    title: "銀行匯款回報",
    description: "下單後依付款請求匯款，並回報末五碼與匯款資訊方便對帳。",
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
    href: "/orders",
    title: "我的訂單",
    detail: "查看訂單、付款狀態與取消申請。",
  },
  {
    href: "/payments",
    title: "付款回報",
    detail: "回報匯款資訊並追蹤付款確認。",
  },
];

const shoppingSteps = [
  {
    title: "查看開團商品",
    detail: "商品頁會列出規格、售價、結單時間與二補提醒。",
  },
  {
    title: "加入購物車並下單",
    detail: "可先加入不同活動商品；結帳時系統會依活動拆分訂單。",
  },
  {
    title: "完成銀行匯款",
    detail: "付款後請回報日期、金額、帳號末五碼與匯款人，方便對帳。",
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
              <p className="text-sm font-medium text-amber-700">Astera 代購</p>
              <p className="mt-4 max-w-3xl text-2xl font-semibold leading-10 sm:text-4xl">
                泰國 GL / 藝人周邊代購，從商品資訊、下單到匯款回報都集中整理。
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                你可以先查看已開放商品與活動，確認規格、價格、結單時間與二補提醒後加入購物車。
                下單後請依付款請求完成銀行匯款，並在付款頁回報匯款資訊。
              </p>
              <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-700 sm:grid-cols-3">
                <p className="rounded-2xl bg-amber-50 p-4">付款方式：銀行匯款</p>
                <p className="rounded-2xl bg-amber-50 p-4">結單與到貨：依商品活動公告</p>
                <p className="rounded-2xl bg-amber-50 p-4">客服入口：品牌中心與訂單頁</p>
              </div>
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
              <p className="text-sm font-medium text-slate-400">購買流程</p>
              <div className="mt-5 grid gap-4">
                {shoppingSteps.map((step) => (
                <div key={step.title} className="rounded-2xl bg-white/6 p-4">
                  <p className="text-xs font-semibold text-amber-300">
                    {step.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {step.detail}
                  </p>
                </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">下單前請確認</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                <li className="rounded-2xl bg-slate-50 p-4">商品、活動與結單資訊以後台發布資料為準</li>
                <li className="rounded-2xl bg-slate-50 p-4">預購、代搶與候補商品可能因實際成本產生二補</li>
                <li className="rounded-2xl bg-slate-50 p-4">未設定的社群入口不會顯示可點擊連結</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
