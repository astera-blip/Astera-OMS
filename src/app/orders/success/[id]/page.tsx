import Link from "next/link";

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Success
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Order created</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Order reference: <span className="font-medium text-slate-900">{id}</span>
          </p>
          <div className="mt-6">
            <Link
              href="/orders"
              className="inline-flex h-11 items-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              Back to orders
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
