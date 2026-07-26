import { ProductWorkspace } from "@/components/workspace/product-form";

export default function WorkspaceProductsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Products</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Manage product master data, variants, and sale-ready metadata from one
            place.
          </p>
        </div>

        <ProductWorkspace />
      </section>
    </main>
  );
}
