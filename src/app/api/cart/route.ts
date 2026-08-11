import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import type { CartLineItem } from "@/lib/order/checkout";

type CartRequestBody = {
  items?: CartLineItem[];
};

export async function GET(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const snapshot = await getAdminFirestore().collection("carts").doc(claims.uid).get();

    return NextResponse.json({ items: snapshot.exists ? snapshot.data()?.items ?? [] : [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: message === "missing_token" ? 401 : 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    const body = (await request.json()) as CartRequestBody;
    const items = body.items ?? [];

    if (!Array.isArray(items) || items.length > 50 || items.some((item) => !isCartLineItem(item))) {
      return NextResponse.json({ error: "invalid_cart" }, { status: 400 });
    }

    await getAdminFirestore().collection("carts").doc(claims.uid).set({
      memberUid: claims.uid,
      items,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: message === "missing_token" ? 401 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);

    await getAdminFirestore().collection("carts").doc(claims.uid).delete();

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: message === "missing_token" ? 401 : 500 });
  }
}

function isCartLineItem(value: unknown): value is CartLineItem {
  const item = value as Partial<CartLineItem>;
  const quantity = item.quantity;

  return !!item
    && typeof item.productId === "string"
    && typeof item.variantId === "string"
    && typeof item.saleCampaignId === "string"
    && Number.isInteger(quantity)
    && typeof quantity === "number"
    && quantity > 0
    && quantity <= 99;
}
