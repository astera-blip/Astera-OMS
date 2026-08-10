import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  buildProductionAlertPolicy,
  buildProductionSecurityDeploymentCommands,
  ensureProductionMonitoring,
  inspectSchedulerJob,
  inspectWorkerServiceIamPolicy,
  parseProductionSecurityDeploymentArgs,
  runProductionSecurityDeployment,
  validateDeployedWorkerService,
  validateWorkerBuildIgnore,
} from "../../scripts/deploy-production-security-worker.mjs";

const confirmedArgs = [
  "--project", "astera-oms-prod",
  "--confirm-project", "astera-oms-prod",
];
const revision = "a".repeat(40);
const imageTag =
  `asia-east1-docker.pkg.dev/astera-oms-prod/astera-ops/astera-security-worker:git-${revision}`;
const imageDigest =
  "asia-east1-docker.pkg.dev/astera-oms-prod/astera-ops/astera-security-worker@sha256:"
  + "b".repeat(64);
const serviceUrl = "https://astera-security-worker-1032606875618.asia-east1.run.app";
const workerServiceAccount =
  "astera-security-worker@astera-oms-prod.iam.gserviceaccount.com";
const schedulerServiceAccount =
  "astera-security-scheduler@astera-oms-prod.iam.gserviceaccount.com";
const schedulerMember = `serviceAccount:${schedulerServiceAccount}`;
const hmacKeyName =
  "projects/astera-oms-prod/locations/asia-east1/keyRings/astera-oms-security/cryptoKeys/member-account-fingerprint";
const unsafeArguments: string[][] = [
  [],
  ["--project", "astera-oms-prod"],
  ["--project", "astera-oms-prod", "--confirm-project", "wrong"],
  ["--project", "dev", "--confirm-project", "dev", "--apply"],
  [...confirmedArgs, "--region", "us-central1"],
  [...confirmedArgs, "--service", "other"],
  [...confirmedArgs, "--apply", "--apply"],
];

describe("production security deployment", () => {
  it("defaults to dry-run for the exact fixed Production target", () => {
    expect(parseProductionSecurityDeploymentArgs(confirmedArgs)).toEqual({
      project: "astera-oms-prod",
      projectNumber: "1032606875618",
      region: "asia-east1",
      apply: false,
    });
  });

  it.each(unsafeArguments)("rejects caller-controlled or incomplete deployment arguments: %o", (argv) => {
    expect(() => parseProductionSecurityDeploymentArgs(argv)).toThrow();
  });

  it("builds immutable root-context image and private Cloud Run commands", () => {
    const plan = buildProductionSecurityDeploymentCommands(
      parseProductionSecurityDeploymentArgs(confirmedArgs),
      { sourceRevision: revision, imageDigest, serviceUrl },
    );

    expect(plan.imageTag).toBe(imageTag);
    expect(plan.buildWorkerImage).toEqual({
      name: "buildWorkerImage",
      command: "gcloud",
      args: [
        "builds", "submit", ".",
        "--config=ops/security-worker/cloudbuild.yaml",
        "--ignore-file=ops/security-worker/Dockerfile.dockerignore",
        `--substitutions=_IMAGE=${imageTag}`,
        "--region=asia-east1",
        "--project=astera-oms-prod",
        "--quiet",
      ],
    });
    expect(plan.discoverWorkerImageDigest).toEqual({
      name: "discoverWorkerImageDigest",
      command: "gcloud",
      args: [
        "artifacts", "docker", "images", "describe", imageTag,
        "--format=value(image_summary.fully_qualified_digest)",
        "--project=astera-oms-prod",
      ],
    });
    expect(plan.deployWorkerService).toEqual({
      name: "deployWorkerService",
      command: "gcloud",
      args: [
        "run", "deploy", "astera-security-worker",
        `--image=${imageDigest}`,
        `--service-account=${workerServiceAccount}`,
        "--region=asia-east1",
        "--min-instances=0",
        "--max-instances=1",
        "--concurrency=1",
        `--set-env-vars=GOOGLE_CLOUD_PROJECT=astera-oms-prod,GCP_KMS_HMAC_KEY_NAME=${hmacKeyName}`,
        "--no-allow-unauthenticated",
        "--invoker-iam-check",
        "--project=astera-oms-prod",
        "--quiet",
      ],
    });
    expect(plan.deployWorkerService.args).not.toContain("--allow-unauthenticated");
  });

  it("fails closed unless the source upload ignore is the exact default-deny allowlist", () => {
    const contents = readFileSync(
      new URL("../../ops/security-worker/Dockerfile.dockerignore", import.meta.url),
      "utf8",
    );
    expect(validateWorkerBuildIgnore(contents)).toBe(true);
    expect(() => validateWorkerBuildIgnore(contents.replace(/^\*\r?\n/m, "")))
      .toThrow("production_security_deployment_build_ignore_invalid");
    expect(() => validateWorkerBuildIgnore(`${contents}\n!docs/\n`))
      .toThrow("production_security_deployment_build_ignore_invalid");
    expect(() => validateWorkerBuildIgnore(`${contents}\n#!include:.gitignore\n`))
      .toThrow("production_security_deployment_build_ignore_invalid");
    expect(() => validateWorkerBuildIgnore(contents.replace(/^\*/m, " *")))
      .toThrow("production_security_deployment_build_ignore_invalid");
  });

  it("builds service validation, service-level IAM, and fixed Scheduler commands", () => {
    const plan = buildProductionSecurityDeploymentCommands(
      parseProductionSecurityDeploymentArgs(confirmedArgs),
      { sourceRevision: revision, imageDigest, serviceUrl },
    );

    expect(plan.discoverWorkerService.args).toEqual([
      "run", "services", "describe", "astera-security-worker",
      "--region=asia-east1",
      "--format=json",
      "--project=astera-oms-prod",
    ]);
    expect(plan.discoverWorkerServiceIamPolicy.args).toEqual([
      "run", "services", "get-iam-policy", "astera-security-worker",
      "--region=asia-east1",
      "--format=json",
      "--project=astera-oms-prod",
    ]);
    expect(plan.bindSchedulerInvoker.args).toEqual([
      "run", "services", "add-iam-policy-binding", "astera-security-worker",
      `--member=${schedulerMember}`,
      "--role=roles/run.invoker",
      "--region=asia-east1",
      "--project=astera-oms-prod",
      "--quiet",
    ]);

    expect(plan.dailySchedulerJob.create.args).toEqual([
      "scheduler", "jobs", "create", "http", "astera-refund-vault-cleanup-daily",
      "--location=asia-east1",
      "--schedule=30 3 * * *",
      "--time-zone=Asia/Taipei",
      `--uri=${serviceUrl}/jobs/refund-account-cleanup`,
      "--http-method=POST",
      `--oidc-service-account-email=${schedulerServiceAccount}`,
      `--oidc-token-audience=${serviceUrl}`,
      "--project=astera-oms-prod",
      "--quiet",
    ]);
    expect(plan.dailySchedulerJob.update.args).toEqual([
      "scheduler", "jobs", "update", "http", "astera-refund-vault-cleanup-daily",
      "--location=asia-east1",
      "--schedule=30 3 * * *",
      "--time-zone=Asia/Taipei",
      `--uri=${serviceUrl}/jobs/refund-account-cleanup`,
      "--http-method=POST",
      `--oidc-service-account-email=${schedulerServiceAccount}`,
      `--oidc-token-audience=${serviceUrl}`,
      "--clear-headers",
      "--clear-message-body",
      "--project=astera-oms-prod",
      "--quiet",
    ]);
    expect(plan.monthlySchedulerJob.create.args).toEqual(expect.arrayContaining([
      "astera-fingerprint-key-report-monthly",
      "--schedule=0 4 1 * *",
      `--uri=${serviceUrl}/jobs/fingerprint-key-usage`,
      `--oidc-token-audience=${serviceUrl}`,
    ]));
    for (const job of [plan.dailySchedulerJob, plan.monthlySchedulerJob]) {
      expect(job.create.args.some((arg: string) => arg.includes("message-body"))).toBe(false);
      expect(job.create.args.some((arg: string) => arg.includes("headers"))).toBe(false);
    }
  });

  it("accepts only the exact deployed service and a validated root URL", () => {
    expect(validateDeployedWorkerService(exactService(), imageDigest)).toBe(serviceUrl);

    for (const incompatible of [
      exactService({ metadata: { ...exactService().metadata, name: "other" } }),
      exactService({
        spec: {
          ...exactService().spec,
          template: {
            ...exactService().spec.template,
            spec: { ...exactService().spec.template.spec, containerConcurrency: 80 },
          },
        },
      }),
      exactService({
        spec: {
          ...exactService().spec,
          template: {
            ...exactService().spec.template,
            metadata: {
              annotations: {
                ...exactService().spec.template.metadata.annotations,
                "autoscaling.knative.dev/minScale": "1",
              },
            },
          },
        },
      }),
      exactService({ status: { url: "https://evil.example/jobs" } }),
      exactService({
        spec: {
          ...exactService().spec,
          template: {
            ...exactService().spec.template,
            spec: {
              ...exactService().spec.template.spec,
              serviceAccountName: schedulerServiceAccount,
            },
          },
        },
      }),
    ]) {
      expect(() => validateDeployedWorkerService(incompatible, imageDigest))
        .toThrow("production_security_deployment_incompatible:discoverWorkerService");
    }
  });

  it("rejects conflicting Cloud Run URL readback fields", () => {
    expect(() => validateDeployedWorkerService(exactService({
      status: {
        url: serviceUrl,
        address: { url: "https://astera-security-worker-aaaaaaaaaa-de.a.run.app" },
      },
    }), imageDigest)).toThrow(
      "production_security_deployment_incompatible:discoverWorkerService",
    );
  });

  it("fails closed on public, alternate, duplicate, or conditional invokers", () => {
    expect(inspectWorkerServiceIamPolicy({ bindings: [] })).toEqual({
      schedulerInvokerExists: false,
    });
    expect(inspectWorkerServiceIamPolicy(exactIamPolicy(), true)).toEqual({
      schedulerInvokerExists: true,
    });

    for (const bindings of [
      [{ role: "roles/run.invoker", members: ["allUsers"] }],
      [{ role: "roles/run.invoker", members: ["allAuthenticatedUsers"] }],
      [{ role: "roles/run.invoker", members: ["serviceAccount:other@astera-oms-prod.iam.gserviceaccount.com"] }],
      [{ role: "roles/run.invoker", members: [schedulerMember], condition: { expression: "true" } }],
      [{ role: "roles/run.invoker", members: [], condition: { expression: "true" } }],
      [
        { role: "roles/run.invoker", members: [schedulerMember] },
        { role: "roles/run.invoker", members: [schedulerMember] },
      ],
    ]) {
      expect(() => inspectWorkerServiceIamPolicy({ bindings }))
        .toThrow("production_security_deployment_incompatible:discoverWorkerServiceIamPolicy");
    }
  });

  it("classifies only exact bodyless OIDC Scheduler jobs as unchanged", () => {
    expect(inspectSchedulerJob([], dailyJob())).toEqual({ exists: false, exact: false });
    expect(inspectSchedulerJob([dailyJob()], dailyJob())).toEqual({ exists: true, exact: true });
    expect(inspectSchedulerJob([
      dailyJob({
        httpTarget: {
          ...dailyJob().httpTarget,
          headers: { "User-Agent": "Google-Cloud-Scheduler" },
        },
      }),
    ], dailyJob())).toEqual({ exists: true, exact: true });
    expect(inspectSchedulerJob([
      dailyJob({ httpTarget: { ...dailyJob().httpTarget, body: "c2VjcmV0" } }),
    ], dailyJob())).toEqual({ exists: true, exact: false });
    expect(inspectSchedulerJob([
      dailyJob({
        httpTarget: {
          ...dailyJob().httpTarget,
          headers: {
            "User-Agent": "Google-Cloud-Scheduler",
            "X-Unexpected": "value",
          },
        },
      }),
    ], dailyJob())).toEqual({ exists: true, exact: false });
    expect(inspectSchedulerJob([
      dailyJob({
        httpTarget: {
          ...dailyJob().httpTarget,
          oidcToken: { ...dailyJob().httpTarget.oidcToken, audience: `${serviceUrl}/jobs/refund-account-cleanup` },
        },
      }),
    ], dailyJob())).toEqual({ exists: true, exact: false });
    expect(() => inspectSchedulerJob([dailyJob(), dailyJob()], dailyJob()))
      .toThrow("production_security_deployment_incompatible:discoverSchedulerJob");
  });

  it("rejects malformed Scheduler body and header output before mutation", () => {
    for (const httpTarget of [
      { ...dailyJob().httpTarget, headers: ["not", "a", "map"] },
      { ...dailyJob().httpTarget, body: { secret: "not-api-output" } },
      { ...dailyJob().httpTarget, oidcToken: { audience: serviceUrl } },
    ]) {
      expect(() => inspectSchedulerJob([
        dailyJob({ httpTarget }),
      ], dailyJob())).toThrow(
        "production_security_deployment_incompatible:discoverSchedulerJob",
      );
    }
  });

  it("requires external email verification before policy creation and then becomes idempotent", async () => {
    const state: MonitoringState = { channels: [], policies: [] };
    const request = statefulMonitoringRequest(state);

    await expect(ensureProductionMonitoring({ request }))
      .rejects.toThrow("production_security_monitoring_verification_required");

    expect(state.channels).toEqual([{
      name: "projects/astera-oms-prod/notificationChannels/channel-1",
      type: "email",
      displayName: "Astera Security Worker email",
      labels: { email_address: "astera.0920@gmail.com" },
      verificationStatus: "UNVERIFIED",
    }]);
    expect(state.policies).toEqual([]);

    state.channels[0].verificationStatus = "VERIFIED";
    await ensureProductionMonitoring({ request });
    expect(state.policies).toEqual([normalizedPolicyFixture(state.channels[0].name)]);

    const callsAfterCreate = request.mock.calls.length;
    await ensureProductionMonitoring({ request });
    expect(request.mock.calls).toHaveLength(callsAfterCreate + 2);
    expect(state.channels).toHaveLength(1);
    expect(state.policies).toHaveLength(1);
  });

  it.each([undefined, "VERIFICATION_STATUS_UNSPECIFIED"])(
    "accepts an email channel whose verification status is %s",
    async (verificationStatus) => {
      const state: MonitoringState = {
        channels: [{
          name: "projects/astera-oms-prod/notificationChannels/channel-1",
          type: "email",
          displayName: "Astera Security Worker email",
          labels: { email_address: "astera.0920@gmail.com" },
          enabled: true,
          ...(verificationStatus === undefined ? {} : { verificationStatus }),
        }],
        policies: [],
      };

      await ensureProductionMonitoring({ request: statefulMonitoringRequest(state) });

      expect(state.policies).toEqual([
        normalizedPolicyFixture(state.channels[0].name),
      ]);
    },
  );

  it("accepts semantically exact Monitoring policy fields in any JSON property order", async () => {
    const channel = {
      name: "projects/astera-oms-prod/notificationChannels/channel-1",
      type: "email",
      displayName: "Astera Security Worker email",
      labels: { email_address: "astera.0920@gmail.com" },
      enabled: true,
      verificationStatus: "VERIFIED",
    };
    const desired = buildProductionAlertPolicy(channel.name);
    const state: MonitoringState = {
      channels: [channel],
      policies: [{
        name: "projects/astera-oms-prod/alertPolicies/policy-1",
        documentation: {
          content: desired.documentation.content,
          mimeType: desired.documentation.mimeType,
        },
        conditions: desired.conditions.map((condition) => ({
          conditionThreshold: {
            aggregations: condition.conditionThreshold.aggregations.map((aggregation) => ({
              crossSeriesReducer: aggregation.crossSeriesReducer,
              perSeriesAligner: aggregation.perSeriesAligner,
              alignmentPeriod: aggregation.alignmentPeriod,
            })),
            duration: condition.conditionThreshold.duration,
            thresholdValue: condition.conditionThreshold.thresholdValue,
            comparison: condition.conditionThreshold.comparison,
            filter: condition.conditionThreshold.filter,
          },
          displayName: condition.displayName,
        })),
        notificationChannels: desired.notificationChannels,
        enabled: desired.enabled,
        combiner: desired.combiner,
        displayName: desired.displayName,
      }],
    };

    await expect(ensureProductionMonitoring({ request: statefulMonitoringRequest(state) }))
      .resolves.toEqual({
        channelName: channel.name,
        policyName: "projects/astera-oms-prod/alertPolicies/policy-1",
      });
  });

  it("preflights policy conflicts before creating a missing channel", async () => {
    const desired = buildProductionAlertPolicy(
      "projects/astera-oms-prod/notificationChannels/channel-existing",
    );
    const state: MonitoringState = {
      channels: [],
      policies: [
        { name: "projects/astera-oms-prod/alertPolicies/policy-1", ...desired },
        { name: "projects/astera-oms-prod/alertPolicies/policy-2", ...desired },
      ],
    };
    const request = statefulMonitoringRequest(state);

    await expect(ensureProductionMonitoring({ request }))
      .rejects.toThrow("production_security_monitoring_conflict");
    expect(state.channels).toHaveLength(0);
    expect(request.mock.calls.every(([call]) => call.method === "GET")).toBe(true);
  });

  it("rejects malformed Monitoring resources and repeated pagination tokens", async () => {
    const malformedRequest = vi.fn(async ({ method = "GET", url }: {
      method?: string;
      url: string;
    }) => ({
      data: url.endsWith("notificationChannels")
        ? { notificationChannels: [{}] }
        : { alertPolicies: [] },
      method,
    }));
    await expect(ensureProductionMonitoring({ request: malformedRequest }))
      .rejects.toThrow("production_security_monitoring_conflict");
    expect(malformedRequest.mock.calls.every(([call]) => call.method === "GET")).toBe(true);

    const repeatedTokenRequest = vi.fn(async ({ url }: { url: string }) => ({
      data: url.endsWith("notificationChannels")
        ? { notificationChannels: [], nextPageToken: "same-token" }
        : { alertPolicies: [] },
    }));
    await expect(ensureProductionMonitoring({ request: repeatedTokenRequest }))
      .rejects.toThrow("production_security_monitoring_conflict");
    expect(repeatedTokenRequest).toHaveBeenCalledTimes(2);
  });

  it("permits valid unrelated Monitoring resources with omitted optional defaults", async () => {
    const fixedChannel = {
      name: "projects/astera-oms-prod/notificationChannels/channel-1",
      type: "email",
      displayName: "Astera Security Worker email",
      labels: { email_address: "astera.0920@gmail.com" },
      enabled: true,
      verificationStatus: "VERIFIED",
    };
    const state: MonitoringState = {
      channels: [{
        name: "projects/astera-oms-prod/notificationChannels/unrelated",
        type: "email",
        labels: { email_address: "other@example.com" },
        verificationStatus: "VERIFICATION_STATUS_UNSPECIFIED",
      }, fixedChannel],
      policies: [{
        name: "projects/astera-oms-prod/alertPolicies/unrelated",
        displayName: "Unrelated policy",
        combiner: "OR",
        conditions: [{ displayName: "Unrelated condition" }],
      }],
    };

    await expect(ensureProductionMonitoring({ request: statefulMonitoringRequest(state) }))
      .resolves.toMatchObject({
        channelName: "projects/astera-oms-prod/notificationChannels/channel-1",
        policyName: "projects/astera-oms-prod/alertPolicies/policy-1",
      });
    expect(state.channels).toHaveLength(2);
    expect(state.policies).toHaveLength(2);
  });

  it("blocks an explicitly unverified fixed email channel before policy creation", async () => {
    const channel: { name: string; [key: string]: unknown } = {
      name: "projects/astera-oms-prod/notificationChannels/channel-1",
      type: "email",
      displayName: "Astera Security Worker email",
      labels: { email_address: "astera.0920@gmail.com" },
      enabled: true,
      verificationStatus: "UNVERIFIED",
    };
    const state: MonitoringState = { channels: [channel], policies: [] };
    const request = statefulMonitoringRequest(state);

    await expect(ensureProductionMonitoring({ request }))
      .rejects.toThrow("production_security_monitoring_verification_required");
    expect(request.mock.calls.every(([call]) => call.method === "GET")).toBe(true);
  });

  it("rejects malformed Monitoring channel verification status", async () => {
    const state: MonitoringState = {
      channels: [{
        name: "projects/astera-oms-prod/notificationChannels/unrelated",
        type: "email",
        labels: { email_address: "other@example.com" },
        verificationStatus: "BROKEN",
      }],
      policies: [],
    };
    const request = statefulMonitoringRequest(state);

    await expect(ensureProductionMonitoring({ request }))
      .rejects.toThrow("production_security_monitoring_conflict");
    expect(request.mock.calls.every(([call]) => call.method === "GET")).toBe(true);
  });

  it("fails closed on duplicate or conflicting Monitoring state", async () => {
    const exactChannel = {
      name: "projects/astera-oms-prod/notificationChannels/channel-1",
      type: "email",
      displayName: "Astera Security Worker email",
      labels: { email_address: "astera.0920@gmail.com" },
      enabled: true,
      verificationStatus: "VERIFIED",
    };
    const conflictingStates: MonitoringState[] = [
      { channels: [exactChannel, { ...exactChannel, name: `${exactChannel.name}-2` }], policies: [] },
      { channels: [{ ...exactChannel, labels: { email_address: "other@example.com" } }], policies: [] },
      {
        channels: [exactChannel],
        policies: [{
          name: "projects/astera-oms-prod/alertPolicies/policy-1",
          ...buildProductionAlertPolicy(exactChannel.name),
          enabled: false,
        }],
      },
    ];

    for (const state of conflictingStates) {
      await expect(ensureProductionMonitoring({ request: statefulMonitoringRequest(state) }))
        .rejects.toThrow("production_security_monitoring_conflict");
    }
  });

  it("dry-run performs no child process or Monitoring request and prints safe actions only", async () => {
    const spawnSync = vi.fn();
    const createMonitoringRequest = vi.fn();
    const output: string[] = [];

    await runProductionSecurityDeployment(confirmedArgs, {
      spawnSync,
      createMonitoringRequest,
      log: (line) => output.push(line),
    });

    expect(spawnSync).not.toHaveBeenCalled();
    expect(createMonitoringRequest).not.toHaveBeenCalled();
    expect(output).toEqual([
      "mode=dry-run",
      "action=buildWorkerImage",
      "action=deployWorkerService",
      "action=bindSchedulerInvoker",
      "action=upsertDailySchedulerJob",
      "action=upsertMonthlySchedulerJob",
      "action=ensureEmailNotificationChannel",
      "action=ensureAlertPolicy",
    ]);
  });

  it("apply stops at the first failed command without requesting Monitoring", async () => {
    const spawnSync = vi.fn((command: string, args: string[]) => {
      if (command === "git" && args.join(" ") === "rev-parse HEAD") {
        return { status: 0, stdout: `${revision}\n`, stderr: "" };
      }
      if (command === "git" && args[0] === "status") {
        return { status: 0, stdout: "", stderr: "" };
      }
      return { status: 9, stdout: "", stderr: "not printed" };
    });
    const createMonitoringRequest = vi.fn();
    const output: string[] = [];

    await expect(runProductionSecurityDeployment([...confirmedArgs, "--apply"], {
      spawnSync,
      createMonitoringRequest,
      log: (line) => output.push(line),
      platform: "linux",
    })).rejects.toThrow("production_security_deployment_command_failed:buildWorkerImage");

    expect(spawnSync).toHaveBeenCalledTimes(3);
    expect(createMonitoringRequest).not.toHaveBeenCalled();
    expect(output).toEqual([
      "mode=apply",
      "action=verifySourceRevision",
      "action=verifyBuildContextClean",
      "action=buildWorkerImage",
    ]);
  });

  it("uses absolute bundled Cloud SDK Python and gcloud.py on Windows", async () => {
    const windows = windowsLauncherFixture();
    const spawnSync = vi.fn((command: string, args: string[]) => {
      if (command === "git" && args.join(" ") === "rev-parse HEAD") {
        return { status: 0, stdout: `${revision}\n`, stderr: "" };
      }
      if (command === "git" && args[0] === "status") {
        return { status: 0, stdout: "", stderr: "" };
      }
      return { status: 7, stdout: "", stderr: "not printed" };
    });

    await expect(runProductionSecurityDeployment([...confirmedArgs, "--apply"], {
      spawnSync,
      createMonitoringRequest: vi.fn(),
      log: vi.fn(),
      platform: "win32",
      env: windows.env,
      cwd: () => windows.cwd,
      existsSync: windows.existsSync,
      realpathSync: windows.realpathSync,
    })).rejects.toThrow("production_security_deployment_command_failed:buildWorkerImage");

    expect(spawnSync).toHaveBeenNthCalledWith(
      3,
      windows.python,
      ["-S", windows.gcloudPy,
        "builds", "submit", ".",
        "--config=ops/security-worker/cloudbuild.yaml",
        "--ignore-file=ops/security-worker/Dockerfile.dockerignore",
        `--substitutions=_IMAGE=${imageTag}`,
        "--region=asia-east1",
        "--project=astera-oms-prod",
        "--quiet"],
      expect.objectContaining({ shell: false }),
    );
  });

  it.each(["cwd", "path"] as const)("rejects a Windows %s gcloud.cmd shadow", async (source) => {
    const windows = windowsLauncherFixture(source);
    const spawnSync = sourceRevisionRunner();

    await expect(runProductionSecurityDeployment([...confirmedArgs, "--apply"], {
      spawnSync,
      createMonitoringRequest: vi.fn(),
      log: vi.fn(),
      platform: "win32",
      env: windows.env,
      cwd: () => windows.cwd,
      existsSync: windows.existsSync,
      realpathSync: windows.realpathSync,
    })).rejects.toThrow("production_security_deployment_windows_launcher_invalid");
    expect(spawnSync).toHaveBeenCalledTimes(2);
  });

  it("rejects a missing trusted Windows Cloud SDK launcher", async () => {
    const windows = windowsLauncherFixture("missing");
    const spawnSync = sourceRevisionRunner();

    await expect(runProductionSecurityDeployment([...confirmedArgs, "--apply"], {
      spawnSync,
      createMonitoringRequest: vi.fn(),
      log: vi.fn(),
      platform: "win32",
      env: windows.env,
      cwd: () => windows.cwd,
      existsSync: windows.existsSync,
      realpathSync: windows.realpathSync,
    })).rejects.toThrow("production_security_deployment_windows_launcher_invalid");
    expect(spawnSync).toHaveBeenCalledTimes(2);
  });

  it("runs strict create/update apply then a mutation-idempotent Windows apply", async () => {
    const harness = strictApplyHarness();
    const dependencies = {
      spawnSync: harness.spawnSync,
      createMonitoringRequest: async () => harness.monitoringRequest,
      log: vi.fn(),
      platform: "win32",
      env: harness.windows.env,
      cwd: () => harness.windows.cwd,
      existsSync: harness.windows.existsSync,
      realpathSync: harness.windows.realpathSync,
    };

    await expect(runProductionSecurityDeployment(
      [...confirmedArgs, "--apply"],
      dependencies,
    )).resolves.toMatchObject({ mode: "apply" });
    expect(harness.state.mutations).toEqual([
      "bindSchedulerInvoker",
      "createDailySchedulerJob",
      "updateMonthlySchedulerJob",
    ]);
    expect(harness.state.jobs.get(harness.dailyName)).toEqual(dailyJob());
    expect(harness.state.jobs.get(harness.monthlyName)).toEqual(schedulerJob(
      "astera-fingerprint-key-report-monthly",
    ));

    await expect(runProductionSecurityDeployment(
      [...confirmedArgs, "--apply"],
      dependencies,
    )).resolves.toMatchObject({ mode: "apply" });
    expect(harness.state.mutations).toEqual([
      "bindSchedulerInvoker",
      "createDailySchedulerJob",
      "updateMonthlySchedulerJob",
    ]);
    expect(harness.state.builds).toBe(2);
    expect(harness.state.deploys).toBe(2);
    expect(harness.monitoringRequest).toHaveBeenCalledTimes(4);
    expect(harness.monitoringRequest.mock.calls.every(([call]) => call.method === "GET"))
      .toBe(true);
    expect(harness.spawnSync.mock.calls.flatMap(([, args]) => args))
      .not.toContain("--allow-unauthenticated");
  });
});

function exactService(overrides: Record<string, unknown> = {}) {
  const service = {
    metadata: {
      name: "astera-security-worker",
      namespace: "1032606875618",
      labels: { "cloud.googleapis.com/location": "asia-east1" },
    },
    spec: {
      template: {
        metadata: {
          annotations: {
            "autoscaling.knative.dev/maxScale": "1",
          },
        },
        spec: {
          serviceAccountName: workerServiceAccount,
          containerConcurrency: 1,
          containers: [{
            image: imageDigest,
            env: [
              { name: "GOOGLE_CLOUD_PROJECT", value: "astera-oms-prod" },
              { name: "GCP_KMS_HMAC_KEY_NAME", value: hmacKeyName },
            ],
          }],
        },
      },
    },
    status: { url: serviceUrl },
  };
  return { ...service, ...overrides };
}

function exactIamPolicy() {
  return { bindings: [{ role: "roles/run.invoker", members: [schedulerMember] }] };
}

function dailyJob(overrides: Record<string, unknown> = {}) {
  const job = {
    name: "projects/astera-oms-prod/locations/asia-east1/jobs/astera-refund-vault-cleanup-daily",
    schedule: "30 3 * * *",
    timeZone: "Asia/Taipei",
    state: "ENABLED",
    httpTarget: {
      uri: `${serviceUrl}/jobs/refund-account-cleanup`,
      httpMethod: "POST",
      oidcToken: {
        serviceAccountEmail: schedulerServiceAccount,
        audience: serviceUrl,
      },
    },
  };
  return { ...job, ...overrides };
}

function schedulerJob(name: string) {
  if (name === "astera-refund-vault-cleanup-daily") return dailyJob();
  return {
    name: "projects/astera-oms-prod/locations/asia-east1/jobs/astera-fingerprint-key-report-monthly",
    schedule: "0 4 1 * *",
    timeZone: "Asia/Taipei",
    state: "ENABLED",
    httpTarget: {
      uri: `${serviceUrl}/jobs/fingerprint-key-usage`,
      httpMethod: "POST",
      oidcToken: {
        serviceAccountEmail: schedulerServiceAccount,
        audience: serviceUrl,
      },
    },
  };
}

type MonitoringState = {
  channels: Array<{ name: string; [key: string]: unknown }>;
  policies: Array<{ name: string; [key: string]: unknown }>;
};

function statefulMonitoringRequest(state: MonitoringState) {
  return vi.fn(async ({ method = "GET", url, data }: {
    method?: string;
    url: string;
    data?: Record<string, unknown>;
  }) => {
    if (method === "GET" && url.endsWith("/notificationChannels")) {
      return { data: { notificationChannels: state.channels } };
    }
    if (method === "POST" && url.endsWith("/notificationChannels")) {
      expect(data).toEqual({
        type: "email",
        displayName: "Astera Security Worker email",
        labels: { email_address: "astera.0920@gmail.com" },
        enabled: true,
      });
      const created = {
        name: "projects/astera-oms-prod/notificationChannels/channel-1",
        type: "email",
        displayName: "Astera Security Worker email",
        labels: { email_address: "astera.0920@gmail.com" },
        verificationStatus: "UNVERIFIED",
      };
      state.channels.push(created);
      return { data: created };
    }
    if (method === "GET" && url.endsWith("/alertPolicies")) {
      return { data: { alertPolicies: state.policies } };
    }
    if (method === "POST" && url.endsWith("/alertPolicies")) {
      expect(data?.displayName).toBe("Astera Security Worker non-2xx or timeout");
      expect(data?.notificationChannels).toEqual([
        "projects/astera-oms-prod/notificationChannels/channel-1",
      ]);
      const created = normalizedPolicyFixture(
        "projects/astera-oms-prod/notificationChannels/channel-1",
      );
      state.policies.push(created);
      return { data: created };
    }
    throw new Error(`unexpected_request:${method}:${url}`);
  });
}

function successfulJson(value: unknown) {
  return { status: 0, stdout: JSON.stringify(value), stderr: "" };
}

function strictApplyHarness() {
  const windows = windowsLauncherFixture();
  const dailyName =
    "projects/astera-oms-prod/locations/asia-east1/jobs/astera-refund-vault-cleanup-daily";
  const monthlyName =
    "projects/astera-oms-prod/locations/asia-east1/jobs/astera-fingerprint-key-report-monthly";
  const initialMonthly = {
    ...schedulerJob("astera-fingerprint-key-report-monthly"),
    schedule: "5 5 1 * *",
  };
  const state = {
    invokerBound: false,
    jobs: new Map<string, ReturnType<typeof schedulerJob>>([[monthlyName, initialMonthly]]),
    mutations: [] as string[],
    builds: 0,
    deploys: 0,
  };
  const channelName = "projects/astera-oms-prod/notificationChannels/channel-1";
  const monitoringState: MonitoringState = {
    channels: [{
      name: channelName,
      type: "email",
      displayName: "Astera Security Worker email",
      labels: { email_address: "astera.0920@gmail.com" },
      verificationStatus: "VERIFIED",
    }],
    policies: [normalizedPolicyFixture(channelName)],
  };
  const monitoringRequest = statefulMonitoringRequest(monitoringState);
  const spawnSync = vi.fn((command: string, args: string[], options: { shell: false }) => {
    expect(options).toMatchObject({ shell: false, encoding: "utf8", windowsHide: true });
    if (command === "git") {
      if (args.join(" ") === "rev-parse HEAD") {
        return { status: 0, stdout: `${revision}\n`, stderr: "" };
      }
      if (args[0] === "status") {
        expect(args).toEqual([
          "status", "--porcelain=v1", "--untracked-files=all", "--",
          "ops/security-worker", "src/lib/payment/fingerprintIdentity.mjs",
        ]);
        return { status: 0, stdout: "", stderr: "" };
      }
      throw new Error(`unexpected_git:${args.join("|")}`);
    }

    expect(command).toBe(windows.python);
    expect(args.slice(0, 2)).toEqual(["-S", windows.gcloudPy]);
    const gcloudArgs = args.slice(2);
    const prefix = gcloudArgs.slice(0, 4).join(" ");
    if (gcloudArgs[0] === "builds") {
      expect(gcloudArgs).toEqual([
        "builds", "submit", ".",
        "--config=ops/security-worker/cloudbuild.yaml",
        "--ignore-file=ops/security-worker/Dockerfile.dockerignore",
        `--substitutions=_IMAGE=${imageTag}`,
        "--region=asia-east1",
        "--project=astera-oms-prod",
        "--quiet",
      ]);
      state.builds += 1;
      return commandSuccess();
    }
    if (prefix === "artifacts docker images describe") {
      expect(gcloudArgs).toEqual([
        "artifacts", "docker", "images", "describe", imageTag,
        "--format=value(image_summary.fully_qualified_digest)",
        "--project=astera-oms-prod",
      ]);
      return { status: 0, stdout: `${imageDigest}\n`, stderr: "" };
    }
    if (gcloudArgs[0] === "run" && gcloudArgs[1] === "deploy") {
      expect(gcloudArgs).toEqual([
        "run", "deploy", "astera-security-worker",
        `--image=${imageDigest}`,
        `--service-account=${workerServiceAccount}`,
        "--region=asia-east1",
        "--min-instances=0",
        "--max-instances=1",
        "--concurrency=1",
        `--set-env-vars=GOOGLE_CLOUD_PROJECT=astera-oms-prod,GCP_KMS_HMAC_KEY_NAME=${hmacKeyName}`,
        "--no-allow-unauthenticated",
        "--invoker-iam-check",
        "--project=astera-oms-prod",
        "--quiet",
      ]);
      state.deploys += 1;
      return commandSuccess();
    }
    if (prefix === "run services describe astera-security-worker") {
      expect(gcloudArgs).toEqual([
        "run", "services", "describe", "astera-security-worker",
        "--region=asia-east1", "--format=json", "--project=astera-oms-prod",
      ]);
      return successfulJson(exactService());
    }
    if (prefix === "run services get-iam-policy astera-security-worker") {
      expect(gcloudArgs).toEqual([
        "run", "services", "get-iam-policy", "astera-security-worker",
        "--region=asia-east1", "--format=json", "--project=astera-oms-prod",
      ]);
      return successfulJson(state.invokerBound ? exactIamPolicy() : { bindings: [] });
    }
    if (prefix === "run services add-iam-policy-binding astera-security-worker") {
      expect(gcloudArgs).toEqual([
        "run", "services", "add-iam-policy-binding", "astera-security-worker",
        `--member=${schedulerMember}`,
        "--role=roles/run.invoker",
        "--region=asia-east1",
        "--project=astera-oms-prod",
        "--quiet",
      ]);
      state.invokerBound = true;
      state.mutations.push("bindSchedulerInvoker");
      return commandSuccess();
    }
    if (prefix === "scheduler jobs list --location=asia-east1") {
      const fullName = gcloudArgs.find((argument) => argument.startsWith("--filter=name="))
        ?.slice("--filter=name=".length);
      if (fullName !== dailyName && fullName !== monthlyName) {
        throw new Error(`unexpected_scheduler_read:${fullName}`);
      }
      expect(gcloudArgs).toEqual(schedulerListArgs(fullName));
      return successfulJson(state.jobs.has(fullName) ? [state.jobs.get(fullName)] : []);
    }
    if (prefix === "scheduler jobs create http") {
      expect(gcloudArgs).toEqual(dailyCreateArgs());
      state.jobs.set(dailyName, dailyJob());
      state.mutations.push("createDailySchedulerJob");
      return commandSuccess();
    }
    if (prefix === "scheduler jobs update http") {
      expect(gcloudArgs).toEqual(monthlyUpdateArgs());
      state.jobs.set(monthlyName, schedulerJob("astera-fingerprint-key-report-monthly"));
      state.mutations.push("updateMonthlySchedulerJob");
      return commandSuccess();
    }
    throw new Error(`unexpected_gcloud:${gcloudArgs.join("|")}`);
  });
  return {
    windows,
    state,
    spawnSync,
    monitoringRequest,
    dailyName,
    monthlyName,
  };
}

function schedulerListArgs(fullName: string) {
  return [
    "scheduler", "jobs", "list",
    "--location=asia-east1",
    `--filter=name=${fullName}`,
    "--format=json(name,schedule,timeZone,state,httpTarget)",
    "--project=astera-oms-prod",
  ];
}

function dailyCreateArgs() {
  return [
    "scheduler", "jobs", "create", "http", "astera-refund-vault-cleanup-daily",
    "--location=asia-east1",
    "--schedule=30 3 * * *",
    "--time-zone=Asia/Taipei",
    `--uri=${serviceUrl}/jobs/refund-account-cleanup`,
    "--http-method=POST",
    `--oidc-service-account-email=${schedulerServiceAccount}`,
    `--oidc-token-audience=${serviceUrl}`,
    "--project=astera-oms-prod",
    "--quiet",
  ];
}

function monthlyUpdateArgs() {
  return [
    "scheduler", "jobs", "update", "http", "astera-fingerprint-key-report-monthly",
    "--location=asia-east1",
    "--schedule=0 4 1 * *",
    "--time-zone=Asia/Taipei",
    `--uri=${serviceUrl}/jobs/fingerprint-key-usage`,
    "--http-method=POST",
    `--oidc-service-account-email=${schedulerServiceAccount}`,
    `--oidc-token-audience=${serviceUrl}`,
    "--clear-headers",
    "--clear-message-body",
    "--project=astera-oms-prod",
    "--quiet",
  ];
}

function commandSuccess() {
  return { status: 0, stdout: "", stderr: "" };
}

function normalizedPolicyFixture(channelName: string) {
  const baseFilter =
    'resource.type = "cloud_run_revision" AND '
    + 'resource.labels.service_name = "astera-security-worker" AND '
    + 'resource.labels.location = "asia-east1" AND '
    + 'metric.type = "run.googleapis.com/request_count"';
  return {
    name: "projects/astera-oms-prod/alertPolicies/policy-1",
    documentation: {
      content: "The private Astera Security Worker returned a non-2xx response or timed out.",
      mimeType: "text/markdown",
    },
    conditions: [
      {
        name: "projects/astera-oms-prod/alertPolicies/policy-1/conditions/non-2xx",
        conditionThreshold: {
          aggregations: [{
            crossSeriesReducer: "REDUCE_SUM",
            perSeriesAligner: "ALIGN_DELTA",
            alignmentPeriod: "60s",
          }],
          duration: "0s",
          thresholdValue: 0,
          comparison: "COMPARISON_GT",
          filter: `${baseFilter} AND metric.labels.response_code_class != "2xx"`,
        },
        displayName: "Astera Security Worker non-2xx",
      },
      {
        name: "projects/astera-oms-prod/alertPolicies/policy-1/conditions/timeout",
        conditionThreshold: {
          aggregations: [{
            crossSeriesReducer: "REDUCE_SUM",
            perSeriesAligner: "ALIGN_DELTA",
            alignmentPeriod: "60s",
          }],
          duration: "0s",
          thresholdValue: 0,
          comparison: "COMPARISON_GT",
          filter: `${baseFilter} AND metric.labels.response_code = "504"`,
        },
        displayName: "Astera Security Worker timeout",
      },
    ],
    notificationChannels: [channelName],
    combiner: "OR",
    displayName: "Astera Security Worker non-2xx or timeout",
  };
}

function sourceRevisionRunner() {
  return vi.fn((command: string, args: string[]) => {
    if (command === "git" && args.join(" ") === "rev-parse HEAD") {
      return { status: 0, stdout: `${revision}\n`, stderr: "" };
    }
    if (command === "git" && args[0] === "status") {
      return { status: 0, stdout: "", stderr: "" };
    }
    return { status: 7, stdout: "", stderr: "" };
  });
}

function windowsLauncherFixture(mode: "valid" | "cwd" | "path" | "missing" = "valid") {
  const localAppData = "C:\\Users\\tester\\AppData\\Local";
  const sdkRoot = `${localAppData}\\Google\\Cloud SDK\\google-cloud-sdk`;
  const python = `${sdkRoot}\\platform\\bundledpython\\python.exe`;
  const gcloudPy = `${sdkRoot}\\lib\\gcloud.py`;
  const trustedBin = `${sdkRoot}\\bin`;
  const trustedCmd = `${trustedBin}\\gcloud.cmd`;
  const cwd = "C:\\repo";
  const cwdShadow = `${cwd}\\gcloud.cmd`;
  const pathShadow = "C:\\untrusted\\gcloud.cmd";
  const existing = new Set([
    ...(mode === "missing" ? [] : [python, gcloudPy, trustedCmd]),
    ...(mode === "cwd" ? [cwdShadow] : []),
    ...(mode === "path" ? [pathShadow] : []),
  ].map((value) => value.toLowerCase()));
  return {
    cwd,
    python,
    gcloudPy,
    env: {
      SystemRoot: "C:\\Windows",
      ComSpec: "C:\\Windows\\System32\\cmd.exe",
      LOCALAPPDATA: localAppData,
      PATH: mode === "path" ? `C:\\untrusted;${trustedBin}` : trustedBin,
    },
    existsSync: vi.fn((path: string) => existing.has(path.toLowerCase())),
    realpathSync: vi.fn((path: string) => path),
  };
}
