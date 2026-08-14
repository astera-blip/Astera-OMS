"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { FeaturedProductsBoard } from "@/components/storefront/FeaturedProductsBoard";
import { MemberHomeActions } from "@/components/storefront/MemberHomeActions";

const shoppingSteps = [
  { number: "01", title: "登入會員", detail: "使用 Google 登入，首次使用先完成會員資料。" },
  { number: "02", title: "選擇商品與活動", detail: "確認售價、販售類型與結單時間後加入購物車。" },
  { number: "03", title: "銀行匯款與回報", detail: "訂單成立後依付款請求匯款，再送出付款回報。" },
];

export function HomeExperience() {
  const { status, user, error, signInWithGoogle } = useAuth();

  if (status === "loading") {
    return (
      <main id="main-content" tabIndex={-1} className="flex-1 bg-astera-page px-4 py-8 text-astera-ink sm:px-8">
        <div aria-live="polite" aria-busy="true" className="mx-auto grid max-w-7xl gap-6">
          <div className="h-48 animate-pulse rounded-2xl border border-astera-border bg-astera-surface" />
          <div className="h-36 animate-pulse rounded-2xl border border-astera-border bg-astera-surface" />
          <p className="sr-only">首頁載入中。</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main id="main-content" tabIndex={-1} className="flex-1 overflow-x-clip bg-astera-page px-4 py-6 text-astera-ink sm:px-8 sm:py-8">
        <div className="mx-auto grid max-w-7xl gap-6">
          <section data-testid="guest-login-card" className="grid gap-6 rounded-2xl border border-astera-border bg-astera-surface px-5 py-[22px] sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-astera-brand">THAILAND ARTIST GOODS</p>
              <h1 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">泰國 GL／藝人周邊代購</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-astera-secondary sm:text-base">
                登入會員後即可收藏商品、依活動結單時間下單，並在線上追蹤訂單與匯款回報進度。
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-center">
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-astera-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-astera-ink"
              >
                使用 Google 登入
              </button>
              <p className="text-sm text-astera-secondary">登入後可建立訂單與追蹤進度</p>
              {error ? <p role="alert" className="max-w-sm text-sm text-red-700">{error}</p> : null}
            </div>
          </section>

          <section data-testid="shopping-steps-card" aria-labelledby="shopping-steps-heading" className="rounded-2xl border border-astera-border bg-astera-surface px-5 py-6 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-astera-service">HOW TO ORDER</p>
                <h2 id="shopping-steps-heading" className="mt-2 font-serif text-2xl">代購步驟</h2>
              </div>
              <p className="text-sm text-astera-secondary">三個步驟完成下單與付款回報</p>
            </div>
            <ol className="mt-5 grid gap-4 md:grid-cols-3">
              {shoppingSteps.map((step) => (
                <li key={step.number} className="rounded-xl bg-astera-page p-4">
                  <p className="text-xs font-semibold tracking-[0.16em] text-astera-brand">{step.number}</p>
                  <h3 className="mt-2 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-astera-secondary">{step.detail}</p>
                </li>
              ))}
            </ol>
          </section>

          <FeaturedProductsBoard mode="guest" />
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 overflow-x-clip bg-astera-page px-4 py-8 text-astera-ink sm:px-8 sm:py-10">
      <div className="mx-auto grid max-w-7xl gap-10">
        <MemberHomeActions />
        <FeaturedProductsBoard mode="member" />
      </div>
    </main>
  );
}
