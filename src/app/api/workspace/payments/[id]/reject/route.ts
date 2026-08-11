import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as { reason?: string };
    const reason = body.reason?.trim() ?? "";
    if (!id || !reason) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const result = await db.runTransaction(async (transaction) => {
      const paymentRef = db.collection("payments").doc(id);
      const paymentSnapshot = await transaction.get(paymentRef);
      if (!paymentSnapshot.exists) {
        throw new Error("not_found");
      }

      const payment = paymentSnapshot.data() as { status?: string };
      if (payment.status === "rejected") {
        return { paymentId: id, paymentStatus: "rejected", alreadyRejected: true };
      }
      if (payment.status !== "pendingReview") {
        throw new Error("invalid_payment");
      }

      transaction.update(paymentRef, {
        status: "rejected",
        rejectionReason: reason,
        rejectedAt: FieldValue.serverTimestamp(),
        rejectedBy: claims.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
      transaction.set(db.collection("auditLogs").doc(`audit_reject_${id}`), {
        action: "payment.rejected",
        actorUid: claims.uid,
        targetType: "payment",
        targetId: id,
        reason,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { paymentId: id, paymentStatus: "rejected", alreadyRejected: false };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token"
      ? 401
      : message === "forbidden"
        ? 403
        : message === "not_found"
          ? 404
          : message === "invalid_payment"
            ? 409
            : 500;
    return NextResponse.json(
      { error: status === 500 ? "internal_error" : message },
      { status },
    );
  }
}
