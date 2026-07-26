import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { ConsentRecord, LegalDocumentVersion } from "@/lib/legal/documents";
import type { NotificationEvent } from "@/lib/notification/events";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";
import type { OrderItemRecord, OrderRecord } from "./checkout";

export type FirestoreOrderBundle = {
  order: OrderRecord;
  items: OrderItemRecord[];
  paymentRequest: LocalPaymentRequest;
  consentRecord: ConsentRecord;
  notificationEvent?: NotificationEvent;
};

export async function createOrderBundle(
  db: Firestore,
  bundle: FirestoreOrderBundle,
) {
  const batch = writeBatch(db);

  batch.set(doc(db, "orders", bundle.order.id), {
    ...bundle.order,
    createdAt: serverTimestamp(),
  });

  for (const item of bundle.items) {
    batch.set(doc(db, "orderItems", item.id), {
      ...item,
      createdAt: serverTimestamp(),
    });
  }

  batch.set(doc(db, "paymentRequests", bundle.paymentRequest.id), {
    ...bundle.paymentRequest,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "consentRecords", bundle.consentRecord.id), bundle.consentRecord);
  if (bundle.notificationEvent) {
    batch.set(doc(db, "notificationEvents", bundle.notificationEvent.id), {
      ...bundle.notificationEvent,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function listMemberOrders(
  db: Firestore,
  memberUid: string,
): Promise<Array<{ order: OrderRecord; items: OrderItemRecord[] }>> {
  const [ordersSnapshot, itemsSnapshot] = await Promise.all([
    getDocs(query(collection(db, "orders"), where("memberUid", "==", memberUid))),
    getDocs(query(collection(db, "orderItems"), where("memberUid", "==", memberUid))),
  ]);
  const items = itemsSnapshot.docs.map((snapshot) => snapshot.data() as OrderItemRecord);

  return ordersSnapshot.docs.map((snapshot) => {
    const order = snapshot.data() as OrderRecord;
    return {
      order,
      items: items.filter((item) => item.orderId === order.id),
    };
  });
}

export async function saveLegalDocumentVersion(
  db: Firestore,
  version: LegalDocumentVersion,
) {
  await setDoc(doc(db, "legalDocumentVersions", version.id), version);
}

export async function listLegalDocumentVersions(
  db: Firestore,
): Promise<LegalDocumentVersion[]> {
  const snapshot = await getDocs(collection(db, "legalDocumentVersions"));

  return snapshot.docs.map((document) => document.data() as LegalDocumentVersion);
}

export async function listConsentRecords(db: Firestore): Promise<ConsentRecord[]> {
  const snapshot = await getDocs(collection(db, "consentRecords"));

  return snapshot.docs.map((document) => document.data() as ConsentRecord);
}
