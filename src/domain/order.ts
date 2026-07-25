import type { AuditMetadata, EntityId, FirebaseUid } from "./common";

export type OrderStatus =
  | "draft"
  | "awaitingPayment"
  | "partiallyPaid"
  | "paid"
  | "processing"
  | "completed"
  | "cancelled";

export type OrderItemStatus =
  | "awaitingPayment"
  | "paid"
  | "purchasing"
  | "purchased"
  | "waitingArrival"
  | "arrived"
  | "awaitingSupplement"
  | "readyToShip"
  | "shipped"
  | "completed"
  | "cancelRequested"
  | "cancelled"
  | "refunded";

export type OrderItemSnapshot = {
  productName: string;
  variantName: string;
  sku: string;
  unitPriceTwd: number;
  publicSaleNotes?: string;
};

export type Order = AuditMetadata & {
  id: EntityId;
  memberUid?: FirebaseUid;
  guestCustomerId?: EntityId;
  status: OrderStatus;
  totalTwd: number;
};

export type OrderItem = AuditMetadata & {
  id: EntityId;
  orderId: EntityId;
  memberUid?: FirebaseUid;
  productId: EntityId;
  variantId: EntityId;
  saleCampaignId: EntityId;
  quantity: number;
  status: OrderItemStatus;
  snapshot: OrderItemSnapshot;
};
