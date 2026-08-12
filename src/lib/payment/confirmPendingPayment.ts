import { FieldValue } from "firebase-admin/firestore";
import type { getAdminFirestore } from "@/lib/firebase/admin";
import { attemptNotificationDelivery } from "@/lib/notification/delivery";
import { createPaymentConfirmedNotificationEvent } from "@/lib/notification/events";
import { confirmBankTransfer } from "@/lib/payment/manualBankTransfer";

type AdminFirestore = ReturnType<typeof getAdminFirestore>;

export type PaymentReconciliationIdentity = {
  transactionFingerprint: string;
  transactionAt: string;
  accountingDate: string;
  method: string;
  accountLast5: string;
  paymentGroupId: string;
};

export async function confirmPendingPaymentGroup(input: {
  db: AdminFirestore;
  paymentIds: string[];
  actorUid: string;
  reason: string;
  reconciliation?: PaymentReconciliationIdentity;
}) {
  const paymentIds = [...new Set(input.paymentIds)].sort();
  if (paymentIds.length === 0 || !input.reason.trim()) {
    throw new Error("invalid_request");
  }

  const result = await input.db.runTransaction(async (transaction) => {
    const paymentRefs = paymentIds.map((id) => input.db.collection("payments").doc(id));
    const paymentSnapshots = await Promise.all(paymentRefs.map((ref) => transaction.get(ref)));
    if (paymentSnapshots.some((snapshot) => !snapshot.exists)) {
      throw new Error("not_found");
    }
    const payments = paymentSnapshots.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    })) as Array<NonNullable<Parameters<typeof confirmBankTransfer>[0]["payment"]>>;
    if (payments.some((payment) => payment.status !== "pendingReview")) {
      throw new Error("invalid_payment");
    }
    if (input.reconciliation) {
      const groupIds = new Set(payments.map((payment) => payment.paymentGroupId ?? payment.id));
      if (groupIds.size !== 1 || !groupIds.has(input.reconciliation.paymentGroupId)) {
        throw new Error("selection_not_valid");
      }
    }

    const requestRefs = payments.map((payment) =>
      input.db.collection("paymentRequests").doc(payment.paymentRequestId));
    const requestSnapshots = await Promise.all(requestRefs.map((ref) => transaction.get(ref)));
    if (requestSnapshots.some((snapshot) => !snapshot.exists)) {
      throw new Error("not_found");
    }
    const paymentRequests = requestSnapshots.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    })) as Array<Parameters<typeof confirmBankTransfer>[0]["paymentRequest"]>;
    if (paymentRequests.some((request) => request.status === "paid" || request.status === "cancelled")) {
      throw new Error("invalid_payment_request");
    }

    const related = await Promise.all(paymentRequests.map(async (paymentRequest) => {
      const orderRef = input.db.collection("orders").doc(paymentRequest.orderId);
      const memberRef = input.db.collection("members").doc(paymentRequest.memberUid);
      const [orderSnapshot, itemsSnapshot, memberSnapshot] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(input.db.collection("orderItems").where("orderId", "==", paymentRequest.orderId)),
        transaction.get(memberRef),
      ]);
      if (!orderSnapshot.exists) {
        throw new Error("order_not_found");
      }
      const member = memberSnapshot.data() as { email?: string } | undefined;
      if (!member?.email) {
        throw new Error("member_email_not_found");
      }
      return {
        orderRef,
        memberEmail: member.email,
        orderBundle: {
          order: { id: orderSnapshot.id, ...orderSnapshot.data() },
          items: itemsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
        } as Parameters<typeof confirmBankTransfer>[0]["orderBundle"],
      };
    }));

    const reconciliationClaimRef = input.reconciliation
      ? input.db.collection("auditLogs").doc(`reconciliation_${input.reconciliation.transactionFingerprint}`)
      : null;
    if (reconciliationClaimRef) {
      const claimSnapshot = await transaction.get(reconciliationClaimRef);
      if (claimSnapshot.exists) {
        throw new Error("duplicate_reconciliation");
      }
    }

    const confirmations = payments.map((payment, index) => {
      const paymentRequest = paymentRequests[index]!;
      const relation = related[index]!;
      const confirmation = confirmBankTransfer({
        orderBundle: relation.orderBundle,
        paymentRequest,
        payment,
        receivedAmountTwd: payment.receivedAmountTwd,
        receivedAt: payment.receivedAt,
        confirmedBy: input.actorUid,
        reason: input.reason.trim(),
      });
      const notificationEvent = createPaymentConfirmedNotificationEvent({
        id: `notif_${confirmation.payment.id}`,
        memberUid: confirmation.paymentRequest.memberUid,
        recipientEmail: relation.memberEmail,
        orderId: confirmation.paymentRequest.orderId,
        orderNumber: confirmation.orderBundle.order.orderNumber,
        paymentRequestId: confirmation.paymentRequest.id,
        paymentId: confirmation.payment.id,
        createdAt: confirmation.payment.createdAt,
      });

      transaction.update(relation.orderRef, {
        status: confirmation.orderBundle.order.status,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: input.actorUid,
      });
      for (const item of confirmation.orderBundle.items) {
        transaction.update(input.db.collection("orderItems").doc(item.id), {
          status: item.status,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: item.updatedBy,
        });
      }
      transaction.update(requestRefs[index]!, {
        status: confirmation.paymentRequest.status,
        allocatedAmountTwd: confirmation.paymentRequest.allocatedAmountTwd ?? 0,
        unallocatedAmountTwd: confirmation.paymentRequest.unallocatedAmountTwd ?? 0,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: input.actorUid,
      });
      transaction.update(paymentRefs[index]!, {
        ...confirmation.payment,
        ...(input.reconciliation ? { reconciliation: {
          source: "taishin_xlsx",
          transactionFingerprint: input.reconciliation.transactionFingerprint,
          transactionAt: input.reconciliation.transactionAt,
          accountingDate: input.reconciliation.accountingDate,
          method: input.reconciliation.method,
          accountLast5: input.reconciliation.accountLast5,
        } } : {}),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: input.actorUid,
      });
      transaction.set(input.db.collection("paymentAllocations").doc(confirmation.allocation.id), {
        ...confirmation.allocation,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(input.db.collection("auditLogs").doc(confirmation.auditLog.id), {
        ...confirmation.auditLog,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(input.db.collection("notificationEvents").doc(notificationEvent.id), {
        ...notificationEvent,
        createdAt: FieldValue.serverTimestamp(),
      });
      return {
        paymentId: confirmation.payment.id,
        paymentRequestStatus: confirmation.paymentRequest.status,
        orderStatus: confirmation.orderBundle.order.status,
        notificationEventId: notificationEvent.id,
      };
    });

    if (reconciliationClaimRef && input.reconciliation) {
      transaction.set(reconciliationClaimRef, {
        action: "payment.reconciliation.claimed",
        actorUid: input.actorUid,
        targetType: "paymentGroup",
        targetId: input.reconciliation.paymentGroupId,
        paymentIds,
        reconciliation: input.reconciliation,
        reason: input.reason.trim(),
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return confirmations;
  });

  await Promise.all(result.map((confirmation) =>
    attemptNotificationDelivery(input.db, confirmation.notificationEventId).catch(() => undefined)));
  return { confirmations: result };
}
