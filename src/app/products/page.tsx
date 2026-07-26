import { PublicProductCatalog } from "@/components/catalog/PublicProductCatalog";

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Public catalog
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Products</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Browse the current public product projection. This surface only shows
            fields safe for customers.
          </p>
        </div>
        <PublicProductCatalog />
      </section>
    </main>
  );
}
