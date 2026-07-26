"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  buildCartSummary,
  type CartLineItem,
  validateShippingDetails,
} from "@/lib/order/checkout";
import type { PublicCatalogItem } from "@/lib/catalog/publicCatalog";
import {
  clearCart,
  loadCart,
  saveCart,
} from "@/lib/order/localStore";

export function CartBoard() {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartLineItem[]>(() => loadCart());
  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [shippingMethod, setShippingMethod] = useState<"address" | "seven_eleven" | "family_mart">("address");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingStoreInfo, setShippingStoreInfo] = useState("");
  const [message, setMessage] = useState("已載入購物車。");

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
      const cloudCart = await loadMemberCart(db, user.uid);
      const localCart = loadCart();

      setCart(cloudCart.length > 0 ? cloudCart : localCart);
    }

    void loadFirestoreCart().catch(() => setMessage("無法載入雲端購物車，先使用本機資料。"));
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

    try {
      const [{ auth }, { clearMemberCart }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/cart/repository"),
      ]);
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
          legalVersionIds: [],
          idempotencyKey,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string; details?: Record<string, string> } | null;
        const details = payload?.details ? Object.values(payload.details).join(" ") : "";
        setMessage(details || payload?.error || "訂單建立失敗。");
        return;
      }
      const payload = (await response.json()) as { orderId?: string };

      await clearMemberCart((await import("@/lib/firebase/client")).db, user.uid);
      clearCart();
      setCart([]);
      setMessage(`已建立訂單 ${payload.orderId ?? "新訂單"}，付款請求已建立。`);
    } catch {
      setMessage("訂單建立失敗，請確認已登入且網路可用。");
    }
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-4">
        {cart.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            購物車目前沒有商品。
          </div>
        ) : (
          cart.map((item, index) => (
            <article key={`${item.productId}-${item.variantId}-${item.saleCampaignId}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{item.productId}</h2>
                  <p className="text-sm text-slate-600">Variant {item.variantId}</p>
                </div>
                <button type="button" onClick={() => removeItem(index)} className="text-sm font-medium text-red-700">
                  移除
                </button>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <label className="text-sm font-medium">數量</label>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) => updateQuantity(index, Number(event.target.value))}
                  className="w-24 rounded-2xl border border-slate-300 px-3 py-2"
                />
              </div>
            </article>
          ))
        )}
      </div>

      <aside className="grid gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Recipient</p>
          <h3 className="mt-2 text-2xl font-semibold">收件資料</h3>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">收件人姓名</span>
              <input
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                className="rounded-2xl border border-slate-300 px-4 py-3"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">收件電話</span>
              <input
                value={recipientPhone}
                onChange={(event) => setRecipientPhone(event.target.value)}
                className="rounded-2xl border border-slate-300 px-4 py-3"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">配送方式</span>
              <select
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
              <label className="grid gap-2 text-sm">
                <span className="font-medium">收件地址</span>
                <textarea
                  value={shippingAddress}
                  onChange={(event) => setShippingAddress(event.target.value)}
                  className="min-h-24 rounded-2xl border border-slate-300 px-4 py-3"
                />
              </label>
            ) : (
              <label className="grid gap-2 text-sm">
                <span className="font-medium">超商門市資訊</span>
                <textarea
                  value={shippingStoreInfo}
                  onChange={(event) => setShippingStoreInfo(event.target.value)}
                  className="min-h-24 rounded-2xl border border-slate-300 px-4 py-3"
                />
              </label>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Checkout</p>
          <h3 className="mt-2 text-2xl font-semibold">建立訂單</h3>
          <div className="mt-4 grid gap-2 text-sm">
            <p>項目數：{summary.itemCount}</p>
            <p>合計：NT$ {summary.totalTwd.toLocaleString()}</p>
            <p>sale type：{summary.saleType ?? "尚未決定"}</p>
          </div>
          <button
            type="button"
            onClick={() => void placeOrder()}
            className="mt-5 w-full rounded-full bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950"
          >
            建立訂單
          </button>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        </div>
      </aside>
    </section>
  );
}
