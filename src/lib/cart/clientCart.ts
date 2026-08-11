import type { CartLineItem } from "@/lib/order/checkout";

export function shouldSyncCloudCart(
  memberUid: string | null | undefined,
  loadedMemberUid: string | null,
) {
  return !memberUid || memberUid === loadedMemberUid;
}

export function mergeClientAndCloudCart(
  cloudItems: CartLineItem[],
  localItems: CartLineItem[],
): CartLineItem[] {
  if (cloudItems.length === 0) {
    return localItems;
  }

  const merged = new Map<string, CartLineItem>();

  for (const item of [...cloudItems, ...localItems]) {
    const key = `${item.productId}::${item.variantId}::${item.saleCampaignId}`;
    const existing = merged.get(key);

    if (existing) {
      merged.set(key, { ...existing, quantity: Math.max(existing.quantity, item.quantity) });
      continue;
    }

    merged.set(key, item);
  }

  return [...merged.values()];
}
