import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import type { CartLineItem } from "@/lib/order/checkout";

export type StoredCart = {
  memberUid: string;
  items: CartLineItem[];
};

export async function loadMemberCart(
  db: Firestore,
  memberUid: string,
): Promise<CartLineItem[]> {
  const snapshot = await getDoc(doc(db, "carts", memberUid));

  if (!snapshot.exists()) {
    return [];
  }

  return (snapshot.data() as StoredCart).items ?? [];
}

export async function saveMemberCart(
  db: Firestore,
  memberUid: string,
  items: CartLineItem[],
) {
  await setDoc(doc(db, "carts", memberUid), {
    memberUid,
    items,
    updatedAt: serverTimestamp(),
  });
}

export async function clearMemberCart(db: Firestore, memberUid: string) {
  await deleteDoc(doc(db, "carts", memberUid));
}
