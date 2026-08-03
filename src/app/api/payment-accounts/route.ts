import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import {
  buildPaymentAccountSnapshot,
  type PaymentAccount,
  type PublicPaymentAccount,
} from "@/lib/payment/bankAccounts";

export async function GET(request: Request) {
  try {
    await requireFirebaseUser(request);
    const snapshot = await getAdminFirestore()
      .collection("paymentAccounts")
      .where("status", "==", "active")
      .get();
    const accounts = snapshot.docs
      .map((document) => buildPaymentAccountSnapshot({
        id: document.id,
        ...(document.data() as Omit<PaymentAccount, "id">),
      }))
      .sort((left, right) => left.bankName.localeCompare(right.bankName, "zh-Hant"));
    return NextResponse.json({ accounts });
  } catch (error) {
    return paymentAccountResponse(error);
  }
}

function paymentAccountResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown_error";
  const status = message === "missing_token" ? 401 : 500;
  return NextResponse.json({ error: status === 500 ? "internal_error" : message }, { status });
}

export type PublicPaymentAccountResponse = { accounts: PublicPaymentAccount[] };
