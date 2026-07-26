const fields = [
  "Order header and status",
  "Order items and snapshot details",
  "Payment review and receivable state",
  "Cancellation and audit trail hooks",
];

export default function OrdersPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Day 3
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Orders are the lifecycle core of the system. This page is the shell for
            checkout records, item snapshots, and operational follow-up.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">{field}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Placeholder space for filtering, tables, and detail drawers.
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
