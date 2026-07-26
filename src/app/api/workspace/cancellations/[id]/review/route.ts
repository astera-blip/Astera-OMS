import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { reviewCancellationRequest } from "@/lib/order/cancellation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: "approved" | "rejected";
      reviewNote?: string;
    };

    if (!body.status || !body.reviewNote?.trim()) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const requestSnapshot = await db.collection("cancellationRequests").doc(id).get();
    if (!requestSnapshot.exists) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const requestRecord = requestSnapshot.data() as Parameters<typeof reviewCancellationRequest>[0];
    const reviewed = reviewCancellationRequest(requestRecord, {
      status: body.status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: claims.uid,
      reviewNote: body.reviewNote.trim(),
    });

    const batch = db.batch();
    batch.set(db.collection("cancellationRequests").doc(reviewed.id), reviewed);

    const orderSnapshot = await db.collection("orders").doc(reviewed.orderId).get();
    if (orderSnapshot.exists) {
      const order = orderSnapshot.data() as Record<string, unknown> & { id: string; memberUid: string; status: string };
      const itemsSnapshot = await db.collection("orderItems").where("orderId", "==", reviewed.orderId).get();
      const targetItemIds = new Set(reviewed.orderItemIds);

      for (const snapshot of itemsSnapshot.docs) {
        if (!targetItemIds.has(snapshot.id)) {
          continue;
        }

        batch.set(snapshot.ref, {
          ...snapshot.data(),
          status: body.status === "approved" ? "cancelled" : "awaitingPayment",
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: claims.uid,
        });
      }

      const remainingItems = itemsSnapshot.docs.filter((snapshot) => !targetItemIds.has(snapshot.id));
      const allCancelled = remainingItems.every((snapshot) => {
        const data = snapshot.data() as { status?: string };
        return data.status === "cancelled";
      }) && body.status === "approved";

      batch.set(orderSnapshot.ref, {
        ...order,
        status: allCancelled ? "cancelled" : order.status,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });

      const requestList = await db.collection("paymentRequests").where("orderId", "==", reviewed.orderId).get();
      for (const paymentSnapshot of requestList.docs) {
        batch.set(paymentSnapshot.ref, {
          ...paymentSnapshot.data(),
          status: allCancelled && body.status === "approved" ? "cancelled" : paymentSnapshot.data().status,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: claims.uid,
        });
      }
    }

    await batch.commit();
    return NextResponse.json({ ok: true, status: reviewed.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
