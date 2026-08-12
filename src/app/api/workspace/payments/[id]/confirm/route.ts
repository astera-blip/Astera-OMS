import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { confirmPendingPaymentGroup } from "@/lib/payment/confirmPendingPayment";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const { id } = await context.params;
    const body = (await request.json()) as { reason?: string };
    const reason = body.reason?.trim() ?? "";
    if (!reason) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const result = await confirmPendingPaymentGroup({
      db: getAdminFirestore(),
      paymentIds: [id],
      actorUid: claims.uid,
      reason,
    });
    const confirmation = result.confirmations[0]!;
    return NextResponse.json({
      ok: true,
      paymentId: confirmation.paymentId,
      paymentRequestStatus: confirmation.paymentRequestStatus,
      orderStatus: confirmation.orderStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" || message === "invalid_token"
      ? 401
      : message === "forbidden"
        ? 403
        : message === "not_found" || message === "order_not_found" || message === "member_email_not_found"
          ? 404
          : message === "invalid_request" || message === "invalid_payment_request" || message === "invalid_payment"
            ? 400
            : 500;
    return NextResponse.json({ error: status === 500 ? "internal_error" : message }, { status });
  }
}
