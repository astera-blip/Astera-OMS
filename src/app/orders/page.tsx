import { OrderHistoryBoard } from "@/components/storefront/OrderHistoryBoard";

export default function OrdersPage() {
  return (
    <main className="min-h-dvh bg-astera-page px-5 py-8 text-astera-ink sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-xl border border-astera-border bg-astera-surface p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-astera-service">
            訂單服務
          </p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight">我的訂單</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-astera-secondary">
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
