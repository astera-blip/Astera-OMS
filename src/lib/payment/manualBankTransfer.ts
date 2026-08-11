import type { OrderItemRecord, OrderRecord } from "@/lib/order/checkout";
import type { OrderBundle } from "@/lib/order/checkout";
import type { AccountIdentity } from "@/lib/payment/accountIdentity";
import type { PublicPaymentAccount } from "@/lib/payment/bankAccounts";
import { isUsableFingerprintIdentity } from "@/lib/payment/fingerprintIdentity.mjs";

export type MemberPaymentAccountIdentitySnapshot = Pick<
  AccountIdentity,
  "bankCode" | "accountNumberLast5"
> & Partial<Pick<
  AccountIdentity,
  "accountFingerprint" | "fingerprintAlgorithm" | "fingerprintKeyVersion"
>> & {
  payerName?: string;
};

export type LocalPaymentRequest = {
  id: string;
  memberUid: string;
  orderId: string;
  amountTwd: number;
  status: "open" | "partiallyPaid" | "paid" | "cancelled";
  method: "bankTransfer";
  dueAt?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  unallocatedAmountTwd?: number;
  allocatedAmountTwd?: number;
};

export type LocalPayment = {
  id: string;
  memberUid: string;
  paymentRequestId: string;
  paymentGroupId?: string;
  receivedAmountTwd: number;
  receivedAt: string;
  status: "pendingReview" | "confirmed" | "rejected" | "reversed";
  transferAccountLast5?: string;
  receivingPaymentAccountId?: string;
  receivingPaymentAccount?: PublicPaymentAccount;
  memberPaymentAccountId?: string;
  memberPaymentAccount?: MemberPaymentAccountIdentitySnapshot;
  manualFingerprintReviewRequired?: boolean;
  payerName?: string;
  memberNote?: string;
  adminNote?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type MemberPaymentSummary = Pick<
  LocalPayment,
  | "id"
  | "paymentRequestId"
  | "paymentGroupId"
  | "receivedAmountTwd"
  | "receivedAt"
  | "status"
  | "memberNote"
  | "createdAt"
> & {
  receivingAccountDisplay: string;
  memberAccountDisplay: string;
};

export type LocalPaymentAllocation = {
  id: string;
  paymentId: string;
  kind?: "payment" | "adjustment";
  targetType: "paymentRequest" | "order" | "orderItem" | "receivable" | "wallet";
  targetId: string;
  amountTwd: number;
  createdAt: string;
  createdBy: string;
};

export type LocalAuditLog = {
  id: string;
  action: "payment.confirmed" | "payment.reversed" | "order.status.updated";
  actorUid: string;
  targetType: "paymentRequest" | "order";
  targetId: string;
  reason: string;
  createdAt: string;
};

export function createPaymentRequestForOrder(
  orderBundle: OrderBundle,
  context: { paymentRequestId: string; createdAt: string; dueAt?: string },
): LocalPaymentRequest {
  return {
    id: context.paymentRequestId,
    memberUid: orderBundle.order.memberUid,
    orderId: orderBundle.order.id,
    amountTwd: orderBundle.order.totalTwd,
    status: "open",
    method: "bankTransfer",
    ...(context.dueAt ? { dueAt: context.dueAt } : {}),
    createdAt: context.createdAt,
    createdBy: "system",
  };
}

export function allocatePaymentReportAmount(
  receivedAmountTwd: number,
  requests: ReadonlyArray<{
    id: string;
    amountTwd: number;
    allocatedAmountTwd?: number;
  }>,
) {
  let remaining = Math.max(0, Math.trunc(receivedAmountTwd));

  return requests.flatMap((request) => {
    const outstanding = Math.max(request.amountTwd - (request.allocatedAmountTwd ?? 0), 0);
    const allocated = Math.min(remaining, outstanding);
    remaining -= allocated;

    return allocated > 0
      ? [{ paymentRequestId: request.id, receivedAmountTwd: allocated }]
      : [];
  });
}

export function buildMemberPaymentAccountIdentitySnapshot(
  identity: AccountIdentity & { payerName?: string },
): MemberPaymentAccountIdentitySnapshot {
  const snapshot: MemberPaymentAccountIdentitySnapshot = {
    bankCode: identity.bankCode,
    accountNumberLast5: identity.accountNumberLast5,
    ...(identity.payerName ? { payerName: identity.payerName } : {}),
  };

  return hasUsableFingerprint(identity)
    ? {
        ...snapshot,
        accountFingerprint: identity.accountFingerprint,
        fingerprintAlgorithm: identity.fingerprintAlgorithm,
        fingerprintKeyVersion: identity.fingerprintKeyVersion,
      }
    : snapshot;
}

export function withPaymentFingerprintReviewCapability<T extends LocalPayment>(
  payment: T,
): T & { manualFingerprintReviewRequired: boolean } {
  return {
    ...payment,
    manualFingerprintReviewRequired: !hasUsableFingerprint(payment.memberPaymentAccount),
  };
}

export function hasUsableFingerprint(
  identity: Partial<Pick<
    AccountIdentity,
    "accountFingerprint" | "fingerprintAlgorithm" | "fingerprintKeyVersion"
  >> | undefined,
): boolean {
  return isUsableFingerprintIdentity(identity);
}

export function getPaymentAccountLast5(payment: LocalPayment): string | undefined {
  return payment.memberPaymentAccount?.accountNumberLast5 ?? payment.transferAccountLast5;
}

export function confirmBankTransfer(input: {
  orderBundle: OrderBundle;
  paymentRequest: LocalPaymentRequest;
  payment?: LocalPayment;
  receivedAmountTwd: number;
  receivedAt: string;
  confirmedBy: string;
  reason: string;
}): {
  orderBundle: OrderBundle;
  paymentRequest: LocalPaymentRequest;
  payment: LocalPayment;
  allocation: LocalPaymentAllocation;
  auditLog: LocalAuditLog;
} {
  const paymentId = input.payment?.id ?? `pay_${input.paymentRequest.id}`;
  const previouslyAllocated = input.paymentRequest.allocatedAmountTwd ?? 0;
  const remainingAmount = Math.max(input.paymentRequest.amountTwd - previouslyAllocated, 0);
  const allocatedFromPayment = Math.min(input.receivedAmountTwd, remainingAmount);
  const allocatedAmountTwd = previouslyAllocated + allocatedFromPayment;
  const unallocatedAmountTwd =
    (input.paymentRequest.unallocatedAmountTwd ?? 0)
    + Math.max(input.receivedAmountTwd - allocatedFromPayment, 0);
  const orderStatus =
    allocatedAmountTwd >= input.paymentRequest.amountTwd ? "paid" : "partiallyPaid";
  const itemStatus = orderStatus === "paid" ? "paid" : "awaitingPayment";

  return {
    orderBundle: {
      order: updateOrder(input.orderBundle.order, orderStatus, input.receivedAt, input.confirmedBy),
      items: input.orderBundle.items.map((item) =>
        item.status === "cancelled"
          ? item
          : updateOrderItem(item, itemStatus, input.receivedAt, input.confirmedBy),
      ),
    },
    paymentRequest: {
      ...input.paymentRequest,
      status: orderStatus === "paid" ? "paid" : "partiallyPaid",
      allocatedAmountTwd,
      unallocatedAmountTwd,
      updatedAt: input.receivedAt,
      updatedBy: input.confirmedBy,
    },
    payment: {
      ...input.payment,
      id: paymentId,
      memberUid: input.paymentRequest.memberUid,
      paymentRequestId: input.paymentRequest.id,
      receivedAmountTwd: input.receivedAmountTwd,
      receivedAt: input.receivedAt,
      status: "confirmed",
      adminNote: input.reason,
      createdAt: input.payment?.createdAt ?? input.receivedAt,
      createdBy: input.payment?.createdBy ?? input.confirmedBy,
      updatedAt: input.receivedAt,
      updatedBy: input.confirmedBy,
    },
    allocation: {
      id: `alloc_${paymentId}`,
      paymentId,
      kind: "payment",
      targetType: "paymentRequest",
      targetId: input.paymentRequest.id,
      amountTwd: allocatedFromPayment,
      createdAt: input.receivedAt,
      createdBy: input.confirmedBy,
    },
    auditLog: {
      id: `audit_${paymentId}`,
      action: "payment.confirmed",
      actorUid: input.confirmedBy,
      targetType: "paymentRequest",
      targetId: input.paymentRequest.id,
      reason: input.reason,
      createdAt: input.receivedAt,
    },
  };
}

export function reverseConfirmedPayment(input: {
  orderBundle: OrderBundle;
  paymentRequest: LocalPaymentRequest;
  payment: LocalPayment;
  allocatedAmountTwd?: number;
  reversedAt: string;
  reversedBy: string;
  reason: string;
}): {
  orderBundle: OrderBundle;
  paymentRequest: LocalPaymentRequest;
  payment: LocalPayment;
  adjustment: LocalPaymentAllocation;
  auditLog: LocalAuditLog;
} {
  if (input.payment.status !== "confirmed") {
    throw new Error("invalid_payment");
  }
  const allocatedByPayment =
    input.allocatedAmountTwd
    ?? Math.min(
      input.payment.receivedAmountTwd,
      input.paymentRequest.allocatedAmountTwd ?? input.paymentRequest.amountTwd,
    );
  const allocatedAmountTwd = Math.max(
    (input.paymentRequest.allocatedAmountTwd ?? input.paymentRequest.amountTwd)
      - allocatedByPayment,
    0,
  );
  const unallocatedFromPayment = Math.max(
    input.payment.receivedAmountTwd - allocatedByPayment,
    0,
  );
  const unallocatedAmountTwd = Math.max(
    (input.paymentRequest.unallocatedAmountTwd ?? 0) - unallocatedFromPayment,
    0,
  );
  const reopenedStatus =
    allocatedAmountTwd === 0
      ? "awaitingPayment"
      : allocatedAmountTwd >= input.paymentRequest.amountTwd
        ? "paid"
        : "partiallyPaid";
  const paymentRequestStatus =
    reopenedStatus === "awaitingPayment"
      ? "open"
      : reopenedStatus === "paid"
        ? "paid"
        : "partiallyPaid";

  return {
    orderBundle: {
      order: updateOrder(input.orderBundle.order, reopenedStatus, input.reversedAt, input.reversedBy),
      items: input.orderBundle.items.map((item) =>
        item.status === "cancelled"
          ? item
          : updateOrderItem(
            item,
            reopenedStatus === "paid" ? "paid" : "awaitingPayment",
            input.reversedAt,
            input.reversedBy,
          ),
      ),
    },
    paymentRequest: {
      ...input.paymentRequest,
      status: paymentRequestStatus,
      allocatedAmountTwd,
      unallocatedAmountTwd,
      updatedAt: input.reversedAt,
      updatedBy: input.reversedBy,
    },
    payment: {
      ...input.payment,
      status: "reversed",
      adminNote: input.reason,
      updatedAt: input.reversedAt,
      updatedBy: input.reversedBy,
    },
    adjustment: {
      id: `adj_${input.payment.id}_${input.reversedAt.replace(/[^0-9]/g, "")}`,
      paymentId: input.payment.id,
      kind: "adjustment",
      targetType: "paymentRequest",
      targetId: input.paymentRequest.id,
      amountTwd: -allocatedByPayment,
      createdAt: input.reversedAt,
      createdBy: input.reversedBy,
    },
    auditLog: {
      id: `audit_reverse_${input.payment.id}`,
      action: "payment.reversed",
      actorUid: input.reversedBy,
      targetType: "paymentRequest",
      targetId: input.paymentRequest.id,
      reason: input.reason,
      createdAt: input.reversedAt,
    },
  };
}

function updateOrder(
  order: OrderRecord,
  status: OrderRecord["status"],
  updatedAt: string,
  updatedBy: string,
): OrderRecord {
  return {
    ...order,
    status,
    updatedAt,
    updatedBy,
  };
}

function updateOrderItem(
  item: OrderItemRecord,
  status: "paid" | "awaitingPayment",
  updatedAt: string,
  updatedBy: string,
): OrderItemRecord {
  return {
    ...item,
    status,
    updatedAt,
    updatedBy,
  };
}
