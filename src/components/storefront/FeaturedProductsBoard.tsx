"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { HomeProductCard } from "@/components/storefront/HomeProductCard";
import {
  findCatalogItem,
  getDefaultVariant,
  type PublicCatalogItem,
} from "@/lib/catalog/publicCatalog";
import {
  featuredCampaign,
  rankClosingSoonProducts,
  rankLatestProducts,
} from "@/lib/catalog/featuredProducts";
import {
  clearPendingCartIntent,
  loadPendingCartIntent,
  savePendingCartIntent,
} from "@/lib/cart/pendingCartIntent";
import { createCartWriteQueue } from "@/lib/cart/cartWriteQueue";
import { validateCartAddition, type CartLineItem } from "@/lib/order/checkout";

type LoadState = "loading" | "ready" | "empty" | "error";

export function FeaturedProductsBoard({ mode }: { mode: "guest" | "member" }) {
  const { user, profile, signInWithGoogle } = useAuth();
  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [submittingProductId, setSubmittingProductId] = useState<string | null>(null);
  const processingIntent = useRef(false);
  const cartWriteQueue = useRef(createCartWriteQueue());

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
    queueMicrotask(() => void loadCatalog());
  }, [loadCatalog]);

  const latest = useMemo(() => rankLatestProducts(catalog), [catalog]);
  const closingSoon = useMemo(() => rankClosingSoonProducts(catalog), [catalog]);

  const writeMemberCart = useCallback((nextItem: CartLineItem) => cartWriteQueue.current(async () => {
    if (!user) {
      throw new Error("member_required");
    }
    const token = await user.getIdToken();
    const currentResponse = await fetch("/api/cart", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!currentResponse.ok) {
      throw new Error("load_cart_failed");
    }
    const currentPayload = (await currentResponse.json()) as { items?: CartLineItem[] };
    const currentItems = currentPayload.items ?? [];
    const validation = validateCartAddition(currentItems, nextItem, catalog);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const existing = currentItems.find((line) =>
      line.productId === nextItem.productId
      && line.variantId === nextItem.variantId
      && line.saleCampaignId === nextItem.saleCampaignId);
    const items = existing
      ? currentItems.map((line) => line === existing
        ? { ...line, quantity: line.quantity + nextItem.quantity }
        : line)
      : [...currentItems, nextItem];
    const saveResponse = await fetch("/api/cart", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items }),
    });
    if (!saveResponse.ok) {
      throw new Error("save_cart_failed");
    }
  }), [catalog, user]);

  useEffect(() => {
    if (!user || !profile || state !== "ready" || processingIntent.current) {
      return;
    }
    const intent = loadPendingCartIntent();
    if (!intent) {
      return;
    }
    const item = findCatalogItem(catalog, intent.productId);
    const variant = item?.variants.find((entry) => entry.id === intent.variantId);
    const campaign = item?.campaigns.find((entry) => entry.id === intent.saleCampaignId);
    if (!item || !variant || !campaign || campaign.status !== "open") {
      clearPendingCartIntent();
      queueMicrotask(() => setMessage("原先選擇的商品目前無法購買，請重新確認活動資訊。"));
      return;
    }

    processingIntent.current = true;
    queueMicrotask(() => {
      setSubmittingProductId(intent.productId);
      void writeMemberCart(intent)
        .then(() => {
          clearPendingCartIntent();
          setMessage(`登入完成，已將 ${item.product.name} 加入購物車。`);
        })
        .catch(() => setMessage("登入已完成，但商品尚未加入購物車，請再試一次。"))
        .finally(() => {
          processingIntent.current = false;
          setSubmittingProductId(null);
        });
    });
  }, [catalog, profile, state, user, writeMemberCart]);

  async function addToCart(item: PublicCatalogItem) {
    const variant = getDefaultVariant(item);
    const campaign = featuredCampaign(item);
    if (!variant || !campaign || campaign.status !== "open") {
      setMessage("這個商品目前沒有可購買的活動。");
      return;
    }

    const nextItem: CartLineItem = {
      productId: item.product.id,
      variantId: variant.id,
      saleCampaignId: campaign.id,
      quantity: 1,
    };
    if (!user) {
      savePendingCartIntent(nextItem);
      setMessage("請先使用 Google 登入；登入後會保留這項商品。");
      await signInWithGoogle();
      return;
    }

    setSubmittingProductId(item.product.id);
    try {
      await writeMemberCart(nextItem);
      setMessage(`已加入 ${item.product.name}。`);
    } catch (error) {
      setMessage(error instanceof Error && !error.message.endsWith("_failed")
        ? error.message
        : "加入購物車失敗，請確認網路後再試一次。");
    } finally {
      setSubmittingProductId(null);
    }
  }

  if (state === "loading") {
    return mode === "guest" ? (
      <GuestSellingFrame>
        <ProductSectionsSkeleton mode="guest" />
      </GuestSellingFrame>
    ) : <ProductSectionsSkeleton mode="member" />;
  }

  if (state === "error") {
    if (mode === "guest") {
      return (
        <GuestSellingFrame>
          <div className="grid gap-5 lg:grid-cols-2">
            {["即將結單", "最新商品"].map((title) => (
              <section key={title} aria-label={title} className="rounded-2xl border border-astera-border bg-astera-surface p-4 sm:p-5">
                <h2 className="font-serif text-xl sm:text-2xl">{title}</h2>
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                  <p role="alert">商品讀取失敗，請確認網路後再試一次。</p>
                  <button type="button" onClick={() => void loadCatalog()} className="mt-4 min-h-11 rounded-lg border border-red-300 bg-astera-surface px-4 font-semibold transition-colors hover:bg-red-100">
                    重新載入
                  </button>
                </div>
              </section>
            ))}
          </div>
        </GuestSellingFrame>
      );
    }
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p role="alert">商品讀取失敗，請確認網路後再試一次。</p>
        <button type="button" onClick={() => void loadCatalog()} className="mt-4 min-h-11 rounded-lg border border-red-300 bg-astera-surface px-4 font-semibold transition-colors hover:bg-red-100">
          重新載入
        </button>
      </div>
    );
  }

  const sharedProps = {
    submittingProductId,
    signedIn: !!user,
    onAddToCart: (item: PublicCatalogItem) => void addToCart(item),
  };

  if (mode === "guest") {
    return (
      <GuestSellingFrame>
        <p aria-live="polite" className="mt-2 min-h-6 text-sm text-astera-service">{message}</p>
        <div data-testid="selling-groups" className="mt-4 grid gap-5 lg:grid-cols-2">
          <ProductGroup
            title="即將結單"
            items={closingSoon.slice(0, 2)}
            testId="closing-soon-grid"
            showDeadline
            emptyText="目前沒有即將結單的商品。"
            {...sharedProps}
          />
          <ProductGroup
            title="最新商品"
            items={latest.slice(0, 2)}
            testId="latest-product-grid"
            showDeadline={false}
            emptyText="目前沒有新上架商品。"
            {...sharedProps}
          />
        </div>
      </GuestSellingFrame>
    );
  }

  return (
    <div className="grid gap-10">
      <ProductGroup
        title="最新商品"
        items={latest}
        testId="latest-product-grid"
        showDeadline={false}
        emptyText="目前沒有新上架商品。"
        standalone
        {...sharedProps}
      />
      <ProductGroup
        title="即將結單"
        items={closingSoon}
        testId="closing-soon-grid"
        showDeadline
        emptyText="目前沒有即將結單的商品。"
        standalone
        {...sharedProps}
      />
      <p aria-live="polite" className="-mt-8 min-h-6 text-sm text-astera-service">{message}</p>
    </div>
  );
}

function ProductGroup({
  title,
  items,
  testId,
  showDeadline,
  emptyText,
  standalone = false,
  submittingProductId,
  signedIn,
  onAddToCart,
}: {
  title: string;
  items: PublicCatalogItem[];
  testId: string;
  showDeadline: boolean;
  emptyText: string;
  standalone?: boolean;
  submittingProductId: string | null;
  signedIn: boolean;
  onAddToCart: (item: PublicCatalogItem) => void;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl sm:text-2xl">{title}</h2>
        {standalone ? <Link href="/products" className="inline-flex min-h-11 items-center text-sm font-semibold text-astera-brand">查看全部</Link> : null}
      </div>
      {items.length > 0 ? (
        <div data-testid={testId} className={`mt-4 grid grid-cols-2 gap-3 ${standalone ? "lg:grid-cols-4 sm:gap-5" : "sm:gap-4"}`}>
          {items.map((item) => (
            <HomeProductCard
              key={item.product.id}
              item={item}
              showDeadline={showDeadline}
              submitting={submittingProductId === item.product.id}
              signedIn={signedIn}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      ) : (
        <div data-testid={testId} className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <p className="col-span-full rounded-xl bg-astera-page px-4 py-8 text-center text-sm text-astera-secondary">{emptyText}</p>
        </div>
      )}
    </>
  );

  return standalone ? <section aria-label={title}>{content}</section> : (
    <section aria-label={title} className="rounded-2xl border border-astera-border bg-astera-surface p-4 sm:p-5">
      {content}
    </section>
  );
}

function ProductSectionsSkeleton({ mode }: { mode: "guest" | "member" }) {
  const grids = mode === "guest" ? 2 : 2;
  return (
    <div aria-live="polite" aria-busy="true" className={mode === "guest" ? "grid gap-5 lg:grid-cols-2" : "grid gap-10"}>
      {Array.from({ length: grids }, (_, groupIndex) => (
        <section key={groupIndex} className={mode === "guest" ? "rounded-2xl border border-astera-border bg-astera-surface p-4" : ""}>
          {mode === "guest" ? (
            <h2 className="font-serif text-xl sm:text-2xl">{groupIndex === 0 ? "即將結單" : "最新商品"}</h2>
          ) : <div className="h-7 w-28 animate-pulse rounded bg-astera-brand-soft" />}
          <div className={`mt-4 grid grid-cols-2 gap-3 ${mode === "member" ? "lg:grid-cols-4" : ""}`}>
            {Array.from({ length: mode === "member" ? 4 : 2 }, (_, index) => (
              <div key={index} className="rounded-xl border border-astera-border bg-astera-surface p-3">
                <div className="aspect-[4/5] animate-pulse rounded-lg bg-astera-brand-soft" />
                <div className="mt-3 h-4 animate-pulse rounded bg-astera-brand-soft" />
                <div className="mt-3 h-11 animate-pulse rounded bg-astera-brand-soft" />
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="sr-only">商品載入中。</p>
    </div>
  );
}

function GuestSellingFrame({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="selling-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-astera-brand">NOW SELLING</p>
          <h2 id="selling-heading" className="mt-2 font-serif text-2xl sm:text-3xl">正在販售</h2>
        </div>
        <Link href="/products" className="inline-flex min-h-11 items-center text-sm font-semibold text-astera-brand underline decoration-astera-border underline-offset-4">查看全部</Link>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
