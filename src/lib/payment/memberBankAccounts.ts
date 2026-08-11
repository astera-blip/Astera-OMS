import {
  normalizeAccountNumber,
  normalizeBankCode,
  type AccountIdentity,
} from "@/lib/payment/accountIdentity";
import { isUsableFingerprintIdentity } from "@/lib/payment/fingerprintIdentity.mjs";
import type {
  DuplicateAccountNotificationEvent,
  DuplicateAccountNotificationStatus,
} from "@/lib/notification/events";

export type MemberPaymentAccountStatus = "active" | "pendingDeletion" | "inactive";
export type MemberPaymentAccountVerificationStatus = "verified" | "needsReverification";

export type MemberPaymentAccountInput = {
  bankCode: string;
  accountNumberFull: string;
  payerName: string;
};

export type MemberPaymentAccount = AccountIdentity & {
  id: string;
  memberUid: string;
  payerName?: string;
  status: MemberPaymentAccountStatus;
  verificationStatus?: MemberPaymentAccountVerificationStatus;
  createdAt?: unknown;
  createdBy?: string;
  updatedAt?: unknown;
  updatedBy?: string;
  deletionRequestedAt?: unknown;
  deletionRequestedBy?: string;
  archivedAt?: unknown;
  archivedBy?: string;
};

export type PublicMemberPaymentAccount = {
  id: string;
  bankCode: string;
  accountNumberMasked: string;
  accountNumberLast5: string;
  payerName?: string;
  needsPayerName: boolean;
  status: MemberPaymentAccountStatus;
  verificationStatus: MemberPaymentAccountVerificationStatus;
};

export type MemberPaymentAccountDuplicateReviewStatus = DuplicateAccountNotificationStatus;
export type MemberPaymentAccountDuplicateNotification = DuplicateAccountNotificationEvent;

export type NormalizedMemberPaymentAccountInput = {
  bankCode: string;
  accountNumberFull: string;
  payerName: string;
};

export function normalizeMemberPaymentAccountPayerName(input: unknown): string {
  if (typeof input !== "string" || /[\u0000-\u001F\u007F]/u.test(input)) {
    throw new Error("invalid_payer_name");
  }
  const normalized = input.trim();
  if (!normalized || Array.from(normalized).length > 80) {
    throw new Error("invalid_payer_name");
  }
  return normalized;
}

export function normalizeMemberPaymentAccountInput(
  input: MemberPaymentAccountInput,
): NormalizedMemberPaymentAccountInput {
  return {
    bankCode: normalizeBankCode(input.bankCode),
    accountNumberFull: normalizeAccountNumber(input.accountNumberFull),
    payerName: normalizeMemberPaymentAccountPayerName(input.payerName),
  };
}

export function validateMemberPaymentAccountInput(input: unknown):
  | { ok: true; value: NormalizedMemberPaymentAccountInput }
  | { ok: false; error: string } {
  const value = input as Partial<MemberPaymentAccountInput> | null;
  const bankCode = typeof value?.bankCode === "string" ? value.bankCode : "";
  const accountNumberFull = typeof value?.accountNumberFull === "string" ? value.accountNumberFull : "";
  const payerName = typeof value?.payerName === "string" ? value.payerName : "";

  try {
    return {
      ok: true,
      value: normalizeMemberPaymentAccountInput({ bankCode, accountNumberFull, payerName }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error && error.message === "invalid_bank_code"
        ? "member_payment_account_bank_code_invalid"
        : error instanceof Error && error.message === "invalid_account_number"
          ? "member_payment_account_number_invalid"
          : "member_payment_account_payer_name_invalid",
    };
  }
}

export function maskMemberAccountNumber(accountNumberLast5: string): string {
  const normalized = accountNumberLast5.trim();
  if (!/^\d{5}$/.test(normalized)) {
    throw new Error("invalid_account_number_last5");
  }
  return `***${normalized}`;
}

export function normalizeMemberPaymentAccount(value: MemberPaymentAccount): MemberPaymentAccount {
  const accountNumberLast5 = value.accountNumberLast5.trim();
  if (!/^\d{5}$/.test(accountNumberLast5)) {
    throw new Error("invalid_account_number_last5");
  }

  const status = value.status === "active"
    || value.status === "pendingDeletion"
    || value.status === "inactive"
    ? value.status
    : "inactive";
  const verificationStatus = value.verificationStatus === "verified"
    && isUsableFingerprintIdentity(value)
    ? "verified"
    : "needsReverification";
  const payerName = normalizeOptionalStoredPayerName(value.payerName);

  return {
    ...value,
    bankCode: normalizeBankCode(value.bankCode),
    accountNumberLast5,
    status,
    verificationStatus,
    ...(payerName ? { payerName } : { payerName: undefined }),
  };
}

export function buildMemberPaymentAccountSnapshot(value: MemberPaymentAccount): PublicMemberPaymentAccount {
  try {
    const normalized = normalizeMemberPaymentAccount(value);
    return {
      id: normalized.id,
      bankCode: normalized.bankCode,
      accountNumberMasked: maskMemberAccountNumber(normalized.accountNumberLast5),
      accountNumberLast5: normalized.accountNumberLast5,
      payerName: normalized.payerName,
      needsPayerName: !normalized.payerName,
      status: normalized.status,
      verificationStatus: normalized.verificationStatus ?? "needsReverification",
    };
  } catch {
    const last5 = typeof value.accountNumberLast5 === "string"
      && /^\d{5}$/.test(value.accountNumberLast5.trim())
      ? value.accountNumberLast5.trim()
      : "";
    return {
      id: value.id,
      bankCode: "",
      accountNumberMasked: last5 ? maskMemberAccountNumber(last5) : "資料待重新驗證",
      accountNumberLast5: last5,
      payerName: normalizeOptionalStoredPayerName(value.payerName),
      needsPayerName: !normalizeOptionalStoredPayerName(value.payerName),
      // A legacy record without the fields required by the current identity
      // contract must remain visible but can never be selected for payment.
      status: "inactive",
      verificationStatus: "needsReverification",
    };
  }
}

export function isCountableMemberPaymentAccount(value: MemberPaymentAccount): boolean {
  try {
    const normalized = normalizeMemberPaymentAccount(value);
    return normalized.status === "active" || normalized.status === "pendingDeletion";
  } catch {
    // Incomplete legacy records cannot be paid with and must not consume one
    // of the member's five usable-account slots.
    return false;
  }
}

export function isMemberPaymentAccountUsableForPayment(
  account: PublicMemberPaymentAccount,
): boolean {
  return account.status === "active"
    && account.verificationStatus === "verified"
    && !account.needsPayerName
    && Boolean(account.payerName);
}

export function isStoredMemberPaymentAccountUsableForPayment(
  account: MemberPaymentAccount,
): boolean {
  return account.status === "active"
    && account.verificationStatus === "verified"
    && Boolean(normalizeOptionalStoredPayerName(account.payerName))
    && isUsableFingerprintIdentity(account);
}

export function memberPaymentAccountErrorMessage(error: string): string {
  return {
    member_payment_account_bank_code_invalid: "請填寫 3 位數字的銀行代碼。",
    member_payment_account_number_invalid: "請填寫 8 至 20 位數字的完整銀行帳號。",
    member_payment_account_payer_name_invalid: "請填寫有效的匯款人姓名。",
    member_payment_account_payer_name_required: "請先補填這個匯款帳戶的匯款人姓名。",
    member_payment_account_limit_reached: "最多只能保存 5 筆匯款帳戶；請先申請封存舊帳戶。",
    member_payment_account_not_found: "找不到指定的匯款帳戶。",
    member_payment_account_not_active: "這個匯款帳戶目前無法使用。",
  }[error] ?? "匯款帳戶資料無效。";
}

function normalizeOptionalStoredPayerName(value: unknown): string | undefined {
  try {
    return normalizeMemberPaymentAccountPayerName(value);
  } catch {
    return undefined;
  }
}
