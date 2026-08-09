import { createServer } from "node:http";
import {
  emitGovernanceJobFailure,
  runFingerprintKeyUsageReport,
  runRefundAccountCleanup,
} from "./job-functions.mjs";

const PRODUCTION_PROJECT = "astera-oms-prod";
const FAILURE_RESPONSE = Object.freeze({ ok: false, error: "security_worker_failed" });

/**
 * @param {{
 *   project: string | undefined;
 *   initializeDependencies?: (input: { project: string }) => Promise<{
 *     db: any;
 *     FieldValue: any;
 *     listKnownKeyVersions: () => Promise<number[]>;
 *   }>;
 *   now?: () => Date;
 * }} options
 * @returns {import("node:http").RequestListener}
 */
export function createSecurityWorker({
  project,
  initializeDependencies = initializeRuntimeDependencies,
  now = () => new Date(),
} = {}) {
  return async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://security-worker.local").pathname;
    if (pathname === "/healthz") {
      return request.method === "GET"
        ? sendJson(response, 200, { ok: true })
        : sendJson(response, 405, { ok: false });
    }
    if (pathname !== "/jobs/refund-account-cleanup" && pathname !== "/jobs/fingerprint-key-usage") {
      return sendJson(response, 404, { ok: false });
    }
    if (request.method !== "POST") return sendJson(response, 405, { ok: false });

    let dependencies;
    const runtimeProject = process.env.GOOGLE_CLOUD_PROJECT?.trim();
    const job = pathname === "/jobs/refund-account-cleanup"
      ? "refundAccountCleanup"
      : "fingerprintKeyUsageReport";
    const occurredAt = now();
    try {
      if (runtimeProject !== PRODUCTION_PROJECT || project !== runtimeProject) {
        throw new Error("production_project_required");
      }
      dependencies = await initializeDependencies({ project: runtimeProject });
      const result = job === "refundAccountCleanup"
        ? await runRefundAccountCleanup({
          db: dependencies.db,
          FieldValue: dependencies.FieldValue,
          project: runtimeProject,
          now: occurredAt,
        })
        : await runFingerprintKeyUsageReport({
          db: dependencies.db,
          project: runtimeProject,
          now: occurredAt,
          listKnownKeyVersions: dependencies.listKnownKeyVersions,
        });
      return job === "refundAccountCleanup"
        ? sendJson(response, 200, { ok: true, job, cleaned: result.cleaned })
        : sendJson(response, 200, {
          ok: true,
          job,
          versionCount: result.report.versions.length,
          malformedMemberAccounts: result.report.documentStatistics.malformedMemberAccounts,
          malformedPaymentSnapshots: result.report.documentStatistics.malformedPaymentSnapshots,
        });
    } catch {
      if (dependencies?.db) {
        await emitGovernanceJobFailure({
          db: dependencies.db,
          project: runtimeProject,
          job,
          occurredAt,
        }).catch(() => undefined);
      }
      console.error("security_worker_failed");
      return sendJson(response, 500, FAILURE_RESPONSE);
    }
  };
}

async function initializeRuntimeDependencies({ project }) {
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
  return {
    db,
    FieldValue,
    listKnownKeyVersions: createKeyVersionLister(project),
  };
}

function createKeyVersionLister(project) {
  return async () => {
    const keyName = process.env.GCP_KMS_HMAC_KEY_NAME?.trim();
    if (!keyName || !keyName.startsWith(`projects/${project}/`)) {
      throw new Error("cloud_kms_mac_not_configured");
    }
    const { KeyManagementServiceClient } = await import("@google-cloud/kms");
    const kms = new KeyManagementServiceClient({ projectId: project });
    const [versions] = await kms.listCryptoKeyVersions({ parent: keyName });
    return versions.flatMap((version) => {
      const match = version.name?.match(/\/cryptoKeyVersions\/(\d+)$/);
      const versionNumber = match ? Number(match[1]) : Number.NaN;
      return Number.isSafeInteger(versionNumber) && versionNumber > 0 ? [versionNumber] : [];
    });
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"))) {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  createServer(createSecurityWorker({ project })).listen(process.env.PORT ?? 8080);
}
