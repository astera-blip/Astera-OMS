import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  buildTaishinTransactionFingerprint,
  extractTaishinLast5,
  parseTaishinWorkbook,
  parseTaishinRows,
} from "@/lib/reconciliation/taishin";

describe("Taishin reconciliation parser", () => {
  it("extracts the last five digits from the longest digit group in remarks", () => {
    expect(extractTaishinLast5("ATM 822-0000212540103022 客服 12")).toBe("03022");
    expect(extractTaishinLast5("沒有帳號")).toBe("");
  });

  it("parses the uploaded Taishin header row without exposing balance or remark", () => {
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
      });
      expect(result.transactions[0]?.transactionFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(result.transactions[0]).not.toHaveProperty("balanceTwd");
      expect(result.transactions[0]).not.toHaveProperty("remark");
      expect(result.transactions[0]).not.toHaveProperty("matchKey");
    }
  });

  it("creates the same fingerprint from the same normalized transaction identity", () => {
    const first = buildTaishinTransactionFingerprint({
      transactionAt: " 2026/05/26 16:58:48 ",
      accountingDate: "2026/05/26",
      method: " CD　轉入 ",
      amountTwd: 1420,
      accountLast5: "03022",
    });
    const second = buildTaishinTransactionFingerprint({
      transactionAt: "2026/05/26 16:58:48",
      accountingDate: "2026/05/26",
      method: "CD 轉入",
      amountTwd: 1420,
      accountLast5: "03022",
    });

    expect(first).toBe(second);
  });

  it("rejects files that are missing the required bank columns", () => {
    const result = parseTaishinRows([["日期", "金額"], ["2026/05/26", 1420]]);
    expect(result).toEqual({ ok: false, error: "taishin_columns_invalid" });
  });

  it("ignores a merged one-value trailing export note after valid transactions", () => {
    const result = parseTaishinRows([
      ["台新銀行 - 交易明細"],
      ["交易日", "帳務日", "摘要", "金額", "餘額", "備註"],
      ["2026/05/26 16:58:48", "2026/05/26", "CD轉入", 1420, 355633, "ATM 822-0000212540103022"],
      [
        "本列為匯出檔尾端說明",
        "本列為匯出檔尾端說明",
        "本列為匯出檔尾端說明",
        "本列為匯出檔尾端說明",
        "本列為匯出檔尾端說明",
        "本列為匯出檔尾端說明",
      ],
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sourceRowCount).toBe(1);
      expect(result.transactions).toHaveLength(1);
    }
  });

  it("still rejects a malformed transaction row before a later valid row", () => {
    const result = parseTaishinRows([
      ["台新銀行 - 交易明細"],
      ["交易日", "帳務日", "摘要", "金額", "餘額", "備註"],
      ["2026/05/26 16:58:48", "2026/05/26", "CD轉入", "", 355633, "ATM 822-0000212540103022"],
      ["2026/05/27 10:20:00", "2026/05/27", "CD轉入", 520, 356153, "ATM 822-0000212540103001"],
    ]);

    expect(result).toEqual({ ok: false, error: "taishin_rows_invalid" });
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
      expect(result.transactions[0]?.transactionFingerprint).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
