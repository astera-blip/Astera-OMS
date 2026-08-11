"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProductCoverImage } from "@/components/storefront/ProductCoverImage";
import {
  findCatalogItem,
  getDefaultVariant,
  getEffectiveCatalogPriceTwd,
  type PublicCatalogItem,
} from "@/lib/catalog/publicCatalog";
import {
  featuredCampaign,
  formatCampaignDeadline,
  rankFeaturedProducts,
  saleTypeCustomerLabels,
} from "@/lib/catalog/featuredProducts";
import {
  clearPendingCartIntent,
  loadPendingCartIntent,
  savePendingCartIntent,
} from "@/lib/cart/pendingCartIntent";
import { validateCartAddition, type CartLineItem } from "@/lib/order/checkout";
import { formatCampaignDateTime } from "@/lib/product/campaignDates";

type LoadState = "loading" | "ready" | "empty" | "error";

const classificationKeys = ["artist", "cp", "series", "brand", "company"] as const;

export function FeaturedProductsBoard() {
  const { user, profile, signInWithGoogle } = useAuth();
  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [submittingProductId, setSubmittingProductId] = useState<string | null>(null);
  const processingIntent = useRef(false);

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

  const writeMemberCart = useCallback(async (nextItem: CartLineItem) => {
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
      ? currentItems.map((line) => line === existing ? { ...line, quantity: line.quantity + nextItem.quantity } : line)
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
  }, [catalog, user]);

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
    return (
      <div aria-live="polite" aria-busy="true">
        <div className="mb-8 h-32 animate-pulse rounded-xl border border-astera-border bg-astera-brand-soft" />
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-xl border border-astera-border bg-astera-surface p-3">
              <div className="aspect-[4/5] animate-pulse rounded-lg bg-astera-brand-soft" />
              <div className="mt-4 h-4 animate-pulse rounded bg-astera-brand-soft" />
              <div className="mt-3 h-11 animate-pulse rounded bg-astera-brand-soft" />
            </div>
          ))}
        </div>
        <p className="sr-only">推薦商品載入中。</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p role="alert">推薦商品讀取失敗，請確認網路後再試一次。</p>
        <button type="button" onClick={() => void loadCatalog()} className="mt-4 min-h-11 rounded-lg border border-red-300 bg-astera-surface px-4 font-semibold transition-colors hover:bg-red-100">
          重新載入
        </button>
      </div>
    );
  }

  if (state === "empty" || featured.length === 0) {
    return (
      <div className="rounded-xl border border-astera-border bg-astera-surface p-8 text-center">
        <h2 className="font-serif text-2xl">目前沒有開放販售的商品</h2>
        <p className="mt-3 text-sm leading-6 text-astera-secondary">新的活動與商品準備好後會在這裡公開，歡迎稍後再回來看看。</p>
      </div>
    );
  }

  return (
    <div className="grid gap-14">
      <section aria-labelledby="campaign-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-astera-brand">LATEST CAMPAIGNS</p>
            <h2 id="campaign-heading" className="mt-3 font-serif text-3xl sm:text-4xl">最新活動</h2>
          </div>
          <Link href="/brand#campaigns" className="inline-flex min-h-11 items-center text-sm font-semibold text-astera-brand underline decoration-astera-border underline-offset-4">查看 Campaign／品牌</Link>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-3" aria-label="最新 Campaign">
          {campaigns.map(({ item, campaign }) => (
            <Link key={campaign.id} href={`/products/${item.product.id}`} className="group rounded-xl border border-astera-border bg-astera-surface p-5 transition-colors hover:border-astera-brand">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-astera-campaign px-3 py-1 text-xs font-semibold">{saleTypeCustomerLabels[campaign.saleType]}</span>
                {campaign.requiresSupplement ? <span className="rounded-full border border-astera-service px-3 py-1 text-xs font-semibold text-astera-service">可能二補</span> : null}
              </div>
              <h3 className="mt-5 text-lg font-semibold group-hover:text-astera-brand">{campaign.title}</h3>
              <p className="mt-2 text-sm text-astera-secondary">{classificationSummary(item)}</p>
              <p className="mt-5 text-sm font-semibold tabular-nums text-astera-service">{formatCampaignDeadline(campaign.endsAt)}</p>
              {campaign.endsAt ? <p className="mt-1 text-xs text-astera-secondary">{formatCampaignDateTime(campaign.endsAt)}</p> : null}
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="products-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-astera-catalog">CURATED GOODS</p>
            <h2 id="products-heading" className="mt-3 font-serif text-3xl sm:text-4xl">推薦商品</h2>
          </div>
          <Link href="/products" className="inline-flex min-h-11 items-center text-sm font-semibold text-astera-brand underline decoration-astera-border underline-offset-4">看全部商品</Link>
        </div>
        <p aria-live="polite" className="mt-3 min-h-6 text-sm text-astera-service">{message}</p>
        <div data-testid="featured-product-grid" className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {featured.map((item) => {
            const variant = getDefaultVariant(item);
            const campaign = featuredCampaign(item);
            const price = variant ? getEffectiveCatalogPriceTwd(variant, campaign) : 0;
            const canBuy = campaign?.status === "open" && !!variant;
            const submitting = submittingProductId === item.product.id;
            return (
              <article key={item.product.id} className="flex min-w-0 flex-col rounded-xl border border-astera-border bg-astera-surface p-3 transition-colors hover:border-astera-brand sm:p-4">
                <Link href={`/products/${item.product.id}`} className="block rounded-lg">
                  <ProductCoverImage image={item.product.images?.[0]} productName={item.product.name} />
                </Link>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {campaign ? <span className="rounded-full bg-astera-campaign px-2.5 py-1 text-[11px] font-semibold sm:text-xs">{saleTypeCustomerLabels[campaign.saleType]}</span> : null}
                  {campaign?.requiresSupplement ? <span className="rounded-full bg-astera-brand-soft px-2.5 py-1 text-[11px] font-semibold text-astera-service sm:text-xs">二補</span> : null}
                </div>
                <Link href={`/products/${item.product.id}`} className="mt-3 line-clamp-2 font-semibold leading-6 hover:text-astera-brand">{item.product.name}</Link>
                <p className="mt-3 text-lg font-semibold tabular-nums">NT$ {price.toLocaleString()}</p>
                <div className="mt-2 min-h-16 text-xs leading-5 text-astera-secondary">
                  <p className="line-clamp-1">{campaign?.title ?? "販售活動準備中"}</p>
                  <p className="mt-1 tabular-nums text-astera-service">{formatCampaignDeadline(campaign?.endsAt)}</p>
                </div>
                <button
                  type="button"
                  disabled={!canBuy || submitting}
                  onClick={() => void addToCart(item)}
                  className="mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-astera-brand px-3 text-sm font-semibold text-white transition-colors hover:bg-astera-ink disabled:cursor-not-allowed disabled:bg-astera-border disabled:text-astera-secondary"
                >
                  {submitting ? "加入中…" : canBuy ? (user ? "加入購物車" : "登入後加入") : "目前無法購買"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function classificationSummary(item: PublicCatalogItem) {
  const labels = classificationKeys
    .map((key) => item.product.classifications?.[key]?.label)
    .filter((label): label is string => !!label);
  return labels.length > 0 ? labels.slice(0, 3).join("／") : item.product.name;
}
