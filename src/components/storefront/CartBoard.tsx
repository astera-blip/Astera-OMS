"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { mergeClientAndCloudCart, shouldSyncCloudCart } from "@/lib/cart/clientCart";
import {
  currentLegalVersionIds,
  legalDocumentVersions,
  supplementRuleContent,
} from "@/lib/legal/documents";
import {
  buildCartSummary,
  isCheckoutSubmissionReady,
  type CartLineItem,
  validateShippingDetails,
} from "@/lib/order/checkout";
import { findCatalogItem, type PublicCatalogItem } from "@/lib/catalog/publicCatalog";
import {
  clearAnonymousCart,
  loadAnonymousCart,
  saveAnonymousCart,
} from "@/lib/cart/anonymousCart";
import { saleTypeCustomerLabels } from "@/lib/catalog/featuredProducts";

export function CartBoard({ showCheckoutStep = true }: { showCheckoutStep?: boolean }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartLineItem[]>(() => loadAnonymousCart());
  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const shippingMethod = "seven_eleven" as const;
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [acceptedSupplementRule, setAcceptedSupplementRule] = useState(false);
  const [message, setMessage] = useState("已載入購物車。");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [loadedMemberUid, setLoadedMemberUid] = useState<string | null>(null);

  useEffect(() => {
    async function syncCart() {
      if (!shouldSyncCloudCart(user?.uid, loadedMemberUid)) {
        return;
      }

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
  }, [cart, loadedMemberUid, user]);

  useEffect(() => {
    let cancelled = false;

    async function loadFirestoreCart() {
      if (!user) {
        setLoadedMemberUid(null);
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
      const merged = mergeClientAndCloudCart(payload.items ?? [], loadAnonymousCart());
      if (cancelled) {
        return;
      }
      setCart(merged);
      clearAnonymousCart();
      setLoadedMemberUid(user.uid);
    }

    void loadFirestoreCart().catch(() => setMessage("無法載入購物車，請確認網路後再試一次。"));

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    async function loadCatalog() {
      const [{ db }, { listPublicProducts }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/product/repository"),
      ]);
      setCatalog(await listPublicProducts(db));
    }

    void loadCatalog().catch(() => setCatalog([]));
  }, []);

  const summary = useMemo(() => buildCartSummary(cart, catalog), [cart, catalog]);
  const legalDocuments = legalDocumentVersions.filter(
    (document) => document.documentType === "terms" || document.documentType === "privacy",
  );
  const isCartEmpty = cart.length === 0;
  const checkoutSubmissionReady = isCheckoutSubmissionReady({
    recipientName,
    recipientPhone,
    shippingMethod,
    acceptedLegalTerms,
    acceptedSupplementRule,
  });
  const isOrderDisabled = placingOrder || isCartEmpty || !user || catalog.length === 0 || !checkoutSubmissionReady;

  function updateQuantity(index: number, quantity: number) {
    setCart((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    );
  }

  function removeItem(index: number) {
    setCart((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function placeOrder() {
    if (cart.length === 0) {
      setMessage("購物車是空的。");
      return;
    }

    if (!user) {
      setMessage("請先登入再建立訂單。");
      return;
    }

    if (catalog.length === 0) {
      setMessage("公開商品尚未載入，無法建立訂單。");
      return;
    }
    if (!acceptedLegalTerms || !acceptedSupplementRule) {
      setMessage("請先同意下單條款、隱私權政策與二補規則。");
      return;
    }

    const shippingCheck = validateShippingDetails({
      recipientName,
      recipientPhone,
      shippingMethod,
    });

    if (!shippingCheck.ok) {
      setMessage(Object.values(shippingCheck.errors).filter(Boolean).join(" "));
      return;
    }

    const timestamp = new Date().toISOString();
    const idempotencyKey = `${user.uid}_${timestamp.replaceAll(/[-:.TZ]/g, "").slice(0, 17)}`;

    setPlacingOrder(true);
    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        setMessage("請重新登入後再建立訂單。");
        return;
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
          body: JSON.stringify({
            cart,
            recipientName: shippingCheck.value.recipientName,
            recipientPhone: shippingCheck.value.recipientPhone,
            shippingMethod,
            legalVersionIds: currentLegalVersionIds(),
            acceptedLegalTerms,
            acceptedSupplementRule,
            idempotencyKey,
          }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string; details?: Record<string, string> } | null;
        const details = payload?.details ? Object.values(payload.details).join(" ") : "";
        setMessage(details || payload?.error || "訂單建立失敗。");
        return;
      }
      const payload = (await response.json()) as {
        orderId?: string;
        orders?: Array<{ orderId: string; orderNumber?: string; totalTwd?: number }>;
      };

      await fetch("/api/cart", {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
       clearAnonymousCart();
      setCart([]);
      setAcceptedLegalTerms(false);
      setAcceptedSupplementRule(false);
      const orderLabels = payload.orders?.map((order) => order.orderNumber ?? order.orderId).join("、");
      setMessage(`已建立訂單 ${orderLabels || payload.orderId || "新訂單"}，付款請求已建立。`);
    } catch {
      setMessage("訂單建立失敗，請確認已登入且網路可用。");
    } finally {
      setPlacingOrder(false);
    }
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-4">
        {isCartEmpty ? (
          <div className="rounded-xl border border-astera-border bg-astera-surface p-6">
            <p className="font-medium text-astera-ink">購物車目前沒有商品。</p>
            <p className="mt-2 text-sm text-astera-secondary">請先加入商品，再回到這裡確認訂單。</p>
            <Link href="/products" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-astera-brand px-4 text-sm font-medium text-white">
              前往商品列表
            </Link>
          </div>
        ) : (
          cart.map((item, index) => {
            const product = findCatalogItem(catalog, item.productId);
            const variant = product?.variants.find((entry) => entry.id === item.variantId);

            return (
              <article key={`${item.productId}-${item.variantId}-${item.saleCampaignId}`} className="rounded-xl border border-astera-border bg-astera-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{product?.product.name ?? "商品資訊載入中"}</h2>
                    <p className="text-sm text-astera-secondary">{variant?.name ?? "商品規格資訊載入中"}</p>
                  </div>
                  <button type="button" onClick={() => removeItem(index)} className="min-h-11 text-sm font-medium text-red-700">
                    移除
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <label className="text-sm font-medium">數量</label>
                  <input
                    id={`cartQuantity-${index}`}
                    name={`cartQuantity-${index}`}
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => updateQuantity(index, Number(event.target.value))}
                    className="min-h-11 w-24 rounded-lg border border-astera-border px-3 py-2"
                  />
                </div>
              </article>
            );
          })
        )}
      </div>

      <aside className="grid gap-4">
        {showCheckoutStep ? (
          <div className="rounded-xl border border-astera-border bg-astera-surface p-5">
            <p className="text-sm font-semibold text-astera-service">結帳步驟</p>
            <p className="mt-2 text-sm leading-6 text-astera-secondary">
              購物車確認完成後，前往獨立結帳頁填寫收件資料與條款同意。
            </p>
            <Link
              href="/checkout"
              className={`mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold ${
                isCartEmpty || !user
                  ? "cursor-not-allowed bg-astera-border text-astera-secondary"
                  : "bg-astera-brand text-white hover:bg-astera-ink"
              }`}
              aria-disabled={isCartEmpty || !user}
              onClick={(event) => {
                if (isCartEmpty || !user) {
                  event.preventDefault();
                }
              }}
            >
              {showCheckoutStep ? "前往結帳" : "確認訂單"}
            </Link>
            {isCartEmpty ? <p className="mt-3 text-sm text-astera-secondary">請先加入商品。</p> : !user ? <p className="mt-3 text-sm text-astera-secondary">請先登入後再前往結帳。</p> : null}
          </div>
        ) : null}
        {!showCheckoutStep ? <>
        <div className="rounded-xl border border-astera-border bg-astera-surface p-5">
          <p className="text-sm font-semibold text-slate-500">收件資訊</p>
          <h3 className="mt-2 text-2xl font-semibold">收件資料</h3>
          <div className="mt-4 grid gap-3">
            <label htmlFor="recipientName" className="grid gap-2 text-sm">
              <span className="font-medium">收件人姓名</span>
              <input
                id="recipientName"
                name="recipientName"
                autoComplete="name"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                className="min-h-11 rounded-lg border border-astera-border px-4 py-3"
              />
            </label>
            <label htmlFor="recipientPhone" className="grid gap-2 text-sm">
              <span className="font-medium">收件電話</span>
              <input
                id="recipientPhone"
                name="recipientPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={recipientPhone}
                onChange={(event) => setRecipientPhone(event.target.value)}
                className="min-h-11 rounded-lg border border-astera-border px-4 py-3"
              />
            </label>
            <div className="grid gap-2 text-sm">
              <span className="font-medium">配送方式</span>
              <input
                id="shippingMethod"
                name="shippingMethod"
                type="hidden"
                value={shippingMethod}
              />
              <p className="min-h-11 rounded-lg border border-astera-border px-4 py-3 font-medium">7-Eleven 賣貨便</p>
              <p className="text-xs text-astera-secondary">目前僅提供 7-Eleven 賣貨便。</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-astera-border bg-astera-surface p-5">
          <p className="text-sm font-semibold text-astera-service">購物車摘要</p>
          <h3 className="mt-2 text-2xl font-semibold">建立訂單</h3>
          <div className="mt-4 grid gap-2 text-sm">
            <p>項目數：{summary.itemCount}</p>
            <p>合計：NT$ {summary.totalTwd.toLocaleString()}</p>
            <p>
              販售類型：
              {summary.saleType ? saleTypeCustomerLabels[summary.saleType] : "尚未決定"}
            </p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-astera-ink">
            <label htmlFor="acceptedLegalTerms" className="flex items-start gap-3">
              <input
                id="acceptedLegalTerms"
                name="acceptedLegalTerms"
                type="checkbox"
                checked={acceptedLegalTerms}
                onChange={(event) => setAcceptedLegalTerms(event.target.checked)}
                className="mt-1"
              />
              <span>
                我同意
                <Link className="mx-1 underline underline-offset-4" href="/terms">下單條款</Link>
                與
                <Link className="mx-1 underline underline-offset-4" href="/privacy">隱私權政策</Link>
                。
              </span>
            </label>
            <div className="rounded-lg bg-astera-page p-4 text-sm leading-6 text-astera-secondary">
              {legalDocuments.map((document) => (
                <div key={document.id} className="not-first:mt-4">
                  <p className="font-medium text-astera-ink">
                    {document.title} <span className="text-xs text-astera-secondary">v{document.version}</span>
                  </p>
                  <p className="mt-1">{document.body}</p>
                </div>
              ))}
            </div>
            <label htmlFor="acceptedSupplementRule" className="flex items-start gap-3">
              <input
                id="acceptedSupplementRule"
                name="acceptedSupplementRule"
                type="checkbox"
                checked={acceptedSupplementRule}
                onChange={(event) => setAcceptedSupplementRule(event.target.checked)}
                className="mt-1"
              />
              <span>我了解此代購商品可能依實際運費、匯率或官方配貨結果產生二補。</span>
            </label>
            <div className="rounded-lg bg-astera-campaign/30 p-4 text-sm leading-6 text-astera-ink">
              <p className="font-medium text-astera-ink">{supplementRuleContent.title}</p>
              <p className="mt-1">{supplementRuleContent.summary}</p>
              <ul className="mt-2 list-disc pl-5">
                {supplementRuleContent.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void placeOrder()}
            disabled={isOrderDisabled}
            className="mt-5 min-h-11 w-full rounded-lg bg-astera-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-astera-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {placingOrder ? "建立中…" : isCartEmpty ? "請先加入商品" : !user ? "請先登入" : "建立訂單"}
          </button>
          {!isOrderDisabled || placingOrder || isCartEmpty || !user || catalog.length === 0 ? null : (
            <p className="mt-3 text-sm leading-6 text-astera-secondary">
              請填寫收件人姓名、有效手機號碼，並同意下單條款、隱私權政策與二補規則。
            </p>
          )}
          <p aria-live="polite" className="mt-3 text-sm leading-6 text-astera-secondary">{message}</p>
        </div>
        </> : null}
      </aside>
    </section>
  );
}
