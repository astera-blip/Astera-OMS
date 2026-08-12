"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProductCoverImage } from "@/components/storefront/ProductCoverImage";
import { type CartLineItem, validateCartAddition } from "@/lib/order/checkout";
import {
  findCatalogItem,
  getDefaultCampaign,
  getDefaultVariant,
  getEffectiveCatalogPriceTwd,
  type PublicCatalogItem,
} from "@/lib/catalog/publicCatalog";
import { mergeClientAndCloudCart } from "@/lib/cart/clientCart";
import { saleTypeCustomerLabels } from "@/lib/catalog/featuredProducts";
import { formatCampaignDateTime } from "@/lib/product/campaignDates";
import {
  clearAnonymousCart,
  loadAnonymousCart,
} from "@/lib/cart/anonymousCart";

type LoadState = "loading" | "ready" | "empty" | "error";
type FilterKey = "all" | "company" | "artist" | "cp" | "brand" | "series";

const filterOptions: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "company", label: "公司" },
  { key: "artist", label: "藝人" },
  { key: "cp", label: "CP" },
  { key: "brand", label: "品牌" },
  { key: "series", label: "系列" },
];

export function PublicProductsBoard() {
  const { user, signInWithGoogle } = useAuth();
  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);
  const [catalogState, setCatalogState] = useState<LoadState>("loading");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [cart, setCart] = useState<CartLineItem[]>(() => loadAnonymousCart());
  const [message, setMessage] = useState("購物車會顯示你加入的商品。");

  useEffect(() => {
    async function syncCart() {
      if (!user) {
        return;
      }

      const token = await user.getIdToken();
      await fetch("/api/cart", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: cart }),
      });
    }

    void syncCart().catch(() => {
      setMessage("購物車同步失敗，請確認網路後再試一次。");
    });
  }, [cart, user]);

  useEffect(() => {
    async function loadFirestoreCart() {
      if (!user) {
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch("/api/cart", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("load_cart_failed");
      }
      const payload = (await response.json()) as { items?: CartLineItem[] };
      setCart(mergeClientAndCloudCart(payload.items ?? [], loadAnonymousCart()));
      clearAnonymousCart();
    }

    void loadFirestoreCart().catch(() => setMessage("無法載入購物車，請確認網路後再試一次。"));
  }, [user]);

  const loadCatalog = useCallback(async () => {
    setCatalogState("loading");

    try {
      const [{ db }, { listPublicProducts }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/product/repository"),
      ]);
      const products = (await listPublicProducts(db)).filter(
        (item) => item.product.publishState === "published",
      );
      setCatalog(products);
      setCatalogState(products.length > 0 ? "ready" : "empty");
    } catch {
      setCatalog([]);
      setCatalogState("error");
      setMessage("無法載入公開商品，請稍後再試。");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadCatalog();
    });
  }, [loadCatalog]);

  const filteredCatalog = useMemo(
    () =>
      catalog.filter((item) => {
        if (filterKey === "all") {
          return true;
        }

        return !!item.product.classifications?.[filterKey];
      }),
    [catalog, filterKey],
  );

  const featuredCatalog = useMemo(() => {
    return [...filteredCatalog].sort((a, b) => {
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
    });
  }, [filteredCatalog]);

  async function addToCart(productId: string) {
    if (!user) {
      setMessage("請先使用 Google 登入，登入後才能加入購物車。");
      await signInWithGoogle();
      return;
    }

    const item = findCatalogItem(catalog, productId);
    const variant = item ? getDefaultVariant(item) : null;
    const campaign = item ? getDefaultCampaign(item) : null;

    if (!item || !variant || !campaign || campaign.status !== "open") {
      setMessage("這個商品目前沒有可購買的活動。");
      return;
    }

    const nextItem: CartLineItem = {
      productId: item.product.id,
      variantId: variant.id,
      saleCampaignId: campaign.id,
      quantity: 1,
    };
    const validation = validateCartAddition(cart, nextItem, catalog);

    if (!validation.ok) {
      setMessage(validation.error);
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (line) =>
          line.productId === nextItem.productId &&
          line.variantId === nextItem.variantId &&
          line.saleCampaignId === nextItem.saleCampaignId,
      );

      const nextCart = existing
        ? current.map((line) =>
            line === existing ? { ...line, quantity: line.quantity + 1 } : line,
          )
        : [...current, nextItem];

       return nextCart;
    });
    setMessage(`已加入 ${item.product.name}。`);
  }

  return (
    <section className="grid gap-4">
        <div className="rounded-xl border border-astera-border bg-astera-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-astera-brand">商品目錄</p>
              <h2 className="mt-1 text-xl font-semibold">商品分類</h2>
            </div>
            {catalogState === "ready" ? (
              <p className="text-sm text-astera-secondary">
                {filteredCatalog.length} / {catalog.length} 筆
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilterKey(option.key)}
                className={[
                  "min-h-11 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  filterKey === option.key
                    ? "bg-astera-brand text-white"
                    : "bg-astera-brand-soft text-astera-ink hover:bg-astera-border",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p aria-live="polite" className="mt-3 text-sm text-astera-secondary">{message}</p>
        </div>

        {catalogState === "loading" ? (
          <div aria-live="polite" className="rounded-xl border border-astera-border bg-astera-surface p-6 text-sm text-astera-secondary">
            公開商品載入中。
          </div>
        ) : catalogState === "error" ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
            <p role="alert">公開商品讀取失敗，請確認網路後再試一次。</p>
            <button
              type="button"
              onClick={() => void loadCatalog()}
              className="mt-4 min-h-11 rounded-full border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100"
            >
              重新載入
            </button>
          </div>
        ) : catalogState === "empty" ? (
          <div className="rounded-xl border border-astera-border bg-astera-surface p-6 text-sm text-astera-secondary">
            目前沒有開放販售的商品，請稍後再回來看看。
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {featuredCatalog.map((item) => {
            const variant = getDefaultVariant(item);
            const campaign = getDefaultCampaign(item);
            const effectivePrice = variant ? getEffectiveCatalogPriceTwd(variant, campaign) : 0;
            const classifications = item.product.classifications
              ? Object.entries(item.product.classifications).filter(([, value]) => !!value)
              : [];

            return (
              <article
                key={item.product.id}
                className="flex min-w-0 flex-col rounded-[10px] border border-astera-border bg-astera-surface p-3 transition-colors hover:border-astera-brand"
              >
                <Link href={`/products/${item.product.id}`} className="mb-4 block">
                  <ProductCoverImage
                    image={item.product.images?.[0]}
                    productName={item.product.name}
                  />
                </Link>
                <div className="flex-1">
                  {classifications.length > 0 ? <p className="text-xs font-medium text-astera-service">{classifications.slice(0, 2).map(([, value]) => value?.label).filter(Boolean).join("／")}</p> : null}
                  <h2 className="mt-1 line-clamp-2 text-base font-semibold text-astera-ink">{item.product.name}</h2>
                  <p className="mt-2 text-sm font-semibold text-astera-ink">NT$ {effectivePrice.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-astera-secondary">{campaign ? saleTypeCustomerLabels[campaign.saleType] : "目前未開放"}{campaign?.title ? ` · ${campaign.title}` : ""}</p>
                </div>
                {campaign?.endsAt ? (
                  <p className="mt-3 text-xs font-medium text-astera-service">
                    結單：{formatCampaignDateTime(campaign.endsAt)}
                  </p>
                ) : null}
                {campaign?.requiresSupplement ? <span className="mt-2 w-fit rounded-full bg-astera-campaign px-2 py-1 text-xs font-medium text-astera-ink">可能二補</span> : null}
                <button type="button" onClick={() => addToCart(item.product.id)} className="mt-3 min-h-11 w-full rounded-lg bg-astera-brand px-3 text-sm font-semibold text-white transition-colors hover:bg-astera-ink">
                  {user ? "加入購物車" : "登入後加入"}
                </button>
              </article>
            );
          })}
          </div>
        )}
        {catalogState === "ready" && filteredCatalog.length === 0 ? (
          <div className="rounded-xl border border-astera-border bg-astera-surface p-6 text-sm text-astera-secondary">
            這個分類目前沒有商品。
          </div>
        ) : null}
    </section>
  );
}
