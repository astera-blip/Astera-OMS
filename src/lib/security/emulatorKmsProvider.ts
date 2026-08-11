import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { everyConfiguredProjectMatches } from "@/lib/firebase/projectEnvironment";

const emulatorProjectId = "demo-astera-oms";
const latestMacKeyVersion = 7;
const refundEncryptionKeyVersion = 4;
const macKeys = new Map([
  [3, "e2e-fingerprint-key-version-3"],
  [7, "e2e-fingerprint-key-version-7"],
]);
const refundEncryptionKey = createHash("sha256")
  .update("astera-e2e-refund-vault-key-v4")
  .digest();

type MacSignRequest = {
  name?: string | null;
  data?: Uint8Array | string | null;
};

type EncryptRequest = {
  name?: string | null;
  plaintext?: Uint8Array | string | null;
  additionalAuthenticatedData?: Uint8Array | string | null;
};

type DecryptRequest = {
  name?: string | null;
  ciphertext?: Uint8Array | string | null;
  additionalAuthenticatedData?: Uint8Array | string | null;
};

type EmulatorKmsEnvironment = Readonly<Record<string, string | undefined>>;

export function isEmulatorKmsProviderEnabled(
  env: EmulatorKmsEnvironment = process.env,
) {
  return env.PLAYWRIGHT_USE_FIREBASE_EMULATORS === "true"
    && everyConfiguredProjectMatches(emulatorProjectId, env)
    && isExpectedLocalEmulatorHost(env.FIREBASE_AUTH_EMULATOR_HOST, 9099)
    && isExpectedLocalEmulatorHost(env.FIRESTORE_EMULATOR_HOST, 8080)
    && env.NODE_ENV !== "production"
    && env.VERCEL !== "1"
    && !env.VERCEL_ENV?.trim();
}

export function emulatorKmsMacConfig(
  env: EmulatorKmsEnvironment = process.env,
) {
  requireEmulatorKmsProvider(env);
  return {
    projectId: emulatorProjectId,
    keyName: `projects/${emulatorProjectId}/locations/asia-east1/keyRings/e2e/cryptoKeys/account-fingerprint`,
    keyVersion: latestMacKeyVersion,
  };
}

export function createEmulatorKmsMacSigner(
  env: EmulatorKmsEnvironment = process.env,
) {
  requireEmulatorKmsProvider(env);
  return {
    async macSign(request: MacSignRequest) {
      const keyVersion = keyVersionFromResourceName(request.name);
      const key = keyVersion ? macKeys.get(keyVersion) : undefined;
      if (!key || request.data === null || request.data === undefined) {
        throw new Error("invalid_emulator_kms_mac_request");
      }
      return [{
        name: request.name,
        mac: createHmac("sha256", key)
          .update(asBuffer(request.data))
          .digest(),
      }];
    },
  };
}

export function createEmulatorRefundKmsClient(
  env: EmulatorKmsEnvironment = process.env,
) {
  requireEmulatorKmsProvider(env);
  return {
    async encrypt(request: EncryptRequest) {
      if (!request.name || request.plaintext === null || request.plaintext === undefined) {
        throw new Error("invalid_emulator_kms_encrypt_request");
      }
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", refundEncryptionKey, iv);
      if (request.additionalAuthenticatedData !== null
        && request.additionalAuthenticatedData !== undefined) {
        cipher.setAAD(asBuffer(request.additionalAuthenticatedData));
      }
      const ciphertext = Buffer.concat([
        iv,
        cipher.update(asBuffer(request.plaintext)),
        cipher.final(),
        cipher.getAuthTag(),
      ]);
      return [{
        name: `${request.name}/cryptoKeyVersions/${refundEncryptionKeyVersion}`,
        ciphertext,
      }];
    },
    async decrypt(request: DecryptRequest) {
      if (request.ciphertext === null || request.ciphertext === undefined) {
        throw new Error("invalid_emulator_kms_decrypt_request");
      }
      const ciphertext = asBuffer(request.ciphertext);
      if (ciphertext.length < 29) {
        throw new Error("invalid_emulator_kms_ciphertext");
      }
      const iv = ciphertext.subarray(0, 12);
      const authTag = ciphertext.subarray(ciphertext.length - 16);
      const encrypted = ciphertext.subarray(12, ciphertext.length - 16);
      const decipher = createDecipheriv("aes-256-gcm", refundEncryptionKey, iv);
      if (request.additionalAuthenticatedData !== null
        && request.additionalAuthenticatedData !== undefined) {
        decipher.setAAD(asBuffer(request.additionalAuthenticatedData));
      }
      decipher.setAuthTag(authTag);
      return [{
        plaintext: Buffer.concat([
          decipher.update(encrypted),
          decipher.final(),
        ]),
      }];
    },
  };
}

function requireEmulatorKmsProvider(env: EmulatorKmsEnvironment) {
  if (!isEmulatorKmsProviderEnabled(env)) {
    throw new Error("emulator_kms_provider_forbidden");
  }
}

function keyVersionFromResourceName(resourceName: string | null | undefined) {
  const match = resourceName?.match(/\/cryptoKeyVersions\/(\d+)$/);
  const version = match ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(version) && version > 0 ? version : undefined;
}

function asBuffer(value: Uint8Array | string) {
  return typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
}

function isExpectedLocalEmulatorHost(value: string | undefined, port: number) {
  const host = value?.trim() ?? "";
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}
