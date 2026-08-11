import { pathToFileURL } from "node:url";
import { assertHmacKeyNameForProject } from "./migrate-member-account-fingerprints.mjs";
import {
  buildFingerprintKeyUsageReport,
  emitGovernanceJobFailure,
  runFingerprintKeyUsageReport,
} from "../ops/security-worker/job-functions.mjs";

export { buildFingerprintKeyUsageReport };

export function parseKeyUsageArgs(argv) {
  const values = parseNamedArgs(argv);
  assertConfirmedProject(values);
  return { project: values.project };
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
    const result = await runFingerprintKeyUsageReport({
      db,
      project,
      now,
      listKnownKeyVersions,
    });
    console.log(JSON.stringify(result.report, null, 2));
  } catch {
    await emitGovernanceJobFailure({
      db,
      project,
      job: "fingerprintKeyUsageReport",
      occurredAt: now,
    }).catch(() => undefined);
    throw new Error("fingerprint_key_usage_report_failed");
  }
}

async function listKnownKeyVersions(project) {
  const keyName = process.env.GCP_KMS_HMAC_KEY_NAME?.trim();
  if (!keyName) throw new Error("cloud_kms_mac_not_configured");
  assertHmacKeyNameForProject(keyName, project);
  const { KeyManagementServiceClient } = await import("@google-cloud/kms");
  const kms = new KeyManagementServiceClient({ projectId: project });
  const [versions] = await kms.listCryptoKeyVersions({ parent: keyName });
  return versions.flatMap((version) => {
    const match = version.name?.match(/\/cryptoKeyVersions\/(\d+)$/);
    const number = match ? Number(match[1]) : Number.NaN;
    return Number.isSafeInteger(number) && number > 0 ? [number] : [];
  });
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
    console.error("fingerprint_key_usage_report_failed");
    process.exitCode = 1;
  }
}
