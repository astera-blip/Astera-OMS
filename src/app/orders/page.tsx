import { OrderHistoryBoard } from "@/components/storefront/OrderHistoryBoard";

export default function OrdersPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Customer
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            訂單紀錄會保留下單當時的商品名稱、規格與售價。
          </p>
        </div>

        <div className="mt-6">
          <OrderHistoryBoard />
        </div>
      </section>
    </main>
  );
}
