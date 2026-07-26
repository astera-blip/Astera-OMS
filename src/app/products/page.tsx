const fields = [
  "Canonical product name",
  "Artist, company, brand, series",
  "Variants and default variant",
  "Preorder notes and campaign state",
];

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Day 3
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Products</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Product master data will live here. This page is the starting shell for
            catalog structure before Firestore wiring.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">{field}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Placeholder space for forms, lists, or import tools.
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
