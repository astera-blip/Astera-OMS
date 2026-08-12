"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProductCoverImage } from "@/components/storefront/ProductCoverImage";
import { loadAnonymousCart } from "@/lib/cart/anonymousCart";
import { findCatalogItem, type PublicCatalogItem } from "@/lib/catalog/publicCatalog";
import { buildCartSummary, type CartLineItem } from "@/lib/order/checkout";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HeaderCartDrawer({ open, onClose }: Props) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartLineItem[]>(() => loadAnonymousCart());
  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);

  const loadDrawerData = useCallback(async () => {
    try {
      const [{ db }, { listPublicProducts }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/product/repository"),
      ]);
      const nextCatalog = (await listPublicProducts(db)).filter(
        (item) => item.product.publishState === "published",
      );
      setCatalog(nextCatalog);
    } catch {
      // The drawer must still allow cart navigation if public catalog data is
      // temporarily unavailable (including smoke tests without Firebase config).
      setCatalog([]);
    }

    if (!user) {
      setCart(loadAnonymousCart());
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/cart", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { items?: CartLineItem[] };
      setCart(payload.items ?? []);
    } catch {
      // Keep the current summary visible until the next successful sync.
    }
  }, [user]);

  useEffect(() => {
    if (!open) {
      return;
    }
    queueMicrotask(() => void loadDrawerData());
  }, [loadDrawerData, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const summary = useMemo(() => buildCartSummary(cart, catalog), [cart, catalog]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" aria-hidden={false}>
      <button
        type="button"
        aria-label="關閉購物車"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-astera-ink/20"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="header-cart-drawer-title"
        className="relative flex min-h-dvh w-full max-w-sm flex-col border-l border-astera-border bg-astera-surface p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-astera-service">購物車摘要</p>
            <h2 id="header-cart-drawer-title" className="mt-1 font-serif text-2xl text-astera-ink">購物車（{summary.itemCount}）</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-astera-border text-xl text-astera-ink transition-colors hover:bg-astera-brand-soft"
            aria-label="關閉購物車"
          >
            ×
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="mt-8 rounded-xl border border-astera-border bg-astera-page p-4 text-sm leading-6 text-astera-secondary">
            購物車目前沒有商品。先去看看正在販售的商品吧。
          </div>
        ) : (
          <div className="mt-6 grid gap-4 overflow-y-auto pr-1">
            {cart.map((line) => {
              const item = findCatalogItem(catalog, line.productId);
              const variant = item?.variants.find((entry) => entry.id === line.variantId);
              return (
                <article key={`${line.productId}-${line.variantId}-${line.saleCampaignId}`} className="flex gap-3 border-b border-astera-border pb-4">
                  <div className="w-16 shrink-0">
                    <ProductCoverImage image={item?.product.images?.[0]} productName={item?.product.name ?? "商品圖片"} />
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-astera-ink">{item?.product.name ?? "商品資料載入中"}</p>
                    <p className="mt-1 text-astera-secondary">{variant?.name ?? "規格資訊載入中"} × {line.quantity}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-auto border-t border-astera-border pt-4">
          <div className="flex items-center justify-between text-base font-semibold text-astera-ink">
            <span>小計</span><span>NT$ {summary.totalTwd.toLocaleString()}</span>
          </div>
          <div className="mt-4 grid gap-2">
            <Link href="/cart" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-astera-border px-4 text-sm font-semibold text-astera-ink transition-colors hover:bg-astera-brand-soft">
              查看購物車
            </Link>
            <Link href="/checkout" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-astera-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-astera-ink">
              前往結帳
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
