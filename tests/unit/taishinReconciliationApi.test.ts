import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Taishin reconciliation API contract", () => {
  it("is Owner-only and validates uploaded XLSX before parsing", () => {
    const source = readFileSync("src/app/api/workspace/reconciliation/taishin/route.ts", "utf8");
    expect(source).toContain("isOwnerClaim");
    expect(source).toContain("formData");
    expect(source).toContain("parseTaishinWorkbook");
    expect(source).toContain(".xlsx");
    expect(source).toContain("file_too_large");
  });

  it("returns match results without writing payment history", () => {
    const source = readFileSync("src/app/api/workspace/reconciliation/taishin/route.ts", "utf8");
    expect(source).toContain("matches");
    expect(source).not.toContain('collection("payments").doc');
    expect(source).not.toContain('collection("paymentAllocations").doc');
  });

  it("exposes the Owner workspace upload and comparison controls", () => {
    const board = readFileSync("src/components/workspace/TaishinReconciliationBoard.tsx", "utf8");
    expect(board).toContain("/api/workspace/reconciliation/taishin");
    expect(board).toContain('accept=".xlsx');
    expect(board).toContain("比對匯款金額");
    expect(board).toContain("匯款帳號末五碼");
  });
});
