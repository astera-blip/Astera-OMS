import "server-only";

import { readFileSync } from "node:fs";
import { getVercelOidcToken } from "@vercel/oidc";
import { cert, getApps, initializeApp, type App, type Credential } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { IdentityPoolClient } from "google-auth-library";

let adminApp: App | null = null;

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
  const client = new IdentityPoolClient({
    type: "external_account",
    audience,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    service_account_impersonation: {
      token_lifetime_seconds: 3600,
    },
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/datastore",
      "https://www.googleapis.com/auth/devstorage.read_write",
    ],
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({
        audience,
        expirationBufferMs: 5 * 60 * 1000,
      }),
    },
  });

  return {
    async getAccessToken() {
      const response = await client.getAccessToken();

      if (!response.token) {
        throw new Error("vercel_oidc_access_token_missing");
      }

      return {
        access_token: response.token,
        expires_in: 3600,
      };
    },
  };
}

function getProjectId() {
  return process.env.GOOGLE_CLOUD_PROJECT
    ?? process.env.GCP_PROJECT_ID
    ?? process.env.GCLOUD_PROJECT
    ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ?? undefined;
}

function getStorageBucket() {
  return process.env.FIREBASE_STORAGE_BUCKET
    ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ?? undefined;
}

export function getAdminApp() {
  if (adminApp) {
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
  return getFirestore(getAdminApp());
}

export function getAdminStorage() {
  return getStorage(getAdminApp());
}

export function getAdminStorageBucket() {
  const bucketName = getStorageBucket();
  if (!bucketName) {
    throw new Error("storage_bucket_not_configured");
  }
  return getAdminStorage().bucket(bucketName);
}
