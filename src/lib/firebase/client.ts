import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { assertSafeRuntimeMode } from "@/lib/environment/runtimeMode";

assertSafeRuntimeMode({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS:
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS,
  NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH:
    process.env.NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH,
});

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const requiredEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} satisfies Record<keyof FirebaseClientConfig, string | undefined>;

function getFirebaseConfig(): FirebaseClientConfig {
  const missingKeys = Object.entries(requiredEnv)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing Firebase environment config: ${missingKeys.join(", ")}`,
    );
  }

  return requiredEnv as FirebaseClientConfig;
}

function shouldUseEmulators() {
  return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
}

function getFirebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());
}

const app = getFirebaseApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (typeof window !== "undefined" && shouldUseEmulators()) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
