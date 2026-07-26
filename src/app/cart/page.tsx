const steps = [
  "Select a product variant and sale campaign.",
  "Preserve the snapshot on checkout.",
  "Hand off to payment request creation.",
];

export default function CartPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Phase 3
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Cart</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Cart state will be scoped to the logged-in member and converted into an
            immutable order snapshot at checkout.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm leading-6 text-slate-700">{step}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
