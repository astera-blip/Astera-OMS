import { KeyManagementServiceClient } from "@google-cloud/kms";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { normalizeAccountNumber, normalizeBankCode } from "@/lib/payment/accountIdentity";
import {
  createEmulatorRefundKmsClient,
  isEmulatorKmsProviderEnabled,
} from "@/lib/security/emulatorKmsProvider";

type RefundVaultRecord = {
  refundBankCode?: unknown;
  refundAccountCiphertext?: unknown;
  refundEncryptionKeyVersion?: unknown;
  refundAccountExpiresAt?: unknown;
  status?: unknown;
};

type RefundKmsClient = Pick<KeyManagementServiceClient, "encrypt" | "decrypt">;

let kmsClient: RefundKmsClient | undefined;

export type EncryptedRefundAccountFields = {
  refundAccountCiphertext: string;
  refundEncryptionKeyVersion: number;
  refundAccountExpiresAt: string;
};

export async function storeRefundAccount(
  requestId: string,
  accountNumberFull: string,
  expiresAt: string,
): Promise<{ encryptionKeyVersion: number; expiresAt: string }> {
  const normalizedRequestId = requireRequestId(requestId);
  const encryptedFields = await encryptRefundAccount(
    normalizedRequestId,
    accountNumberFull,
    expiresAt,
  );
  const db = getAdminFirestore();
  const requestRef = db.collection("cancellationRequests").doc(normalizedRequestId);
  await db.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists) {
      throw new Error("cancellation_request_not_found");
    }
    const record = requestSnapshot.data() as RefundVaultRecord;
    if (record.status !== "pending") {
      throw new Error("refund_account_state_changed");
    }
    transaction.update(requestRef, encryptedFields);
  });

  return {
    encryptionKeyVersion: encryptedFields.refundEncryptionKeyVersion,
    expiresAt: encryptedFields.refundAccountExpiresAt,
  };
}

export async function encryptRefundAccount(
  requestId: string,
  accountNumberFull: string,
  expiresAt: string,
): Promise<EncryptedRefundAccountFields> {
  const normalizedRequestId = requireRequestId(requestId);
  const normalizedAccountNumber = normalizeAccountNumber(accountNumberFull);
  const normalizedExpiresAt = requireFutureExpiry(expiresAt);
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
  return {
    refundAccountCiphertext: Buffer.from(encrypted.ciphertext).toString("base64"),
    refundEncryptionKeyVersion: encryptionKeyVersion,
    refundAccountExpiresAt: normalizedExpiresAt,
  };
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
      await deleteExpiredRefundAccount(getAdminFirestore(), requestRef, new Date());
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
  const db = getAdminFirestore();
  const snapshot = await db
    .collection("cancellationRequests")
    .where("refundAccountExpiresAt", "<=", now.toISOString())
    .get();

  const results = await Promise.all(snapshot.docs.map((document) =>
    deleteExpiredRefundAccount(db, document.ref, now)));
  return results.filter(Boolean).length;
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
  if (isEmulatorKmsProviderEnabled()) {
    return createEmulatorRefundKmsClient() as RefundKmsClient;
  }
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
  if (isEmulatorKmsProviderEnabled()) {
    return "projects/demo-astera-oms/locations/asia-east1/keyRings/e2e/cryptoKeys/refund-account";
  }
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
  const now = Date.now();
  if (
    !Number.isFinite(timestamp)
    || timestamp <= now
    || timestamp > now + 14 * 24 * 60 * 60 * 1000
  ) {
    throw new Error("invalid_refund_account_expiry");
  }
  return new Date(timestamp).toISOString();
}

async function deleteExpiredRefundAccount(
  db: FirebaseFirestore.Firestore,
  requestRef: FirebaseFirestore.DocumentReference,
  now: Date,
) {
  return db.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(requestRef);
    if (!currentSnapshot.exists) {
      return false;
    }
    const current = currentSnapshot.data() as RefundVaultRecord;
    const currentExpiry = typeof current.refundAccountExpiresAt === "string"
      ? Date.parse(current.refundAccountExpiresAt)
      : Number.NaN;
    if (
      !current.refundAccountCiphertext
      || !Number.isFinite(currentExpiry)
      || currentExpiry > now.getTime()
    ) {
      return false;
    }
    transaction.update(requestRef, {
      ...deletedVaultFields(),
      ...(current.status === "pending" ? { status: "needsReverification" } : {}),
    });
    return true;
  });
}

function keyVersionFromResourceName(resourceName: string | null | undefined) {
  const match = resourceName?.match(/\/cryptoKeyVersions\/(\d+)$/);
  const version = match ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(version) && version > 0 ? version : undefined;
}
