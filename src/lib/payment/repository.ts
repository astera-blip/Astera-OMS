import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { OrderBundle } from "@/lib/order/checkout";
import type { NotificationEvent } from "@/lib/notification/events";
import type {
  LocalAuditLog,
  LocalPayment,
  LocalPaymentAllocation,
  LocalPaymentRequest,
} from "./manualBankTransfer";

export async function listMemberPaymentRequests(
  db: Firestore,
  memberUid: string,
): Promise<LocalPaymentRequest[]> {
  const snapshot = await getDocs(
    query(collection(db, "paymentRequests"), where("memberUid", "==", memberUid)),
  );

  return snapshot.docs.map((document) => document.data() as LocalPaymentRequest);
}

export async function listAllPaymentRequests(db: Firestore): Promise<LocalPaymentRequest[]> {
  const snapshot = await getDocs(collection(db, "paymentRequests"));

  return snapshot.docs.map((document) => document.data() as LocalPaymentRequest);
}

export async function listAllPayments(db: Firestore): Promise<LocalPayment[]> {
  const snapshot = await getDocs(collection(db, "payments"));

  return snapshot.docs.map((document) => document.data() as LocalPayment);
}

export async function confirmPaymentBundle(
  db: Firestore,
  input: {
    orderBundle: OrderBundle;
    paymentRequest: LocalPaymentRequest;
    payment: LocalPayment;
    allocation: LocalPaymentAllocation;
    auditLog: LocalAuditLog;
    notificationEvent?: NotificationEvent;
  },
) {
  const batch = writeBatch(db);

  batch.set(doc(db, "payments", input.payment.id), {
    ...input.payment,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "paymentAllocations", input.allocation.id), {
    ...input.allocation,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "auditLogs", input.auditLog.id), {
    ...input.auditLog,
    createdAt: serverTimestamp(),
  });
  if (input.notificationEvent) {
    batch.set(doc(db, "notificationEvents", input.notificationEvent.id), {
      ...input.notificationEvent,
      createdAt: serverTimestamp(),
    });
  }
  batch.update(doc(db, "paymentRequests", input.paymentRequest.id), {
    status: input.paymentRequest.status,
    updatedAt: serverTimestamp(),
    updatedBy: input.paymentRequest.updatedBy,
  });
  batch.update(doc(db, "orders", input.orderBundle.order.id), {
    status: input.orderBundle.order.status,
    updatedAt: serverTimestamp(),
    updatedBy: input.orderBundle.order.updatedBy,
  });

  for (const item of input.orderBundle.items) {
    batch.update(doc(db, "orderItems", item.id), {
      status: item.status,
      updatedAt: serverTimestamp(),
      updatedBy: item.updatedBy,
    });
  }

  await batch.commit();
}

export async function updatePaymentRequestStatus(
  db: Firestore,
  requestId: string,
  status: LocalPaymentRequest["status"],
  updatedBy: string,
) {
  await updateDoc(doc(db, "paymentRequests", requestId), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy,
  });
}
