import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { attemptNotificationDelivery } from "@/lib/notification/delivery";
import {
  buildDuplicateAccountOutcomeTransition,
  sanitizeOwnerNotificationEvent,
  type DuplicateAccountNotificationEvent,
  type DuplicateAccountNotificationOutcome,
} from "@/lib/notification/events";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const db = getAdminFirestore();
    const body = await request.json().catch(() => ({})) as { outcome?: unknown };
    if (body.outcome !== undefined) {
      const outcome = body.outcome;
      if (!isDuplicateAccountOutcome(outcome)) {
        return NextResponse.json({ error: "invalid_notification_outcome" }, { status: 400 });
      }

      const actedAt = new Date().toISOString();
      const reviewed = await db.runTransaction(async (transaction) => {
        const eventRef = db.collection("notificationEvents").doc(id);
        const eventSnapshot = await transaction.get(eventRef);
        if (!eventSnapshot.exists) {
          throw new Error("notification_not_found");
        }
        const event = {
          id,
          ...(eventSnapshot.data() as Omit<DuplicateAccountNotificationEvent, "id">),
        };
        if (
          event.type !== "memberPaymentAccount.exactDuplicate"
          && event.type !== "memberPaymentAccount.last5Collision"
        ) {
          throw new Error("notification_outcome_not_supported");
        }
        const transition = buildDuplicateAccountOutcomeTransition(event, {
          outcome,
          actorUid: claims.uid,
          actedAt,
        });
        transaction.update(eventRef, transition.eventUpdate);
        const auditRef = db.collection("auditLogs").doc();
        transaction.create(auditRef, {
          id: auditRef.id,
          ...transition.audit,
        });
        return {
          ...event,
          ...transition.eventUpdate,
        };
      });

      return NextResponse.json(sanitizeOwnerNotificationEvent(reviewed));
    }

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
        : message === "notification_already_reviewed"
          ? 409
          : message === "notification_outcome_not_supported"
            ? 400
        : 500;

    return NextResponse.json({ error: status === 500 ? "internal_error" : message }, { status });
  }
}

function isDuplicateAccountOutcome(value: unknown): value is DuplicateAccountNotificationOutcome {
  return value === "confirmedDifferent" || value === "confirmedDuplicate";
}
