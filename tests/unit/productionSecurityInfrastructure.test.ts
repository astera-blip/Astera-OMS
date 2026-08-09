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
    const commandByName = Object.fromEntries(commands.map((step) => [step.name, step]));

    expect(commands.map((step) => step.name)).toEqual(expect.arrayContaining([
      "enableApis",
      "createKeyRing",
      "createHmacKey",
      "createRefundKey",
      "createWorkerServiceAccount",
      "createSchedulerServiceAccount",
      "bindVercelHmacSigner",
      "bindWorkerHmacViewer",
      "bindVercelRefundCrypto",
      "createArtifactRepository",
      "prepareCloudRunDeployment",
      "prepareSchedulerDeployment",
      "prepareMonitoringDeployment",
    ]));
    expect(commandByName.enableApis.args).toEqual(expect.arrayContaining([
      "cloudkms.googleapis.com",
      "run.googleapis.com",
      "cloudscheduler.googleapis.com",
      "cloudbuild.googleapis.com",
      "artifactregistry.googleapis.com",
      "monitoring.googleapis.com",
    ]));
    expect(commandByName.createHmacKey.args).toEqual(expect.arrayContaining([
      "member-account-fingerprint",
      "--purpose=mac",
      "--default-algorithm=hmac-sha256",
      "--protection-level=software",
    ]));
    expect(commandByName.createRefundKey.args).toEqual(expect.arrayContaining([
      "refund-account-vault",
      "--purpose=encryption",
      "--default-algorithm=google-symmetric-encryption",
      "--protection-level=software",
    ]));
    expect(commandByName.bindVercelHmacSigner.args).toContain("--role=roles/cloudkms.signer");
    expect(commandByName.bindWorkerHmacViewer.args).toContain("--role=roles/cloudkms.viewer");
    expect(commandByName.bindVercelRefundCrypto.args)
      .toContain("--role=roles/cloudkms.cryptoKeyEncrypterDecrypter");
    expect(commands.every((step) => step.command === "gcloud")).toBe(true);
    expect(commands.every((step) => {
      const joined = step.args.join(" ");
      return joined.includes("--project astera-oms-prod")
        || joined.includes("--project=astera-oms-prod");
    })).toBe(true);
    expect(commands.flatMap((step) => step.args)).not.toContain("auth");
    expect(commands.flatMap((step) => step.args).join(" ")).not.toContain("config set");
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
    expect(output[0]).toBe("mode=dry-run");
    expect(output).toContain("action=createHmacKey");
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
    })).toThrow("production_security_command_failed:enableApis");

    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(spawnSync).toHaveBeenCalledWith(
      "gcloud",
      expect.any(Array),
      expect.objectContaining({ shell: false }),
    );
    expect(output).toEqual(["mode=apply", "action=enableApis"]);
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
