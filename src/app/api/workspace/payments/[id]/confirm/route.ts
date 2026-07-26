import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { confirmBankTransfer } from "@/lib/payment/manualBankTransfer";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as {
      receivedAmountTwd?: number;
      receivedAt?: string;
      reason?: string;
    };

    if (!body.receivedAmountTwd || !body.receivedAt || !body.reason) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const requestSnapshot = await db.collection("paymentRequests").doc(id).get();
    if (!requestSnapshot.exists) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const paymentRequest = requestSnapshot.data() as Parameters<typeof confirmBankTransfer>[0]["paymentRequest"];
    const orderSnapshot = await db.collection("orders").doc(paymentRequest.orderId).get();
    if (!orderSnapshot.exists) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }

    const itemsSnapshot = await db.collection("orderItems").where("orderId", "==", paymentRequest.orderId).get();
    const orderBundle = {
      order: orderSnapshot.data(),
      items: itemsSnapshot.docs.map((snapshot) => snapshot.data()),
    } as Parameters<typeof confirmBankTransfer>[0]["orderBundle"];

    const result = confirmBankTransfer({
      orderBundle,
      paymentRequest,
      receivedAmountTwd: body.receivedAmountTwd,
      receivedAt: body.receivedAt,
      confirmedBy: claims.uid,
      reason: body.reason,
    });

    const batch = db.batch();
    batch.set(db.collection("orders").doc(result.orderBundle.order.id), {
      ...result.orderBundle.order,
      updatedAt: FieldValue.serverTimestamp(),
    });
    for (const item of result.orderBundle.items) {
      batch.set(db.collection("orderItems").doc(item.id), {
        ...item,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    batch.set(db.collection("paymentRequests").doc(result.paymentRequest.id), {
      ...result.paymentRequest,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("payments").doc(result.payment.id), {
      ...result.payment,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("paymentAllocations").doc(result.allocation.id), {
      ...result.allocation,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("auditLogs").doc(result.auditLog.id), {
      ...result.auditLog,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({ ok: true, paymentId: result.payment.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
