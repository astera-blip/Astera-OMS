import { PublicProductsBoard } from "@/components/storefront/PublicProductsBoard";
import Link from "next/link";

export default function ProductsPage() {
  return (
    <main className="min-h-dvh bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            商品目錄
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">商品列表</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            先從公開商品、分類與活動狀態開始看，再加入購物車。只有開放中的活動才能購買。
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              回首頁
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <PublicProductsBoard />
        </div>
      </section>
    </main>
  );
}
