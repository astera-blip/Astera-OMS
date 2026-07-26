import type { CartLineItem, OrderItemRecord, OrderRecord } from "./checkout";
import type {
  LocalAuditLog,
  LocalPayment,
  LocalPaymentAllocation,
  LocalPaymentRequest,
} from "@/lib/payment/manualBankTransfer";
import type { ConsentRecord } from "@/lib/legal/documents";

const cartKey = "astera-cart-v1";
const ordersKey = "astera-orders-v1";
const paymentRequestsKey = "astera-payment-requests-v1";
const paymentsKey = "astera-payments-v1";
const allocationsKey = "astera-payment-allocations-v1";
const auditLogsKey = "astera-audit-logs-v1";
const consentRecordsKey = "astera-consent-records-v1";

export type StoredOrderBundle = {
  order: OrderRecord;
  items: OrderItemRecord[];
};

export function loadCart(): CartLineItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(cartKey);
    return raw ? (JSON.parse(raw) as CartLineItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartLineItem[]) {
  window.localStorage.setItem(cartKey, JSON.stringify(items));
}

export function loadOrders(): StoredOrderBundle[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ordersKey);
    return raw ? (JSON.parse(raw) as StoredOrderBundle[]) : [];
  } catch {
    return [];
  }
}

export function saveOrders(items: StoredOrderBundle[]) {
  window.localStorage.setItem(ordersKey, JSON.stringify(items));
}

export function clearCart() {
  window.localStorage.removeItem(cartKey);
}

export function loadPaymentRequests(): LocalPaymentRequest[] {
  return loadJson<LocalPaymentRequest[]>(paymentRequestsKey, []);
}

export function savePaymentRequests(items: LocalPaymentRequest[]) {
  window.localStorage.setItem(paymentRequestsKey, JSON.stringify(items));
}

export function loadPayments(): LocalPayment[] {
  return loadJson<LocalPayment[]>(paymentsKey, []);
}

export function savePayments(items: LocalPayment[]) {
  window.localStorage.setItem(paymentsKey, JSON.stringify(items));
}

export function loadPaymentAllocations(): LocalPaymentAllocation[] {
  return loadJson<LocalPaymentAllocation[]>(allocationsKey, []);
}

export function savePaymentAllocations(items: LocalPaymentAllocation[]) {
  window.localStorage.setItem(allocationsKey, JSON.stringify(items));
}

export function loadAuditLogs(): LocalAuditLog[] {
  return loadJson<LocalAuditLog[]>(auditLogsKey, []);
}

export function saveAuditLogs(items: LocalAuditLog[]) {
  window.localStorage.setItem(auditLogsKey, JSON.stringify(items));
}

export function loadConsentRecords(): ConsentRecord[] {
  return loadJson<ConsentRecord[]>(consentRecordsKey, []);
}

export function saveConsentRecords(items: ConsentRecord[]) {
  window.localStorage.setItem(consentRecordsKey, JSON.stringify(items));
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
