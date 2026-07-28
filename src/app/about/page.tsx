import { legalDocumentVersions } from "@/lib/legal/documents";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Astera OMS
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">About</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Astera 提供泰國 GL / 藝人周邊代購服務。下單前請確認商品活動、規格、價格、付款與二補規則。
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          {legalDocumentVersions.map((document) => (
            <article key={document.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{document.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {document.documentType} · {document.version}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  現行版本
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-700">{document.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
