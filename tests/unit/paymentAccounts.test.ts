import { describe, expect, it } from "vitest";
import {
  buildPaymentAccountSnapshot,
  normalizePaymentAccount,
  validatePaymentAccountInput,
  type PaymentAccount,
} from "@/lib/payment/bankAccounts";

describe("payment account recognition", () => {
  it("validates and normalizes an Astera receiving account", () => {
    expect(validatePaymentAccountInput({
      bankName: "  國泰世華銀行 ",
      branchName: "  南京東路分行 ",
      accountName: " Astera OMS ",
      accountNumberLast5: "12345",
    })).toEqual({
      ok: true,
      value: {
        bankName: "國泰世華銀行",
        branchName: "南京東路分行",
        accountName: "Astera OMS",
        accountNumberLast5: "12345",
        currency: "TWD",
      },
    });
  });

  it("rejects malformed account identity", () => {
    expect(validatePaymentAccountInput({
      bankName: "銀行",
      accountName: "Astera",
      accountNumberLast5: "12A45",
    })).toEqual({ ok: false, error: "payment_account_last5_invalid" });
    expect(validatePaymentAccountInput({
      bankName: " ",
      accountName: "Astera",
      accountNumberLast5: "12345",
    })).toEqual({ ok: false, error: "payment_account_bank_required" });
  });

  it("exposes a stable public snapshot without internal audit fields", () => {
    const account: PaymentAccount = normalizePaymentAccount({
      id: "acct-1",
      bankName: "國泰世華銀行",
      branchName: "南京東路分行",
      accountName: "Astera OMS",
      accountNumberLast5: "12345",
      currency: "TWD",
      status: "active",
      createdAt: "2026-08-02T00:00:00.000Z",
      createdBy: "owner-1",
      updatedAt: "2026-08-02T00:00:00.000Z",
      updatedBy: "owner-1",
    });

    expect(buildPaymentAccountSnapshot(account)).toEqual({
      id: "acct-1",
      bankName: "國泰世華銀行",
      branchName: "南京東路分行",
      accountName: "Astera OMS",
      accountNumberLast5: "12345",
      currency: "TWD",
    });
  });
});
