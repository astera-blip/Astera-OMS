import Link from "next/link";
import { loadBrandContentServer } from "@/lib/content/serverRepository";

export async function StorefrontFooter() {
  let content;

  try {
    content = await loadBrandContentServer();
  } catch {
    content = {
      siteSettings: null,
      channels: [],
      faqs: [],
      announcements: [],
    };
  }

  const siteSettings = content.siteSettings;
  const channels = content.channels.filter((channel) => channel.status === "active" && !!channel.url);

  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-8 text-slate-700 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1fr_1fr_1fr]">
        <div>
          <p className="text-sm font-semibold text-slate-950">
            {siteSettings?.brandName || "Astera"}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {siteSettings?.shippingNote || "配送與付款資訊整理中。"}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-950">客服資訊</p>
          <div className="mt-2 grid gap-1 text-sm leading-6 text-slate-600">
            {siteSettings?.contactEmail ? <p>客服信箱：{siteSettings.contactEmail}</p> : null}
            {siteSettings?.supportHours ? <p>回覆時間：{siteSettings.supportHours}</p> : null}
            {!siteSettings?.contactEmail && !siteSettings?.supportHours ? (
              <p>如需協助，請先透過訂單頁或品牌中心查看最新聯繫方式。</p>
            ) : null}
          </div>
        </div>

        {channels.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-slate-950">社群入口</p>
            <div className="mt-2 grid gap-2 text-sm">
              {channels.map((channel) => (
                <a
                  key={channel.key}
                  href={channel.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-700 underline decoration-slate-300 underline-offset-4"
                >
                  {channel.title}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="mx-auto mt-6 flex max-w-7xl flex-wrap gap-4 text-xs text-slate-500">
        <Link href="/brand">品牌中心</Link>
        <Link href="/products">商品列表</Link>
        <Link href="/cart">購物車</Link>
        <Link href="/terms">服務條款</Link>
        <Link href="/privacy">隱私權政策</Link>
      </div>
    </footer>
  );
}
