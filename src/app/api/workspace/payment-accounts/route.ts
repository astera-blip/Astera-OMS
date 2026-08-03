import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import {
  normalizePaymentAccount,
  paymentAccountErrorMessage,
  validatePaymentAccountInput,
  type PaymentAccount,
} from "@/lib/payment/bankAccounts";

export async function GET(request: Request) {
  try {
    await requireOwner(request);
    const snapshot = await getAdminFirestore().collection("paymentAccounts").get();
    const accounts = snapshot.docs
      .map((document) => serializeAccount({
        id: document.id,
        ...(document.data() as Omit<PaymentAccount, "id">),
      }))
      .sort((left, right) => left.bankName.localeCompare(right.bankName, "zh-Hant"));
    return NextResponse.json({ accounts });
  } catch (error) {
    return ownerPaymentAccountResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const claims = await requireOwner(request);
    const validation = validatePaymentAccountInput(await request.json());
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const db = getAdminFirestore();
    const ref = db.collection("paymentAccounts").doc();
    await ref.set({
      ...validation.value,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: claims.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: claims.uid,
    });
    return NextResponse.json({
      account: {
        id: ref.id,
        ...validation.value,
        status: "active",
      },
    }, { status: 201 });
  } catch (error) {
    return ownerPaymentAccountResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const claims = await requireOwner(request);
    const body = await request.json() as { id?: unknown; status?: unknown } & Partial<PaymentAccount>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      throw new Error("payment_account_not_found");
    }
    const status = body.status === "inactive" ? "inactive" : body.status === "active" ? "active" : null;
    if (!status) {
      throw new Error("payment_account_status_invalid");
    }
    const db = getAdminFirestore();
    const ref = db.collection("paymentAccounts").doc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      throw new Error("payment_account_not_found");
    }
    const current = normalizePaymentAccount({
      id,
      ...(existing.data() as Omit<PaymentAccount, "id">),
    });
    const validation = validatePaymentAccountInput({
      bankName: body.bankName ?? current.bankName,
      branchName: body.branchName ?? current.branchName,
      accountName: body.accountName ?? current.accountName,
      accountNumberLast5: body.accountNumberLast5 ?? current.accountNumberLast5,
    });
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    await ref.update({
      ...validation.value,
      status,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: claims.uid,
    });
    return NextResponse.json({ account: { id, ...validation.value, status } });
  } catch (error) {
    return ownerPaymentAccountResponse(error);
  }
}

async function requireOwner(request: Request) {
  const claims = await requireFirebaseUser(request);
  if (!isOwnerClaim(claims)) {
    throw new Error("forbidden");
  }
  return claims;
}

function serializeAccount(account: PaymentAccount) {
  const normalized = normalizePaymentAccount(account);
  return {
    ...normalized,
    createdAt: toIso(account.createdAt),
    updatedAt: toIso(account.updatedAt),
  };
}

function toIso(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return undefined;
}

function ownerPaymentAccountResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown_error";
  const status =
    message === "missing_token" ? 401
      : message === "forbidden" ? 403
        : message === "payment_account_not_found" ? 404
          : message.startsWith("payment_account_") ? 400
            : 500;
  return NextResponse.json({
    error: status === 500 ? "internal_error" : message,
    ...(status < 500 ? { message: paymentAccountErrorMessage(message) } : {}),
  }, { status });
}
