import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Taishin reconciliation Owner board", () => {
  it("provides safe select-all, clear and batch-confirm controls", () => {
    const source = readFileSync("src/components/workspace/TaishinReconciliationBoard.tsx", "utf8");
    expect(source).toContain("全選可認列項目");
    expect(source).toContain("全部取消");
    expect(source).toContain("批次確認認列");
    expect(source).toContain("selectedByDefault");
    expect(source).toContain("result.selectable");
    expect(source).toContain("/api/workspace/reconciliation/taishin/confirm");
    expect(source).toContain("window.confirm");
  });

  it("keeps the uploaded file in memory and resends it for server revalidation", () => {
    const source = readFileSync("src/components/workspace/TaishinReconciliationBoard.tsx", "utf8");
    expect(source).toContain("formData.set(\"file\", file)");
    expect(source).toContain("formData.set(\"selections\"");
    expect(source).toContain("disabled={!result.selectable}");
  });
});
