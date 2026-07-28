import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import type { NotificationEvent } from "@/lib/notification/events";
import { deliverNotificationEvent, getResendNotificationConfig } from "@/lib/notification/resend";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const db = getAdminFirestore();
    const ref = db.collection("notificationEvents").doc(id);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const event = snapshot.data() as NotificationEvent;
    if (event.status === "sent") {
      return NextResponse.json({ error: "already_sent" }, { status: 400 });
    }

    const delivered = await deliverNotificationEvent(event, {
      attemptedAt: new Date().toISOString(),
      config: getResendNotificationConfig(),
    });

    await ref.set({
      ...delivered,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: claims.uid,
    }, { merge: true });

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
    const status = message === "missing_token" ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
