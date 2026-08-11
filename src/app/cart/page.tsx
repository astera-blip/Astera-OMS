import { CartBoard } from "@/components/storefront/CartBoard";

export default function CartPage() {
  return (
    <main className="min-h-dvh bg-astera-page px-5 py-8 text-astera-ink sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-xl border border-astera-border bg-astera-surface p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-astera-brand">
            購物結帳
          </p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight">購物車</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-astera-secondary">
            可加入不同販售活動的商品；前往結帳後，系統會依 Campaign 自動拆分訂單。
          </p>
        </div>

        <div className="mt-6">
          <CartBoard />
        </div>
      </section>
    </main>
  );
}
