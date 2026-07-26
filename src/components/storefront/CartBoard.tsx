"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  createOrderFromCart,
  buildCartSummary,
  type CartLineItem,
} from "@/lib/order/checkout";
import { publicCatalogSeed } from "@/lib/catalog/publicCatalog";
import {
  clearCart,
  loadCart,
  loadOrders,
  loadConsentRecords,
  loadPaymentRequests,
  saveCart,
  saveConsentRecords,
  saveOrders,
  savePaymentRequests,
} from "@/lib/order/localStore";
import { createPaymentRequestForOrder } from "@/lib/payment/manualBankTransfer";
import { createConsentRecord } from "@/lib/legal/documents";
import { createOrderCreatedNotificationEvent } from "@/lib/notification/events";

export function CartBoard() {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartLineItem[]>(() => loadCart());
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

  const summary = useMemo(() => buildCartSummary(cart, publicCatalogSeed), [cart]);

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

    const timestamp = new Date().toISOString();
    const nextOrderId = `order_${timestamp.replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
    const result = createOrderFromCart(
      {
        orderId: nextOrderId,
        memberUid: user?.uid ?? "member-local",
        createdAt: timestamp,
      },
      cart,
      publicCatalogSeed,
    );

    const existingOrders = loadOrders();
    const paymentRequest = createPaymentRequestForOrder(result, {
      paymentRequestId: `pr_${nextOrderId}`,
      createdAt: timestamp,
    });
    const consentRecord = createConsentRecord({
      memberUid: result.order.memberUid,
      orderId: result.order.id,
      acceptedAt: timestamp,
    });
    const notificationEvent = createOrderCreatedNotificationEvent({
      id: `notif_${nextOrderId}`,
      memberUid: result.order.memberUid,
      orderId: result.order.id,
      paymentRequestId: paymentRequest.id,
      createdAt: timestamp,
    });
    saveOrders([{ ...result }, ...existingOrders]);
    savePaymentRequests([paymentRequest, ...loadPaymentRequests()]);
    saveConsentRecords([consentRecord, ...loadConsentRecords()]);
    if (user) {
      try {
        const [{ db }, { clearMemberCart }, { createOrderBundle }] = await Promise.all([
          import("@/lib/firebase/client"),
          import("@/lib/cart/repository"),
          import("@/lib/order/repository"),
        ]);
        await createOrderBundle(db, {
          ...result,
          paymentRequest,
          consentRecord,
          notificationEvent,
        });
        await clearMemberCart(db, user.uid);
      } catch {
        setMessage("訂單已暫存於本機，但 Firestore 建立失敗。");
        return;
      }
    }
    clearCart();
    setCart([]);
    setMessage(`已建立訂單 ${result.order.id}，付款請求 ${paymentRequest.id} 已建立。`);
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
