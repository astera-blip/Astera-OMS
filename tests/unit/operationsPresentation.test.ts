import { describe, expect, it } from "vitest";
import {
  classificationSaveFeedback,
  formatOperationsOrderReference,
  paymentReviewStatusLabel,
} from "@/lib/workspace/operationsPresentation";

describe("operations presentation", () => {
  it("uses the formal order number when the order has one", () => {
    expect(formatOperationsOrderReference({
      id: "order_internal_001",
      orderNumber: "AST-20260815-0007",
      createdAt: "2026-08-15T12:34:00.000Z",
    })).toBe("AST-20260815-0007");
  });

  it("turns a legacy order identifier into a readable timestamp instead of exposing the document id", () => {
    expect(formatOperationsOrderReference({
      id: "order_20260726075437",
      createdAt: "2026-07-26T07:54:37.000Z",
    })).toBe("歷史訂單・2026/07/26 07:54");
  });

  it("uses an embedded legacy timestamp when an old order id starts with a member identifier", () => {
    expect(formatOperationsOrderReference({
      id: "order_h6rg9HE7zrVrnNqzOaF6CLCVERB2_20260811060824683_1",
    })).toBe("歷史訂單・2026/08/11 06:08");
  });

  it("uses a non-identifying fallback when a legacy order has no readable date", () => {
    expect(formatOperationsOrderReference({
      id: "h6rg9HE7zrVrnNqzOaF6CLCVERB2",
    })).toBe("歷史訂單");
  });

  it("translates payment review statuses for operations staff", () => {
    expect(paymentReviewStatusLabel("pendingReview")).toBe("待確認");
    expect(paymentReviewStatusLabel("confirmed")).toBe("已確認");
    expect(paymentReviewStatusLabel("rejected")).toBe("已拒絕");
    expect(paymentReviewStatusLabel("reversed")).toBe("已撤銷");
  });

  it("gives each classification row an immediate, human-readable save result", () => {
    expect(classificationSaveFeedback({ state: "saving" })).toBe("儲存中…");
    expect(classificationSaveFeedback({ state: "saved", label: "AW" })).toBe("已儲存 AW。");
    expect(classificationSaveFeedback({ state: "error", error: "classification_label_conflict" }))
      .toBe("已有相同名稱的分類。");
  });
});
