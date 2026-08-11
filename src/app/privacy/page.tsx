import Link from "next/link";
import { getCurrentLegalDocument } from "@/lib/legal/documents";

export default function PrivacyPage() {
  const document = getCurrentLegalDocument("privacy");

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Privacy（隱私）
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
          如需查詢、更正或處理會員資料，請透過品牌中心所列客服信箱聯繫。
        </p>
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link className="underline underline-offset-4" href="/terms">查看下單條款</Link>
          <Link className="underline underline-offset-4" href="/brand">前往品牌中心</Link>
        </div>
      </article>
    </main>
  );
}
