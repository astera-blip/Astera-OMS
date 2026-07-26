import { collection, doc, getDocs, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import type { CartDraft } from "./cart";

export type OrderRecord = {
  id: string;
  memberUid?: string;
  status: "draft" | "awaitingPayment" | "partiallyPaid" | "paid" | "processing" | "completed" | "cancelled";
  totalTwd: number;
};

export type OrderItemRecord = {
  id: string;
  orderId: string;
  memberUid?: string;
  productId: string;
  variantId: string;
  saleCampaignId: string;
  quantity: number;
  status: "awaitingPayment" | "paid" | "purchasing" | "purchased" | "waitingArrival" | "arrived" | "awaitingSupplement" | "readyToShip" | "shipped" | "completed" | "cancelRequested" | "cancelled" | "refunded";
  snapshot: {
    productName: string;
    variantName: string;
    sku: string;
    unitPriceTwd: number;
    publicSaleNotes?: string;
  };
};

export async function loadOrders(db: Firestore) {
  const snapshot = await getDocs(collection(db, "orders"));
  return snapshot.docs.map((order) => ({
    id: order.id,
    ...(order.data() as Omit<OrderRecord, "id">),
  }));
}

export async function loadOrderItems(db: Firestore, orderId: string) {
  const snapshot = await getDocs(collection(db, "orderItems"));
  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...(item.data() as Omit<OrderItemRecord, "id">),
    }))
    .filter((item) => item.orderId === orderId);
}

export async function createOrderFromCart(db: Firestore, draft: CartDraft) {
  const orderId = `order-${Date.now()}`;
  const normalizedTotal = draft.items.reduce((total, item) => total + item.unitPriceTwd * item.quantity, 0);

  await setDoc(doc(db, "orders", orderId), {
    memberUid: draft.memberUid,
    status: "awaitingPayment",
    totalTwd: normalizedTotal,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await Promise.all(
    draft.items.map((item, index) =>
      setDoc(doc(db, "orderItems", `${orderId}-${index + 1}`), {
        orderId,
        memberUid: draft.memberUid,
        productId: item.productId,
        variantId: item.variantId,
        saleCampaignId: item.saleCampaignId,
        quantity: item.quantity,
        status: "awaitingPayment",
        snapshot: {
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          unitPriceTwd: item.unitPriceTwd,
          ...(item.publicSaleNotes ? { publicSaleNotes: item.publicSaleNotes } : {}),
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  return { ok: true as const, orderId, totalTwd: normalizedTotal };
}
