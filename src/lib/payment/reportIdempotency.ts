import { createHash } from "node:crypto";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;

export type PaymentReportIdentityInput = {
  memberUid: string;
  idempotencyKey: string;
  paymentRequestIds: string[];
  receivedAt: string;
  receivedAmountTwd: number;
  receivingPaymentAccountId: string;
  memberPaymentAccountId: string;
  memberNote: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function validatePaymentReportIdempotencyKey(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("invalid_idempotency_key");
  }
  const normalized = value.trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw new Error("invalid_idempotency_key");
  }
  return normalized;
}

export function buildPaymentReportIdentity(input: PaymentReportIdentityInput) {
  const idempotencyKey = validatePaymentReportIdempotencyKey(input.idempotencyKey);
  const paymentRequestIds = [...new Set(input.paymentRequestIds)].sort();
  const identitySeed = `${input.memberUid}\u0000${idempotencyKey}`;
  const paymentGroupId = `pgrp_${sha256(`group\u0000${identitySeed}`).slice(0, 40)}`;
  const paymentIds = paymentRequestIds.map((paymentRequestId, index) => (
    `pay_${sha256(`payment\u0000${identitySeed}\u0000${index}\u0000${paymentRequestId}`).slice(0, 40)}`
  ));
  const payloadDigest = sha256(JSON.stringify({
    memberUid: input.memberUid,
    paymentRequestIds,
    receivedAt: input.receivedAt,
    receivedAmountTwd: input.receivedAmountTwd,
    receivingPaymentAccountId: input.receivingPaymentAccountId,
    memberPaymentAccountId: input.memberPaymentAccountId,
    memberNote: input.memberNote,
  }));

  return { paymentGroupId, paymentIds, payloadDigest, paymentRequestIds };
}
