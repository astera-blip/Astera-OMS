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
import type { CancellationRequestRecord } from "@/lib/order/cancellation";
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
  const items = itemsSnapshot.docs.map((snapshot) =>
    normalizeOrderItemRecord(snapshot.data() as OrderItemRecord),
  );

  return ordersSnapshot.docs.map((snapshot) => {
    const order = normalizeOrderRecord(snapshot.data() as OrderRecord);
    return {
      order,
      items: items.filter((item) => item.orderId === order.id),
    };
  }).sort((left, right) => {
    const priority = {
      awaitingPayment: 0,
      partiallyPaid: 1,
      paid: 2,
      cancelled: 3,
    } satisfies Record<OrderRecord["status"], number>;
    const priorityDifference = priority[left.order.status] - priority[right.order.status];
    return priorityDifference !== 0
      ? priorityDifference
      : right.order.createdAt.localeCompare(left.order.createdAt);
  });
}

export async function listAllOrders(
  db: Firestore,
): Promise<Array<{ order: OrderRecord; items: OrderItemRecord[] }>> {
  const [ordersSnapshot, itemsSnapshot] = await Promise.all([
    getDocs(collection(db, "orders")),
    getDocs(collection(db, "orderItems")),
  ]);
  const items = itemsSnapshot.docs.map((snapshot) =>
    normalizeOrderItemRecord(snapshot.data() as OrderItemRecord),
  );

  return ordersSnapshot.docs.map((snapshot) => {
    const order = normalizeOrderRecord(snapshot.data() as OrderRecord);
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

export async function saveCancellationRequest(
  db: Firestore,
  request: CancellationRequestRecord,
) {
  await setDoc(doc(db, "cancellationRequests", request.id), {
    ...request,
    createdAt: serverTimestamp(),
  });
}

export async function listCancellationRequests(db: Firestore): Promise<CancellationRequestRecord[]> {
  const snapshot = await getDocs(collection(db, "cancellationRequests"));

  return snapshot.docs.map((document) =>
    normalizeCancellationRequestRecord(document.data() as CancellationRequestRecord),
  );
}

export async function listMemberCancellationRequests(
  db: Firestore,
  memberUid: string,
): Promise<CancellationRequestRecord[]> {
  const snapshot = await getDocs(
    query(collection(db, "cancellationRequests"), where("memberUid", "==", memberUid)),
  );

  return snapshot.docs.map((document) =>
    normalizeCancellationRequestRecord(document.data() as CancellationRequestRecord),
  );
}

export async function reviewCancellationRequest(
  db: Firestore,
  request: CancellationRequestRecord,
) {
  await setDoc(doc(db, "cancellationRequests", request.id), {
    ...request,
    createdAt: serverTimestamp(),
  });
}

function normalizeOrderRecord(record: OrderRecord): OrderRecord {
  return {
    ...record,
    createdAt: normalizeFirestoreTimestamp(record.createdAt),
    ...(record.updatedAt ? { updatedAt: normalizeFirestoreTimestamp(record.updatedAt) } : {}),
  };
}

function normalizeOrderItemRecord(record: OrderItemRecord): OrderItemRecord {
  return {
    ...record,
    createdAt: normalizeFirestoreTimestamp(record.createdAt),
    ...(record.updatedAt ? { updatedAt: normalizeFirestoreTimestamp(record.updatedAt) } : {}),
  };
}

function normalizeCancellationRequestRecord(
  record: CancellationRequestRecord,
): CancellationRequestRecord {
  const safeRecord = sanitizeCancellationRequest(record);
  return {
    ...safeRecord,
    createdAt: normalizeFirestoreTimestamp(safeRecord.createdAt),
    ...(safeRecord.reviewedAt ? { reviewedAt: normalizeFirestoreTimestamp(safeRecord.reviewedAt) } : {}),
    ...(safeRecord.refundCompletedAt
      ? { refundCompletedAt: normalizeFirestoreTimestamp(safeRecord.refundCompletedAt) }
      : {}),
  };
}

export function sanitizeCancellationRequest(
  record: CancellationRequestRecord,
): CancellationRequestRecord {
  return {
    id: record.id,
    orderId: record.orderId,
    orderItemIds: [...record.orderItemIds],
    ...(record.requestedOrderItemIds !== undefined
      ? { requestedOrderItemIds: [...record.requestedOrderItemIds] }
      : {}),
    memberUid: record.memberUid,
    reason: record.reason,
    status: record.status,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    ...(record.reviewedAt !== undefined ? { reviewedAt: record.reviewedAt } : {}),
    ...(record.reviewedBy !== undefined ? { reviewedBy: record.reviewedBy } : {}),
    ...(record.reviewNote !== undefined ? { reviewNote: record.reviewNote } : {}),
    ...(record.refundAmountTwd !== undefined ? { refundAmountTwd: record.refundAmountTwd } : {}),
    ...(record.refundCompletedAt !== undefined
      ? { refundCompletedAt: record.refundCompletedAt }
      : {}),
    ...(record.refundReference !== undefined ? { refundReference: record.refundReference } : {}),
    ...(record.targetPaymentId !== undefined ? { targetPaymentId: record.targetPaymentId } : {}),
    ...(record.targetPaymentRequestId !== undefined
      ? { targetPaymentRequestId: record.targetPaymentRequestId }
      : {}),
    ...(record.refundRequestedAmountTwd !== undefined
      ? { refundRequestedAmountTwd: record.refundRequestedAmountTwd }
      : {}),
    ...(record.refundItemAllocations !== undefined
      ? { refundItemAllocations: record.refundItemAllocations.map((item) => ({ ...item })) }
      : {}),
    ...(record.refundBankCode !== undefined ? { refundBankCode: record.refundBankCode } : {}),
    ...(record.refundAccountLast5 !== undefined
      ? { refundAccountLast5: record.refundAccountLast5 }
      : {}),
  };
}

function normalizeFirestoreTimestamp(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (
    value
    && typeof value === "object"
    && "toDate" in value
    && typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (
    value
    && typeof value === "object"
    && "seconds" in value
    && typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    const { seconds, nanoseconds = 0 } = value as { seconds: number; nanoseconds?: unknown };
    const milliseconds = seconds * 1000 + (typeof nanoseconds === "number" ? Math.floor(nanoseconds / 1_000_000) : 0);
    return new Date(milliseconds).toISOString();
  }
  return "";
}
