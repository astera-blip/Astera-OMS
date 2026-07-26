"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { buildCartSummary, type CartLineItem, validateCartAddition } from "@/lib/order/checkout";
import {
  getDefaultCampaign,
  getDefaultVariant,
  getPurchasableCampaigns,
  getPurchasableVariants,
  type PublicCatalogItem,
} from "@/lib/catalog/publicCatalog";
import { loadCart, saveCart } from "@/lib/order/localStore";

type Props = {
  productId: string;
};

export function PublicProductDetailBoard({ productId }: Props) {
  const { user } = useAuth();
  const [catalogItem, setCatalogItem] = useState<PublicCatalogItem | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [cart, setCart] = useState<CartLineItem[]>(() => loadCart());
  const [message, setMessage] = useState("等待商品資料載入。");

  useEffect(() => {
    async function loadCatalogItem() {
      setStatus("loading");

      const [{ db }, { getPublicProduct }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/product/repository"),
      ]);

      const item = await getPublicProduct(db, productId);
      if (!item || item.product.publishState !== "published") {
        setCatalogItem(null);
        setStatus("missing");
        return;
      }

      setCatalogItem(item);
      setSelectedVariantId((current) => current || getDefaultVariant(item)?.id || "");
      setSelectedCampaignId((current) => current || getDefaultCampaign(item)?.id || "");
      setStatus("ready");
    }

    void loadCatalogItem().catch(() => {
      setCatalogItem(null);
      setStatus("error");
      setMessage("商品讀取失敗，請稍後再試。");
    });
  }, [productId]);

  useEffect(() => {
    async function syncCart() {
      if (!user) {
        saveCart(cart);
        return;
      }

      const [{ db }, { saveMemberCart }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/cart/repository"),
      ]);
      await saveMemberCart(db, user.uid, cart);
    }

    void syncCart().catch(() => saveCart(cart));
  }, [cart, user]);

  const summary = useMemo(() => buildCartSummary(cart, catalogItem ? [catalogItem] : []), [cart, catalogItem]);
  const variants = catalogItem ? getPurchasableVariants(catalogItem) : [];
  const campaigns = catalogItem ? getPurchasableCampaigns(catalogItem) : [];
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? null;
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;

  function addToCart() {
    if (!catalogItem || !selectedVariant || !selectedCampaign || selectedCampaign.status !== "open") {
      setMessage("這個商品目前沒有可購買的活動。");
      return;
    }

    const nextItem: CartLineItem = {
      productId: catalogItem.product.id,
      variantId: selectedVariant.id,
      saleCampaignId: selectedCampaign.id,
      quantity: 1,
    };
    const validation = validateCartAddition(cart, nextItem, [catalogItem]);

    if (!validation.ok) {
      setMessage(validation.error);
      return;
    }

    const nextCart = [...cart, nextItem];
    setCart(nextCart);
    saveCart(nextCart);
    setMessage(`已加入 ${catalogItem.product.name}。`);
  }

  if (status === "loading") {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">商品載入中。</div>;
  }

  if (status === "error") {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">商品讀取失敗，請稍後再試。</div>;
  }

  if (status === "missing" || !catalogItem) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-lg font-semibold">找不到這個商品</p>
        <p className="mt-2 text-sm text-slate-600">它可能尚未發布、已封存，或沒有公開可購買的內容。</p>
        <Link href="/products" className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
          回到商品列表
        </Link>
      </div>
    );
  }

  const availableCampaign = selectedCampaign ?? getDefaultCampaign(catalogItem);

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Public product</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{catalogItem.product.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{catalogItem.product.publicDescription}</p>
          </div>
          <Link href="/products" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            回列表
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">規格</span>
            <select
              value={selectedVariantId}
              onChange={(event) => setSelectedVariantId(event.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-3"
            >
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name} / {variant.sku}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">活動</span>
            <select
              value={selectedCampaignId}
              onChange={(event) => setSelectedCampaignId(event.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-3"
            >
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.title} / {campaign.saleType}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
          <p>售價：NT$ {selectedVariant?.priceTwd.toLocaleString() ?? "0"}</p>
          <p>sale type：{availableCampaign?.saleType ?? "尚未設定"}</p>
          <p>二補提示：{availableCampaign?.requiresSupplement ? "需要" : "不需要"}</p>
          <p>狀態：{availableCampaign?.status ?? "未設定"}</p>
        </div>

        {catalogItem.product.classifications ? (
          <div className="mt-6 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            {Object.entries(catalogItem.product.classifications).map(([key, value]) => (
              <p key={key}>
                <span className="font-medium">{key}：</span>
                {value?.label}
              </p>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={addToCart}
          className="mt-6 inline-flex rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950"
        >
          加入購物車
        </button>
      </article>

      <aside className="grid gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Cart summary</p>
          <h2 className="mt-2 text-2xl font-semibold">購物車</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
          <div className="mt-4 grid gap-2 text-sm">
            <p>項目數：{summary.itemCount}</p>
            <p>合計：NT$ {summary.totalTwd.toLocaleString()}</p>
            <p>sale type：{summary.saleType ?? "尚未決定"}</p>
          </div>
          <Link href="/cart" className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
            前往購物車
          </Link>
        </div>
      </aside>
    </section>
  );
}
