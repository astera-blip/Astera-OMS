import {
  normalizeAccountNumber,
  normalizeBankCode,
  type AccountIdentity,
} from "@/lib/payment/accountIdentity";
import type {
  DuplicateAccountNotificationEvent,
  DuplicateAccountNotificationStatus,
} from "@/lib/notification/events";

export type MemberPaymentAccountStatus = "active" | "pendingDeletion" | "inactive";
export type MemberPaymentAccountVerificationStatus = "verified" | "needsReverification";

export type MemberPaymentAccountInput = {
  bankCode: string;
  accountNumberFull: string;
};

export type MemberPaymentAccount = AccountIdentity & {
  id: string;
  memberUid: string;
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
  status: MemberPaymentAccountStatus;
  verificationStatus: MemberPaymentAccountVerificationStatus;
};

export type MemberPaymentAccountDuplicateReviewStatus = DuplicateAccountNotificationStatus;
export type MemberPaymentAccountDuplicateNotification = DuplicateAccountNotificationEvent;

export type NormalizedMemberPaymentAccountInput = {
  bankCode: string;
  accountNumberFull: string;
};

export function normalizeMemberPaymentAccountInput(
  input: MemberPaymentAccountInput,
): NormalizedMemberPaymentAccountInput {
  return {
    bankCode: normalizeBankCode(input.bankCode),
    accountNumberFull: normalizeAccountNumber(input.accountNumberFull),
  };
}

export function validateMemberPaymentAccountInput(input: unknown):
  | { ok: true; value: NormalizedMemberPaymentAccountInput }
  | { ok: false; error: string } {
  const value = input as Partial<MemberPaymentAccountInput> | null;
  const bankCode = typeof value?.bankCode === "string" ? value.bankCode : "";
  const accountNumberFull = typeof value?.accountNumberFull === "string" ? value.accountNumberFull : "";

  try {
    return {
      ok: true,
      value: normalizeMemberPaymentAccountInput({ bankCode, accountNumberFull }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error && error.message === "invalid_bank_code"
        ? "member_payment_account_bank_code_invalid"
        : "member_payment_account_number_invalid",
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
  const hasUsableFingerprint = typeof value.accountFingerprint === "string"
    && value.accountFingerprint.length > 0
    && value.fingerprintAlgorithm === "HMAC-SHA-256"
    && Number.isSafeInteger(value.fingerprintKeyVersion)
    && value.fingerprintKeyVersion > 0;
  const verificationStatus = value.verificationStatus === "needsReverification"
    || !hasUsableFingerprint
    ? "needsReverification"
    : "verified";

  return {
    ...value,
    bankCode: normalizeBankCode(value.bankCode),
    accountNumberLast5,
    status,
    verificationStatus,
  };
}

export function buildMemberPaymentAccountSnapshot(value: MemberPaymentAccount): PublicMemberPaymentAccount {
  const normalized = normalizeMemberPaymentAccount(value);
  return {
    id: normalized.id,
    bankCode: normalized.bankCode,
    accountNumberMasked: maskMemberAccountNumber(normalized.accountNumberLast5),
    accountNumberLast5: normalized.accountNumberLast5,
    status: normalized.status,
    verificationStatus: normalized.verificationStatus ?? "needsReverification",
  };
}

export function isMemberPaymentAccountUsableForPayment(
  account: PublicMemberPaymentAccount,
): boolean {
  return account.status === "active"
    && account.verificationStatus === "verified";
}

export function memberPaymentAccountErrorMessage(error: string): string {
  return {
    member_payment_account_bank_code_invalid: "請填寫 3 位數字的銀行代碼。",
    member_payment_account_number_invalid: "請填寫 8 至 20 位數字的完整銀行帳號。",
    member_payment_account_limit_reached: "最多只能保存 5 筆匯款帳戶；請先申請封存舊帳戶。",
    member_payment_account_not_found: "找不到指定的匯款帳戶。",
    member_payment_account_not_active: "這個匯款帳戶目前無法使用。",
  }[error] ?? "匯款帳戶資料無效。";
}
