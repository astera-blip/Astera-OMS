import Link from "next/link";
import { getChannelTitle } from "@/lib/content/brandContent";
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
  const channels = content.channels.filter((channel) => channel.status !== "disabled");

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
            <p>客服信箱：{siteSettings?.contactEmail || "尚未設定"}</p>
            <p>回覆時間：{siteSettings?.supportHours || "尚未設定"}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-950">社群入口</p>
          <div className="mt-2 grid gap-2 text-sm">
            {(["lineCommunity", "lineOfficial", "instagram"] as const).map((key) => {
              const channel = channels.find((item) => item.key === key);
              const enabled = channel?.status === "active" && !!channel.url;

              return enabled ? (
                <a
                  key={key}
                  href={channel.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-700 underline decoration-slate-300 underline-offset-4"
                >
                  {channel.title}
                </a>
              ) : (
                <span key={key} className="text-slate-500">
                  {channel?.title || getChannelTitle(key)}：尚未開放
                </span>
              );
            })}
          </div>
        </div>
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
