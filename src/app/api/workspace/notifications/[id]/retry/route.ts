import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { attemptNotificationDelivery } from "@/lib/notification/delivery";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const db = getAdminFirestore();
    const delivered = await attemptNotificationDelivery(db, id);

    return NextResponse.json({
      ok: true,
      id: delivered.id,
      status: delivered.status,
      attemptCount: delivered.attemptCount,
      ...(delivered.providerMessageId ? { providerMessageId: delivered.providerMessageId } : {}),
      ...(delivered.lastError ? { lastError: delivered.lastError } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token"
      ? 401
      : message === "notification_not_found"
        ? 404
        : 500;

    return NextResponse.json({ error: status === 500 ? "internal_error" : message }, { status });
  }
}
