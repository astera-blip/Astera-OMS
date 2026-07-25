import type { AuditMetadata, EntityId, FirebaseUid } from "./common";

export type PaymentRequestStatus =
  | "open"
  | "partiallyPaid"
  | "paid"
  | "cancelled";

export type PaymentStatus = "pendingReview" | "confirmed" | "rejected";

export type PaymentRequest = AuditMetadata & {
  id: EntityId;
  memberUid: FirebaseUid;
  amountTwd: number;
  status: PaymentRequestStatus;
  dueAt?: string;
};

export type Payment = AuditMetadata & {
  id: EntityId;
  memberUid?: FirebaseUid;
  receivedAmountTwd: number;
  receivedAt: string;
  status: PaymentStatus;
  adminNote?: string;
};

export type PaymentAllocation = AuditMetadata & {
  id: EntityId;
  paymentId: EntityId;
  targetType: "paymentRequest" | "order" | "orderItem" | "receivable" | "wallet";
  targetId: EntityId;
  amountTwd: number;
};
