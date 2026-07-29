"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { mergeClientAndCloudCart } from "@/lib/cart/clientCart";
import {
  currentLegalVersionIds,
  legalDocumentVersions,
  supplementRuleContent,
} from "@/lib/legal/documents";
import {
  buildCartSummary,
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

export function CartBoard() {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartLineItem[]>(() => loadAnonymousCart());
  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [shippingMethod, setShippingMethod] = useState<"address" | "seven_eleven" | "family_mart">("address");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingStoreInfo, setShippingStoreInfo] = useState("");
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [acceptedSupplementRule, setAcceptedSupplementRule] = useState(false);
  const [message, setMessage] = useState("已載入購物車。");
  const [placingOrder, setPlacingOrder] = useState(false);

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
      const merged = mergeClientAndCloudCart(payload.items ?? [], loadAnonymousCart());
      setCart(merged);
      clearAnonymousCart();
    }

    void loadFirestoreCart().catch(() => setMessage("無法載入購物車，請確認網路後再試一次。"));
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
  const isOrderDisabled = placingOrder || isCartEmpty;

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
      shippingAddress,
      shippingStoreInfo,
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
            ...(shippingCheck.value.shippingAddress ? { shippingAddress: shippingCheck.value.shippingAddress } : {}),
            ...(shippingCheck.value.shippingStoreInfo ? { shippingStoreInfo: shippingCheck.value.shippingStoreInfo } : {}),
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
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="font-medium text-slate-900">購物車目前沒有商品。</p>
            <p className="mt-2 text-sm text-slate-600">請先加入商品，再回到這裡確認收件資料與建立訂單。</p>
            <Link href="/products" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-4 text-sm font-medium text-white">
              前往商品列表
            </Link>
          </div>
        ) : (
          cart.map((item, index) => {
            const product = findCatalogItem(catalog, item.productId);
            const variant = product?.variants.find((entry) => entry.id === item.variantId);

            return (
              <article key={`${item.productId}-${item.variantId}-${item.saleCampaignId}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{product?.product.name ?? "商品資訊載入中"}</h2>
                    <p className="text-sm text-slate-600">{variant?.name ?? "商品規格資訊載入中"}</p>
                  </div>
                  <button type="button" onClick={() => removeItem(index)} className="text-sm font-medium text-red-700">
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
                    className="w-24 rounded-2xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </article>
            );
          })
        )}
      </div>

      <aside className="grid gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
                className="rounded-2xl border border-slate-300 px-4 py-3"
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
                className="rounded-2xl border border-slate-300 px-4 py-3"
              />
            </label>
            <label htmlFor="shippingMethod" className="grid gap-2 text-sm">
              <span className="font-medium">配送方式</span>
              <select
                id="shippingMethod"
                name="shippingMethod"
                value={shippingMethod}
                onChange={(event) => setShippingMethod(event.target.value as typeof shippingMethod)}
                className="rounded-2xl border border-slate-300 px-4 py-3"
              >
                <option value="address">宅配地址</option>
                <option value="seven_eleven">7-Eleven 賣貨便</option>
                <option value="family_mart">全家好賣+ / 店到店</option>
              </select>
            </label>
            {shippingMethod === "address" ? (
              <label htmlFor="shippingAddress" className="grid gap-2 text-sm">
                <span className="font-medium">收件地址</span>
                <textarea
                  id="shippingAddress"
                  name="shippingAddress"
                  autoComplete="street-address"
                  value={shippingAddress}
                  onChange={(event) => setShippingAddress(event.target.value)}
                  className="min-h-24 rounded-2xl border border-slate-300 px-4 py-3"
                />
              </label>
            ) : (
              <label htmlFor="shippingStoreInfo" className="grid gap-2 text-sm">
                <span className="font-medium">超商門市資訊</span>
                <textarea
                  id="shippingStoreInfo"
                  name="shippingStoreInfo"
                  value={shippingStoreInfo}
                  onChange={(event) => setShippingStoreInfo(event.target.value)}
                  className="min-h-24 rounded-2xl border border-slate-300 px-4 py-3"
                />
              </label>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">購物車摘要</p>
          <h3 className="mt-2 text-2xl font-semibold">建立訂單</h3>
          <div className="mt-4 grid gap-2 text-sm">
            <p>項目數：{summary.itemCount}</p>
            <p>合計：NT$ {summary.totalTwd.toLocaleString()}</p>
            <p>
              販售類型：
              {summary.saleType ? saleTypeCustomerLabels[summary.saleType] : "尚未決定"}
            </p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-slate-700">
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
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {legalDocuments.map((document) => (
                <div key={document.id} className="not-first:mt-4">
                  <p className="font-medium text-slate-900">
                    {document.title} <span className="text-xs text-slate-500">v{document.version}</span>
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
            <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-slate-700">
              <p className="font-medium text-slate-900">{supplementRuleContent.title}</p>
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
            className="mt-5 min-h-11 w-full rounded-full bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {placingOrder ? "建立中…" : isCartEmpty ? "請先加入商品" : "建立訂單"}
          </button>
          <p aria-live="polite" className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        </div>
      </aside>
    </section>
  );
}
