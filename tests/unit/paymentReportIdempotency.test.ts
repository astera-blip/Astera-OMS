import { describe, expect, it } from "vitest";
import {
  buildPaymentReportIdentity,
  validatePaymentReportIdempotencyKey,
} from "@/lib/payment/reportIdempotency";

const input = {
  memberUid: "member-a",
  idempotencyKey: "pay_12345678-1234-4234-9234-123456789abc",
  paymentRequestIds: ["pr-b", "pr-a"],
  receivedAt: "2026-08-11",
  receivedAmountTwd: 1040,
  receivingPaymentAccountId: "receiving-1",
  memberPaymentAccountId: "member-account-1",
  memberNote: "測試付款",
};

describe("payment report idempotency", () => {
  it("accepts bounded URL-safe keys and rejects missing or unsafe keys", () => {
    expect(validatePaymentReportIdempotencyKey(input.idempotencyKey)).toBe(input.idempotencyKey);
    expect(() => validatePaymentReportIdempotencyKey("")).toThrow("invalid_idempotency_key");
    expect(() => validatePaymentReportIdempotencyKey("short")).toThrow("invalid_idempotency_key");
    expect(() => validatePaymentReportIdempotencyKey("contains spaces and secrets")).toThrow("invalid_idempotency_key");
    expect(() => validatePaymentReportIdempotencyKey("a".repeat(129))).toThrow("invalid_idempotency_key");
  });

  it("produces stable opaque group and allocation IDs", () => {
    const first = buildPaymentReportIdentity(input);
    const replay = buildPaymentReportIdentity({
      ...input,
      paymentRequestIds: ["pr-a", "pr-b"],
    });

    expect(replay).toEqual(first);
    expect(first.paymentGroupId).toMatch(/^pgrp_[a-f0-9]{40}$/);
    expect(first.paymentIds).toEqual([
      expect.stringMatching(/^pay_[a-f0-9]{40}$/),
      expect.stringMatching(/^pay_[a-f0-9]{40}$/),
    ]);
    expect(first.paymentGroupId).not.toContain(input.memberUid);
    expect(first.paymentGroupId).not.toContain(input.idempotencyKey);
  });

  it("changes the digest and IDs when immutable input changes", () => {
    const first = buildPaymentReportIdentity(input);
    const changed = buildPaymentReportIdentity({ ...input, receivedAmountTwd: 1041 });

    expect(changed.payloadDigest).not.toBe(first.payloadDigest);
    expect(changed.paymentGroupId).toBe(first.paymentGroupId);
    expect(changed.paymentIds).toEqual(first.paymentIds);
  });

  it("does not let note object ordering affect the canonical digest", () => {
    const first = buildPaymentReportIdentity(input);
    const replay = buildPaymentReportIdentity({ ...input });

    expect(replay.payloadDigest).toBe(first.payloadDigest);
  });
});
