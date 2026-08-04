import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FULL_ACCOUNT_FIELDS = [
  "accountNumberFull",
  "fullAccountNumber",
];
const CANONICAL_PREFIX = "astera:bank-account:v1";

export function parseMigrationArgs(argv, now = new Date()) {
  const values = parseArgs(argv, new Set(["dry-run", "apply"]));
  assertConfirmedProject(values);
  if (values["dry-run"] && values.apply) {
    throw new Error("migration_mode_conflict");
  }

  const dryRun = !values.apply;
  const backupDir = values["backup-dir"]
    ?? `.local-backups/member-account-fingerprint-${toFileTimestamp(now)}`;
  if (!dryRun) {
    assertIgnoredBackupPath(backupDir);
  }
  return {
    project: values.project,
    dryRun,
    backupDir,
  };
}

/**
 * @param {{
 *   accounts: Array<Record<string, any>>,
 *   payments: Array<Record<string, any>>,
 *   dryRun?: boolean,
 *   deriveIdentity: (input: {bankCode: unknown, accountNumber: unknown}) => Promise<Record<string, any>>,
 *   backup?: (data: {accounts: Array<Record<string, any>>, payments: Array<Record<string, any>>}) => Promise<void> | void,
 *   update?: (operation: {
 *     id: string,
 *     action: string,
 *     set: Record<string, any>,
 *     deleteFields: string[],
 *   }) => Promise<void> | void,
 * }} input
 */
export async function runFingerprintMigration({
  accounts,
  payments,
  dryRun = true,
  deriveIdentity,
  backup,
  update,
}) {
  if (!Array.isArray(accounts) || !Array.isArray(payments) || typeof deriveIdentity !== "function") {
    throw new Error("invalid_migration_input");
  }

  const operations = [];
  const accountReport = [];
  for (const account of accounts) {
    const id = safeDocumentId(account?.id);
    const deleteFields = FULL_ACCOUNT_FIELDS.filter((field) =>
      Object.prototype.hasOwnProperty.call(account, field));
    if (
      typeof account?.accountFingerprint === "string"
      && account.accountFingerprint.length > 0
      && account.fingerprintAlgorithm === "HMAC-SHA-256"
      && Number.isSafeInteger(account?.fingerprintKeyVersion)
      && account.fingerprintKeyVersion > 0
    ) {
      if (deleteFields.length > 0) {
        operations.push({
          id,
          action: "removeLegacyPlaintext",
          set: {},
          deleteFields,
        });
        accountReport.push({
          id,
          status: dryRun ? "wouldRemoveLegacyPlaintext" : "legacyPlaintextRemoved",
          fingerprintKeyVersion: account.fingerprintKeyVersion,
        });
      } else {
        accountReport.push({ id, status: "alreadyFingerprintProtected" });
      }
      continue;
    }

    const fullAccountField = FULL_ACCOUNT_FIELDS.find((field) =>
      typeof account?.[field] === "string" && account[field].trim());
    if (fullAccountField) {
      const identity = await deriveIdentity({
        bankCode: account.bankCode,
        accountNumber: account[fullAccountField],
      });
      operations.push({
        id,
        action: "deriveFingerprint",
        set: {
          bankCode: identity.bankCode,
          accountNumberLast5: identity.accountNumberLast5,
          accountFingerprint: identity.accountFingerprint,
          fingerprintAlgorithm: "HMAC-SHA-256",
          fingerprintKeyVersion: identity.fingerprintKeyVersion,
          verificationStatus: "verified",
        },
        deleteFields,
      });
      accountReport.push({
        id,
        status: dryRun ? "wouldDeriveFingerprint" : "fingerprintDerived",
        fingerprintKeyVersion: identity.fingerprintKeyVersion,
      });
      continue;
    }

    operations.push({
      id,
      action: "needsReverification",
      set: { verificationStatus: "needsReverification" },
      deleteFields: [],
    });
    accountReport.push({ id, status: dryRun ? "wouldRequireReverification" : "needsReverification" });
  }

  const paymentSnapshotsForManualReview = payments
    .filter((payment) => !hasUsableFingerprint(payment?.memberPaymentAccount ?? payment))
    .map((payment) => safeDocumentId(payment?.id));

  if (!dryRun) {
    if (typeof backup !== "function" || typeof update !== "function") {
      throw new Error("mutation_dependencies_required");
    }
    await backup({ accounts, payments });
    for (const operation of operations) {
      await update(operation);
    }
  }

  return {
    mode: dryRun ? "dry-run" : "apply",
    accountReport,
    paymentSnapshotsForManualReview,
    operations,
    immutablePaymentSnapshotsUpdated: 0,
  };
}

export function buildSafeMigrationOutput(result) {
  return {
    mode: result.mode,
    accountReport: result.accountReport.map((entry) => ({
      id: entry.id,
      status: entry.status,
      ...(Number.isSafeInteger(entry.fingerprintKeyVersion)
        ? { fingerprintKeyVersion: entry.fingerprintKeyVersion }
        : {}),
    })),
    paymentSnapshotsForManualReview: [...result.paymentSnapshotsForManualReview],
    statistics: {
      accountOperations: result.operations.length,
      paymentSnapshotsForManualReview: result.paymentSnapshotsForManualReview.length,
      immutablePaymentSnapshotsUpdated: result.immutablePaymentSnapshotsUpdated,
    },
  };
}

function hasUsableFingerprint(snapshot) {
  return typeof snapshot?.accountFingerprint === "string"
    && snapshot.accountFingerprint.length > 0
    && Number.isSafeInteger(snapshot?.fingerprintKeyVersion)
    && snapshot.fingerprintKeyVersion > 0;
}

function normalizeBankCode(value) {
  if (typeof value !== "string") throw new Error("invalid_bank_code");
  const normalized = mapFullWidthDigits(value).trim();
  if (!/^\d{3}$/.test(normalized)) throw new Error("invalid_bank_code");
  return normalized;
}

function normalizeAccountNumber(value) {
  if (typeof value !== "string") throw new Error("invalid_account_number");
  const normalized = mapFullWidthDigits(value).replace(/[ -]/g, "");
  if (!/^\d{8,20}$/.test(normalized)) throw new Error("invalid_account_number");
  return normalized;
}

function mapFullWidthDigits(value) {
  return value.replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xFEE0));
}

export function assertHmacKeyNameForProject(keyName, project) {
  const parts = typeof keyName === "string" ? keyName.split("/") : [];
  if (
    parts.length !== 8
    || parts[0] !== "projects"
    || parts[1] !== project
    || parts[2] !== "locations"
    || !parts[3]
    || parts[4] !== "keyRings"
    || !parts[5]
    || parts[6] !== "cryptoKeys"
    || !parts[7]
  ) {
    throw new Error("cloud_kms_mac_not_configured");
  }
  return keyName;
}

async function createKmsIdentityDeriver(project) {
  const keyName = process.env.GCP_KMS_HMAC_KEY_NAME?.trim();
  const keyVersion = Number(process.env.GCP_KMS_HMAC_KEY_VERSION);
  if (
    !keyName
    || !Number.isSafeInteger(keyVersion)
    || keyVersion < 1
  ) {
    throw new Error("cloud_kms_mac_not_configured");
  }
  assertHmacKeyNameForProject(keyName, project);
  const { KeyManagementServiceClient } = await import("@google-cloud/kms");
  const kms = new KeyManagementServiceClient({ projectId: project });
  return async ({ bankCode, accountNumber }) => {
    const normalizedBankCode = normalizeBankCode(bankCode);
    const normalizedAccountNumber = normalizeAccountNumber(accountNumber);
    const [response] = await kms.macSign({
      name: `${keyName}/cryptoKeyVersions/${keyVersion}`,
      data: Buffer.from(
        `${CANONICAL_PREFIX}|${normalizedBankCode}|${normalizedAccountNumber}`,
        "utf8",
      ),
    });
    if (!response.mac) throw new Error("kms_mac_missing");
    return {
      bankCode: normalizedBankCode,
      accountNumberLast5: normalizedAccountNumber.slice(-5),
      accountFingerprint: Buffer.from(response.mac).toString("base64"),
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: keyVersionFromName(response.name) ?? keyVersion,
    };
  };
}

async function loadMigrationRecords(db) {
  const [accountSnapshot, paymentSnapshot] = await Promise.all([
    db.collection("memberPaymentAccounts").get(),
    db.collection("payments").get(),
  ]);
  return {
    accounts: accountSnapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
    payments: paymentSnapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
  };
}

export async function writeMigrationBackup(data, backupDir) {
  const destination = assertIgnoredBackupPath(backupDir);
  await mkdir(destination, { recursive: true });
  const backupFile = resolve(destination, "member-account-fingerprint-backup.json");
  await writeFile(
    backupFile,
    `${JSON.stringify(serializeForBackup(data), null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  return backupFile;
}

function createAccountUpdater(db, FieldValue) {
  return async (operation) => {
    const patch = { ...operation.set };
    for (const field of operation.deleteFields) {
      patch[field] = FieldValue.delete();
    }
    await db.collection("memberPaymentAccounts").doc(operation.id).update(patch);
  };
}

async function main(argv) {
  const options = parseMigrationArgs(argv);
  const [{ applicationDefault, getApps, initializeApp }, { FieldValue, getFirestore }] =
    await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/firestore"),
    ]);
  const app = getApps()[0] ?? initializeApp({
    credential: applicationDefault(),
    projectId: options.project,
  });
  const db = getFirestore(app);
  const records = await loadMigrationRecords(db);
  const deriveIdentity = await createKmsIdentityDeriver(options.project);
  let backupFile;
  const report = await runFingerprintMigration({
    ...records,
    dryRun: options.dryRun,
    deriveIdentity,
    backup: async (data) => {
      backupFile = await writeMigrationBackup(data, options.backupDir);
    },
    update: createAccountUpdater(db, FieldValue),
  });
  console.log(JSON.stringify({
    ok: true,
    project: options.project,
    ...buildSafeMigrationOutput(report),
    ...(backupFile ? { backupFile } : {}),
  }, null, 2));
}

function parseArgs(argv, booleanNames) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) throw new Error("invalid_arguments");
    const name = token.slice(2);
    if (booleanNames.has(name)) {
      values[name] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error("invalid_arguments");
    values[name] = value;
    index += 1;
  }
  return values;
}

function assertConfirmedProject(values) {
  if (!values.project || !values["confirm-project"]) {
    throw new Error("project_confirmation_required");
  }
  if (values.project !== values["confirm-project"]) {
    throw new Error("project_confirmation_mismatch");
  }
}

function assertIgnoredBackupPath(backupDir) {
  const ignoredRoot = resolve(".local-backups");
  const destination = resolve(backupDir);
  const relativePath = relative(ignoredRoot, destination);
  if (
    isAbsolute(relativePath)
    || relativePath === ".."
    || relativePath.startsWith(`..\\`)
    || relativePath.startsWith("../")
  ) {
    throw new Error("backup_path_must_be_ignored");
  }
  return destination;
}

function toFileTimestamp(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new Error("invalid_backup_timestamp");
  }
  return date.toISOString().replace(/[:.]/g, "-");
}

function serializeForBackup(value) {
  if (value && typeof value.toDate === "function") {
    return { __type: "timestamp", value: value.toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(serializeForBackup);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, serializeForBackup(nested)]),
    );
  }
  return value;
}

function safeDocumentId(value) {
  if (typeof value !== "string" || !value || value.includes("/")) {
    throw new Error("invalid_document_id");
  }
  return value;
}

function keyVersionFromName(name) {
  const match = name?.match(/\/cryptoKeyVersions\/(\d+)$/);
  const version = match ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(version) && version > 0 ? version : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main(process.argv.slice(2));
  } catch {
    console.error("fingerprint_migration_failed");
    process.exitCode = 1;
  }
}
