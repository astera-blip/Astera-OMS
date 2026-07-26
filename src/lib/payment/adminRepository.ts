import { collection, getDocs, type Firestore } from "firebase/firestore";

export type PaymentRequestAdminRecord = {
  id: string;
  memberUid: string;
  amountTwd: number;
  status: "open" | "partiallyPaid" | "paid" | "cancelled";
  dueAt?: string;
};

export type PaymentAdminRecord = {
  id: string;
  memberUid?: string;
  receivedAmountTwd: number;
  receivedAt: string;
  status: "pendingReview" | "confirmed" | "rejected";
  adminNote?: string;
};

export async function loadPaymentRequests(db: Firestore) {
  const snapshot = await getDocs(collection(db, "paymentRequests"));

  return snapshot.docs.map((paymentRequest) => ({
    id: paymentRequest.id,
    ...(paymentRequest.data() as Omit<PaymentRequestAdminRecord, "id">),
  }));
}

export async function loadPayments(db: Firestore) {
  const snapshot = await getDocs(collection(db, "payments"));

  return snapshot.docs.map((payment) => ({
    id: payment.id,
    ...(payment.data() as Omit<PaymentAdminRecord, "id">),
  }));
}
