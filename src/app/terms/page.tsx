import Link from "next/link";
import { getCurrentLegalDocument } from "@/lib/legal/documents";

export default function TermsPage() {
  const document = getCurrentLegalDocument("terms");

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Legal（法律資訊）
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{document.title}</h1>
        <p className="mt-3 text-sm text-slate-500">
          版本：{document.version} · 生效日期：
          {new Date(document.effectiveAt).toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })}
        </p>
        <p className="mt-8 whitespace-pre-line text-base leading-8 text-slate-700">
          {document.body}
        </p>
        <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          本頁為目前服務使用版本；正式法律文字仍可能依營運與專業審閱結果更新。
        </p>
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link className="underline underline-offset-4" href="/privacy">查看隱私權政策</Link>
          <Link className="underline underline-offset-4" href="/cart">返回購物車</Link>
        </div>
      </article>
    </main>
  );
}
