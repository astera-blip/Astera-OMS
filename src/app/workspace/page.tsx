import Link from "next/link";

const sections = [
  { href: "/workspace/products", title: "Products", text: "Product master data, variants, and sale campaigns." },
  { href: "/workspace/members", title: "Members", text: "Profiles, phone warnings, and CRM state." },
  { href: "/workspace/orders", title: "Orders", text: "Order headers and immutable item snapshots." },
  { href: "/workspace/payments", title: "Payments", text: "Payment requests, confirmations, and receivables." },
  { href: "/workspace/audit-logs", title: "Audit logs", text: "High-risk operational actions and traceability." },
];

export default function WorkspaceHomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Operations home</h1>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{section.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
