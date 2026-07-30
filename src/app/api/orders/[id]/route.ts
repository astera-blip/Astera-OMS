import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import type { CancellationRequestRecord } from "@/lib/order/cancellation";
import type { OrderItemRecord, OrderRecord } from "@/lib/order/checkout";
import type { LocalPaymentRequest } from "@/lib/payment/manualBankTransfer";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const claims = await requireFirebaseUser(request);
    const { id: orderId } = await context.params;
    const db = getAdminFirestore();
    const orderSnapshot = await db.collection("orders").doc(orderId).get();

    if (!orderSnapshot.exists) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }

    const order = orderSnapshot.data() as OrderRecord;
    if (order.memberUid !== claims.uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const [itemsSnapshot, paymentRequestsSnapshot, cancellationRequestsSnapshot] = await Promise.all([
      db.collection("orderItems").where("orderId", "==", orderId).get(),
      db.collection("paymentRequests").where("orderId", "==", orderId).get(),
      db.collection("cancellationRequests").where("orderId", "==", orderId).get(),
    ]);

    const items = itemsSnapshot.docs
      .map((snapshot) => snapshot.data() as OrderItemRecord)
      .filter((item) => item.memberUid === claims.uid);
    const paymentRequest = paymentRequestsSnapshot.docs
      .map((snapshot) => snapshot.data() as LocalPaymentRequest)
      .find((candidate) => candidate.memberUid === claims.uid) ?? null;
    const cancellationRequests = cancellationRequestsSnapshot.docs
      .map((snapshot) => snapshot.data() as CancellationRequestRecord)
      .filter((candidate) => candidate.memberUid === claims.uid);

    return NextResponse.json(serializeForResponse({
      order,
      items,
      paymentRequest,
      cancellationRequests,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" || message === "invalid_token" ? 401 : 500;

    return NextResponse.json(
      { error: status === 500 ? "internal_error" : message },
      { status },
    );
  }
}

function serializeForResponse(value: unknown): unknown {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (
    typeof value === "object"
    && "toDate" in value
    && typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (
    typeof value === "object"
    && "seconds" in value
    && typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    const { seconds, nanoseconds = 0 } = value as { seconds: number; nanoseconds?: unknown };
    return new Date(
      seconds * 1000 + (typeof nanoseconds === "number" ? Math.floor(nanoseconds / 1_000_000) : 0),
    ).toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeForResponse);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeForResponse(entry)]),
    );
  }
  return null;
}
