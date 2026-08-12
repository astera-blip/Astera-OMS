import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { confirmPendingPaymentGroup } from "@/lib/payment/confirmPendingPayment";
import type { LocalPayment } from "@/lib/payment/manualBankTransfer";
import { matchTaishinTransactions } from "@/lib/reconciliation/paymentMatching";
import { parseTaishinWorkbook } from "@/lib/reconciliation/taishin";

const maxFileBytes = 10 * 1024 * 1024;

type Selection = {
  transactionFingerprint: string;
  paymentGroupId: string;
  paymentIds: string[];
};

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      throw new Error("forbidden");
    }
    const formData = await request.formData();
    const file = formData.get("file");
    const reason = typeof formData.get("reason") === "string"
      ? String(formData.get("reason")).trim()
      : "";
    if (!(file instanceof File)) {
      throw new Error("file_required");
    }
    if (file.size > maxFileBytes || !file.name.toLowerCase().endsWith(".xlsx")) {
      throw new Error(file.size > maxFileBytes ? "file_too_large" : "file_type_invalid");
    }
    if (!reason) {
      throw new Error("invalid_request");
    }
    const selections = parseSelections(formData.get("selections"));
    const parsed = await parseTaishinWorkbook(await file.arrayBuffer());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const db = getAdminFirestore();
    const [paymentsSnapshot, claimsSnapshot] = await Promise.all([
      db.collection("payments").where("status", "==", "pendingReview").get(),
      db.collection("auditLogs").where("action", "==", "payment.reconciliation.claimed").get(),
    ]);
    const payments = paymentsSnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    })) as LocalPayment[];
    const claimedFingerprints = new Set(claimsSnapshot.docs.flatMap((snapshot) => {
      const value = (snapshot.data() as { reconciliation?: { transactionFingerprint?: unknown } })
        .reconciliation?.transactionFingerprint;
      return typeof value === "string" ? [value] : [];
    }));
    const current = matchTaishinTransactions({
      transactions: parsed.transactions,
      payments,
      claimedFingerprints,
    });

    const results = [];
    for (const selection of selections) {
      const match = current.results.find((item) =>
        item.selectable
          && item.transactionFingerprint === selection.transactionFingerprint
          && item.paymentGroupId === selection.paymentGroupId
          && sameIds(item.paymentIds, selection.paymentIds));
      if (!match?.transactionFingerprint || !match.transactionAt || !match.accountingDate || !match.method) {
        results.push({
          reconciliationItemId: `selection:${selection.transactionFingerprint}`,
          status: "failed",
          error: "selection_not_valid",
        });
        continue;
      }
      try {
        await confirmPendingPaymentGroup({
          db,
          paymentIds: match.paymentIds,
          actorUid: claims.uid,
          reason,
          reconciliation: {
            transactionFingerprint: match.transactionFingerprint,
            transactionAt: match.transactionAt,
            accountingDate: match.accountingDate,
            method: match.method,
            accountLast5: match.accountLast5,
            paymentGroupId: match.paymentGroupId!,
          },
        });
        results.push({ reconciliationItemId: match.reconciliationItemId, status: "confirmed" });
      } catch (error) {
        results.push({
          reconciliationItemId: match.reconciliationItemId,
          status: "failed",
          error: safeRecognitionError(error),
        });
      }
    }
    const succeeded = results.filter((result) => result.status === "confirmed").length;
    return NextResponse.json({
      summary: { requested: selections.length, succeeded, failed: selections.length - succeeded },
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" || message === "invalid_token"
      ? 401
      : message === "forbidden"
        ? 403
        : message === "file_required" || message === "file_too_large" || message === "file_type_invalid"
          || message === "invalid_request" || message.startsWith("taishin_")
          ? 400
          : 500;
    return NextResponse.json({ error: status === 500 ? "internal_error" : message }, { status });
  }
}

function parseSelections(value: FormDataEntryValue | null): Selection[] {
  if (typeof value !== "string") {
    throw new Error("invalid_request");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("invalid_request");
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 100) {
    throw new Error("invalid_request");
  }
  return parsed.map((item) => {
    const candidate = item as Partial<Selection>;
    if (!/^[a-f0-9]{64}$/.test(candidate.transactionFingerprint ?? "")
      || typeof candidate.paymentGroupId !== "string"
      || !Array.isArray(candidate.paymentIds)
      || candidate.paymentIds.length === 0
      || candidate.paymentIds.some((id) => typeof id !== "string" || !id)) {
      throw new Error("invalid_request");
    }
    return {
      transactionFingerprint: candidate.transactionFingerprint!,
      paymentGroupId: candidate.paymentGroupId,
      paymentIds: [...new Set(candidate.paymentIds)].sort(),
    };
  });
}

function sameIds(left: ReadonlyArray<string>, right: ReadonlyArray<string>) {
  return [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}

function safeRecognitionError(error: unknown) {
  const message = error instanceof Error ? error.message : "recognition_failed";
  return [
    "duplicate_reconciliation",
    "selection_not_valid",
    "invalid_payment",
    "invalid_payment_request",
    "not_found",
  ].includes(message) ? message : "recognition_failed";
}
