const memberLinks = [
  { href: "/account/profile", label: "會員資料", detail: "更新姓名、手機與聯絡資訊" },
  { href: "/orders", label: "訂單與付款", detail: "查看訂單、付款請求與取消進度" },
  { href: "/account/bank-accounts", label: "付款設定", detail: "管理付款回報使用的匯款帳戶" },
  { href: "/brand", label: "客服聯絡", detail: "查看品牌公告與客服資訊" },
];

export default function MembersPage() {
  return (
    <main className="min-h-dvh bg-[#F7F3F2] px-5 py-6 text-[#20242B] sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <header className="border-b border-[#DED7D6] pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6E4E64]">Astera</p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">會員工作台</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6C6B70]">
            這裡會整理會員資料、訂單與付款服務。實際資料載入後，待處理事項與商品預覽會顯示在對應區域。
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[32%_68%]">
          <aside className="grid gap-4">
            <section className="rounded-xl border border-[#DED7D6] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#466060]">Member Dashboard</p>
              <h2 className="mt-2 text-xl font-semibold">今天需要處理</h2>
              <div aria-live="polite" className="mt-4 rounded-lg border border-dashed border-[#DED7D6] bg-[#F7F3F2] p-4 text-sm leading-6 text-[#6C6B70]">
                目前沒有待辦事項。
              </div>
            </section>

            <nav aria-label="會員服務" className="grid gap-2">
              {memberLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border border-[#DED7D6] bg-white p-4 transition-colors hover:border-[#6E4E64] hover:bg-[#E7DDDF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6E4E64]"
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="mt-1 block text-sm text-[#6C6B70]">{item.detail}</span>
                </Link>
              ))}
            </nav>
          </aside>

          <section className="grid min-w-0 gap-6">
            <section className="rounded-xl border border-[#DED7D6] bg-white p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#466060]">Campaign</p>
                  <h2 className="mt-2 text-xl font-semibold">即將結單</h2>
                </div>
                <Link href="/products" className="text-sm font-semibold text-[#6E4E64] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6E4E64]">
                  查看商品
                </Link>
              </div>
              <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2">
                <div className="min-w-[240px] snap-start rounded-lg border border-dashed border-[#DED7D6] bg-[#F7F3F2] p-4 text-sm leading-6 text-[#6C6B70] sm:min-w-[280px]">
                  商品與結單時間會在公開活動載入後顯示。
                </div>
                <div className="min-w-[240px] snap-start rounded-lg border border-dashed border-[#DED7D6] bg-[#F7F3F2] p-4 text-sm leading-6 text-[#6C6B70] sm:min-w-[280px]">
                  尚未有可顯示的活動預覽。
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[#DED7D6] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#466060]">Catalog</p>
              <h2 className="mt-2 text-xl font-semibold">最新販售</h2>
              <div aria-live="polite" className="mt-4 rounded-lg border border-dashed border-[#DED7D6] bg-[#F7F3F2] p-4 text-sm leading-6 text-[#6C6B70]">
                最新商品預覽會在公開商品資料載入後顯示。
              </div>
            </section>
          </section>
        </div>
      </section>
    </main>
  );
}
import Link from "next/link";
