import "server-only";

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getVercelOidcTokenSync } from "@vercel/oidc";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type Credential,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { resolveFirebaseProjectId } from "@/lib/firebase/projectEnvironment";

let adminApp: App | null = null;
let usingVercelOidc = false;

const vercelOidcDirectory = join(tmpdir(), "astera-oms-vercel-oidc");
const vercelOidcSubjectTokenPath = join(vercelOidcDirectory, "subject-token.jwt");
const vercelOidcCredentialPath = join(vercelOidcDirectory, "external-account.json");

function loadServiceAccount() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credentialsPath) {
    return null;
  }

  const credentials = JSON.parse(readFileSync(credentialsPath, "utf8")) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS does not contain a valid service account JSON.");
  }

  return cert({
    projectId: credentials.project_id,
    clientEmail: credentials.client_email,
    privateKey: credentials.private_key,
  });
}

function getVercelOidcCredential(): Credential | null {
  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER_ID;
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;

  if (!projectNumber || !poolId || !providerId || !serviceAccountEmail) {
    return null;
  }

  const audience = process.env.GCP_WORKLOAD_IDENTITY_AUDIENCE
    ?? `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
  mkdirSync(vercelOidcDirectory, { recursive: true });
  chmodSync(vercelOidcDirectory, 0o700);
  writeFileSync(vercelOidcSubjectTokenPath, getVercelOidcTokenSync(), {
    encoding: "utf8",
    mode: 0o600,
  });
  writeFileSync(vercelOidcCredentialPath, JSON.stringify({
    type: "external_account",
    audience,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    credential_source: {
      file: vercelOidcSubjectTokenPath,
      format: {
        type: "text",
      },
    },
  }), { encoding: "utf8", mode: 0o600 });

  // Firestore only accepts Firebase Admin's official credential classes. The
  // generated external-account file lets applicationDefault() use Vercel's
  // short-lived OIDC token without storing a service-account private key.
  process.env.GOOGLE_APPLICATION_CREDENTIALS = vercelOidcCredentialPath;
  usingVercelOidc = true;
  return applicationDefault();
}

function refreshVercelOidcSubjectToken() {
  if (!usingVercelOidc) {
    return;
  }

  writeFileSync(vercelOidcSubjectTokenPath, getVercelOidcTokenSync(), {
    encoding: "utf8",
    mode: 0o600,
  });
}

function getProjectId() {
  return resolveFirebaseProjectId();
}

function getStorageBucket() {
  return process.env.FIREBASE_STORAGE_BUCKET
    ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ?? undefined;
}

export function getAdminApp() {
  if (adminApp) {
    refreshVercelOidcSubjectToken();
    return adminApp;
  }

  if (getApps().length > 0) {
    adminApp = getApps()[0] ?? null;
    if (!adminApp) {
      throw new Error("Firebase admin app could not be initialized.");
    }
    return adminApp;
  }

  const credential = loadServiceAccount() ?? getVercelOidcCredential();
  const projectId = getProjectId();
  const storageBucket = getStorageBucket();
  adminApp = initializeApp(
    credential
      ? { credential, ...(storageBucket ? { storageBucket } : {}) }
      : projectId || storageBucket
        ? {
            ...(projectId ? { projectId } : {}),
            ...(storageBucket ? { storageBucket } : {}),
          }
        : undefined,
  );

  return adminApp;
}

export function getAdminFirestore() {
  refreshVercelOidcSubjectToken();
  return getFirestore(getAdminApp());
}

export function getAdminStorage() {
  refreshVercelOidcSubjectToken();
  return getStorage(getAdminApp());
}

export function getAdminStorageBucket() {
  const bucketName = getStorageBucket();
  if (!bucketName) {
    throw new Error("storage_bucket_not_configured");
  }
  return getAdminStorage().bucket(bucketName);
}
