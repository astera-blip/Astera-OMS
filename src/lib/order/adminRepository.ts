import { collection, getDocs, type Firestore } from "firebase/firestore";

export type OrderAdminRecord = {
  id: string;
  memberUid?: string;
  status: string;
  totalTwd: number;
};

export type OrderItemAdminRecord = {
  id: string;
  orderId: string;
  memberUid?: string;
  productId: string;
  variantId: string;
  saleCampaignId: string;
  quantity: number;
  status: string;
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
    ...(order.data() as Omit<OrderAdminRecord, "id">),
  }));
}

export async function loadOrderItems(db: Firestore, orderId?: string) {
  const snapshot = await getDocs(collection(db, "orderItems"));

  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...(item.data() as Omit<OrderItemAdminRecord, "id">),
    }))
    .filter((item) => (orderId ? item.orderId === orderId : true));
}
