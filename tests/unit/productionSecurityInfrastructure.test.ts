import { describe, expect, it, vi } from "vitest";
import {
  buildProductionSecurityCommands,
  parseProductionSecurityArgs,
  runProductionSecuritySetup,
} from "../../scripts/setup-production-security.mjs";

const confirmedDryRunArgs = [
  "--project", "astera-oms-prod",
  "--confirm-project", "astera-oms-prod",
];
const unsafeProjectArgs: string[][] = [
  [],
  ["--project", "astera-oms-prod"],
  ["--project", "astera-oms-prod", "--confirm-project", "another-project"],
  ["--project", "astera-oms-dev-b2b2e", "--confirm-project", "astera-oms-dev-b2b2e", "--apply"],
];
const enableApisArgs = [
  "services", "enable",
  "cloudkms.googleapis.com",
  "run.googleapis.com",
  "cloudscheduler.googleapis.com",
  "cloudbuild.googleapis.com",
  "artifactregistry.googleapis.com",
  "monitoring.googleapis.com",
  "--project", "astera-oms-prod",
  "--quiet",
];

describe("production security infrastructure", () => {
  it("defaults to a dry run for the exact Production project and region", () => {
    expect(parseProductionSecurityArgs(confirmedDryRunArgs)).toEqual({
      project: "astera-oms-prod",
      apply: false,
      region: "asia-east1",
    });
  });

  it.each(unsafeProjectArgs)("rejects an unsafe project gate: %o", (argv) => {
    expect(() => parseProductionSecurityArgs(argv)).toThrow();
  });

  it("builds the exact least-privilege Production resource command plan", () => {
    const commands = buildProductionSecurityCommands(
      parseProductionSecurityArgs(confirmedDryRunArgs),
    );

    expect(commands).toEqual([
      {
        name: "enableApis",
        command: "gcloud",
        args: [
          "services", "enable",
          "cloudkms.googleapis.com",
          "run.googleapis.com",
          "cloudscheduler.googleapis.com",
          "cloudbuild.googleapis.com",
          "artifactregistry.googleapis.com",
          "monitoring.googleapis.com",
          "--project", "astera-oms-prod",
          "--quiet",
        ],
      },
      {
        name: "discoverKeyRing",
        command: "gcloud",
        args: [
          "kms", "keyrings", "list",
          "--location=asia-east1",
          "--filter=name=projects/astera-oms-prod/locations/asia-east1/keyRings/astera-oms-security",
          "--format=json(name)",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "createKeyRing",
        command: "gcloud",
        args: [
          "kms", "keyrings", "create", "astera-oms-security",
          "--location=asia-east1",
          "--project", "astera-oms-prod",
          "--quiet",
        ],
      },
      {
        name: "discoverHmacKey",
        command: "gcloud",
        args: [
          "kms", "keys", "list",
          "--keyring=astera-oms-security",
          "--location=asia-east1",
          "--filter=name=projects/astera-oms-prod/locations/asia-east1/keyRings/astera-oms-security/cryptoKeys/member-account-fingerprint",
          "--format=json(name,purpose,versionTemplate)",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "createHmacKey",
        command: "gcloud",
        args: [
          "kms", "keys", "create", "member-account-fingerprint",
          "--keyring=astera-oms-security",
          "--location=asia-east1",
          "--purpose=mac",
          "--default-algorithm=hmac-sha256",
          "--protection-level=software",
          "--project", "astera-oms-prod",
          "--quiet",
        ],
      },
      {
        name: "discoverRefundKey",
        command: "gcloud",
        args: [
          "kms", "keys", "list",
          "--keyring=astera-oms-security",
          "--location=asia-east1",
          "--filter=name=projects/astera-oms-prod/locations/asia-east1/keyRings/astera-oms-security/cryptoKeys/refund-account-vault",
          "--format=json(name,purpose,versionTemplate)",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "createRefundKey",
        command: "gcloud",
        args: [
          "kms", "keys", "create", "refund-account-vault",
          "--keyring=astera-oms-security",
          "--location=asia-east1",
          "--purpose=encryption",
          "--default-algorithm=google-symmetric-encryption",
          "--protection-level=software",
          "--project", "astera-oms-prod",
          "--quiet",
        ],
      },
      {
        name: "discoverWorkerServiceAccount",
        command: "gcloud",
        args: [
          "iam", "service-accounts", "list",
          "--filter=email=astera-security-worker@astera-oms-prod.iam.gserviceaccount.com",
          "--format=json(email)",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "createWorkerServiceAccount",
        command: "gcloud",
        args: [
          "iam", "service-accounts", "create", "astera-security-worker",
          "--display-name=Astera Security Worker",
          "--project", "astera-oms-prod",
          "--quiet",
        ],
      },
      {
        name: "discoverSchedulerServiceAccount",
        command: "gcloud",
        args: [
          "iam", "service-accounts", "list",
          "--filter=email=astera-security-scheduler@astera-oms-prod.iam.gserviceaccount.com",
          "--format=json(email)",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "createSchedulerServiceAccount",
        command: "gcloud",
        args: [
          "iam", "service-accounts", "create", "astera-security-scheduler",
          "--display-name=Astera Security Scheduler",
          "--project", "astera-oms-prod",
          "--quiet",
        ],
      },
      {
        name: "discoverHmacIamPolicy",
        command: "gcloud",
        args: [
          "kms", "keys", "get-iam-policy", "member-account-fingerprint",
          "--keyring=astera-oms-security",
          "--location=asia-east1",
          "--format=json",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "bindVercelHmacSigner",
        command: "gcloud",
        args: [
          "kms", "keys", "add-iam-policy-binding", "member-account-fingerprint",
          "--keyring=astera-oms-security",
          "--location=asia-east1",
          "--member=serviceAccount:astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com",
          "--role=roles/cloudkms.signer",
          "--project", "astera-oms-prod",
          "--quiet",
        ],
      },
      {
        name: "bindWorkerHmacViewer",
        command: "gcloud",
        args: [
          "kms", "keys", "add-iam-policy-binding", "member-account-fingerprint",
          "--keyring=astera-oms-security",
          "--location=asia-east1",
          "--member=serviceAccount:astera-security-worker@astera-oms-prod.iam.gserviceaccount.com",
          "--role=roles/cloudkms.viewer",
          "--project", "astera-oms-prod",
          "--quiet",
        ],
      },
      {
        name: "discoverRefundIamPolicy",
        command: "gcloud",
        args: [
          "kms", "keys", "get-iam-policy", "refund-account-vault",
          "--keyring=astera-oms-security",
          "--location=asia-east1",
          "--format=json",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "bindVercelRefundCrypto",
        command: "gcloud",
        args: [
          "kms", "keys", "add-iam-policy-binding", "refund-account-vault",
          "--keyring=astera-oms-security",
          "--location=asia-east1",
          "--member=serviceAccount:astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com",
          "--role=roles/cloudkms.cryptoKeyEncrypterDecrypter",
          "--project", "astera-oms-prod",
          "--quiet",
        ],
      },
      {
        name: "discoverArtifactRepository",
        command: "gcloud",
        args: [
          "artifacts", "repositories", "list",
          "--location=asia-east1",
          "--filter=name=projects/astera-oms-prod/locations/asia-east1/repositories/astera-ops",
          "--format=json(name,format)",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "createArtifactRepository",
        command: "gcloud",
        args: [
          "artifacts", "repositories", "create", "astera-ops",
          "--repository-format=docker",
          "--location=asia-east1",
          "--project", "astera-oms-prod",
          "--quiet",
        ],
      },
      {
        name: "prepareCloudRunDeployment",
        command: "gcloud",
        args: [
          "services", "describe", "run.googleapis.com",
          "--format=value(state)",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "prepareSchedulerDeployment",
        command: "gcloud",
        args: [
          "services", "describe", "cloudscheduler.googleapis.com",
          "--format=value(state)",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "prepareMonitoringDeployment",
        command: "gcloud",
        args: [
          "services", "describe", "monitoring.googleapis.com",
          "--format=value(state)",
          "--project", "astera-oms-prod",
        ],
      },
    ]);
  });

  it("prints only safe action names and executes nothing in the default dry run", () => {
    const spawnSync = vi.fn();
    const output: string[] = [];

    const result = runProductionSecuritySetup(confirmedDryRunArgs, {
      spawnSync,
      log: (line) => output.push(line),
    });

    expect(result.mode).toBe("dry-run");
    expect(spawnSync).not.toHaveBeenCalled();
    expect(output).toEqual([
      "mode=dry-run",
      "action=enableApis",
      "action=createKeyRing",
      "action=createHmacKey",
      "action=createRefundKey",
      "action=createWorkerServiceAccount",
      "action=createSchedulerServiceAccount",
      "action=bindVercelHmacSigner",
      "action=bindWorkerHmacViewer",
      "action=bindVercelRefundCrypto",
      "action=createArtifactRepository",
      "action=prepareCloudRunDeployment",
      "action=prepareSchedulerDeployment",
      "action=prepareMonitoringDeployment",
    ]);
    expect(output.join("\n")).not.toMatch(/@|policy|token|fingerprint|ciphertext|account data/i);
  });

  it("requires the triple gate, uses argv with shell false, and stops on first failure", () => {
    const spawnSync = vi.fn(() => ({ status: 7, stdout: "", stderr: "not printed" }));
    const output: string[] = [];

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], {
      spawnSync,
      log: (line) => output.push(line),
      platform: "linux",
    })).toThrow("production_security_command_failed:enableApis");

    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(spawnSync).toHaveBeenCalledWith(
      "gcloud",
      enableApisArgs,
      expect.objectContaining({ shell: false }),
    );
    expect(output).toEqual(["mode=apply", "action=enableApis"]);
  });

  it("launches gcloud.cmd through the validated Windows command processor", () => {
    const spawnSync = vi.fn(() => ({ status: 7, stdout: "", stderr: "not printed" }));

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], {
      spawnSync,
      log: vi.fn(),
      platform: "win32",
      env: {
        SystemRoot: "C:\\Windows",
        ComSpec: "C:\\Windows\\System32\\cmd.exe",
      },
    })).toThrow("production_security_command_failed:enableApis");

    expect(spawnSync).toHaveBeenCalledWith(
      "C:\\Windows\\System32\\cmd.exe",
      ["/d", "/s", "/c", "gcloud.cmd", ...enableApisArgs],
      expect.objectContaining({ shell: false }),
    );
  });

  it("fails closed before spawning when the Windows command processor is invalid", () => {
    const spawnSync = vi.fn();

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], {
      spawnSync,
      log: vi.fn(),
      platform: "win32",
      env: {
        SystemRoot: "C:\\Windows",
        ComSpec: "C:\\untrusted\\cmd.exe",
      },
    })).toThrow("production_security_windows_launcher_invalid");
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("leaves exact existing resources and IAM bindings unchanged", () => {
    const spawnSync = vi.fn((_command: string, args: string[]) => {
      const joined = args.join(" ");
      if (joined.includes("kms keyrings list")) {
        return successfulJson([{
          name: "projects/astera-oms-prod/locations/asia-east1/keyRings/astera-oms-security",
        }]);
      }
      if (joined.includes("kms keys list") && joined.includes("member-account-fingerprint")) {
        return successfulJson([{
          name: "projects/astera-oms-prod/locations/asia-east1/keyRings/astera-oms-security/cryptoKeys/member-account-fingerprint",
          purpose: "MAC",
          versionTemplate: { algorithm: "HMAC_SHA256", protectionLevel: "SOFTWARE" },
        }]);
      }
      if (joined.includes("kms keys list") && joined.includes("refund-account-vault")) {
        return successfulJson([{
          name: "projects/astera-oms-prod/locations/asia-east1/keyRings/astera-oms-security/cryptoKeys/refund-account-vault",
          purpose: "ENCRYPT_DECRYPT",
          versionTemplate: {
            algorithm: "GOOGLE_SYMMETRIC_ENCRYPTION",
            protectionLevel: "SOFTWARE",
          },
        }]);
      }
      if (joined.includes("iam service-accounts list") && joined.includes("astera-security-worker@")) {
        return successfulJson([{
          email: "astera-security-worker@astera-oms-prod.iam.gserviceaccount.com",
        }]);
      }
      if (joined.includes("iam service-accounts list") && joined.includes("astera-security-scheduler@")) {
        return successfulJson([{
          email: "astera-security-scheduler@astera-oms-prod.iam.gserviceaccount.com",
        }]);
      }
      if (joined.includes("get-iam-policy") && joined.includes("member-account-fingerprint")) {
        return successfulJson({ bindings: [
          {
            role: "roles/cloudkms.signer",
            members: ["serviceAccount:astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com"],
          },
          {
            role: "roles/cloudkms.viewer",
            members: ["serviceAccount:astera-security-worker@astera-oms-prod.iam.gserviceaccount.com"],
          },
        ] });
      }
      if (joined.includes("get-iam-policy") && joined.includes("refund-account-vault")) {
        return successfulJson({ bindings: [{
          role: "roles/cloudkms.cryptoKeyEncrypterDecrypter",
          members: ["serviceAccount:astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com"],
        }] });
      }
      if (joined.includes("artifacts repositories list")) {
        return successfulJson([{
          name: "projects/astera-oms-prod/locations/asia-east1/repositories/astera-ops",
          format: "DOCKER",
        }]);
      }
      return { status: 0, stdout: "ENABLED\n", stderr: "" };
    });
    const output: string[] = [];

    runProductionSecuritySetup([...confirmedDryRunArgs, "--apply"], {
      spawnSync,
      log: (line) => output.push(line),
    });

    expect(output).not.toContain("action=createKeyRing");
    expect(output).not.toContain("action=createHmacKey");
    expect(output).not.toContain("action=createRefundKey");
    expect(output).not.toContain("action=bindVercelHmacSigner");
    expect(output).not.toContain("action=bindWorkerHmacViewer");
    expect(output).not.toContain("action=bindVercelRefundCrypto");
    expect(output).not.toContain("action=createArtifactRepository");
  });
});

function successfulJson(value: unknown) {
  return { status: 0, stdout: JSON.stringify(value), stderr: "" };
}
