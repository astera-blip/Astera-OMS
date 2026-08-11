import type { CartLineItem } from "@/lib/order/checkout";

const anonymousCartKey = "astera-cart-v1";

export function loadAnonymousCart(): CartLineItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(anonymousCartKey);
    return raw ? (JSON.parse(raw) as CartLineItem[]) : [];
  } catch {
    return [];
  }
}

export function saveAnonymousCart(items: CartLineItem[]) {
  window.localStorage.setItem(anonymousCartKey, JSON.stringify(items));
}

export function clearAnonymousCart() {
  window.localStorage.removeItem(anonymousCartKey);
}
