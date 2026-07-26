"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  buildCartSummary,
  type CartLineItem,
  validateCartAddition,
} from "@/lib/order/checkout";
import {
  findCatalogItem,
  getDefaultCampaign,
  getDefaultVariant,
  type PublicCatalogItem,
} from "@/lib/catalog/publicCatalog";
import { loadCart, saveCart } from "@/lib/order/localStore";

type LoadState = "loading" | "ready" | "empty" | "error";

export function PublicProductsBoard() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);
  const [catalogState, setCatalogState] = useState<LoadState>("loading");
  const [cart, setCart] = useState<CartLineItem[]>(() => loadCart());
  const [message, setMessage] = useState("等待公開商品載入。");

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

    void syncCart().catch(() => {
      saveCart(cart);
      setMessage("購物車已暫存於本機，稍後可再同步。");
    });
  }, [cart, user]);

  useEffect(() => {
    async function loadFirestoreCart() {
      if (!user) {
        return;
      }

      const [{ db }, { loadMemberCart }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/cart/repository"),
      ]);
      setCart(await loadMemberCart(db, user.uid));
    }

    void loadFirestoreCart().catch(() => setMessage("無法載入雲端購物車，先使用本機資料。"));
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

      saveCart(nextCart);
      return nextCart;
    });
    setMessage(`已加入 ${item.product.name}。`);
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-4">
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
            目前沒有已發布的商品。
          </div>
        ) : (
          catalog.map((item) => {
            const variant = getDefaultVariant(item);
            const campaign = getDefaultCampaign(item);

            return (
              <article
                key={item.product.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
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
                <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                  <p>SKU：{variant?.sku ?? "未設定"}</p>
                  <p>售價：NT$ {variant?.priceTwd.toLocaleString() ?? "0"}</p>
                  <p>活動：{campaign?.title ?? "未設定"}</p>
                </div>
              </article>
            );
          })
        )}
      </div>

      <aside className="grid gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Cart summary</p>
          <h3 className="mt-2 text-2xl font-semibold">購物車</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
          <div className="mt-4 grid gap-2 text-sm">
            <p>項目數：{summary.itemCount}</p>
            <p>合計：NT$ {summary.totalTwd.toLocaleString()}</p>
            <p>sale type：{summary.saleType ?? "尚未決定"}</p>
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
            不同 sale type 的商品不能混在同一張訂單。建立訂單時會保存商品、規格與售價 snapshot。
          </p>
        </div>
      </aside>
    </section>
  );
}
