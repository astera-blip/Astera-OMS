import { spawnSync as nodeSpawnSync } from "node:child_process";
import {
  existsSync as nodeExistsSync,
  readFileSync as nodeReadFileSync,
  realpathSync as nodeRealpathSync,
} from "node:fs";
import { win32 } from "node:path";
import { pathToFileURL } from "node:url";
import { GoogleAuth } from "google-auth-library";

const PROJECT = "astera-oms-prod";
const PROJECT_NUMBER = "1032606875618";
const REGION = "asia-east1";
const REPOSITORY = "astera-ops";
const SERVICE = "astera-security-worker";
const WORKER_SERVICE_ACCOUNT =
  "astera-security-worker@astera-oms-prod.iam.gserviceaccount.com";
const SCHEDULER_SERVICE_ACCOUNT =
  "astera-security-scheduler@astera-oms-prod.iam.gserviceaccount.com";
const SCHEDULER_MEMBER = `serviceAccount:${SCHEDULER_SERVICE_ACCOUNT}`;
const HMAC_KEY_NAME =
  `projects/${PROJECT}/locations/${REGION}/keyRings/astera-oms-security/`+
  "cryptoKeys/member-account-fingerprint";
const NOTIFICATION_EMAIL = "astera.0920@gmail.com";
const NOTIFICATION_CHANNEL_DISPLAY_NAME = "Astera Security Worker email";
const ALERT_POLICY_DISPLAY_NAME = "Astera Security Worker non-2xx or timeout";
const MONITORING_ROOT = `https://monitoring.googleapis.com/v3/projects/${PROJECT}`;
const IMAGE_ROOT = `${REGION}-docker.pkg.dev/${PROJECT}/${REPOSITORY}/${SERVICE}`;
const DRY_RUN_ACTIONS = Object.freeze([
  "buildWorkerImage",
  "deployWorkerService",
  "bindSchedulerInvoker",
  "upsertDailySchedulerJob",
  "upsertMonthlySchedulerJob",
  "ensureEmailNotificationChannel",
  "ensureAlertPolicy",
]);
const BUILD_CONTEXT_PATHS = Object.freeze([
  "ops/security-worker",
  "src/lib/payment/fingerprintIdentity.mjs",
]);
const REQUIRED_BUILD_IGNORE_CONTENT = `# Default-deny repository-root build context.
*

# Required worker runtime package.
!ops/
!ops/security-worker/
!ops/security-worker/Dockerfile
!ops/security-worker/cloudbuild.yaml
!ops/security-worker/package.json
!ops/security-worker/package-lock.json
!ops/security-worker/server.mjs
!ops/security-worker/job-functions.mjs

# Pure helper imported by job-functions.mjs.
!src/
!src/lib/
!src/lib/payment/
!src/lib/payment/fingerprintIdentity.mjs
`;

const JOBS = Object.freeze([
  Object.freeze({
    key: "dailySchedulerJob",
    actionName: "upsertDailySchedulerJob",
    name: "astera-refund-vault-cleanup-daily",
    schedule: "30 3 * * *",
    route: "/jobs/refund-account-cleanup",
  }),
  Object.freeze({
    key: "monthlySchedulerJob",
    actionName: "upsertMonthlySchedulerJob",
    name: "astera-fingerprint-key-report-monthly",
    schedule: "0 4 1 * *",
    route: "/jobs/fingerprint-key-usage",
  }),
]);

export function parseProductionSecurityDeploymentArgs(argv) {
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--apply") {
      if (values.apply) throw new Error("invalid_arguments");
      values.apply = true;
      continue;
    }
    if (token !== "--project" && token !== "--confirm-project") {
      throw new Error("invalid_arguments");
    }
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--") || Object.hasOwn(values, name)) {
      throw new Error("invalid_arguments");
    }
    values[name] = value;
    index += 1;
  }

  if (!values.project || !values["confirm-project"]) {
    throw new Error("project_confirmation_required");
  }
  if (values.project !== PROJECT) throw new Error("production_project_required");
  if (values["confirm-project"] !== PROJECT) {
    throw new Error("project_confirmation_mismatch");
  }

  return Object.freeze({
    project: PROJECT,
    projectNumber: PROJECT_NUMBER,
    region: REGION,
    apply: values.apply === true,
  });
}

export function buildProductionSecurityDeploymentCommands(
  config,
  { sourceRevision, imageDigest, serviceUrl },
) {
  assertFixedConfig(config);
  const imageTag = buildImageTag(sourceRevision);
  assertImageDigest(imageDigest);
  assertServiceUrl(serviceUrl);

  const plan = {
    imageTag,
    buildWorkerImage: buildImageCommand(imageTag),
    discoverWorkerImageDigest: discoverImageCommand(imageTag),
    deployWorkerService: deployServiceCommand(imageDigest),
    discoverWorkerService: discoverServiceCommand(),
    discoverWorkerServiceIamPolicy: discoverIamPolicyCommand(
      "discoverWorkerServiceIamPolicy",
    ),
    bindSchedulerInvoker: step("bindSchedulerInvoker", [
      "run", "services", "add-iam-policy-binding", SERVICE,
      `--member=${SCHEDULER_MEMBER}`,
      "--role=roles/run.invoker",
      `--region=${REGION}`,
      `--project=${PROJECT}`,
      "--quiet",
    ]),
    discoverVerifiedWorkerServiceIamPolicy: discoverIamPolicyCommand(
      "discoverVerifiedWorkerServiceIamPolicy",
    ),
    dailySchedulerJob: buildSchedulerCommands(JOBS[0], serviceUrl),
    monthlySchedulerJob: buildSchedulerCommands(JOBS[1], serviceUrl),
  };
  return Object.freeze(plan);
}

export function validateWorkerBuildIgnore(contents) {
  if (
    typeof contents !== "string"
    || contents.replace(/\r\n/g, "\n") !== REQUIRED_BUILD_IGNORE_CONTENT
  ) {
    throw new Error("production_security_deployment_build_ignore_invalid");
  }
  return true;
}

export function validateDeployedWorkerService(value, expectedImageDigest) {
  assertImageDigest(expectedImageDigest);
  try {
    if (!isRecord(value)) throw new Error();
    const metadata = value.metadata;
    const template = value.spec?.template;
    const templateMetadata = template?.metadata;
    const templateSpec = template?.spec;
    const containers = templateSpec?.containers;
    const annotations = templateMetadata?.annotations;
    const labels = metadata?.labels;
    if (
      !isRecord(metadata)
      || metadata.name !== SERVICE
      || metadata.namespace !== PROJECT_NUMBER
      || !isRecord(labels)
      || labels["cloud.googleapis.com/location"] !== REGION
      || !isRecord(template)
      || !isRecord(templateMetadata)
      || !isRecord(annotations)
      || (
        annotations["autoscaling.knative.dev/minScale"] !== undefined
        && annotations["autoscaling.knative.dev/minScale"] !== "0"
      )
      || annotations["autoscaling.knative.dev/maxScale"] !== "1"
      || !isRecord(templateSpec)
      || templateSpec.serviceAccountName !== WORKER_SERVICE_ACCOUNT
      || templateSpec.containerConcurrency !== 1
      || !Array.isArray(containers)
      || containers.length !== 1
      || !isRecord(containers[0])
      || containers[0].image !== expectedImageDigest
      || !hasExactWorkerEnvironment(containers[0].env)
    ) {
      throw new Error();
    }
    const serviceUrl = value.status?.url;
    assertServiceUrl(serviceUrl);
    const address = value.status?.address;
    if (
      address !== undefined
      && (!isRecord(address) || address.url !== serviceUrl)
    ) {
      throw new Error();
    }
    return serviceUrl;
  } catch {
    throw new Error(
      "production_security_deployment_incompatible:discoverWorkerService",
    );
  }
}

export function inspectWorkerServiceIamPolicy(value, requireInvoker = false) {
  const failure = () => {
    throw new Error(
      "production_security_deployment_incompatible:discoverWorkerServiceIamPolicy",
    );
  };
  if (!isRecord(value)) failure();
  const bindings = value.bindings ?? [];
  if (!Array.isArray(bindings)) failure();

  let schedulerInvokerCount = 0;
  for (const binding of bindings) {
    if (
      !isRecord(binding)
      || typeof binding.role !== "string"
      || !Array.isArray(binding.members)
      || binding.members.length === 0
    ) {
      failure();
    }
    if (
      binding.role === "roles/run.invoker"
      && Object.hasOwn(binding, "condition")
    ) {
      failure();
    }
    for (const member of binding.members) {
      if (typeof member !== "string" || member.length === 0) failure();
      if (member === "allUsers" || member === "allAuthenticatedUsers") failure();
      if (binding.role === "roles/run.invoker") {
        if (member !== SCHEDULER_MEMBER || Object.hasOwn(binding, "condition")) {
          failure();
        }
        schedulerInvokerCount += 1;
      } else if (member === SCHEDULER_MEMBER) {
        failure();
      }
    }
  }
  if (schedulerInvokerCount > 1 || (requireInvoker && schedulerInvokerCount !== 1)) {
    failure();
  }
  return Object.freeze({ schedulerInvokerExists: schedulerInvokerCount === 1 });
}

export function inspectSchedulerJob(value, expected) {
  const failure = () => {
    throw new Error(
      "production_security_deployment_incompatible:discoverSchedulerJob",
    );
  };
  if (!Array.isArray(value) || value.length > 1) failure();
  if (value.length === 0) return Object.freeze({ exists: false, exact: false });
  const job = value[0];
  if (
    !isRecord(job)
    || typeof job.name !== "string"
    || typeof job.schedule !== "string"
    || typeof job.timeZone !== "string"
    || typeof job.state !== "string"
    || !isRecord(job.httpTarget)
    || typeof job.httpTarget.uri !== "string"
    || typeof job.httpTarget.httpMethod !== "string"
  ) {
    failure();
  }
  if (job.name !== expected.name) failure();

  const oidcToken = job.httpTarget.oidcToken;
  if (
    (oidcToken !== undefined && !isRecord(oidcToken))
    || (isRecord(oidcToken) && (
      typeof oidcToken.serviceAccountEmail !== "string"
      || typeof oidcToken.audience !== "string"
    ))
    || (job.httpTarget.headers !== undefined && !isRecord(job.httpTarget.headers))
    || (job.httpTarget.body !== undefined && typeof job.httpTarget.body !== "string")
  ) {
    failure();
  }
  const oidcWellFormed = isRecord(oidcToken)
    && typeof oidcToken.serviceAccountEmail === "string"
    && typeof oidcToken.audience === "string";
  const headers = job.httpTarget.headers;
  const headersAreEmpty = headers === undefined
    || (isRecord(headers) && Object.keys(headers).length === 0);
  const bodyIsEmpty = job.httpTarget.body === undefined || job.httpTarget.body === "";
  const exact = job.schedule === expected.schedule
    && job.timeZone === expected.timeZone
    && job.state === "ENABLED"
    && job.httpTarget.uri === expected.httpTarget.uri
    && job.httpTarget.httpMethod === "POST"
    && oidcWellFormed
    && oidcToken.serviceAccountEmail === SCHEDULER_SERVICE_ACCOUNT
    && oidcToken.audience === expected.httpTarget.oidcToken.audience
    && headersAreEmpty
    && bodyIsEmpty;
  return Object.freeze({ exists: true, exact });
}

export function buildProductionAlertPolicy(channelName) {
  if (!isNotificationChannelName(channelName)) {
    throw new Error("production_security_monitoring_channel_invalid");
  }
  const baseFilter = [
    'resource.type = "cloud_run_revision"',
    `resource.labels.service_name = "${SERVICE}"`,
    `resource.labels.location = "${REGION}"`,
    'metric.type = "run.googleapis.com/request_count"',
  ].join(" AND ");
  const condition = (displayName, metricFilter) => ({
    displayName,
    conditionThreshold: {
      filter: `${baseFilter} AND ${metricFilter}`,
      comparison: "COMPARISON_GT",
      thresholdValue: 0,
      duration: "0s",
      aggregations: [{
        alignmentPeriod: "60s",
        perSeriesAligner: "ALIGN_DELTA",
        crossSeriesReducer: "REDUCE_SUM",
      }],
    },
  });
  return {
    displayName: ALERT_POLICY_DISPLAY_NAME,
    combiner: "OR",
    enabled: true,
    notificationChannels: [channelName],
    conditions: [
      condition(
        "Astera Security Worker non-2xx",
        'metric.labels.response_code_class != "2xx"',
      ),
      condition(
        "Astera Security Worker timeout",
        'metric.labels.response_code = "504"',
      ),
    ],
    documentation: {
      mimeType: "text/markdown",
      content: "The private Astera Security Worker returned a non-2xx response or timed out.",
    },
  };
}

export async function ensureProductionMonitoring({ request }) {
  if (typeof request !== "function") {
    throw new Error("production_security_monitoring_client_invalid");
  }
  const channels = await listMonitoringResources(
    request,
    "notificationChannels",
  );
  const policies = await listMonitoringResources(request, "alertPolicies");
  const channelCandidates = channels.filter((channel) =>
    isRecord(channel)
    && (
      channel.displayName === NOTIFICATION_CHANNEL_DISPLAY_NAME
      || channel.labels?.email_address === NOTIFICATION_EMAIL
    ));
  if (channelCandidates.length > 1) monitoringConflict();
  const policyCandidates = policies.filter((policy) =>
    policy.displayName === ALERT_POLICY_DISPLAY_NAME);
  if (policyCandidates.length > 1) monitoringConflict();

  let channel = channelCandidates[0];
  if (channel) {
    validateFixedNotificationChannel(channel);
  } else {
    if (policyCandidates.length !== 0) monitoringConflict();
    const response = await request({
      method: "POST",
      url: `${MONITORING_ROOT}/notificationChannels`,
      data: expectedNotificationChannel(),
    });
    channel = response?.data;
    validateFixedNotificationChannel(channel);
  }

  const desiredPolicy = buildProductionAlertPolicy(channel.name);
  let policy = policyCandidates[0];
  if (policy) {
    if (!isExactAlertPolicy(policy, desiredPolicy)) monitoringConflict();
  } else {
    const response = await request({
      method: "POST",
      url: `${MONITORING_ROOT}/alertPolicies`,
      data: desiredPolicy,
    });
    policy = response?.data;
    if (!isExactAlertPolicy(policy, desiredPolicy)) monitoringConflict();
  }
  return Object.freeze({ channelName: channel.name, policyName: policy.name });
}

/**
 * @param {string[]} argv
 * @param {{
 *   spawnSync?: (
 *     command: string,
 *     args: string[],
 *     options: { shell: false, encoding: "utf8", windowsHide: true },
 *   ) => { status: number | null, stdout?: unknown },
 *   createMonitoringRequest?: () => Promise<(options: {
 *     method?: string,
 *     url: string,
 *     data?: Record<string, unknown>,
 *     params?: Record<string, unknown>,
 *   }) => Promise<unknown>>,
 *   readFileSync?: (path: URL, encoding: "utf8") => string,
 *   existsSync?: (path: string) => boolean,
 *   realpathSync?: (path: string) => string,
 *   cwd?: () => string,
 *   log?: (line: string) => void,
 *   platform?: string,
 *   env?: Record<string, string | undefined>,
 * }} [dependencies]
 */
export async function runProductionSecurityDeployment(
  argv,
  {
    spawnSync = nodeSpawnSync,
    createMonitoringRequest = createGoogleMonitoringRequest,
    readFileSync = nodeReadFileSync,
    existsSync = nodeExistsSync,
    realpathSync = nodeRealpathSync,
    cwd = process.cwd,
    log = console.log,
    platform = process.platform,
    env = process.env,
  } = {},
) {
  const config = parseProductionSecurityDeploymentArgs(argv);
  const mode = config.apply ? "apply" : "dry-run";
  log(`mode=${mode}`);
  if (!config.apply) {
    for (const action of DRY_RUN_ACTIONS) log(`action=${action}`);
    return Object.freeze({ mode, actions: DRY_RUN_ACTIONS });
  }

  const dependencies = {
    spawnSync,
    log,
    platform,
    env,
    existsSync,
    realpathSync,
    cwd,
  };
  const sourceRevision = readSourceRevision(dependencies);
  verifyWorkerBuildIgnore(readFileSync);
  verifyBuildContextClean(dependencies);
  const imageTag = buildImageTag(sourceRevision);
  runCommand(buildImageCommand(imageTag), dependencies);
  const imageDigest = readImageDigest(
    runCommand(discoverImageCommand(imageTag), dependencies).stdout,
    imageTag,
  );
  runCommand(deployServiceCommand(imageDigest), dependencies);
  const serviceUrl = validateDeployedWorkerService(
    parseCommandJson(
      runCommand(discoverServiceCommand(), dependencies).stdout,
      "discoverWorkerService",
    ),
    imageDigest,
  );

  const preBindingPolicy = inspectWorkerServiceIamPolicy(parseCommandJson(
    runCommand(
      discoverIamPolicyCommand("discoverWorkerServiceIamPolicy"),
      dependencies,
    ).stdout,
    "discoverWorkerServiceIamPolicy",
  ));
  if (!preBindingPolicy.schedulerInvokerExists) {
    runCommand(buildBindInvokerCommand(), dependencies);
  }
  inspectWorkerServiceIamPolicy(parseCommandJson(
    runCommand(
      discoverIamPolicyCommand("discoverVerifiedWorkerServiceIamPolicy"),
      dependencies,
    ).stdout,
    "discoverVerifiedWorkerServiceIamPolicy",
  ), true);

  for (const job of JOBS) {
    await reconcileSchedulerJob(job, serviceUrl, dependencies);
  }

  log("action=ensureEmailNotificationChannel");
  const request = await createMonitoringRequest();
  await ensureProductionMonitoring({ request });
  log("action=ensureAlertPolicy");
  return Object.freeze({ mode, actions: DRY_RUN_ACTIONS });
}

function verifyWorkerBuildIgnore(readFileSync) {
  let contents;
  try {
    contents = readFileSync(
      new URL("../ops/security-worker/Dockerfile.dockerignore", import.meta.url),
      "utf8",
    );
  } catch {
    throw new Error("production_security_deployment_build_ignore_invalid");
  }
  validateWorkerBuildIgnore(contents);
}

function buildImageCommand(imageTag) {
  return step("buildWorkerImage", [
    "builds", "submit", ".",
    "--config=ops/security-worker/cloudbuild.yaml",
    "--ignore-file=ops/security-worker/Dockerfile.dockerignore",
    `--substitutions=_IMAGE=${imageTag}`,
    `--region=${REGION}`,
    `--project=${PROJECT}`,
    "--quiet",
  ]);
}

function discoverImageCommand(imageTag) {
  return step("discoverWorkerImageDigest", [
    "artifacts", "docker", "images", "describe", imageTag,
    "--format=value(image_summary.fully_qualified_digest)",
    `--project=${PROJECT}`,
  ]);
}

function deployServiceCommand(imageDigest) {
  assertImageDigest(imageDigest);
  return step("deployWorkerService", [
    "run", "deploy", SERVICE,
    `--image=${imageDigest}`,
    `--service-account=${WORKER_SERVICE_ACCOUNT}`,
    `--region=${REGION}`,
    "--min-instances=0",
    "--max-instances=1",
    "--concurrency=1",
    `--set-env-vars=GOOGLE_CLOUD_PROJECT=${PROJECT},GCP_KMS_HMAC_KEY_NAME=${HMAC_KEY_NAME}`,
    "--no-allow-unauthenticated",
    "--invoker-iam-check",
    `--project=${PROJECT}`,
    "--quiet",
  ]);
}

function discoverServiceCommand() {
  return step("discoverWorkerService", [
    "run", "services", "describe", SERVICE,
    `--region=${REGION}`,
    "--format=json",
    `--project=${PROJECT}`,
  ]);
}

function discoverIamPolicyCommand(name) {
  return step(name, [
    "run", "services", "get-iam-policy", SERVICE,
    `--region=${REGION}`,
    "--format=json",
    `--project=${PROJECT}`,
  ]);
}

function buildBindInvokerCommand() {
  return step("bindSchedulerInvoker", [
    "run", "services", "add-iam-policy-binding", SERVICE,
    `--member=${SCHEDULER_MEMBER}`,
    "--role=roles/run.invoker",
    `--region=${REGION}`,
    `--project=${PROJECT}`,
    "--quiet",
  ]);
}

function buildSchedulerCommands(job, serviceUrl) {
  assertServiceUrl(serviceUrl);
  const fullName = `projects/${PROJECT}/locations/${REGION}/jobs/${job.name}`;
  const expected = Object.freeze({
    name: fullName,
    schedule: job.schedule,
    timeZone: "Asia/Taipei",
    state: "ENABLED",
    httpTarget: Object.freeze({
      uri: `${serviceUrl}${job.route}`,
      httpMethod: "POST",
      oidcToken: Object.freeze({
        serviceAccountEmail: SCHEDULER_SERVICE_ACCOUNT,
        audience: serviceUrl,
      }),
    }),
  });
  const discoverArgs = [
    "scheduler", "jobs", "list",
    `--location=${REGION}`,
    `--filter=name=${fullName}`,
    "--format=json(name,schedule,timeZone,state,httpTarget)",
    `--project=${PROJECT}`,
  ];
  const mutationArgs = [
    `--location=${REGION}`,
    `--schedule=${job.schedule}`,
    "--time-zone=Asia/Taipei",
    `--uri=${serviceUrl}${job.route}`,
    "--http-method=POST",
    `--oidc-service-account-email=${SCHEDULER_SERVICE_ACCOUNT}`,
    `--oidc-token-audience=${serviceUrl}`,
  ];
  return Object.freeze({
    expected,
    discover: step(`discover${capitalize(job.name)}SchedulerJob`, discoverArgs),
    create: step(`create${capitalize(job.name)}SchedulerJob`, [
      "scheduler", "jobs", "create", "http", job.name,
      ...mutationArgs,
      `--project=${PROJECT}`,
      "--quiet",
    ]),
    update: step(`update${capitalize(job.name)}SchedulerJob`, [
      "scheduler", "jobs", "update", "http", job.name,
      ...mutationArgs,
      "--clear-headers",
      "--clear-message-body",
      `--project=${PROJECT}`,
      "--quiet",
    ]),
    verify: step(`discoverVerified${capitalize(job.name)}SchedulerJob`, discoverArgs),
  });
}

async function reconcileSchedulerJob(job, serviceUrl, dependencies) {
  dependencies.log(`action=${job.actionName}`);
  const commands = buildSchedulerCommands(job, serviceUrl);
  const discovered = parseCommandJson(
    runCommand(commands.discover, dependencies, false).stdout,
    commands.discover.name,
  );
  const inspection = inspectSchedulerJob(discovered, commands.expected);
  if (inspection.exists && discovered[0].state !== "ENABLED") {
    throw new Error("production_security_deployment_incompatible:discoverSchedulerJob");
  }
  if (!inspection.exists) {
    runCommand(commands.create, dependencies, false);
  } else if (!inspection.exact) {
    runCommand(commands.update, dependencies, false);
  }
  const verified = parseCommandJson(
    runCommand(commands.verify, dependencies, false).stdout,
    commands.verify.name,
  );
  if (!inspectSchedulerJob(verified, commands.expected).exact) {
    throw new Error("production_security_deployment_incompatible:discoverSchedulerJob");
  }
}

function readSourceRevision(dependencies) {
  const result = runCommand(
    Object.freeze({ name: "verifySourceRevision", command: "git", args: ["rev-parse", "HEAD"] }),
    dependencies,
  );
  const revision = typeof result.stdout === "string" ? result.stdout.trim() : "";
  buildImageTag(revision);
  return revision;
}

function verifyBuildContextClean(dependencies) {
  const result = runCommand(Object.freeze({
    name: "verifyBuildContextClean",
    command: "git",
    args: ["status", "--porcelain=v1", "--untracked-files=all", "--", ...BUILD_CONTEXT_PATHS],
  }), dependencies);
  if (typeof result.stdout !== "string" || result.stdout.trim() !== "") {
    throw new Error("production_security_deployment_build_context_dirty");
  }
}

function runCommand(command, dependencies, shouldLog = true) {
  if (shouldLog) dependencies.log(`action=${command.name}`);
  const launch = resolveLaunch(command, dependencies);
  let result;
  try {
    result = dependencies.spawnSync(launch.command, launch.args, {
      shell: false,
      encoding: "utf8",
      windowsHide: true,
    });
  } catch {
    throw new Error(`production_security_deployment_command_failed:${command.name}`);
  }
  if (result?.status !== 0) {
    throw new Error(`production_security_deployment_command_failed:${command.name}`);
  }
  return result;
}

function resolveLaunch(command, dependencies) {
  if (command.command === "git") return command;
  if (command.command !== "gcloud") {
    throw new Error("production_security_deployment_launcher_invalid");
  }
  if (dependencies.platform !== "win32") return command;

  const localAppData = win32.normalize(
    String(dependencies.env.LOCALAPPDATA ?? "").trim(),
  );
  if (
    !win32.isAbsolute(localAppData)
    || !/^[A-Za-z]:\\Users\\[^\\]+\\AppData\\Local$/i.test(localAppData)
  ) {
    throw new Error("production_security_deployment_windows_launcher_invalid");
  }
  const sdkRoot = win32.join(
    localAppData,
    "Google",
    "Cloud SDK",
    "google-cloud-sdk",
  );
  const python = win32.join(
    sdkRoot,
    "platform",
    "bundledpython",
    "python.exe",
  );
  const gcloudPy = win32.join(sdkRoot, "lib", "gcloud.py");
  if (
    !dependencies.existsSync(python)
    || !dependencies.existsSync(gcloudPy)
    || canonicalWindowsPath(python, dependencies.realpathSync) !== python.toLowerCase()
    || canonicalWindowsPath(gcloudPy, dependencies.realpathSync) !== gcloudPy.toLowerCase()
  ) {
    throw new Error("production_security_deployment_windows_launcher_invalid");
  }
  rejectWindowsGcloudShadows(
    sdkRoot,
    dependencies.env.PATH,
    dependencies.cwd,
    dependencies.existsSync,
  );
  return Object.freeze({
    command: python,
    args: ["-S", gcloudPy, ...command.args],
  });
}

function canonicalWindowsPath(path, realpathSync) {
  try {
    return win32.normalize(realpathSync(path)).toLowerCase();
  } catch {
    throw new Error("production_security_deployment_windows_launcher_invalid");
  }
}

function rejectWindowsGcloudShadows(sdkRoot, pathValue, cwd, existsSync) {
  const trusted = win32.join(sdkRoot, "bin", "gcloud.cmd").toLowerCase();
  const currentDirectory = win32.normalize(cwd());
  if (!win32.isAbsolute(currentDirectory)) {
    throw new Error("production_security_deployment_windows_launcher_invalid");
  }
  const searchDirectories = [
    currentDirectory,
    ...String(pathValue ?? "").split(";").filter((entry) => entry !== ""),
  ];
  for (const directory of searchDirectories) {
    const unquoted = directory.replace(/^"|"$/g, "");
    const resolved = win32.resolve(currentDirectory, unquoted);
    const candidate = win32.join(resolved, "gcloud.cmd");
    if (existsSync(candidate) && candidate.toLowerCase() !== trusted) {
      throw new Error("production_security_deployment_windows_launcher_invalid");
    }
  }
}

function parseCommandJson(stdout, name) {
  try {
    return JSON.parse(typeof stdout === "string" ? stdout : "");
  } catch {
    throw new Error(`production_security_deployment_malformed:${name}`);
  }
}

function readImageDigest(stdout, imageTag) {
  const value = typeof stdout === "string" ? stdout.trim() : "";
  assertImageDigest(value);
  if (!imageTag.startsWith(`${IMAGE_ROOT}:`) || !value.startsWith(`${IMAGE_ROOT}@`)) {
    throw new Error("production_security_deployment_image_invalid");
  }
  return value;
}

function buildImageTag(sourceRevision) {
  if (!/^[0-9a-f]{40}$/.test(sourceRevision)) {
    throw new Error("production_security_deployment_source_revision_invalid");
  }
  return `${IMAGE_ROOT}:git-${sourceRevision}`;
}

function assertImageDigest(value) {
  const escapedRoot = escapeRegExp(IMAGE_ROOT);
  if (!new RegExp(`^${escapedRoot}@sha256:[0-9a-f]{64}$`).test(value)) {
    throw new Error("production_security_deployment_image_invalid");
  }
}

function assertServiceUrl(value) {
  try {
    if (typeof value !== "string") throw new Error();
    const parsed = new URL(value);
    const currentHostname = `${SERVICE}-${PROJECT_NUMBER}.${REGION}.run.app`;
    const legacyHostname = new RegExp(`^${escapeRegExp(SERVICE)}-[a-z0-9]{10}-de\\.a\\.run\\.app$`);
    if (
      parsed.protocol !== "https:"
      || parsed.username !== ""
      || parsed.password !== ""
      || parsed.port !== ""
      || parsed.pathname !== "/"
      || parsed.search !== ""
      || parsed.hash !== ""
      || (parsed.hostname !== currentHostname && !legacyHostname.test(parsed.hostname))
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("production_security_deployment_service_url_invalid");
  }
}

function assertFixedConfig(config) {
  if (
    config?.project !== PROJECT
    || config?.projectNumber !== PROJECT_NUMBER
    || config?.region !== REGION
    || typeof config?.apply !== "boolean"
  ) {
    throw new Error("invalid_production_security_deployment_config");
  }
}

function hasExactWorkerEnvironment(env) {
  if (!Array.isArray(env) || env.length !== 2) return false;
  const values = new Map();
  for (const variable of env) {
    if (
      !isRecord(variable)
      || typeof variable.name !== "string"
      || typeof variable.value !== "string"
      || values.has(variable.name)
    ) {
      return false;
    }
    values.set(variable.name, variable.value);
  }
  return values.size === 2
    && values.get("GOOGLE_CLOUD_PROJECT") === PROJECT
    && values.get("GCP_KMS_HMAC_KEY_NAME") === HMAC_KEY_NAME;
}

function expectedNotificationChannel() {
  return {
    type: "email",
    displayName: NOTIFICATION_CHANNEL_DISPLAY_NAME,
    labels: { email_address: NOTIFICATION_EMAIL },
    enabled: true,
  };
}

function isExactNotificationChannel(channel) {
  return isMatchingNotificationChannelConfiguration(channel)
    && channel.verificationStatus === "VERIFIED";
}

function isMatchingNotificationChannelConfiguration(channel) {
  return isRecord(channel)
    && isNotificationChannelName(channel.name)
    && channel.type === "email"
    && channel.displayName === NOTIFICATION_CHANNEL_DISPLAY_NAME
    && (channel.enabled === undefined || channel.enabled === true)
    && isRecord(channel.labels)
    && Object.keys(channel.labels).length === 1
    && channel.labels.email_address === NOTIFICATION_EMAIL;
}

function validateFixedNotificationChannel(channel) {
  if (!isMatchingNotificationChannelConfiguration(channel)) monitoringConflict();
  if (!isExactNotificationChannel(channel)) monitoringVerificationRequired();
}

function isNotificationChannelName(value) {
  return typeof value === "string"
    && /^projects\/astera-oms-prod\/notificationChannels\/[A-Za-z0-9_-]+$/.test(value);
}

function isExactAlertPolicy(policy, desired) {
  if (
    !isRecord(policy)
    || !/^projects\/astera-oms-prod\/alertPolicies\/[A-Za-z0-9_-]+$/.test(policy.name)
    || policy.displayName !== desired.displayName
    || policy.combiner !== desired.combiner
    || (policy.enabled !== undefined && policy.enabled !== true)
    || !semanticallyEqual(policy.notificationChannels, desired.notificationChannels)
    || !semanticallyEqual(policy.documentation, desired.documentation)
    || !Array.isArray(policy.conditions)
    || policy.conditions.length !== desired.conditions.length
  ) {
    return false;
  }
  return policy.conditions.every((condition, index) => {
    if (!isRecord(condition)) return false;
    const normalized = { ...condition };
    delete normalized.name;
    return semanticallyEqual(normalized, desired.conditions[index]);
  });
}

async function listMonitoringResources(request, collection) {
  const resources = [];
  const seenPageTokens = new Set();
  let pageToken;
  do {
    const response = await request({
      method: "GET",
      url: `${MONITORING_ROOT}/${collection}`,
      ...(pageToken ? { params: { pageToken } } : {}),
    });
    const data = response?.data;
    if (!isRecord(data)) monitoringConflict();
    const page = data[collection] ?? [];
    if (
      !Array.isArray(page)
      || page.some((resource) => !isValidMonitoringResource(collection, resource))
    ) {
      monitoringConflict();
    }
    resources.push(...page);
    pageToken = data.nextPageToken;
    if (pageToken !== undefined && typeof pageToken !== "string") monitoringConflict();
    if (pageToken) {
      if (seenPageTokens.has(pageToken)) monitoringConflict();
      seenPageTokens.add(pageToken);
    }
  } while (pageToken);
  return resources;
}

function isValidMonitoringResource(collection, resource) {
  if (!isRecord(resource)) return false;
  if (collection === "notificationChannels") {
    return /^projects\/astera-oms-prod\/notificationChannels\/[A-Za-z0-9_-]+$/
      .test(resource.name)
      && typeof resource.type === "string"
      && resource.type.length > 0
      && isRecord(resource.labels)
      && Object.values(resource.labels).every((value) => typeof value === "string")
      && (resource.displayName === undefined || typeof resource.displayName === "string")
      && (resource.enabled === undefined || typeof resource.enabled === "boolean")
      && (
        resource.verificationStatus === undefined
        || [
          "VERIFICATION_STATUS_UNSPECIFIED",
          "UNVERIFIED",
          "VERIFIED",
        ].includes(resource.verificationStatus)
      );
  }
  if (collection === "alertPolicies") {
    return /^projects\/astera-oms-prod\/alertPolicies\/[A-Za-z0-9_-]+$/
      .test(resource.name)
      && typeof resource.displayName === "string"
      && typeof resource.combiner === "string"
      && (resource.enabled === undefined || typeof resource.enabled === "boolean")
      && (
        resource.notificationChannels === undefined
        || (
          Array.isArray(resource.notificationChannels)
          && resource.notificationChannels.every((name) => typeof name === "string")
        )
      )
      && Array.isArray(resource.conditions)
      && resource.conditions.length > 0
      && resource.conditions.every(isRecord);
  }
  return false;
}

function semanticallyEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => semanticallyEqual(value, right[index]));
  }
  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) =>
        key === rightKeys[index] && semanticallyEqual(left[key], right[key]));
  }
  return false;
}

function monitoringConflict() {
  throw new Error("production_security_monitoring_conflict");
}

function monitoringVerificationRequired() {
  throw new Error("production_security_monitoring_verification_required");
}

async function createGoogleMonitoringRequest() {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/monitoring"],
  });
  const client = await auth.getClient();
  return (options) => client.request(options);
}

function step(name, args) {
  return Object.freeze({
    name,
    command: "gcloud",
    args: Object.freeze(args),
  });
}

function capitalize(value) {
  return value[0].toUpperCase() + value.slice(1);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runProductionSecurityDeployment(process.argv.slice(2));
  } catch {
    console.error("production_security_deployment_failed");
    process.exitCode = 1;
  }
}
