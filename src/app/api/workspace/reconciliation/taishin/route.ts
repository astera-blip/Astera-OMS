import { NextResponse } from "next/server";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { parseTaishinWorkbook } from "@/lib/reconciliation/taishin";

const maxFileBytes = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      throw new Error("forbidden");
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("file_required");
    }
    if (file.size > maxFileBytes) {
      throw new Error("file_too_large");
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      throw new Error("file_type_invalid");
    }

    const parsed = await parseTaishinWorkbook(await file.arrayBuffer());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const paymentAmount = normalizeAmount(formData.get("paymentAmountTwd"));
    const transferAccountLast5 = normalizeLast5(formData.get("transferAccountLast5"));
    const matches = paymentAmount == null || !transferAccountLast5
      ? []
      : parsed.transactions.filter(
        (transaction) => transaction.amountTwd === paymentAmount
          && transaction.accountLast5 === transferAccountLast5,
      );

    return NextResponse.json({
      importedBy: claims.uid,
      sourceRowCount: parsed.sourceRowCount,
      transactions: parsed.transactions,
      matches,
      matchStatus: paymentAmount == null || !transferAccountLast5
        ? "awaiting_payment_data"
        : matches.length > 0 ? "matched" : "not_found",
    });
  } catch (error) {
    return reconciliationResponse(error);
  }
}

function normalizeAmount(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const amount = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(amount) ? Math.trunc(amount) : null;
}

function normalizeLast5(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\D/g, "").slice(-5).padStart(5, "0");
}

function reconciliationResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown_error";
  const status = message === "missing_token" || message === "invalid_token"
    ? 401
    : message === "forbidden"
      ? 403
      : message === "file_required" || message === "file_too_large" || message === "file_type_invalid"
        || message.startsWith("taishin_")
        ? 400
        : 500;
  return NextResponse.json({
    error: status === 500 ? "internal_error" : message,
    ...(status < 500 ? { message: reconciliationErrorMessage(message) } : {}),
  }, { status });
}

function reconciliationErrorMessage(message: string) {
  const messages: Record<string, string> = {
    file_required: "請選擇台新銀行交易明細 Excel 檔。",
    file_too_large: "Excel 檔案不可超過 10 MB。",
    file_type_invalid: "目前只支援 .xlsx 檔案。",
    taishin_columns_invalid: "檔案欄位不符合台新銀行交易明細格式。",
    taishin_rows_invalid: "檔案內有無法辨識的交易資料。",
  };
  return messages[message] ?? "對帳檔案無法處理。";
}
