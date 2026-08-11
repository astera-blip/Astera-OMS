"use client";

import Link from "next/link";
import { ProductCoverImage } from "@/components/storefront/ProductCoverImage";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { formatCampaignDateTime } from "@/lib/product/campaignDates";

type LoadState = "loading" | "ready" | "empty" | "error";

export function FeaturedProductsBoard() {
  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const loadCatalog = useCallback(async () => {
    setState("loading");

    try {
      const [{ db }, { listPublicProducts }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/product/repository"),
      ]);

      const products = (await listPublicProducts(db)).filter(
        (item) => item.product.publishState === "published",
      );

      setCatalog(products);
      setState(products.length > 0 ? "ready" : "empty");
    } catch {
      setCatalog([]);
      setState("error");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadCatalog();
    });
  }, [loadCatalog]);

  const featured = useMemo(() => rankFeaturedProducts(catalog), [catalog]);
  const campaigns = useMemo(() => {
    const seen = new Set<string>();
    return featured
      .map((item) => ({ item, campaign: featuredCampaign(item) }))
      .filter((entry): entry is { item: PublicCatalogItem; campaign: NonNullable<ReturnType<typeof featuredCampaign>> } => {
        if (!entry.campaign || seen.has(entry.campaign.id)) {
          return false;
        }
        seen.add(entry.campaign.id);
        return true;
      })
      .slice(0, 3);
  }, [featured]);

  if (state === "loading") {
    return <div aria-live="polite" className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">推薦商品載入中。</div>;
  }

  if (state === "error") {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        <p role="alert">推薦商品讀取失敗，請確認網路後再試一次。</p>
        <button
          type="button"
          onClick={() => void loadCatalog()}
          className="mt-4 min-h-11 rounded-full border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100"
        >
          重新載入
        </button>
      </div>
    );
  }

  if (state === "empty") {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">目前沒有開放中的推薦商品，歡迎稍後再回來看看。</div>;
  }

  if (featured.length === 0) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">目前沒有開放中的推薦商品，歡迎稍後再回來看看。</div>;
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-astera-brand">最新販售</p>
          <h2 className="mt-1 font-serif text-3xl">Campaign 與商品</h2>
        </div>
        <Link href="/products" className="inline-flex min-h-11 items-center text-sm font-medium text-astera-ink underline decoration-astera-border underline-offset-4">
          看全部商品
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3" aria-label="最新 Campaign">
        {campaigns.map(({ item, campaign }) => (
          <Link
            key={campaign.id}
            href={`/products/${item.product.id}`}
            className="rounded-xl border border-astera-border bg-astera-surface p-4 transition-colors hover:border-astera-brand"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-full bg-astera-campaign px-3 py-1 text-xs font-semibold text-astera-ink">
                {saleTypeCustomerLabels[campaign.saleType]}
              </span>
              {campaign.requiresSupplement ? <span className="text-xs font-semibold text-astera-service">可能二補</span> : null}
            </div>
            <h3 className="mt-4 font-semibold text-astera-ink">{campaign.title}</h3>
            <p className="mt-2 text-sm text-astera-secondary">{item.product.name}</p>
            {campaign.endsAt ? (
              <p className="mt-3 text-sm font-medium text-astera-service">
                結單：{formatCampaignDateTime(campaign.endsAt)}
              </p>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-astera-brand">精選商品</p>
          <h2 className="mt-1 text-2xl font-semibold">推薦商品</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {featured.map((item) => {
          const variant = getDefaultVariant(item);
          const campaign = featuredCampaign(item);
          const price = variant ? getEffectiveCatalogPriceTwd(variant, campaign) : 0;

          return (
            <article key={item.product.id} className="rounded-[10px] border border-astera-border bg-astera-surface p-4">
              <Link href={`/products/${item.product.id}`} className="block">
                <ProductCoverImage
                  image={item.product.images?.[0]}
                  productName={item.product.name}
                />
              </Link>
              <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-astera-catalog">
                {campaign ? saleTypeCustomerLabels[campaign.saleType] : "販售資訊準備中"}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{item.product.name}</h3>
              <p className="mt-2 text-sm leading-6 text-astera-secondary">{item.product.publicDescription}</p>
              <div className="mt-4 grid gap-2 text-sm text-astera-ink">
                <p>售價：NT$ {price.toLocaleString()}</p>
                <p>活動：{campaign?.title ?? "未設定"}</p>
                <p className="text-astera-service">{campaign?.requiresSupplement ? "可能需要二補" : "無二補提示"}</p>
                {campaign?.endsAt ? <p>結單：{formatCampaignDateTime(campaign.endsAt)}</p> : null}
              </div>
              <Link
                href={`/products/${item.product.id}`}
                className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-astera-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-astera-ink"
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
