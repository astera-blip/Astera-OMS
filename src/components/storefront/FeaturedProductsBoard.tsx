"use client";

import Link from "next/link";
import { ProductCoverImage } from "@/components/storefront/ProductCoverImage";
import { useEffect, useMemo, useState } from "react";
import { getDefaultCampaign, getDefaultVariant, type PublicCatalogItem } from "@/lib/catalog/publicCatalog";

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

  const featured = useMemo(() => {
    return [...catalog]
      .sort((a, b) => {
        const aCampaign = getDefaultCampaign(a);
        const bCampaign = getDefaultCampaign(b);

        if (aCampaign?.saleType === "rushPurchase" && bCampaign?.saleType !== "rushPurchase") {
          return -1;
        }
        if (aCampaign?.saleType !== "rushPurchase" && bCampaign?.saleType === "rushPurchase") {
          return 1;
        }
        if (aCampaign?.saleType === "preorder" && bCampaign?.saleType === "inStock") {
          return -1;
        }
        if (aCampaign?.saleType === "inStock" && bCampaign?.saleType === "preorder") {
          return 1;
        }

        return a.product.name.localeCompare(b.product.name);
      })
      .slice(0, 6);
  }, [catalog]);

  if (state === "loading") {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">推薦商品載入中。</div>;
  }

  if (state === "error") {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">推薦商品讀取失敗，請稍後再試。</div>;
  }

  if (state === "empty") {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">目前還沒有已發布商品，請由 owner 先建立 1–3 筆真實商品。</div>;
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {featured.map((item) => {
          const variant = getDefaultVariant(item);
          const campaign = getDefaultCampaign(item);

          return (
            <article key={item.product.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <Link href={`/products/${item.product.id}`} className="block">
                <ProductCoverImage
                  image={item.product.images?.[0]}
                  productName={item.product.name}
                />
              </Link>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {campaign?.saleType ?? "unknown"}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{item.product.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.product.publicDescription}</p>
              <div className="mt-4 grid gap-2 text-sm text-slate-700">
                <p>售價：NT$ {variant?.priceTwd.toLocaleString() ?? "0"}</p>
                <p>活動：{campaign?.title ?? "未設定"}</p>
                <p>{campaign?.requiresSupplement ? "需要二補" : "不需要二補"}</p>
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
