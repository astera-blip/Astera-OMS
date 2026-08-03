import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { readRefundAccountForOwner } from "@/lib/payment/refundAccountVault";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const refundAccount = await readRefundAccountForOwner(id);
    await getAdminFirestore().collection("auditLogs").doc().set({
      action: "refund.account.revealed",
      actorUid: claims.uid,
      targetType: "cancellationRequest",
      targetId: id,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ refundAccount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token"
      ? 401
      : message === "forbidden"
        ? 403
        : message === "cancellation_request_not_found"
          ? 404
          : message === "refund_account_expired" || message === "refund_account_unavailable"
            ? 410
            : 500;
    return NextResponse.json({ error: status === 500 ? "internal_error" : message }, { status });
  }
}
