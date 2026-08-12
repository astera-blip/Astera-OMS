import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import type { LocalPayment } from "@/lib/payment/manualBankTransfer";
import { matchTaishinTransactions } from "@/lib/reconciliation/paymentMatching";
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

    const db = getAdminFirestore();
    const [paymentsSnapshot, claimsSnapshot] = await Promise.all([
      db.collection("payments").where("status", "==", "pendingReview").get(),
      db.collection("auditLogs")
        .where("action", "==", "payment.reconciliation.claimed")
        .get(),
    ]);
    const payments = paymentsSnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    })) as LocalPayment[];
    const claimedFingerprints = new Set(
      claimsSnapshot.docs.flatMap((snapshot) => {
        const data = snapshot.data() as {
          reconciliation?: { transactionFingerprint?: unknown };
        };
        return typeof data.reconciliation?.transactionFingerprint === "string"
          ? [data.reconciliation.transactionFingerprint]
          : [];
      }),
    );
    const reconciliation = matchTaishinTransactions({
      transactions: parsed.transactions,
      payments,
      claimedFingerprints,
    });

    return NextResponse.json({
      summary: reconciliation.summary,
      results: reconciliation.results,
    });
  } catch (error) {
    return reconciliationResponse(error);
  }
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
