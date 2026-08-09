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
        "--set-env-vars=GOOGLE_CLOUD_PROJECT=astera-oms-prod",
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
      dailyJob({ httpTarget: { ...dailyJob().httpTarget, body: "c2VjcmV0" } }),
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

  it("creates exact email Monitoring state once and is idempotent", async () => {
    const state: MonitoringState = { channels: [], policies: [] };
    const request = statefulMonitoringRequest(state);

    await ensureProductionMonitoring({ request });

    expect(state.channels).toEqual([{
      name: "projects/astera-oms-prod/notificationChannels/channel-1",
      type: "email",
      displayName: "Astera Security Worker email",
      labels: { email_address: "astera.0920@gmail.com" },
      enabled: true,
    }]);
    expect(state.policies).toEqual([{
      name: "projects/astera-oms-prod/alertPolicies/policy-1",
      ...buildProductionAlertPolicy(state.channels[0].name),
    }]);

    const callsAfterCreate = request.mock.calls.length;
    await ensureProductionMonitoring({ request });
    expect(request.mock.calls).toHaveLength(callsAfterCreate + 2);
    expect(state.channels).toHaveLength(1);
    expect(state.policies).toHaveLength(1);
  });

  it("accepts semantically exact Monitoring policy fields in any JSON property order", async () => {
    const channel = {
      name: "projects/astera-oms-prod/notificationChannels/channel-1",
      type: "email",
      displayName: "Astera Security Worker email",
      labels: { email_address: "astera.0920@gmail.com" },
      enabled: true,
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
    const state: MonitoringState = {
      channels: [{
        name: "projects/astera-oms-prod/notificationChannels/unrelated",
        type: "email",
        labels: { email_address: "other@example.com" },
      }],
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

  it("fails closed on duplicate or conflicting Monitoring state", async () => {
    const exactChannel = {
      name: "projects/astera-oms-prod/notificationChannels/channel-1",
      type: "email",
      displayName: "Astera Security Worker email",
      labels: { email_address: "astera.0920@gmail.com" },
      enabled: true,
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

  it("completes one exact apply sequence using only validated argv and injected Monitoring", async () => {
    let invokerBound = false;
    const schedulerJobs = new Map<string, ReturnType<typeof schedulerJob>>();
    const spawnSync = vi.fn((_command: string, args: string[], _options: { shell: false }) => {
      expect(_options.shell).toBe(false);
      const joined = args.join(" ");
      if (joined === "rev-parse HEAD") {
        return { status: 0, stdout: `${revision}\n`, stderr: "" };
      }
      if (args[0] === "status") return { status: 0, stdout: "", stderr: "" };
      if (joined.startsWith("artifacts docker images describe")) {
        return { status: 0, stdout: `${imageDigest}\n`, stderr: "" };
      }
      if (joined.startsWith("run services describe")) {
        return successfulJson(exactService());
      }
      if (joined.startsWith("run services get-iam-policy")) {
        return successfulJson(invokerBound ? exactIamPolicy() : { bindings: [] });
      }
      if (joined.startsWith("run services add-iam-policy-binding")) {
        invokerBound = true;
        return { status: 0, stdout: "", stderr: "" };
      }
      if (joined.startsWith("scheduler jobs list")) {
        const fullName = args.find((arg) => arg.startsWith("--filter=name="))
          ?.slice("--filter=name=".length) ?? "";
        return successfulJson(schedulerJobs.has(fullName) ? [schedulerJobs.get(fullName)] : []);
      }
      if (joined.startsWith("scheduler jobs create http")) {
        const job = schedulerJob(args[4]);
        schedulerJobs.set(job.name, job);
        return { status: 0, stdout: "", stderr: "" };
      }
      return { status: 0, stdout: "", stderr: "" };
    });
    const monitoringState: MonitoringState = { channels: [], policies: [] };
    const monitoringRequest = statefulMonitoringRequest(monitoringState);

    await expect(runProductionSecurityDeployment([...confirmedArgs, "--apply"], {
      spawnSync,
      createMonitoringRequest: async () => monitoringRequest,
      log: vi.fn(),
      platform: "linux",
    })).resolves.toMatchObject({ mode: "apply" });

    expect(invokerBound).toBe(true);
    expect(schedulerJobs.size).toBe(2);
    expect(monitoringState.channels).toHaveLength(1);
    expect(monitoringState.policies).toHaveLength(1);
    expect(spawnSync.mock.calls.every(([, , options]) => options.shell === false)).toBe(true);
    expect(spawnSync.mock.calls.flatMap(([, args]) => args)).not.toContain("auth");
    expect(spawnSync.mock.calls.flatMap(([, args]) => args)).not.toContain("config");
    expect(spawnSync.mock.calls.flatMap(([, args]) => args))
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
            "autoscaling.knative.dev/minScale": "0",
            "autoscaling.knative.dev/maxScale": "1",
          },
        },
        spec: {
          serviceAccountName: workerServiceAccount,
          containerConcurrency: 1,
          containers: [{
            image: imageDigest,
            env: [{ name: "GOOGLE_CLOUD_PROJECT", value: "astera-oms-prod" }],
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
      const created = {
        name: "projects/astera-oms-prod/notificationChannels/channel-1",
        ...data,
      };
      state.channels.push(created);
      return { data: created };
    }
    if (method === "GET" && url.endsWith("/alertPolicies")) {
      return { data: { alertPolicies: state.policies } };
    }
    if (method === "POST" && url.endsWith("/alertPolicies")) {
      const created = {
        name: "projects/astera-oms-prod/alertPolicies/policy-1",
        ...data,
      };
      state.policies.push(created);
      return { data: created };
    }
    throw new Error(`unexpected_request:${method}:${url}`);
  });
}

function successfulJson(value: unknown) {
  return { status: 0, stdout: JSON.stringify(value), stderr: "" };
}
