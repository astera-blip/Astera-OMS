import { PublicProductDetailBoard } from "@/components/storefront/PublicProductDetailBoard";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Storefront
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">商品詳情</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            這裡會載入單筆公開商品，並使用可購買的規格與活動加入購物車。
          </p>
        </div>

        <div className="mt-6">
          <PublicProductDetailBoard productId={id} />
        </div>
      </section>
    </main>
  );
}
