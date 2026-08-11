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
    <footer className="border-t border-astera-border bg-astera-surface px-6 py-8 text-astera-ink sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1fr_1fr_1fr]">
        <div>
          <p className="font-serif text-lg text-astera-ink">
            {siteSettings?.brandName || "Astera"}
          </p>
          <p className="mt-2 text-sm leading-6 text-astera-secondary">
            {siteSettings?.shippingNote || "配送與付款資訊會隨商品活動公告更新。"}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-astera-service">客服資訊</p>
          <div className="mt-2 grid gap-1 text-sm leading-6 text-astera-secondary">
            {siteSettings?.contactEmail ? <p>客服信箱：{siteSettings.contactEmail}</p> : null}
            {siteSettings?.supportHours ? <p>回覆時間：{siteSettings.supportHours}</p> : null}
            {!siteSettings?.contactEmail && !siteSettings?.supportHours ? (
              <p>如需協助，請查看品牌中心，或登入後從訂單頁聯繫我們。</p>
            ) : null}
          </div>
        </div>

        {channels.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-astera-service">社群入口</p>
            <div className="mt-2 grid gap-2 text-sm">
              {channels.map((channel) => (
                <a
                  key={channel.key}
                  href={channel.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center text-astera-ink underline decoration-astera-border underline-offset-4"
                >
                  {channel.title}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="mx-auto mt-6 flex max-w-7xl flex-wrap gap-x-4 gap-y-1 text-sm text-astera-secondary">
        <Link className="inline-flex min-h-11 items-center underline decoration-astera-border underline-offset-4" href="/brand">品牌中心</Link>
        <Link className="inline-flex min-h-11 items-center underline decoration-astera-border underline-offset-4" href="/products">商品列表</Link>
        <Link className="inline-flex min-h-11 items-center underline decoration-astera-border underline-offset-4" href="/cart">購物車</Link>
        <Link className="inline-flex min-h-11 items-center underline decoration-astera-border underline-offset-4" href="/terms">服務條款</Link>
        <Link className="inline-flex min-h-11 items-center underline decoration-astera-border underline-offset-4" href="/privacy">隱私權政策</Link>
      </div>
    </footer>
  );
}
