import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { paymentStatusLabel } from "@/lib/storefront/customerLabels";

describe("member payment report board", () => {
  const source = readFileSync("src/components/storefront/PaymentRequestsBoard.tsx", "utf8");

  it("uses a synchronous submission guard and a stable retry idempotency key", () => {
    expect(source).toContain("useRef");
    expect(source).toContain("submissionLockRef.current");
    expect(source).toContain("idempotencyDraftRef.current");
    expect(source).toContain("crypto.randomUUID()");
    expect(source).toContain("idempotencyKey,");
    expect(source).toContain('setIsSubmitting(true)');
    expect(source).toContain('"送出中…"');
  });

  it("loads and renders persistent member payment report statuses", () => {
    expect(source).toContain('fetch("/api/payments"');
    expect(source).toContain("我的付款回報");
    expect(source).toContain("paymentStatusLabel(payment.status)");
    expect(source).toContain("useSearchParams");
    expect(source).toContain("resolvePreselectedRequestIds");
    expect(source).toContain('searchParams.get("paymentRequestId")');
    expect(source).toContain("pendingReviewRequestIds.has(request.id)");
    expect(source).toContain("已回報／待確認");
  });

  it("provides the confirmed Chinese status vocabulary", () => {
    expect(paymentStatusLabel("pendingReview")).toBe("已回報／待確認");
    expect(paymentStatusLabel("confirmed")).toBe("已確認");
    expect(paymentStatusLabel("rejected")).toBe("未通過");
    expect(paymentStatusLabel("reversed")).toBe("已撤銷");
  });
});
