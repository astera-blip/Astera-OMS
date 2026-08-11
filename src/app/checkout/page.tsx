import { CartBoard } from "@/components/storefront/CartBoard";

export default function CheckoutPage() {
  return (
    <main className="min-h-dvh bg-astera-page px-5 py-8 text-astera-ink sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-xl border border-astera-border bg-astera-surface p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-astera-service">
            Checkout（結帳）
          </p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">確認訂單</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-astera-secondary">
            確認收件資料、配送方式與下單條款後建立訂單。付款方式為銀行匯款，付款回報會在訂單建立後進行。
          </p>
        </div>

        <div className="mt-6">
          <CartBoard />
        </div>
      </section>
    </main>
  );
}
