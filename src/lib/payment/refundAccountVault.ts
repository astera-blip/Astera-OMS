import { KeyManagementServiceClient } from "@google-cloud/kms";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { normalizeAccountNumber, normalizeBankCode } from "@/lib/payment/accountIdentity";

type RefundVaultRecord = {
  refundBankCode?: unknown;
  refundAccountCiphertext?: unknown;
  refundEncryptionKeyVersion?: unknown;
  refundAccountExpiresAt?: unknown;
  status?: unknown;
};

let kmsClient: KeyManagementServiceClient | undefined;

export async function storeRefundAccount(
  requestId: string,
  accountNumberFull: string,
  expiresAt: string,
): Promise<{ encryptionKeyVersion: number; expiresAt: string }> {
  const normalizedRequestId = requireRequestId(requestId);
  const normalizedAccountNumber = normalizeAccountNumber(accountNumberFull);
  const normalizedExpiresAt = requireFutureExpiry(expiresAt);
  const requestRef = getAdminFirestore().collection("cancellationRequests").doc(normalizedRequestId);
  const requestSnapshot = await requestRef.get();
  if (!requestSnapshot.exists) {
    throw new Error("cancellation_request_not_found");
  }

  const [encrypted] = await getKmsClient().encrypt({
    name: getRefundKeyName(),
    plaintext: Buffer.from(normalizedAccountNumber, "utf8"),
    additionalAuthenticatedData: Buffer.from(normalizedRequestId, "utf8"),
  });
  if (!encrypted.ciphertext) {
    throw new Error("refund_account_encryption_failed");
  }
  const encryptionKeyVersion = keyVersionFromResourceName(encrypted.name);
  if (!encryptionKeyVersion) {
    throw new Error("refund_account_encryption_version_missing");
  }

  await requestRef.update({
    refundAccountCiphertext: Buffer.from(encrypted.ciphertext).toString("base64"),
    refundEncryptionKeyVersion: encryptionKeyVersion,
    refundAccountExpiresAt: normalizedExpiresAt,
  });

  return { encryptionKeyVersion, expiresAt: normalizedExpiresAt };
}

export async function readRefundAccountForOwner(
  requestId: string,
): Promise<{ bankCode: string; accountNumberFull: string; expiresAt: string }> {
  const normalizedRequestId = requireRequestId(requestId);
  const requestRef = getAdminFirestore().collection("cancellationRequests").doc(normalizedRequestId);
  const requestSnapshot = await requestRef.get();
  if (!requestSnapshot.exists) {
    throw new Error("cancellation_request_not_found");
  }

  const record = requestSnapshot.data() as RefundVaultRecord;
  const expiresAt = typeof record.refundAccountExpiresAt === "string"
    ? record.refundAccountExpiresAt
    : "";
  if (!expiresAt || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
    if (record.refundAccountCiphertext) {
      await requestRef.update({
        ...deletedVaultFields(),
        ...(record.status === "pending" ? { status: "needsReverification" } : {}),
      });
    }
    throw new Error("refund_account_expired");
  }
  if (
    typeof record.refundAccountCiphertext !== "string"
    || !Number.isSafeInteger(record.refundEncryptionKeyVersion)
    || Number(record.refundEncryptionKeyVersion) < 1
  ) {
    throw new Error("refund_account_unavailable");
  }

  const bankCode = normalizeBankCode(record.refundBankCode);
  const [decrypted] = await getKmsClient().decrypt({
    name: getRefundKeyName(),
    ciphertext: Buffer.from(record.refundAccountCiphertext, "base64"),
    additionalAuthenticatedData: Buffer.from(normalizedRequestId, "utf8"),
  });
  if (!decrypted.plaintext) {
    throw new Error("refund_account_decryption_failed");
  }

  return {
    bankCode,
    accountNumberFull: normalizeAccountNumber(Buffer.from(decrypted.plaintext).toString("utf8")),
    expiresAt,
  };
}

export async function deleteRefundAccount(requestId: string): Promise<void> {
  await getAdminFirestore()
    .collection("cancellationRequests")
    .doc(requireRequestId(requestId))
    .update(deletedVaultFields());
}

export async function expireRefundAccounts(now: Date): Promise<number> {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("invalid_expiry_time");
  }
  const snapshot = await getAdminFirestore()
    .collection("cancellationRequests")
    .where("refundAccountExpiresAt", "<=", now.toISOString())
    .get();

  await Promise.all(snapshot.docs.map((document) => {
    const record = document.data() as RefundVaultRecord;
    return document.ref.update({
      ...deletedVaultFields(),
      ...(record.status === "pending" ? { status: "needsReverification" } : {}),
    });
  }));
  return snapshot.docs.length;
}

export function deletedRefundVaultFields() {
  return deletedVaultFields();
}

function deletedVaultFields() {
  return {
    refundAccountCiphertext: FieldValue.delete(),
    refundEncryptionKeyVersion: FieldValue.delete(),
    refundAccountExpiresAt: FieldValue.delete(),
  };
}

function getKmsClient() {
  kmsClient ??= new KeyManagementServiceClient({ projectId: getProjectId() });
  return kmsClient;
}

function getProjectId() {
  const projectId = process.env.GCP_PROJECT_ID?.trim()
    || process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (!projectId) {
    throw new Error("refund_account_kms_not_configured");
  }
  return projectId;
}

function getRefundKeyName() {
  const keyName = process.env.GCP_KMS_REFUND_KEY_NAME?.trim();
  if (!keyName || !/\/cryptoKeys\/[^/]+$/.test(keyName)) {
    throw new Error("refund_account_kms_not_configured");
  }
  return keyName;
}

function requireRequestId(requestId: string) {
  const normalized = requestId.trim();
  if (!normalized || normalized.includes("/")) {
    throw new Error("invalid_cancellation_request_id");
  }
  return normalized;
}

function requireFutureExpiry(expiresAt: string) {
  const timestamp = Date.parse(expiresAt);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    throw new Error("invalid_refund_account_expiry");
  }
  return new Date(timestamp).toISOString();
}

function keyVersionFromResourceName(resourceName: string | null | undefined) {
  const match = resourceName?.match(/\/cryptoKeyVersions\/(\d+)$/);
  const version = match ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(version) && version > 0 ? version : undefined;
}
