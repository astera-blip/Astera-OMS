import Link from "next/link";
import { FeaturedProductsBoard } from "@/components/storefront/FeaturedProductsBoard";

const shoppingSteps = [
  {
    number: "01",
    title: "使用 Google 登入",
    detail: "首次登入先完成會員資料，之後即可加入商品並建立訂單。",
  },
  {
    number: "02",
    title: "確認活動與結單",
    detail: "選擇商品規格，確認 Campaign、售價、結單時間與二補提醒。",
  },
  {
    number: "03",
    title: "完成銀行匯款",
    detail: "下單後依付款請求匯款，再到付款頁選擇帳戶並送出回報。",
  },
  {
    number: "04",
    title: "等待確認與通知",
    detail: "付款確認、二補與配送進度會依訂單狀態持續更新。",
  },
];

const faqLinks = [
  {
    title: "如何完成付款？",
    detail: "目前只支援銀行匯款；下單後請依付款請求完成匯款與回報。",
    href: "/brand#faq",
  },
  {
    title: "什麼是二補？",
    detail: "國際運費、匯率或官方配貨結果可能產生實際代購成本差額。",
    href: "#supplement",
  },
  {
    title: "需要協助時怎麼聯繫？",
    detail: "可從品牌中心查看客服資訊；登入後也能從訂單頁確認處理進度。",
    href: "/brand#faq",
  },
];

export default function Home() {
  return (
    <main className="min-h-dvh overflow-x-clip bg-astera-page text-astera-ink">
      <section className="border-b border-astera-border">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-end lg:px-10 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.24em] text-astera-brand">ASTERA SELECT</p>
            <h1 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.025em] sm:text-6xl">
              泰國 GL／藝人周邊代購
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-astera-secondary sm:text-lg">
              從官方周邊、限定活動到收藏商品，清楚整理每個 Campaign、售價與結單時間。
              選好商品後使用 Google 登入，下單並以銀行匯款完成付款。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#featured-products"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-astera-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-astera-ink"
              >
                立即看商品
              </Link>
              <Link
                href="#shopping-guide"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-astera-border bg-astera-surface px-6 text-sm font-semibold text-astera-ink transition-colors hover:border-astera-brand hover:bg-astera-brand-soft"
              >
                了解購買流程
              </Link>
            </div>
          </div>

          <div className="grid gap-3 border-l border-astera-border pl-5 sm:grid-cols-3 lg:grid-cols-1 lg:pl-8" aria-label="服務摘要">
            <p className="border-b border-astera-border pb-3 text-sm leading-6 text-astera-secondary">
              <span className="block font-semibold text-astera-ink">商品資訊</span>
              公開售價、規格與活動集中呈現
            </p>
            <p className="border-b border-astera-border pb-3 text-sm leading-6 text-astera-secondary">
              <span className="block font-semibold text-astera-ink">時間清楚</span>
              結單日期與剩餘時間即時可見
            </p>
            <p className="pb-1 text-sm leading-6 text-astera-secondary">
              <span className="block font-semibold text-astera-ink">銀行匯款</span>
              回報後由 Astera 核對付款狀態
            </p>
          </div>
        </div>
      </section>

      <section id="featured-products" className="scroll-mt-24">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-18 lg:px-10">
          <FeaturedProductsBoard />
        </div>
      </section>

      <section id="shopping-guide" className="scroll-mt-24 border-y border-astera-border bg-astera-surface">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-18 lg:px-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-astera-service">SHOPPING GUIDE</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-serif text-3xl sm:text-4xl">從選購到付款，四個步驟</h2>
            <p className="max-w-xl text-sm leading-6 text-astera-secondary">每筆商品與活動皆以頁面顯示的正式資訊為準。</p>
          </div>
          <ol className="mt-9 grid gap-px overflow-hidden rounded-xl border border-astera-border bg-astera-border sm:grid-cols-2 lg:grid-cols-4">
            {shoppingSteps.map((step) => (
              <li key={step.number} className="min-w-0 bg-astera-surface p-6">
                <p className="font-serif text-2xl text-astera-brand">{step.number}</p>
                <h3 className="mt-5 font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-astera-secondary">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="supplement" className="scroll-mt-24">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-18 lg:px-10">
          <div className="grid gap-8 rounded-xl border border-astera-border bg-astera-brand-soft p-6 sm:p-9 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-astera-brand">SUPPLEMENT</p>
              <h2 className="mt-3 font-serif text-3xl">關於二補</h2>
            </div>
            <div className="grid gap-4 text-sm leading-7 text-astera-ink sm:grid-cols-2">
              <p>部分預購、代搶與候補商品，可能因國際運費、匯率波動、官方配貨或包材產生實際代購成本差額。</p>
              <p>若需二補，Astera 會說明補款金額、原因與期限；請依商品頁、活動公告及後續通知為準。</p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq-support" className="scroll-mt-24 border-t border-astera-border bg-astera-surface">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-18 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-astera-service">FAQ &amp; SUPPORT</p>
              <h2 className="mt-3 font-serif text-3xl sm:text-4xl">下單前常見問題</h2>
            </div>
            <Link href="/brand#faq" className="inline-flex min-h-11 items-center rounded-lg border border-astera-border px-4 text-sm font-semibold transition-colors hover:border-astera-brand hover:bg-astera-brand-soft">
              查看全部 FAQ／客服
            </Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {faqLinks.map((item) => (
              <Link key={item.title} href={item.href} className="group rounded-xl border border-astera-border bg-astera-surface p-6 transition-colors hover:border-astera-brand">
                <h3 className="font-semibold group-hover:text-astera-brand">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-astera-secondary">{item.detail}</p>
                <span className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-astera-brand">了解更多</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
