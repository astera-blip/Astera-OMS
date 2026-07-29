import { CartBoard } from "@/components/storefront/CartBoard";

export default function CartPage() {
  return (
    <main className="min-h-dvh bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            購物結帳
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">購物車</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            可加入不同販售活動的商品，結帳時系統會自動拆分訂單。
          </p>
        </div>

        <div className="mt-6">
          <CartBoard />
        </div>
      </section>
    </main>
  );
}
