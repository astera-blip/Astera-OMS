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
const requiredWifCondition =
  'assertion.project_id == "prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ"';
const requiredPrincipalSet =
  "principalSet://iam.googleapis.com/projects/1032606875618/locations/global/workloadIdentityPools/vercel-oidc/attribute.project_id/prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ";
const discoverWifProviderArgs = [
  "iam", "workload-identity-pools", "providers", "describe", "vercel",
  "--workload-identity-pool=vercel-oidc",
  "--location=global",
  "--format=json(state,attributeMapping,attributeCondition)",
  "--project", "astera-oms-prod",
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
        name: "discoverWifProvider",
        command: "gcloud",
        args: [
          "iam", "workload-identity-pools", "providers", "describe", "vercel",
          "--workload-identity-pool=vercel-oidc",
          "--location=global",
          "--format=json(state,attributeMapping,attributeCondition)",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "updateWifProviderCondition",
        command: "gcloud",
        args: [
          "iam", "workload-identity-pools", "providers", "update-oidc", "vercel",
          "--workload-identity-pool=vercel-oidc",
          "--location=global",
          "--attribute-condition=assertion.project_id == \"prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ\"",
          "--project", "astera-oms-prod",
          "--quiet",
        ],
      },
      {
        name: "discoverVerifiedWifProvider",
        command: "gcloud",
        args: [
          "iam", "workload-identity-pools", "providers", "describe", "vercel",
          "--workload-identity-pool=vercel-oidc",
          "--location=global",
          "--format=json(state,attributeMapping,attributeCondition)",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "discoverRuntimeServiceAccountIamPolicy",
        command: "gcloud",
        args: [
          "iam", "service-accounts", "get-iam-policy",
          "astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com",
          "--format=json",
          "--project", "astera-oms-prod",
        ],
      },
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
        name: "discoverWorkerFirestoreIamPolicy",
        command: "gcloud",
        args: [
          "projects", "get-iam-policy", "astera-oms-prod",
          "--format=json",
          "--project", "astera-oms-prod",
        ],
      },
      {
        name: "bindWorkerFirestoreUser",
        command: "gcloud",
        args: [
          "projects", "add-iam-policy-binding", "astera-oms-prod",
          "--member=serviceAccount:astera-security-worker@astera-oms-prod.iam.gserviceaccount.com",
          "--role=roles/datastore.user",
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
          "services", "list", "--enabled",
          "--filter=config.name=run.googleapis.com",
          "--format=json",
          "--project=astera-oms-prod",
        ],
      },
      {
        name: "prepareSchedulerDeployment",
        command: "gcloud",
        args: [
          "services", "list", "--enabled",
          "--filter=config.name=cloudscheduler.googleapis.com",
          "--format=json",
          "--project=astera-oms-prod",
        ],
      },
      {
        name: "prepareMonitoringDeployment",
        command: "gcloud",
        args: [
          "services", "list", "--enabled",
          "--filter=config.name=monitoring.googleapis.com",
          "--format=json",
          "--project=astera-oms-prod",
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
      "action=updateWifProviderCondition",
      "action=enableApis",
      "action=createKeyRing",
      "action=createHmacKey",
      "action=createRefundKey",
      "action=createWorkerServiceAccount",
      "action=bindWorkerFirestoreUser",
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

  it("binds only the Worker to the exact Firestore data role when its project binding is absent", () => {
    const spawnSync = workerFirestorePolicyRunner({ bindings: [] });

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], { spawnSync, log: vi.fn(), platform: "linux" }))
      .toThrow("production_security_command_failed:bindWorkerFirestoreUser");

    expect(spawnSync).toHaveBeenCalledWith(
      "gcloud",
      [
        "projects", "get-iam-policy", "astera-oms-prod",
        "--format=json",
        "--project", "astera-oms-prod",
      ],
      expect.objectContaining({ shell: false }),
    );
    expect(spawnSync).toHaveBeenCalledWith(
      "gcloud",
      [
        "projects", "add-iam-policy-binding", "astera-oms-prod",
        "--member=serviceAccount:astera-security-worker@astera-oms-prod.iam.gserviceaccount.com",
        "--role=roles/datastore.user",
        "--project", "astera-oms-prod",
        "--quiet",
      ],
      expect.objectContaining({ shell: false }),
    );
  });

  it("discovers and skips an exact existing Worker Firestore project binding", () => {
    const spawnSync = workerFirestorePolicyRunner(exactWorkerFirestoreIamPolicy());

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], { spawnSync, log: vi.fn(), platform: "linux" }))
      .toThrow("production_security_discovery_invalid:discoverHmacIamPolicy");

    expect(spawnSync.mock.calls.some(([, args]) =>
      (args as string[]).slice(0, 2).join(" ") === "projects get-iam-policy"))
      .toBe(true);
    expect(spawnSync.mock.calls.some(([, args]) =>
      (args as string[]).includes("add-iam-policy-binding"))).toBe(false);
  });

  it("fails closed on a malformed Worker Firestore project IAM response", () => {
    const spawnSync = workerFirestorePolicyRunner({ bindings: "invalid" });

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], { spawnSync, log: vi.fn(), platform: "linux" }))
      .toThrow("production_security_resource_incompatible:discoverWorkerFirestoreIamPolicy");
  });

  it.each([
    ["non-string member", {
      bindings: [{
        role: "roles/datastore.user",
        members: ["serviceAccount:astera-security-worker@astera-oms-prod.iam.gserviceaccount.com", 7],
      }],
    }],
    ["empty member", {
      bindings: [{
        role: "roles/datastore.user",
        members: ["serviceAccount:astera-security-worker@astera-oms-prod.iam.gserviceaccount.com", ""],
      }],
    }],
    ["empty-object condition", {
      bindings: [{
        role: "roles/datastore.user",
        members: ["serviceAccount:astera-security-worker@astera-oms-prod.iam.gserviceaccount.com"],
        condition: {},
      }],
    }],
    ["null condition", {
      bindings: [{
        role: "roles/datastore.user",
        members: ["serviceAccount:astera-security-worker@astera-oms-prod.iam.gserviceaccount.com"],
        condition: null,
      }],
    }],
    ["false condition", {
      bindings: [{
        role: "roles/datastore.user",
        members: ["serviceAccount:astera-security-worker@astera-oms-prod.iam.gserviceaccount.com"],
        condition: false,
      }],
    }],
    ["empty-string condition", {
      bindings: [{
        role: "roles/datastore.user",
        members: ["serviceAccount:astera-security-worker@astera-oms-prod.iam.gserviceaccount.com"],
        condition: "",
      }],
    }],
    ["malformed binding object", { bindings: [[]] }],
  ])("fails closed before mutation or later commands for Worker IAM with %s", (_case, policy) => {
    const spawnSync = workerFirestorePolicyRunner(policy);

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], { spawnSync, log: vi.fn(), platform: "linux" }))
      .toThrow("production_security_resource_incompatible:discoverWorkerFirestoreIamPolicy");

    const executedArgs = spawnSync.mock.calls.map(([, args]) => args as string[]);
    expect(executedArgs.some((args) => args.includes("add-iam-policy-binding"))).toBe(false);
    expect(executedArgs.some((args) =>
      args.includes("--filter=email=astera-security-scheduler@astera-oms-prod.iam.gserviceaccount.com")))
      .toBe(false);
  });

  it("accepts exactly one enabled response for each deployment API preparation", () => {
    const spawnSync = deploymentApiPreparationRunner();

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], { spawnSync, log: vi.fn(), platform: "linux" })).not.toThrow();

    const preparationFilters = spawnSync.mock.calls
      .map(([, args]) => args as string[])
      .filter((args) => args[0] === "services" && args[1] === "list")
      .map((args) => args.find((arg) => arg.startsWith("--filter=config.name=")));
    expect(preparationFilters).toEqual([
      "--filter=config.name=run.googleapis.com",
      "--filter=config.name=cloudscheduler.googleapis.com",
      "--filter=config.name=monitoring.googleapis.com",
    ]);
  });

  it.each([
    ["empty array", []],
    ["wrong API", [{ config: { name: "cloudscheduler.googleapis.com" }, state: "ENABLED" }]],
    ["wrong state", [{ config: { name: "run.googleapis.com" }, state: "DISABLED" }]],
    ["multiple results", [
      { config: { name: "run.googleapis.com" }, state: "ENABLED" },
      { config: { name: "run.googleapis.com" }, state: "ENABLED" },
    ]],
  ])("fails closed before the next preparation step for %s enabled API output", (_case, response) => {
    const spawnSync = deploymentApiPreparationRunner({ "run.googleapis.com": response });

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], { spawnSync, log: vi.fn(), platform: "linux" }))
      .toThrow("production_security_resource_incompatible:prepareCloudRunDeployment");

    const executedArgs = spawnSync.mock.calls.map(([, args]) => args as string[]);
    expect(executedArgs.some((args) =>
      args.includes("--filter=config.name=cloudscheduler.googleapis.com"))).toBe(false);
    expect(executedArgs.some((args) =>
      args.includes("--filter=config.name=monitoring.googleapis.com"))).toBe(false);
  });

  it("fails closed before the next preparation step for malformed enabled API JSON", () => {
    const spawnSync = deploymentApiPreparationRunner({ "run.googleapis.com": "not-json" });

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], { spawnSync, log: vi.fn(), platform: "linux" }))
      .toThrow("production_security_discovery_invalid:prepareCloudRunDeployment");

    expect(spawnSync.mock.calls.some(([, args]) =>
      (args as string[]).includes("--filter=config.name=cloudscheduler.googleapis.com"))).toBe(false);
  });

  it("never gives the Scheduler service account a project-wide role", () => {
    const projectRoleCommands = buildProductionSecurityCommands(
      parseProductionSecurityArgs(confirmedDryRunArgs),
    ).filter((command) => command.args[0] === "projects");

    expect(projectRoleCommands).toEqual([
      expect.objectContaining({ name: "discoverWorkerFirestoreIamPolicy" }),
      expect.objectContaining({
        name: "bindWorkerFirestoreUser",
        args: expect.arrayContaining([
          "--member=serviceAccount:astera-security-worker@astera-oms-prod.iam.gserviceaccount.com",
          "--role=roles/datastore.user",
        ]),
      }),
    ]);
    expect(JSON.stringify(projectRoleCommands))
      .not.toContain("astera-security-scheduler@astera-oms-prod.iam.gserviceaccount.com");
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
    })).toThrow("production_security_command_failed:discoverWifProvider");

    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(spawnSync).toHaveBeenCalledWith(
      "gcloud",
      discoverWifProviderArgs,
      expect.objectContaining({ shell: false }),
    );
    expect(output).toEqual(["mode=apply", "action=discoverWifProvider"]);
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
    })).toThrow("production_security_command_failed:discoverWifProvider");

    expect(spawnSync).toHaveBeenCalledWith(
      "C:\\Windows\\System32\\cmd.exe",
      ["/d", "/s", "/c", "gcloud.cmd", ...discoverWifProviderArgs],
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

  it("remediates a missing Provider condition, verifies it, and only then reaches API enablement", () => {
    let providerReads = 0;
    const spawnSync = vi.fn((_command: string, args: string[]) => {
      const joined = args.join(" ");
      if (joined.includes("providers describe")) {
        providerReads += 1;
        return successfulJson(exactProvider(
          providerReads === 1 ? undefined : requiredWifCondition,
        ));
      }
      if (joined.includes("providers update-oidc")) {
        return { status: 0, stdout: "", stderr: "" };
      }
      if (joined.includes("service-accounts get-iam-policy")) {
        return successfulJson(exactRuntimeIamPolicy());
      }
      return { status: 7, stdout: "", stderr: "not printed" };
    });
    const output: string[] = [];

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], {
      spawnSync,
      log: (line) => output.push(line),
      platform: "linux",
    })).toThrow("production_security_command_failed:enableApis");

    expect(spawnSync.mock.calls.map(([, args]) => (args as string[]).slice(0, 5)))
      .toEqual([
        ["iam", "workload-identity-pools", "providers", "describe", "vercel"],
        ["iam", "workload-identity-pools", "providers", "update-oidc", "vercel"],
        ["iam", "workload-identity-pools", "providers", "describe", "vercel"],
        [
          "iam", "service-accounts", "get-iam-policy",
          "astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com",
          "--format=json",
        ],
        ["services", "enable", "cloudkms.googleapis.com", "run.googleapis.com", "cloudscheduler.googleapis.com"],
      ]);
    expect(output).toEqual([
      "mode=apply",
      "action=discoverWifProvider",
      "action=updateWifProviderCondition",
      "action=discoverVerifiedWifProvider",
      "action=discoverRuntimeServiceAccountIamPolicy",
      "action=enableApis",
    ]);
    expect(output.join("\n")).not.toContain(requiredPrincipalSet);
  });

  it("skips Provider mutation when the exact condition already exists", () => {
    const spawnSync = vi.fn((_command: string, args: string[]) => {
      const joined = args.join(" ");
      if (joined.includes("providers describe")) {
        return successfulJson(exactProvider(requiredWifCondition));
      }
      if (joined.includes("service-accounts get-iam-policy")) {
        return successfulJson(exactRuntimeIamPolicy());
      }
      return { status: 7, stdout: "", stderr: "not printed" };
    });

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], { spawnSync, log: vi.fn(), platform: "linux" }))
      .toThrow("production_security_command_failed:enableApis");

    expect(spawnSync.mock.calls.some(([, args]) =>
      (args as string[]).includes("update-oidc"))).toBe(false);
    expect(spawnSync).toHaveBeenNthCalledWith(
      4,
      "gcloud",
      enableApisArgs,
      expect.objectContaining({ shell: false }),
    );
  });

  it.each([
    ["state", { ...exactProvider(), state: "DISABLED" }],
    ["mapping", {
      ...exactProvider(),
      attributeMapping: { "attribute.project_id": "assertion.wrong" },
    }],
  ])("fails closed on incompatible initial Provider %s", (_case, provider) => {
    const spawnSync = vi.fn(() => successfulJson(provider));

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], { spawnSync, log: vi.fn(), platform: "linux" }))
      .toThrow("production_security_resource_incompatible:discoverWifProvider");

    expect(spawnSync).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the post-update Provider readback is not exact", () => {
    let providerReads = 0;
    const spawnSync = vi.fn((_command: string, args: string[]) => {
      if (args.includes("describe")) {
        providerReads += 1;
        return successfulJson(exactProvider(
          providerReads === 1 ? undefined : "assertion.project_id == 'wrong'",
        ));
      }
      return { status: 0, stdout: "", stderr: "" };
    });

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], { spawnSync, log: vi.fn(), platform: "linux" }))
      .toThrow("production_security_resource_incompatible:discoverVerifiedWifProvider");

    expect(spawnSync).toHaveBeenCalledTimes(3);
    expect(spawnSync.mock.calls.some(([, args]) =>
      (args as string[])[0] === "services")).toBe(false);
  });

  it.each([
    ["missing", { bindings: [] }],
    ["alternate", exactRuntimeIamPolicy([
      requiredPrincipalSet,
      "principalSet://iam.googleapis.com/projects/1032606875618/locations/global/workloadIdentityPools/vercel-oidc/attribute.project_id/prj_other",
    ])],
  ])("fails closed on %s runtime-SA workload identity membership", (_case, policy) => {
    const spawnSync = vi.fn((_command: string, args: string[]) => {
      const joined = args.join(" ");
      if (joined.includes("providers describe")) {
        return successfulJson(exactProvider(requiredWifCondition));
      }
      return successfulJson(policy);
    });

    expect(() => runProductionSecuritySetup([
      ...confirmedDryRunArgs,
      "--apply",
    ], { spawnSync, log: vi.fn(), platform: "linux" }))
      .toThrow("production_security_resource_incompatible:discoverRuntimeServiceAccountIamPolicy");

    expect(spawnSync.mock.calls.some(([, args]) =>
      (args as string[])[0] === "services")).toBe(false);
  });

  it("leaves exact existing resources and IAM bindings unchanged", () => {
    const spawnSync = vi.fn((_command: string, args: string[]) => {
      const joined = args.join(" ");
      if (joined.includes("providers describe")) {
        return successfulJson(exactProvider(requiredWifCondition));
      }
      if (joined.includes("service-accounts get-iam-policy")) {
        return successfulJson(exactRuntimeIamPolicy());
      }
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
      if (joined.includes("projects get-iam-policy")) {
        return successfulJson(exactWorkerFirestoreIamPolicy());
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
      if (joined.includes("services list --enabled")) {
        const filter = args.find((argument) => argument.startsWith("--filter=config.name="));
        const apiId = filter?.slice("--filter=config.name=".length);
        return successfulJson([{ config: { name: apiId }, state: "ENABLED" }]);
      }
      return { status: 0, stdout: "", stderr: "" };
    });
    const output: string[] = [];

    runProductionSecuritySetup([...confirmedDryRunArgs, "--apply"], {
      spawnSync,
      log: (line) => output.push(line),
    });

    expect(output).not.toContain("action=createKeyRing");
    expect(output).not.toContain("action=createHmacKey");
    expect(output).not.toContain("action=createRefundKey");
    expect(output).not.toContain("action=bindWorkerFirestoreUser");
    expect(output).not.toContain("action=bindVercelHmacSigner");
    expect(output).not.toContain("action=bindWorkerHmacViewer");
    expect(output).not.toContain("action=bindVercelRefundCrypto");
    expect(output).not.toContain("action=createArtifactRepository");
  });
});

function successfulJson(value: unknown) {
  return { status: 0, stdout: JSON.stringify(value), stderr: "" };
}

function exactProvider(attributeCondition?: string) {
  return {
    state: "ACTIVE",
    attributeMapping: { "attribute.project_id": "assertion.project_id" },
    ...(attributeCondition === undefined ? {} : { attributeCondition }),
  };
}

function exactRuntimeIamPolicy(members = [requiredPrincipalSet]) {
  return {
    bindings: [{
      role: "roles/iam.workloadIdentityUser",
      members,
    }],
  };
}

function exactWorkerFirestoreIamPolicy() {
  return {
    bindings: [{
      role: "roles/datastore.user",
      members: ["serviceAccount:astera-security-worker@astera-oms-prod.iam.gserviceaccount.com"],
    }],
  };
}

function workerFirestorePolicyRunner(policy: unknown) {
  return vi.fn((_command: string, args: string[]) => {
    const joined = args.join(" ");
    if (joined.includes("providers describe")) {
      return successfulJson(exactProvider(requiredWifCondition));
    }
    if (joined.includes("service-accounts get-iam-policy")) {
      return successfulJson(exactRuntimeIamPolicy());
    }
    if (joined.includes("kms keyrings list") || joined.includes("kms keys list")) {
      return successfulJson([]);
    }
    if (joined.includes("iam service-accounts list")) {
      return successfulJson([]);
    }
    if (joined.includes("projects get-iam-policy")) {
      return successfulJson(policy);
    }
    if (joined.includes("projects add-iam-policy-binding")) {
      return { status: 7, stdout: "", stderr: "not printed" };
    }
    return { status: 0, stdout: "", stderr: "" };
  });
}

function deploymentApiPreparationRunner(responses: Record<string, unknown> = {}) {
  return vi.fn((_command: string, args: string[]) => {
    const joined = args.join(" ");
    if (joined.includes("providers describe")) {
      return successfulJson(exactProvider(requiredWifCondition));
    }
    if (joined.includes("service-accounts get-iam-policy")) {
      return successfulJson(exactRuntimeIamPolicy());
    }
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
    if (joined.includes("projects get-iam-policy")) {
      return successfulJson(exactWorkerFirestoreIamPolicy());
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
    if (joined.includes("services list --enabled")) {
      const filter = args.find((argument) => argument.startsWith("--filter=config.name="));
      const apiId = filter?.slice("--filter=config.name=".length);
      const response = apiId && Object.hasOwn(responses, apiId)
        ? responses[apiId]
        : [{ config: { name: apiId }, state: "ENABLED" }];
      return typeof response === "string"
        ? { status: 0, stdout: response, stderr: "" }
        : successfulJson(response);
    }
    return { status: 0, stdout: "", stderr: "" };
  });
}
