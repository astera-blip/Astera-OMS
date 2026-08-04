import { pathToFileURL } from "node:url";

export function parseKeyUsageArgs(argv) {
  const values = parseNamedArgs(argv);
  assertConfirmedProject(values);
  return { project: values.project };
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
  const unclassifiedDocuments = {
    memberAccounts: [],
    paymentSnapshots: [],
  };
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
    const version = account?.fingerprintKeyVersion;
    if (!Number.isSafeInteger(version) || version < 1) {
      unclassifiedDocuments.memberAccounts.push(safeDocumentId(account?.id));
      continue;
    }
    const entry = ensureVersion(version);
    entry.memberAccountReferences += 1;
    recordReferenceTime(entry, referenceTime(account));
  }

  for (const payment of payments) {
    const snapshot = payment?.memberPaymentAccount ?? payment;
    const version = snapshot?.fingerprintKeyVersion;
    if (!Number.isSafeInteger(version) || version < 1) {
      unclassifiedDocuments.paymentSnapshots.push(safeDocumentId(payment?.id));
      continue;
    }
    const entry = ensureVersion(version);
    entry.paymentSnapshotReferences += 1;
    recordReferenceTime(entry, referenceTime(payment));
  }

  const versions = [...stats.values()]
    .sort((left, right) => left.fingerprintKeyVersion - right.fingerprintKeyVersion)
    .map((entry) => ({
      ...entry,
      disposition: entry.memberAccountReferences + entry.paymentSnapshotReferences > 0
        ? "retain"
        : "eligibleForEvaluation",
    }));

  return {
    generatedAt: new Date(generatedAt).toISOString(),
    cadence: "monthly",
    versions,
    unclassifiedDocuments,
    autoDisabledVersions: [],
  };
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
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (value && typeof value.toDate === "function") {
    const converted = value.toDate();
    return converted instanceof Date && Number.isFinite(converted.getTime())
      ? converted.toISOString()
      : null;
  }
  if (value && typeof value.seconds === "number") {
    return new Date(
      value.seconds * 1000
      + (typeof value.nanoseconds === "number"
        ? Math.floor(value.nanoseconds / 1_000_000)
        : 0),
    ).toISOString();
  }
  return null;
}

async function loadUsageData(db) {
  const [accounts, payments] = await Promise.all([
    db.collection("memberPaymentAccounts").get(),
    db.collection("payments").get(),
  ]);
  return {
    memberAccounts: accounts.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
    payments: payments.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
  };
}

async function listKnownKeyVersions(project) {
  const keyName = process.env.GCP_KMS_HMAC_KEY_NAME?.trim();
  if (!keyName || !keyName.includes(`/projects/${project}/`)) {
    throw new Error("cloud_kms_mac_not_configured");
  }
  const { KeyManagementServiceClient } = await import("@google-cloud/kms");
  const kms = new KeyManagementServiceClient({ projectId: project });
  const [versions] = await kms.listCryptoKeyVersions({ parent: keyName });
  return versions.flatMap((version) => {
    const match = version.name?.match(/\/cryptoKeyVersions\/(\d+)$/);
    const number = match ? Number(match[1]) : Number.NaN;
    return Number.isSafeInteger(number) && number > 0 ? [number] : [];
  });
}

async function emitOwnerJobFailure(db, project, occurredAt) {
  await db.collection("notificationEvents").add({
    type: "owner.jobFailed",
    audience: "owner",
    status: "pendingReview",
    payload: {
      job: "fingerprintKeyUsageReport",
      project,
      errorCode: "fingerprint_key_usage_report_failed",
    },
    createdAt: occurredAt.toISOString(),
    updatedAt: occurredAt.toISOString(),
    createdBy: "system",
    updatedBy: "system",
  });
}

async function main(argv) {
  const { project } = parseKeyUsageArgs(argv);
  const [{ applicationDefault, getApps, initializeApp }, { getFirestore }] =
    await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/firestore"),
    ]);
  const app = getApps()[0] ?? initializeApp({
    credential: applicationDefault(),
    projectId: project,
  });
  const db = getFirestore(app);
  const now = new Date();
  try {
    const [{ memberAccounts, payments }, knownKeyVersions] = await Promise.all([
      loadUsageData(db),
      listKnownKeyVersions(project),
    ]);
    console.log(JSON.stringify(buildFingerprintKeyUsageReport({
      memberAccounts,
      payments,
      knownKeyVersions,
      generatedAt: now.toISOString(),
    }), null, 2));
  } catch {
    await emitOwnerJobFailure(db, project, now).catch(() => undefined);
    throw new Error("fingerprint_key_usage_report_failed");
  }
}

function parseNamedArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!token?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error("invalid_arguments");
    }
    values[token.slice(2)] = value;
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

function safeDocumentId(value) {
  if (typeof value !== "string" || !value || value.includes("/")) {
    throw new Error("invalid_document_id");
  }
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main(process.argv.slice(2));
  } catch {
    console.error("fingerprint_key_usage_report_failed");
    process.exitCode = 1;
  }
}
