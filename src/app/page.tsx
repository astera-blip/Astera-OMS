import Link from "next/link";

const modules = [
  {
    name: "Storefront",
    status: "Planned",
    detail: "Public product browsing, campaign pages, and preorder entry.",
  },
  {
    name: "Orders",
    status: "Next",
    detail: "Order intake, payment state, and lifecycle tracking.",
  },
  {
    name: "Members",
    status: "Next",
    detail: "Profiles, recipient details, notes, and customer history.",
  },
  {
    name: "Payments",
    status: "Foundational",
    detail: "Manual bank-transfer confirmation and receivable handling.",
  },
];

const priorities = [
  "Keep customer data and internal data separate.",
  "Preserve historical snapshots for orders and payments.",
  "Use deny-by-default security rules until review is complete.",
  "Delay optional services until they support real workflow needs.",
];

const milestones = [
  {
    label: "Day 2",
    text: "Workspace shell and operational entry points.",
  },
  {
    label: "Day 3",
    text: "Core master data pages for products, members, and orders.",
  },
  {
    label: "Later",
    text: "Firestore-backed flows, auth, and staff permissions.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
              Astera OMS
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Operations Workspace
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-medium">
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5">
              Day 2
            </span>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5">
              Day 3 ready
            </span>
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="flex flex-col gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Current focus</p>
              <p className="mt-3 max-w-3xl text-2xl font-semibold leading-9">
                Build the operational core first, then connect product, order, member,
                and payment data to Firestore with strict access control.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="mailto:astera.0920@gmail.com"
                  className="inline-flex h-11 items-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
                >
                  Owner contact
                </a>
                <a
                  href="https://github.com/astera-blip/Astera-OMS"
                  className="inline-flex h-11 items-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  GitHub repo
                </a>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                href="/products"
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-slate-300"
              >
                <p className="text-sm font-medium text-slate-500">Day 3</p>
                <h2 className="mt-2 text-lg font-semibold">Products</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Master data, variants, and campaign-ready product scaffolding.
                </p>
              </Link>
              <Link
                href="/members"
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-slate-300"
              >
                <p className="text-sm font-medium text-slate-500">Day 3</p>
                <h2 className="mt-2 text-lg font-semibold">Members</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  CRM profile shell, notes, and recipient data entry.
                </p>
              </Link>
              <Link
                href="/orders"
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-slate-300"
              >
                <p className="text-sm font-medium text-slate-500">Day 3</p>
                <h2 className="mt-2 text-lg font-semibold">Orders</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Checkout history, lifecycle states, and payment review hooks.
                </p>
              </Link>
              <Link
                href="/payments"
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-slate-300"
              >
                <p className="text-sm font-medium text-slate-500">Day 3</p>
                <h2 className="mt-2 text-lg font-semibold">Payments</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Manual bank transfer confirmation and receivable tracking.
                </p>
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {modules.map((module) => (
                <article
                  key={module.name}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{module.name}</h2>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {module.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{module.detail}</p>
                </article>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Working priorities</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                {priorities.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-amber-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-slate-50 shadow-sm">
              <p className="text-sm font-medium text-slate-400">Operating rules</p>
              <div className="mt-5 grid gap-4">
                {milestones.map((item) => (
                  <div key={item.label} className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Next actions</h2>
              <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                <li className="rounded-xl bg-slate-50 p-4">Create a module-level navigation shell.</li>
                <li className="rounded-xl bg-slate-50 p-4">Add the first data entry pages for products and members.</li>
                <li className="rounded-xl bg-slate-50 p-4">Wire Firestore data once the schema is locked.</li>
              </ol>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
