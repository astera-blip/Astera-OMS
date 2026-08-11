import { pathToFileURL } from "node:url";
import {
  buildExpiredRefundCleanupPlan,
  emitGovernanceJobFailure,
  runRefundAccountCleanup,
} from "../ops/security-worker/job-functions.mjs";

export { buildExpiredRefundCleanupPlan };

export function parseCleanupArgs(argv) {
  const values = parseNamedArgs(argv);
  assertConfirmedProject(values);
  return { project: values.project };
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
    console.log(JSON.stringify(await runRefundAccountCleanup({
      db,
      FieldValue,
      project,
      now,
    }), null, 2));
  } catch {
    await emitGovernanceJobFailure({
      db,
      project,
      job: "refundAccountCleanup",
      occurredAt: now,
    }).catch(() => undefined);
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
  if (values.project !== "astera-oms-prod") {
    throw new Error("production_project_required");
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
