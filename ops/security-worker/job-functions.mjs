import { isUsableFingerprintIdentity } from "../../src/lib/payment/fingerprintIdentity.mjs";

const PRODUCTION_PROJECT = "astera-oms-prod";
const TEMPORARY_REFUND_FIELDS = [
  "refundAccountCiphertext",
  "refundEncryptionKeyVersion",
  "refundAccountExpiresAt",
];

export async function runRefundAccountCleanup({ db, FieldValue, project, now }) {
  assertProductionJobInput(project, now);
  if (!db || !FieldValue || typeof FieldValue.delete !== "function") {
    throw new Error("invalid_cleanup_dependencies");
  }
  const records = await loadExpiredRecords(db, now);
  const plan = buildExpiredRefundCleanupPlan(records, now);
  const cleaned = await applyCleanupPlan(db, FieldValue, plan, now);
  return { ok: true, project, cleaned };
}

export async function runFingerprintKeyUsageReport({
  db,
  project,
  now,
  listKnownKeyVersions,
}) {
  assertProductionJobInput(project, now);
  if (!db || typeof listKnownKeyVersions !== "function") {
    throw new Error("invalid_key_usage_dependencies");
  }
  const [{ memberAccounts, payments }, knownKeyVersions] = await Promise.all([
    loadUsageData(db),
    listKnownKeyVersions(project),
  ]);
  return {
    ok: true,
    project,
    report: buildFingerprintKeyUsageReport({
      memberAccounts,
      payments,
      knownKeyVersions,
      generatedAt: now.toISOString(),
    }),
  };
}

export async function emitGovernanceJobFailure({ db, project, job, occurredAt }) {
  assertProductionJobInput(project, occurredAt);
  if (!db || typeof job !== "string" || !job) {
    throw new Error("invalid_governance_failure_input");
  }
  await db.collection("notificationEvents").add({
    type: "owner.jobFailed",
    audience: "owner",
    status: "pendingReview",
    payload: {
      job,
      project,
      errorCode: failureCodeFor(job),
    },
    createdAt: occurredAt.toISOString(),
    updatedAt: occurredAt.toISOString(),
    createdBy: "system",
    updatedBy: "system",
  });
}

export function buildExpiredRefundCleanupPlan(records, now = new Date()) {
  if (!Array.isArray(records) || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("invalid_cleanup_input");
  }
  return records.flatMap((record) => {
    const expiresAt = typeof record?.refundAccountExpiresAt === "string"
      ? Date.parse(record.refundAccountExpiresAt)
      : Number.NaN;
    if (
      typeof record?.id !== "string"
      || !record.id
      || typeof record?.refundAccountCiphertext !== "string"
      || !record.refundAccountCiphertext
      || !Number.isFinite(expiresAt)
      || expiresAt > now.getTime()
    ) {
      return [];
    }
    return [{
      id: record.id,
      set: record.status === "pending"
        ? { status: "needsReverification" }
        : {},
      deleteFields: [...TEMPORARY_REFUND_FIELDS],
    }];
  });
}

export function buildFingerprintKeyUsageReport({
  memberAccounts,
  payments,
  knownKeyVersions,
  generatedAt = new Date().toISOString(),
}) {
  if (
    !Array.isArray(memberAccounts)
    || !Array.isArray(payments)
    || !Array.isArray(knownKeyVersions)
    || !Number.isFinite(Date.parse(generatedAt))
  ) {
    throw new Error("invalid_key_usage_input");
  }

  const stats = new Map();
  const unclassifiedDocuments = { memberAccounts: [], paymentSnapshots: [] };
  const documentStatistics = {
    malformedMemberAccounts: 0,
    malformedPaymentSnapshots: 0,
    overdueMemberAccounts: 0,
    overduePaymentSnapshots: 0,
  };
  const reportTimestamp = Date.parse(generatedAt);
  const ensureVersion = (version) => {
    if (!stats.has(version)) {
      stats.set(version, {
        fingerprintKeyVersion: version,
        memberAccountReferences: 0,
        paymentSnapshotReferences: 0,
        earliestReferenceAt: null,
        latestReferenceAt: null,
        disposition: "eligibleForEvaluation",
      });
    }
    return stats.get(version);
  };
  for (const version of knownKeyVersions) {
    if (!Number.isSafeInteger(version) || version < 1) {
      throw new Error("invalid_known_key_version");
    }
    ensureVersion(version);
  }

  for (const account of memberAccounts) {
    if (!isUsableFingerprintIdentity(account)) {
      unclassifiedDocuments.memberAccounts.push(safeDocumentId(account?.id));
      documentStatistics.malformedMemberAccounts += 1;
      continue;
    }
    const entry = ensureVersion(account.fingerprintKeyVersion);
    entry.memberAccountReferences += 1;
    recordReferenceTime(entry, referenceTime(account));
    if (isOverdueReference(account, reportTimestamp)) {
      documentStatistics.overdueMemberAccounts += 1;
    }
  }

  for (const payment of payments) {
    const snapshot = payment?.memberPaymentAccount ?? payment;
    if (!isUsableFingerprintIdentity(snapshot)) {
      unclassifiedDocuments.paymentSnapshots.push(safeDocumentId(payment?.id));
      documentStatistics.malformedPaymentSnapshots += 1;
      continue;
    }
    const entry = ensureVersion(snapshot.fingerprintKeyVersion);
    entry.paymentSnapshotReferences += 1;
    recordReferenceTime(entry, referenceTime(payment));
    if (isOverdueReference(payment, reportTimestamp) || isOverdueReference(snapshot, reportTimestamp)) {
      documentStatistics.overduePaymentSnapshots += 1;
    }
  }

  return {
    generatedAt: new Date(generatedAt).toISOString(),
    cadence: "monthly",
    versions: [...stats.values()]
      .sort((left, right) => left.fingerprintKeyVersion - right.fingerprintKeyVersion)
      .map((entry) => ({
        ...entry,
        disposition: entry.memberAccountReferences + entry.paymentSnapshotReferences > 0
          ? "retain"
          : "eligibleForEvaluation",
      })),
    unclassifiedDocuments,
    documentStatistics,
    autoDisabledVersions: [],
  };
}

function assertProductionJobInput(project, now) {
  if (project !== PRODUCTION_PROJECT) throw new Error("production_project_required");
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("invalid_job_time");
  }
}

async function loadExpiredRecords(db, now) {
  const snapshot = await db
    .collection("cancellationRequests")
    .where("refundAccountExpiresAt", "<=", now.toISOString())
    .get();
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

async function applyCleanupPlan(db, FieldValue, plan, now) {
  let cleaned = 0;
  for (const operation of plan) {
    const ref = db.collection("cancellationRequests").doc(operation.id);
    const changed = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return false;
      const current = snapshot.data();
      const expiry = typeof current.refundAccountExpiresAt === "string"
        ? Date.parse(current.refundAccountExpiresAt)
        : Number.NaN;
      if (
        typeof current.refundAccountCiphertext !== "string"
        || !current.refundAccountCiphertext
        || !Number.isFinite(expiry)
        || expiry > now.getTime()
      ) {
        return false;
      }
      transaction.update(ref, {
        refundAccountCiphertext: FieldValue.delete(),
        refundEncryptionKeyVersion: FieldValue.delete(),
        refundAccountExpiresAt: FieldValue.delete(),
        ...(current.status === "pending" ? { status: "needsReverification" } : {}),
      });
      return true;
    });
    if (changed) cleaned += 1;
  }
  return cleaned;
}

async function loadUsageData(db) {
  const [accounts, payments] = await Promise.all([
    db.collection("memberPaymentAccounts").get(),
    db.collection("payments").get(),
  ]);
  return {
    memberAccounts: accounts.docs.map((document) => ({ id: document.id, ...document.data() })),
    payments: payments.docs.map((document) => ({ id: document.id, ...document.data() })),
  };
}

function failureCodeFor(job) {
  return job === "fingerprintKeyUsageReport"
    ? "fingerprint_key_usage_report_failed"
    : `${job}_failed`;
}

function isOverdueReference(record, reportTimestamp) {
  const expiresAt = record?.fingerprintRetentionExpiresAt ?? record?.retentionExpiresAt;
  return typeof expiresAt === "string"
    && Number.isFinite(Date.parse(expiresAt))
    && Date.parse(expiresAt) <= reportTimestamp;
}

function recordReferenceTime(entry, timestamp) {
  if (!timestamp) return;
  if (!entry.earliestReferenceAt || timestamp < entry.earliestReferenceAt) {
    entry.earliestReferenceAt = timestamp;
  }
  if (!entry.latestReferenceAt || timestamp > entry.latestReferenceAt) {
    entry.latestReferenceAt = timestamp;
  }
}

function referenceTime(record) {
  for (const field of ["createdAt", "reportedAt", "confirmedAt", "updatedAt"]) {
    const normalized = normalizeTimestamp(record?.[field]);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeTimestamp(value) {
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (value && typeof value.toDate === "function") {
    const converted = value.toDate();
    return converted instanceof Date && Number.isFinite(converted.getTime())
      ? converted.toISOString()
      : null;
  }
  if (value && typeof value.seconds === "number") {
    return new Date(
      value.seconds * 1000
      + (typeof value.nanoseconds === "number" ? Math.floor(value.nanoseconds / 1_000_000) : 0),
    ).toISOString();
  }
  return null;
}

function safeDocumentId(value) {
  if (typeof value !== "string" || !value || value.includes("/")) {
    throw new Error("invalid_document_id");
  }
  return value;
}
