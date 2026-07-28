"use client";

import Link from "next/link";
import { ProductCoverImage } from "@/components/storefront/ProductCoverImage";
import { useEffect, useMemo, useState } from "react";
import {
  getDefaultVariant,
  getEffectiveCatalogPriceTwd,
  type PublicCatalogItem,
} from "@/lib/catalog/publicCatalog";
import {
  featuredCampaign,
  rankFeaturedProducts,
  saleTypeCustomerLabels,
} from "@/lib/catalog/featuredProducts";

type LoadState = "loading" | "ready" | "empty" | "error";

export function FeaturedProductsBoard() {
  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    async function loadCatalog() {
      setState("loading");

      const [{ db }, { listPublicProducts }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/product/repository"),
      ]);

      const products = (await listPublicProducts(db)).filter(
        (item) => item.product.publishState === "published",
      );

      setCatalog(products);
      setState(products.length > 0 ? "ready" : "empty");
    }

    void loadCatalog().catch(() => setState("error"));
  }, []);

  const featured = useMemo(() => rankFeaturedProducts(catalog), [catalog]);

  if (state === "loading") {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">推薦商品載入中。</div>;
  }

  if (state === "error") {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">推薦商品讀取失敗，請稍後再試。</div>;
  }

  if (state === "empty") {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">目前沒有開放中的推薦商品，歡迎稍後再回來看看。</div>;
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Featured</p>
          <h2 className="mt-1 text-2xl font-semibold">推薦商品</h2>
        </div>
        <Link href="/products" className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4">
          看全部商品
        </Link>
      </div>

      <div className="grid auto-cols-[minmax(78vw,1fr)] grid-flow-col gap-4 overflow-x-auto pb-3 sm:auto-cols-[minmax(320px,1fr)] lg:grid-flow-row lg:grid-cols-3 lg:overflow-visible">
        {featured.map((item) => {
          const variant = getDefaultVariant(item);
          const campaign = featuredCampaign(item);
          const price = variant ? getEffectiveCatalogPriceTwd(variant, campaign) : 0;

          return (
            <article key={item.product.id} className="snap-start rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <Link href={`/products/${item.product.id}`} className="block">
                <ProductCoverImage
                  image={item.product.images?.[0]}
                  productName={item.product.name}
                />
              </Link>
              <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-slate-500">
                {campaign ? saleTypeCustomerLabels[campaign.saleType] : "販售資訊準備中"}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{item.product.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.product.publicDescription}</p>
              <div className="mt-4 grid gap-2 text-sm text-slate-700">
                <p>售價：NT$ {price.toLocaleString()}</p>
                <p>活動：{campaign?.title ?? "未設定"}</p>
                <p>{campaign?.requiresSupplement ? "需要二補" : "不需要二補"}</p>
                {campaign?.endsAt ? <p>結單：{formatCampaignDateTime(campaign.endsAt)}</p> : null}
              </div>
              <Link
                href={`/products/${item.product.id}`}
                className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
              >
                看詳情
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatCampaignDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
