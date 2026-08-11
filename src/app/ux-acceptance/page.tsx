"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

type View = "storefront" | "dashboard" | "payment" | "checklist";

const products = [
  { name: "Freen 官方寫真", meta: "Freen · 限定企劃", price: "NT$ 1,280", tag: "預購", tone: "bg-[#E7DDDF]" },
  { name: "Wonder Flower Tee", meta: "GL Collection", price: "NT$ 1,450", tag: "現貨", tone: "bg-[#D9E5D8]" },
  { name: "Mini Poster Set", meta: "CP企劃 · 6 款", price: "NT$ 520", tag: "搶購", tone: "bg-[#F8C7CC]" },
  { name: "Fan Day Keyring", meta: "Official Goods", price: "NT$ 390", tag: "候補", tone: "bg-[#D7E4E4]" },
];

const checks = [
  ["訪客可瀏覽商品", "pass", "公開商品與 Campaign 可看，但不能建立訂單"],
  ["Google 登入為唯一入口", "pass", "所有會員操作由 Google 登入開始"],
  ["未登入不得下單", "pass", "購物車按下結帳時顯示登入閘門"],
  ["最多五筆銀行帳戶", "pass", "前五筆以銀行代碼＋完整帳號完成格式驗證"],
  ["付款只使用已認證帳戶", "pass", "沒有帳戶時導向綁定，不顯示其他支付方式"],
  ["Campaign 統一結單", "pass", "卡片與詳情都顯示日期、剩餘時間與文字狀態"],
  ["Dashboard 手機橫向預覽", "pass", "預覽卡片使用 horizontal scroll，不擠成長列表"],
  ["後台與 Excel 對帳", "todo", "此頁只做前台驗收；後台另用權限測試資料驗證"],
];

function Badge({ children, tone = "catalog" }: { children: ReactNode; tone?: "catalog" | "campaign" | "service" }) {
  const styles = {
    catalog: "bg-[#D9E5D8] text-[#20242B]",
    campaign: "bg-[#F8C7CC] text-[#20242B]",
    service: "bg-[#D7E4E4] text-[#466060]",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}

function ProductCard({ product }: { product: (typeof products)[number] }) {
  return (
    <article className="group rounded-xl border border-[#DED7D6] bg-white p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#6E4E64]">
      <div className={`flex aspect-[4/5] items-end rounded-lg p-4 ${product.tone}`}>
        <span className="font-serif text-4xl text-[#20242B]/80">Astera</span>
      </div>
      <div className="space-y-2 px-1 pb-1 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-[#20242B]">{product.name}</h3>
          <Badge>{product.tag}</Badge>
        </div>
        <p className="text-sm text-[#6C6B70]">{product.meta}</p>
        <div className="flex items-end justify-between gap-3 pt-1">
          <div>
            <p className="font-semibold tabular-nums text-[#20242B]">{product.price}</p>
            <p className="mt-1 text-xs text-[#6C6B70]">剩 6 天 · 8/10 結單</p>
          </div>
          <button className="min-h-11 rounded-lg bg-[#6E4E64] px-3 text-xs font-semibold text-white transition duration-200 hover:bg-[#20242B] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#6E4E64]">
            加入購物車
          </button>
        </div>
      </div>
    </article>
  );
}

export default function UXAcceptancePage() {
  const [view, setView] = useState<View>("storefront");
  const [loggedIn, setLoggedIn] = useState(false);
  const [accountCount, setAccountCount] = useState(0);
  const [notice, setNotice] = useState("");

  const selectView = (nextView: View) => {
    setView(nextView);
    if (nextView === "dashboard") setLoggedIn(true);
  };

  const loginGate = () => {
    if (!loggedIn) {
      setNotice("請先使用 Google 登入；登入成功後會回到原本的購物車。這是測試頁，不會真的登入。");
      return;
    }
    if (accountCount === 0) {
      setView("payment");
      setNotice("尚未綁定銀行帳戶，請先完成帳戶登記。");
      return;
    }
    setNotice("已通過登入與銀行帳戶檢查，可進入銀行匯款付款流程。");
  };

  return (
    <main className="min-h-dvh bg-[#F7F3F2] text-[#20242B]">
      <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DED7D6] pb-5">
          <Link href="/" className="font-serif text-2xl tracking-[0.18em] text-[#20242B]">ASTERA</Link>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-[#E7DDDF] px-3 py-1 text-xs font-semibold text-[#6E4E64]">UX acceptance playground</span>
            <Link href="/" className="rounded-lg px-3 py-2 text-[#6C6B70] hover:bg-white">回正式首頁</Link>
            <button onClick={() => setLoggedIn((value) => !value)} className="min-h-11 rounded-lg bg-[#6E4E64] px-4 font-semibold text-white hover:bg-[#20242B]">
              {loggedIn ? "會員中心" : "使用 Google 登入"}
            </button>
          </div>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6E4E64]">{view === "dashboard" ? "ASTERA MEMBER HOME" : "Astera design acceptance"}</p>
            <h1 className="mt-4 max-w-2xl font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl">{view === "dashboard" ? <>歡迎回來，<br />今天先處理重要事項。</> : <>先看商品，<br />再安心完成付款。</>}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#6C6B70]">{view === "dashboard" ? "會員首頁把待付款、即將結單與付款服務集中在第一層，讓你登入後先完成需要處理的事。" : "這個測試頁把核定的公開前台、會員 Dashboard、銀行帳戶與付款閘門放在一起，專門檢查 UI 是否服務真正的會員流程。"}</p>
          </div>
          <div className="rounded-xl border border-[#DED7D6] bg-white p-5 shadow-[0_12px_36px_rgba(32,36,43,0.05)]">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="測試畫面">
              {([['storefront', '未登入前台'], ['dashboard', 'Member Dashboard'], ['payment', '付款／帳戶'], ['checklist', '需求驗收']] as const).map(([key, label]) => (
                <button key={key} role="tab" aria-selected={view === key} onClick={() => selectView(key)} className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition duration-200 ${view === key ? "bg-[#20242B] text-white" : "bg-[#F7F3F2] text-[#6C6B70] hover:bg-[#E7DDDF]"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-[#F7F3F2] p-3"><p className="text-xs text-[#6C6B70]">登入狀態</p><p className="mt-1 font-semibold">{loggedIn ? "會員已登入" : "訪客"}</p></div>
              <div className="rounded-lg bg-[#D7E4E4] p-3"><p className="text-xs text-[#466060]">認證帳戶</p><p className="mt-1 font-semibold text-[#466060]">{accountCount} / 5 筆</p></div>
              <div className="rounded-lg bg-[#F8C7CC] p-3"><p className="text-xs text-[#20242B]">支付方式</p><p className="mt-1 font-semibold">銀行匯款</p></div>
            </div>
          </div>
        </section>

        {notice && <div role="status" className="mb-6 rounded-lg border border-[#466060]/30 bg-[#D7E4E4] px-4 py-3 text-sm text-[#466060]">{notice}</div>}

        {view === "storefront" && (
          <section aria-labelledby="storefront-title" className="space-y-7 pb-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-sm font-semibold text-[#6E4E64]">LATEST RELEASES</p><h2 id="storefront-title" className="mt-2 font-serif text-4xl">最新販售</h2></div>
              <div className="flex items-center gap-3"><Badge tone="campaign">GL limited</Badge><span className="text-sm text-[#6C6B70]">同一 Campaign 共用結單時間</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:gap-5">
              {products.map((product) => <ProductCard key={product.name} product={product} />)}
            </div>
            <div className="grid gap-5 rounded-xl border border-[#DED7D6] bg-white p-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div><p className="text-sm font-semibold text-[#466060]">下單前需要登入</p><h3 className="mt-2 text-xl font-semibold">訪客可以看商品，但不能建立訂單</h3><p className="mt-2 text-sm leading-6 text-[#6C6B70]">登入後補齊會員資料；付款前再檢查是否有已認證的銀行帳戶。</p></div>
              <button onClick={loginGate} className="min-h-11 rounded-lg bg-[#6E4E64] px-5 text-sm font-semibold text-white hover:bg-[#20242B]">測試結帳閘門</button>
            </div>
          </section>
        )}

        {view === "dashboard" && (
          <section aria-labelledby="dashboard-title" className="space-y-7 pb-16">
            <div><p className="text-sm font-semibold text-[#6E4E64]">MEMBER DASHBOARD</p><h2 id="dashboard-title" className="mt-2 font-serif text-4xl">今天要處理的事</h2></div>
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-xl bg-[#20242B] p-6 text-white"><Badge tone="campaign">待處理 2</Badge><h3 className="mt-5 text-2xl font-semibold">完成付款回報</h3><p className="mt-3 text-sm leading-6 text-white/70">92 帽子預購將於 8/10 結單，請使用已認證帳戶回報匯款。</p><button onClick={() => setView("payment")} className="mt-6 min-h-11 rounded-lg bg-[#6E4E64] px-5 text-sm font-semibold text-white hover:bg-white hover:text-[#20242B]">前往付款</button></div>
              <div className="min-w-0 rounded-xl border border-[#DED7D6] bg-white p-6"><div className="flex items-end justify-between"><div><p className="text-sm font-semibold text-[#466060]">即將結單</p><h3 className="mt-2 text-2xl font-semibold">不要錯過收藏企劃</h3></div><span className="text-sm text-[#6C6B70]">全部 →</span></div><div className="mt-5 flex snap-x gap-4 overflow-x-auto pb-2">
                {products.slice(0, 3).map((product) => <div key={product.name} className="min-w-[220px] snap-start rounded-lg border border-[#DED7D6] p-3"><div className={`aspect-[4/5] rounded-lg ${product.tone}`} /><p className="mt-3 font-semibold">{product.name}</p><p className="mt-1 text-xs text-[#6C6B70]">8/10 結單 · {product.tag}</p></div>)}
              </div></div>
            </div>
          </section>
        )}

        {view === "payment" && (
          <section aria-labelledby="payment-title" className="grid gap-6 pb-16 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-[#DED7D6] bg-white p-6"><p className="text-sm font-semibold text-[#466060]">BANK TRANSFER ONLY</p><h2 id="payment-title" className="mt-2 font-serif text-4xl">付款與銀行帳戶</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#6C6B70]">只能使用已認證的銀行帳戶。前五筆可直接登記；帳戶不可自行刪除，超過五筆需提出更換申請。</p><div className="mt-6 grid gap-3"><div className="flex items-center justify-between rounded-lg bg-[#D7E4E4] p-4"><div><p className="text-xs text-[#466060]">目前可用帳戶</p><p className="mt-1 font-semibold text-[#466060]">{accountCount} / 5 筆</p></div><button onClick={() => setAccountCount((count) => count < 5 ? count + 1 : count)} className="min-h-11 rounded-lg bg-[#466060] px-4 text-sm font-semibold text-white hover:bg-[#20242B]">新增測試帳戶</button></div>{accountCount === 0 ? <div className="rounded-lg border border-dashed border-[#466060]/40 p-5 text-sm text-[#466060]">尚未綁定銀行帳戶。建立訂單前應顯示綁定入口，不允許直接付款。</div> : <div className="grid gap-2">{Array.from({ length: accountCount }, (_, index) => <div key={index} className="flex items-center justify-between rounded-lg border border-[#DED7D6] p-4"><div><p className="font-semibold">台新銀行 · 812</p><p className="mt-1 font-mono text-sm text-[#6C6B70]">•••• •••• •••• {String(12340 + index).slice(-5)}</p></div><Badge tone="service">已認證</Badge></div>)}</div>}</div></div>
            <div className="rounded-xl border border-[#DED7D6] bg-white p-6"><p className="text-sm font-semibold text-[#6E4E64]">付款請求</p><h3 className="mt-2 text-2xl font-semibold">92 帽子預購</h3><div className="mt-5 space-y-4 text-sm"><div className="flex justify-between border-b border-[#DED7D6] pb-3"><span className="text-[#6C6B70]">應付金額</span><strong className="tabular-nums">NT$ 520</strong></div><div className="flex justify-between border-b border-[#DED7D6] pb-3"><span className="text-[#6C6B70]">付款截止</span><strong>8/10 23:59</strong></div><label className="block"><span className="mb-2 block font-semibold">匯款金額</span><input className="min-h-11 w-full rounded-lg border border-[#DED7D6] bg-[#F7F3F2] px-3" placeholder="請輸入金額" inputMode="numeric" /></label><button onClick={loginGate} className="min-h-11 w-full rounded-lg bg-[#6E4E64] px-5 text-sm font-semibold text-white hover:bg-[#20242B]">確認銀行匯款</button></div></div>
          </section>
        )}

        {view === "checklist" && (
          <section aria-labelledby="checklist-title" className="space-y-7 pb-16"><div><p className="text-sm font-semibold text-[#6E4E64]">REQUIREMENTS CHECK</p><h2 id="checklist-title" className="mt-2 font-serif text-4xl">需求驗收清單</h2><p className="mt-3 text-sm text-[#6C6B70]">這裡的 Pass 代表測試版應呈現的目標狀態，不代表正式部署版已完成。</p></div><div className="overflow-hidden rounded-xl border border-[#DED7D6] bg-white">{checks.map(([title, status, detail]) => <div key={title} className="grid gap-3 border-b border-[#DED7D6] p-5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-[#6C6B70]">{detail}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${status === "pass" ? "bg-[#D9E5D8] text-[#20242B]" : "bg-[#F7F3F2] text-[#6C6B70]"}`}>{status === "pass" ? "目標：Pass" : "待補測試"}</span></div>)}</div></section>
        )}

        <footer className="border-t border-[#DED7D6] py-6 text-xs text-[#6C6B70]">本頁為 Astera UI/UX 驗收測試，不會建立真實訂單、付款或銀行資料。</footer>
      </div>
    </main>
  );
}
