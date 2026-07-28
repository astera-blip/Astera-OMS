const fields = [
  "會員資料",
  "收件資訊",
  "訂單與付款",
  "客服聯絡",
];

export default function MembersPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Customer
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">會員服務</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            登入後可補齊會員資料、查看訂單與付款請求。若有商品、付款、取消或配送問題，請透過品牌中心提供的客服信箱聯絡。
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">{field}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                請依頁面提示填寫或查看相關資訊；實際訂單與付款狀態以系統紀錄為準。
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
