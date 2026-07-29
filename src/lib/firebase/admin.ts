import "server-only";

import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

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

function getProjectId() {
  return process.env.GOOGLE_CLOUD_PROJECT
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

  const credential = loadServiceAccount();
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
