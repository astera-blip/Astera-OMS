import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  extractTaishinLast5,
  parseTaishinWorkbook,
  parseTaishinRows,
} from "@/lib/reconciliation/taishin";

describe("Taishin reconciliation parser", () => {
  it("extracts the last five digits from the longest digit group in remarks", () => {
    expect(extractTaishinLast5("ATM 822-0000212540103022 客服 12")).toBe("03022");
    expect(extractTaishinLast5("沒有帳號")).toBe("");
  });

  it("parses the uploaded Taishin header row and produces a match key", () => {
    const result = parseTaishinRows([
      ["台新銀行 - 交易明細"],
      ["交易日", "帳務日", "摘要", "金額", "餘額", "備註"],
      ["2026/05/26 16:58:48", "2026/05/26", "CD轉入", 1420, 355633, "ATM 822-0000212540103022"],
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        amountTwd: 1420,
        accountLast5: "03022",
        matchKey: "142003022",
      });
    }
  });

  it("rejects files that are missing the required bank columns", () => {
    const result = parseTaishinRows([["日期", "金額"], ["2026/05/26", 1420]]);
    expect(result).toEqual({ ok: false, error: "taishin_columns_invalid" });
  });

  it("parses an XLSX buffer with the same two-row header layout as the uploaded file", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRows([
      ["台新銀行 - 交易明細"],
      ["交易日", "帳務日", "摘要", "金額", "餘額", "備註"],
      ["2026/05/26 16:58:48", "2026/05/26", "CD轉入", 1420, 355633, "ATM 822-0000212540103022"],
    ]);
    const buffer = await workbook.xlsx.writeBuffer();
    const result = await parseTaishinWorkbook(buffer);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transactions[0]?.matchKey).toBe("142003022");
    }
  });
});
