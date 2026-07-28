"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProductCoverImage } from "@/components/storefront/ProductCoverImage";
import {
  buildCartSummary,
  type CartLineItem,
  validateCartAddition,
} from "@/lib/order/checkout";
import {
  findCatalogItem,
  getDefaultCampaign,
  getDefaultVariant,
  getEffectiveCatalogPriceTwd,
  type PublicCatalogItem,
} from "@/lib/catalog/publicCatalog";
import { mergeClientAndCloudCart } from "@/lib/cart/clientCart";
import {
  campaignStatusCustomerLabels,
  saleTypeCustomerLabels,
} from "@/lib/catalog/featuredProducts";
import {
  clearAnonymousCart,
  loadAnonymousCart,
  saveAnonymousCart,
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
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);
  const [catalogState, setCatalogState] = useState<LoadState>("loading");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [cart, setCart] = useState<CartLineItem[]>(() => loadAnonymousCart());
  const [message, setMessage] = useState("等待公開商品載入。");

  useEffect(() => {
    async function syncCart() {
      if (!user) {
        saveAnonymousCart(cart);
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

  useEffect(() => {
    async function loadCatalog() {
      setCatalogState("loading");

      const [{ db }, { listPublicProducts }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/product/repository"),
      ]);
      const products = (await listPublicProducts(db)).filter(
        (item) => item.product.publishState === "published",
      );
      setCatalog(products);
      setCatalogState(products.length > 0 ? "ready" : "empty");
    }

    void loadCatalog().catch(() => {
      setCatalog([]);
      setCatalogState("error");
      setMessage("無法載入公開商品，請稍後再試。");
    });
  }, []);

  const summary = useMemo(() => buildCartSummary(cart, catalog), [cart, catalog]);
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

  function addToCart(productId: string) {
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

      saveAnonymousCart(nextCart);
      return nextCart;
    });
    setMessage(`已加入 ${item.product.name}。`);
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                Catalog
              </p>
              <h2 className="mt-1 text-xl font-semibold">商品分類</h2>
            </div>
            <p className="text-sm text-slate-500">
              {filteredCatalog.length} / {catalog.length} 筆
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilterKey(option.key)}
                className={[
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  filterKey === option.key
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {catalogState === "loading" ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            公開商品載入中。
          </div>
        ) : catalogState === "error" ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
            公開商品讀取失敗，請稍後再試。
          </div>
        ) : catalogState === "empty" ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            目前沒有已發布的商品。請先由 owner 在後台建立真實商品。
          </div>
        ) : (
          featuredCatalog.map((item) => {
            const variant = getDefaultVariant(item);
            const campaign = getDefaultCampaign(item);
            const effectivePrice = variant ? getEffectiveCatalogPriceTwd(variant, campaign) : 0;
            const classifications = item.product.classifications
              ? Object.entries(item.product.classifications).filter(([, value]) => !!value)
              : [];

            return (
              <article
                key={item.product.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <Link href={`/products/${item.product.id}`} className="mb-4 block">
                  <ProductCoverImage
                    image={item.product.images?.[0]}
                    productName={item.product.name}
                  />
                </Link>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{item.product.name}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      {item.product.publicDescription}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/products/${item.product.id}`}
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      看詳情
                    </Link>
                    <button
                      type="button"
                      onClick={() => addToCart(item.product.id)}
                      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                    >
                      加入購物車
                    </button>
                  </div>
                </div>
                {classifications.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {classifications.map(([key, value]) => (
                      <span
                        key={key}
                        className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
                      >
                        {key} · {value?.label}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                  <p>規格：{variant?.name ?? "未設定"}</p>
                  <p>售價：NT$ {effectivePrice.toLocaleString()}</p>
                  <p>活動：{campaign?.title ?? "未設定"}</p>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  {campaign ? (
                    <>
                      {saleTypeCustomerLabels[campaign.saleType]} · {campaignStatusCustomerLabels[campaign.status]}
                      {campaign.requiresSupplement ? " · 需要二補" : " · 不需要二補"}
                    </>
                  ) : (
                    "沒有可購買的活動"
                  )}
                </div>
                {campaign?.endsAt ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    結單：{formatCampaignDateTime(campaign.endsAt)}
                  </p>
                ) : null}
                {campaign?.publicNotice ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {campaign.publicNotice}
                  </p>
                ) : null}
              </article>
            );
          })
        )}
        {catalogState === "ready" && filteredCatalog.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            這個分類目前沒有商品。
          </div>
        ) : null}
      </div>

      <aside className="grid gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Cart summary</p>
          <h3 className="mt-2 text-2xl font-semibold">購物車</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
          <div className="mt-4 grid gap-2 text-sm">
            <p>項目數：{summary.itemCount}</p>
            <p>合計：NT$ {summary.totalTwd.toLocaleString()}</p>
            <p>
              販售類型：
              {summary.saleType ? saleTypeCustomerLabels[summary.saleType] : "尚未決定"}
            </p>
          </div>
          <Link
            href="/cart"
            className="mt-5 inline-flex rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            前往購物車
          </Link>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-slate-50 shadow-sm">
          <p className="text-sm font-medium text-slate-400">Rules</p>
          <p className="mt-3 text-sm leading-6 text-slate-200">
            可將不同活動商品加入購物車；結帳時系統會依販售活動自動拆分訂單，並保留下單時的商品、規格與售價。
          </p>
        </div>
      </aside>
    </section>
  );
}

function formatCampaignDateTime(value: string) {
  return value.replace("T", " ");
}
