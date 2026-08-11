import { timingSafeEqual } from "node:crypto";
import type { CloudKmsMacClient } from "@/lib/security/cloudKmsMac";
import { isUsableFingerprintIdentity } from "@/lib/payment/fingerprintIdentity.mjs";

export type { CloudKmsMacClient } from "@/lib/security/cloudKmsMac";

export type AccountIdentityInput = {
  bankCode: unknown;
  accountNumber: unknown;
};

export type AccountIdentity = {
  bankCode: string;
  accountNumberLast5: string;
  accountFingerprint: string;
  fingerprintAlgorithm: "HMAC-SHA-256";
  fingerprintKeyVersion: number;
};

const ACCOUNT_CANONICAL_PREFIX = "astera:bank-account:v1";

export function normalizeBankCode(input: unknown): string {
  if (typeof input !== "string") {
    throw new Error("invalid_bank_code");
  }

  const normalized = mapFullWidthDigits(input).trim();
  if (!/^\d{3}$/.test(normalized)) {
    throw new Error("invalid_bank_code");
  }

  return normalized;
}

export function normalizeAccountNumber(input: unknown): string {
  if (typeof input !== "string") {
    throw new Error("invalid_account_number");
  }

  const normalized = mapFullWidthDigits(input).replace(/[ -]/g, "");
  if (!/^\d{8,20}$/.test(normalized)) {
    throw new Error("invalid_account_number");
  }

  return normalized;
}

export async function deriveAccountIdentity(
  input: AccountIdentityInput,
  macClient: CloudKmsMacClient,
): Promise<AccountIdentity> {
  const bankCode = normalizeBankCode(input.bankCode);
  const accountNumber = normalizeAccountNumber(input.accountNumber);
  const signed = await macClient.signCanonicalAccount(toCanonicalAccount(bankCode, accountNumber));

  const identity: AccountIdentity = {
    bankCode,
    accountNumberLast5: accountNumber.slice(-5),
    accountFingerprint: signed.mac,
    fingerprintAlgorithm: "HMAC-SHA-256",
    fingerprintKeyVersion: signed.keyVersion,
  };
  if (!isUsableFingerprintIdentity(identity)) {
    throw new Error("invalid_account_fingerprint");
  }
  return identity;
}

export async function verifyAccountIdentity(
  input: AccountIdentityInput,
  expected: AccountIdentity,
  macClient: CloudKmsMacClient,
): Promise<boolean> {
  if (!isUsableFingerprintIdentity(expected)) {
    return false;
  }

  const bankCode = normalizeBankCode(input.bankCode);
  const accountNumber = normalizeAccountNumber(input.accountNumber);
  const signed = await macClient.signCanonicalAccount(
    toCanonicalAccount(bankCode, accountNumber),
    expected.fingerprintKeyVersion,
  );
  if (!isUsableFingerprintIdentity({
    accountFingerprint: signed.mac,
    fingerprintAlgorithm: "HMAC-SHA-256",
    fingerprintKeyVersion: signed.keyVersion,
  }) || signed.keyVersion !== expected.fingerprintKeyVersion) {
    return false;
  }
  const actualMac = Buffer.from(signed.mac, "base64");
  const expectedMac = Buffer.from(expected.accountFingerprint, "base64");

  return actualMac.length === expectedMac.length && timingSafeEqual(actualMac, expectedMac);
}

function toCanonicalAccount(bankCode: string, accountNumber: string): string {
  return `${ACCOUNT_CANONICAL_PREFIX}|${bankCode}|${accountNumber}`;
}

function mapFullWidthDigits(input: string): string {
  return input.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0));
}
