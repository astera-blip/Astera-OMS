import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productionFiles = [
  "src/components/storefront/CartBoard.tsx",
  "src/components/storefront/PublicProductDetailBoard.tsx",
  "src/components/storefront/PublicProductsBoard.tsx",
  "src/components/storefront/OrderHistoryBoard.tsx",
  "src/components/storefront/OrderDetailBoard.tsx",
  "src/components/workspace/AuditLogBoard.tsx",
  "src/components/workspace/OrderOperationsBoard.tsx",
  "src/components/workspace/PaymentOperationsBoard.tsx",
  "src/components/workspace/ProductWorkspace.tsx",
  "src/lib/payment/manualBankTransfer.ts",
  "src/lib/payment/repository.ts",
];

describe("production data-source boundary", () => {
  it("does not import the legacy order local-store module", () => {
    for (const file of productionFiles) {
      const source = readFileSync(resolve(file), "utf8");
      expect(source, file).not.toContain("@/lib/order/localStore");
    }
  });

  it("does not persist workspace business records in localStorage", () => {
    const source = readFileSync(
      resolve("src/components/workspace/ProductWorkspace.tsx"),
      "utf8",
    );

    expect(source).not.toContain("window.localStorage");
    expect(source).not.toContain("先使用本機資料");
    expect(source).not.toContain("已儲存在本機");
  });

  it("does not expose development-phase or obsolete cart copy", () => {
    const sources = productionFiles
      .concat(["src/app/cart/page.tsx"])
      .map((file) => readFileSync(resolve(file), "utf8"))
      .join("\n");

    expect(sources).not.toMatch(/Phase [24]|Firestore \/ API|不同 sale type/);
  });

  it("keeps buyer storefront copy consumer-facing", () => {
    const sources = [
      "src/app/page.tsx",
      "src/app/brand/page.tsx",
      "src/components/storefront/PublicProductsBoard.tsx",
      "src/components/storefront/PublicProductDetailBoard.tsx",
      "src/components/storefront/CartBoard.tsx",
      "src/components/storefront/StorefrontFooter.tsx",
    ]
      .map((file) => readFileSync(resolve(file), "utf8"))
      .join("\n");

    expect(sources).not.toMatch(/Small-circle MVP|Current status|custom claim|owner email|Owner 後台|尚未設定|請先由 owner/);
    for (const visibleText of [
      "Brand center",
      "Shopping guide",
      "Cart summary",
      "Rules",
      ">Recipient<",
      ">Checkout<",
      ">Catalog<",
      ">Products<",
      ">Payment<",
    ]) {
      expect(sources, visibleText).not.toContain(visibleText);
    }
  });

  it("gives member payment and order readers a retryable loading boundary", () => {
    const sources = [
      "src/components/storefront/PaymentRequestsBoard.tsx",
      "src/components/storefront/OrderHistoryBoard.tsx",
      "src/components/storefront/OrderDetailBoard.tsx",
    ]
      .map((file) => readFileSync(resolve(file), "utf8"))
      .join("\n");

    expect(sources).toContain("重新載入");
    expect(sources).toContain('role="alert"');
    expect(sources).toContain("訂單載入中。");
    expect(sources).toContain("付款請求載入中。");
  });

  it("keeps order-detail read diagnostics safe for buyers while retaining a console error code", () => {
    const source = readFileSync(
      resolve("src/components/storefront/OrderDetailBoard.tsx"),
      "utf8",
    );

    expect(source).toContain('console.warn("member_order_detail_load_failed"');
    expect(source).toContain("error instanceof Error ? error.message : \"unknown\"");
    expect(source).not.toContain("setMessage(error.message)");
  });

  it("loads member order detail through the protected server endpoint", () => {
    const source = readFileSync(
      resolve("src/components/storefront/OrderDetailBoard.tsx"),
      "utf8",
    );

    expect(source).toContain("/api/orders/${encodeURIComponent(orderId)}");
    expect(source).not.toContain("listMemberCancellationRequests");
  });

  it("lets paid order items submit the protected refund-account cancellation flow", () => {
    const source = readFileSync(
      resolve("src/components/storefront/OrderDetailBoard.tsx"),
      "utf8",
    );

    expect(source).toContain('item.status === "awaitingPayment" || item.status === "paid"');
    expect(source).toContain("confirmedPayments");
    expect(source).toContain("targetPaymentId");
    expect(source).toContain("refundBankCode");
    expect(source).toContain("refundAccountNumberFull");
    expect(source).toContain("退款完整銀行帳號");
    expect(source).toContain("退款帳號與原付款帳號不一致");
    expect(source).toContain("退款帳號驗證嘗試次數過多");
  });

  it("shows the formal order number to members instead of the internal document id", () => {
    for (const file of [
      "src/components/storefront/OrderHistoryBoard.tsx",
      "src/components/storefront/OrderDetailBoard.tsx",
    ]) {
      const source = readFileSync(resolve(file), "utf8");

      expect(source, file).toContain("orderNumber ??");
    }
  });

  it("defers member reader loads started by React effects", () => {
    for (const file of [
      "src/components/storefront/PaymentRequestsBoard.tsx",
      "src/components/storefront/OrderHistoryBoard.tsx",
      "src/components/storefront/OrderDetailBoard.tsx",
    ]) {
      const source = readFileSync(resolve(file), "utf8");

      expect(source, file).toContain("queueMicrotask(() => {");
    }
  });
});
