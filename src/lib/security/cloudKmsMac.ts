import { KeyManagementServiceClient } from "@google-cloud/kms";
import {
  createEmulatorKmsMacSigner,
  emulatorKmsMacConfig,
  isEmulatorKmsProviderEnabled,
} from "@/lib/security/emulatorKmsProvider";

export type CloudKmsMacClient = {
  signCanonicalAccount(canonical: string, keyVersion?: number): Promise<{ mac: string; keyVersion: number }>;
};

type CloudKmsMacConfig = {
  projectId: string;
  keyName: string;
  keyVersion: number;
};

type KmsMacSigner = Pick<KeyManagementServiceClient, "macSign">;

export class CloudKmsMac implements CloudKmsMacClient {
  private readonly config: CloudKmsMacConfig;
  private readonly kms: KmsMacSigner;

  constructor(
    config = getCloudKmsMacConfig(),
    kms = createKmsMacSigner(config),
  ) {
    this.config = config;
    this.kms = kms;
  }

  async signCanonicalAccount(canonical: string, keyVersion = this.config.keyVersion): Promise<{ mac: string; keyVersion: number }> {
    if (typeof canonical !== "string") {
      throw new Error("invalid_canonical_account");
    }
    if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
      throw new Error("invalid_kms_key_version");
    }

    const requestedVersionName = `${this.config.keyName}/cryptoKeyVersions/${keyVersion}`;
    const [response] = await this.kms.macSign({
      name: requestedVersionName,
      data: Buffer.from(canonical, "utf8"),
    });
    if (!response.mac) {
      throw new Error("kms_mac_missing");
    }

    return {
      mac: Buffer.from(response.mac).toString("base64"),
      keyVersion: keyVersionFromResourceName(response.name) ?? keyVersion,
    };
  }
}

export function getCloudKmsMacConfig(env: NodeJS.ProcessEnv = process.env): CloudKmsMacConfig {
  if (isEmulatorKmsProviderEnabled(env)) {
    return emulatorKmsMacConfig(env);
  }
  const projectId = env.GCP_PROJECT_ID?.trim();
  const keyName = env.GCP_KMS_HMAC_KEY_NAME?.trim();
  const keyVersion = Number(env.GCP_KMS_HMAC_KEY_VERSION);

  if (!projectId || !keyName || !Number.isSafeInteger(keyVersion) || keyVersion < 1) {
    throw new Error("cloud_kms_mac_not_configured");
  }

  return { projectId, keyName, keyVersion };
}

function createKmsMacSigner(config: CloudKmsMacConfig): KmsMacSigner {
  if (isEmulatorKmsProviderEnabled()) {
    return createEmulatorKmsMacSigner() as KmsMacSigner;
  }
  return new KeyManagementServiceClient({ projectId: config.projectId });
}

function keyVersionFromResourceName(resourceName: string | null | undefined): number | undefined {
  const match = resourceName?.match(/\/cryptoKeyVersions\/(\d+)$/);
  const keyVersion = match ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(keyVersion) && keyVersion > 0 ? keyVersion : undefined;
}
