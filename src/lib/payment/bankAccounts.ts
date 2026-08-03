export type PaymentAccountStatus = "active" | "inactive";

export type PaymentAccountInput = {
  bankName: string;
  branchName?: string;
  accountName: string;
  accountNumberLast5: string;
  currency?: "TWD";
};

export type PaymentAccount = PaymentAccountInput & {
  id: string;
  currency: "TWD";
  status: PaymentAccountStatus;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type PublicPaymentAccount = Pick<
  PaymentAccount,
  "id" | "bankName" | "branchName" | "accountName" | "accountNumberLast5" | "currency"
>;

export function validatePaymentAccountInput(input: unknown):
  | { ok: true; value: Required<PaymentAccountInput> }
  | { ok: false; error: string } {
  const value = input as Partial<PaymentAccountInput>;
  const bankName = typeof value.bankName === "string" ? value.bankName.trim() : "";
  const branchName = typeof value.branchName === "string" ? value.branchName.trim() : "";
  const accountName = typeof value.accountName === "string" ? value.accountName.trim() : "";
  const accountNumberLast5 = typeof value.accountNumberLast5 === "string"
    ? value.accountNumberLast5.trim()
    : "";

  if (!bankName) {
    return { ok: false, error: "payment_account_bank_required" };
  }
  if (bankName.length > 80) {
    return { ok: false, error: "payment_account_bank_too_long" };
  }
  if (branchName.length > 80) {
    return { ok: false, error: "payment_account_branch_too_long" };
  }
  if (!accountName) {
    return { ok: false, error: "payment_account_name_required" };
  }
  if (accountName.length > 120) {
    return { ok: false, error: "payment_account_name_too_long" };
  }
  if (!/^\d{5}$/.test(accountNumberLast5)) {
    return { ok: false, error: "payment_account_last5_invalid" };
  }

  return {
    ok: true,
    value: {
      bankName,
      branchName,
      accountName,
      accountNumberLast5,
      currency: "TWD",
    },
  };
}

export function normalizePaymentAccount(value: PaymentAccount): PaymentAccount {
  return {
    ...value,
    bankName: value.bankName.trim(),
    branchName: value.branchName?.trim() ?? "",
    accountName: value.accountName.trim(),
    accountNumberLast5: value.accountNumberLast5.trim(),
    currency: "TWD",
    status: value.status === "inactive" ? "inactive" : "active",
  };
}

export function buildPaymentAccountSnapshot(account: PaymentAccount): PublicPaymentAccount {
  const normalized = normalizePaymentAccount(account);
  return {
    id: normalized.id,
    bankName: normalized.bankName,
    branchName: normalized.branchName,
    accountName: normalized.accountName,
    accountNumberLast5: normalized.accountNumberLast5,
    currency: normalized.currency,
  };
}

export function paymentAccountErrorMessage(error: string) {
  return {
    payment_account_bank_required: "請填寫銀行名稱。",
    payment_account_bank_too_long: "銀行名稱過長。",
    payment_account_branch_too_long: "分行名稱過長。",
    payment_account_name_required: "請填寫戶名。",
    payment_account_name_too_long: "戶名過長。",
    payment_account_last5_invalid: "請填寫正確的帳號末五碼。",
    payment_account_not_found: "找不到指定的收款帳戶。",
    payment_account_inactive: "此收款帳戶目前未啟用。",
    payment_account_required: "請選擇實際匯入的收款帳戶。",
  }[error] ?? "收款帳戶資料無效。";
}
