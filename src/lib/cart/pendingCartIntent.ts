import type { CartLineItem } from "@/lib/order/checkout";

const pendingCartIntentKey = "astera-pending-cart-intent-v1";

export type PendingCartIntent = Pick<
  CartLineItem,
  "productId" | "variantId" | "saleCampaignId" | "quantity"
>;

export function savePendingCartIntent(intent: PendingCartIntent) {
  if (typeof window === "undefined" || !isPendingCartIntent(intent)) {
    return;
  }

  try {
    window.sessionStorage.setItem(pendingCartIntentKey, JSON.stringify(intent));
  } catch {
    // Browser privacy settings can disable session storage. Login still proceeds.
  }
}

export function loadPendingCartIntent(): PendingCartIntent | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(pendingCartIntentKey);
    if (!raw) {
      return null;
    }
    const value: unknown = JSON.parse(raw);
    return isPendingCartIntent(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearPendingCartIntent() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(pendingCartIntentKey);
  } catch {
    // Storage cleanup is best-effort when browser storage is unavailable.
  }
}

function isPendingCartIntent(value: unknown): value is PendingCartIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const allowedKeys = ["productId", "quantity", "saleCampaignId", "variantId"];

  return keys.length === allowedKeys.length
    && keys.every((key, index) => key === allowedKeys[index])
    && isBoundedId(record.productId)
    && isBoundedId(record.variantId)
    && isBoundedId(record.saleCampaignId)
    && Number.isInteger(record.quantity)
    && Number(record.quantity) > 0
    && Number(record.quantity) <= 99;
}

function isBoundedId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}
