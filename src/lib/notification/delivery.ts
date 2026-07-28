import { randomUUID } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { NotificationEvent } from "@/lib/notification/events";
import {
  deliverNotificationEvent,
  getResendNotificationConfig,
  type ResendNotificationConfig,
  type ResendSendPayload,
  type ResendSendResult,
} from "@/lib/notification/resend";

const deliveryLockDurationMs = 5 * 60 * 1000;

export function acquireNotificationDeliveryLock(
  event: NotificationEvent,
  lockId: string,
  now: Date,
): NotificationEvent & { acquired: boolean } {
  if (
    event.status === "sent"
    || (event.deliveryLockUntil && new Date(event.deliveryLockUntil).getTime() > now.getTime())
  ) {
    return { ...event, acquired: false };
  }
  return {
    ...event,
    acquired: true,
    deliveryLockId: lockId,
    deliveryLockUntil: new Date(now.getTime() + deliveryLockDurationMs).toISOString(),
  };
}

export async function attemptNotificationDelivery(
  db: Firestore,
  eventId: string,
  now = new Date(),
  options?: {
    config?: ResendNotificationConfig;
    send?: (payload: ResendSendPayload, apiKey: string) => Promise<ResendSendResult>;
  },
): Promise<NotificationEvent> {
  const ref = db.collection("notificationEvents").doc(eventId);
  const lockId = randomUUID();
  const locked = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      throw new Error("notification_not_found");
    }
    const event = snapshot.data() as NotificationEvent;
    const candidate = acquireNotificationDeliveryLock(event, lockId, now);
    if (!candidate.acquired) {
      return candidate;
    }
    transaction.set(ref, {
      deliveryLockId: candidate.deliveryLockId,
      deliveryLockUntil: candidate.deliveryLockUntil,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return candidate;
  });
  if (!locked.acquired) {
    const event = { ...locked } as NotificationEvent & { acquired?: boolean };
    delete event.acquired;
    return event;
  }

  const delivered = await deliverNotificationEvent(locked, {
    attemptedAt: now.toISOString(),
    config: options?.config ?? getResendNotificationConfig(),
    ...(options?.send ? { send: options.send } : {}),
  });
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data() as NotificationEvent | undefined;
    if (!current || current.deliveryLockId !== lockId) {
      return;
    }
    const persisted = { ...delivered } as NotificationEvent;
    delete persisted.deliveryLockId;
    delete persisted.deliveryLockUntil;
    transaction.set(ref, {
      ...persisted,
      deliveryLockId: FieldValue.delete(),
      deliveryLockUntil: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  const result = { ...delivered };
  delete result.deliveryLockId;
  delete result.deliveryLockUntil;
  return result;
}
