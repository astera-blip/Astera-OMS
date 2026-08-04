import { pathToFileURL } from "node:url";

const TEMPORARY_REFUND_FIELDS = [
  "refundAccountCiphertext",
  "refundEncryptionKeyVersion",
  "refundAccountExpiresAt",
];

export function parseCleanupArgs(argv) {
  const values = parseNamedArgs(argv);
  assertConfirmedProject(values);
  return { project: values.project };
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

async function loadExpiredRecords(db, now) {
  const snapshot = await db
    .collection("cancellationRequests")
    .where("refundAccountExpiresAt", "<=", now.toISOString())
    .get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
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

async function emitOwnerJobFailure(db, project, job, occurredAt) {
  await db.collection("notificationEvents").add({
    type: "owner.jobFailed",
    audience: "owner",
    status: "pendingReview",
    payload: {
      job,
      project,
      errorCode: `${job}_failed`,
    },
    createdAt: occurredAt.toISOString(),
    updatedAt: occurredAt.toISOString(),
    createdBy: "system",
    updatedBy: "system",
  });
}

async function main(argv) {
  const { project } = parseCleanupArgs(argv);
  const [{ applicationDefault, getApps, initializeApp }, { FieldValue, getFirestore }] =
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
    const records = await loadExpiredRecords(db, now);
    const plan = buildExpiredRefundCleanupPlan(records, now);
    const cleaned = await applyCleanupPlan(db, FieldValue, plan, now);
    console.log(JSON.stringify({ ok: true, project, cleaned }, null, 2));
  } catch {
    await emitOwnerJobFailure(db, project, "refundAccountCleanup", now).catch(() => undefined);
    throw new Error("refund_account_cleanup_failed");
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main(process.argv.slice(2));
  } catch {
    console.error("refund_account_cleanup_failed");
    process.exitCode = 1;
  }
}
