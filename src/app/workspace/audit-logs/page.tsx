const items = [
  "Payment confirmation events",
  "Order status transitions",
  "Member risk flags and product pricing changes",
];

export default function WorkspaceAuditLogsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Audit logs</h1>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm leading-6 text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
