import ExcelJS from "exceljs";

export type TaishinTransaction = {
  transactionAt: string;
  accountingDate: string;
  method: string;
  amountTwd: number;
  balanceTwd: number | null;
  remark: string;
  accountLast5: string;
  matchKey: string;
};

export type TaishinParseResult =
  | { ok: true; transactions: TaishinTransaction[]; sourceRowCount: number }
  | { ok: false; error: "taishin_columns_invalid" | "taishin_rows_invalid" };

const requiredHeaders = ["交易日", "帳務日", "摘要", "金額", "餘額", "備註"] as const;

export function extractTaishinLast5(remark: unknown): string {
  if (typeof remark !== "string") {
    return "";
  }
  const groups = remark.match(/\d+/g) ?? [];
  if (groups.length === 0) {
    return "";
  }
  const longest = groups.reduce((current, candidate) =>
    candidate.length > current.length ? candidate : current,
  );
  return longest.slice(-5).padStart(5, "0");
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replaceAll(",", "").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function normalizeCell(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value == null ? "" : String(value).trim();
}

export function parseTaishinRows(rows: ReadonlyArray<ReadonlyArray<unknown>>): TaishinParseResult {
  const headerRow = rows[1] ?? rows[0] ?? [];
  const normalizedHeaders = headerRow.map((value) => normalizeCell(value).replaceAll(/\s/g, ""));
  const columnIndexes = requiredHeaders.map((header) =>
    normalizedHeaders.findIndex((value) => value.includes(header)),
  );

  if (columnIndexes.some((index) => index < 0)) {
    return { ok: false, error: "taishin_columns_invalid" };
  }

  const dataRows = rows.slice(rows[1] === headerRow ? 2 : 1);
  const transactions: TaishinTransaction[] = [];

  for (const row of dataRows) {
    if (row.every((value) => normalizeCell(value) === "")) {
      continue;
    }
    const [transactionIndex, accountingIndex, methodIndex, amountIndex, balanceIndex, remarkIndex] = columnIndexes;
    const transactionAt = normalizeCell(row[transactionIndex]);
    const accountingDate = normalizeCell(row[accountingIndex]);
    const method = normalizeCell(row[methodIndex]);
    const amountTwd = normalizeAmount(row[amountIndex]);
    const balanceTwd = normalizeAmount(row[balanceIndex]);
    const remark = normalizeCell(row[remarkIndex]);
    if (!transactionAt || amountTwd == null) {
      return { ok: false, error: "taishin_rows_invalid" };
    }
    const accountLast5 = extractTaishinLast5(remark);
    transactions.push({
      transactionAt,
      accountingDate,
      method,
      amountTwd,
      balanceTwd,
      remark,
      accountLast5,
      matchKey: `${amountTwd}${accountLast5}`,
    });
  }

  return { ok: true, transactions, sourceRowCount: transactions.length };
}

export async function parseTaishinWorkbook(buffer: ArrayBuffer | Uint8Array): Promise<TaishinParseResult> {
  const workbook = new ExcelJS.Workbook();
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const workbookBuffer = bytes as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(workbookBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { ok: false, error: "taishin_rows_invalid" };
  }
  const rows: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    rows.push(values);
  });
  return parseTaishinRows(rows);
}
