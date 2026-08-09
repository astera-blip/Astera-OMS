import { spawnSync as nodeSpawnSync } from "node:child_process";
import { win32 } from "node:path";
import { pathToFileURL } from "node:url";

const PROJECT = "astera-oms-prod";
const PROJECT_NUMBER = "1032606875618";
const REGION = "asia-east1";
const KEY_RING = "astera-oms-security";
const HMAC_KEY = "member-account-fingerprint";
const REFUND_KEY = "refund-account-vault";
const ARTIFACT_REPOSITORY = "astera-ops";
const WIF_POOL = "vercel-oidc";
const WIF_PROVIDER = "vercel";
const WIF_PROJECT_ID = "prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ";
const WIF_ATTRIBUTE_CONDITION =
  `assertion.project_id == "${WIF_PROJECT_ID}"`;
const VERCEL_SERVICE_ACCOUNT =
  "astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com";
const WORKER_SERVICE_ACCOUNT =
  "astera-security-worker@astera-oms-prod.iam.gserviceaccount.com";
const SCHEDULER_SERVICE_ACCOUNT =
  "astera-security-scheduler@astera-oms-prod.iam.gserviceaccount.com";

const keyRingName =
  `projects/${PROJECT}/locations/${REGION}/keyRings/${KEY_RING}`;
const hmacKeyName = `${keyRingName}/cryptoKeys/${HMAC_KEY}`;
const refundKeyName = `${keyRingName}/cryptoKeys/${REFUND_KEY}`;
const artifactRepositoryName =
  `projects/${PROJECT}/locations/${REGION}/repositories/${ARTIFACT_REPOSITORY}`;
const wifPrincipalSet =
  `principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/`+
  `workloadIdentityPools/${WIF_POOL}/attribute.project_id/${WIF_PROJECT_ID}`;

export function parseProductionSecurityArgs(argv) {
  const values = {};
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
  if (values.project !== PROJECT) {
    throw new Error("production_project_required");
  }
  if (values["confirm-project"] !== PROJECT) {
    throw new Error("project_confirmation_mismatch");
  }

  return Object.freeze({
    project: PROJECT,
    apply: values.apply === true,
    region: REGION,
  });
}

export function buildProductionSecurityCommands(config) {
  assertFixedConfig(config);
  const projectArgs = ["--project", PROJECT];
  const discoverWifProviderArgs = [
    "iam", "workload-identity-pools", "providers", "describe", WIF_PROVIDER,
    `--workload-identity-pool=${WIF_POOL}`,
    "--location=global",
    "--format=json(state,attributeMapping,attributeCondition)",
    ...projectArgs,
  ];
  const commands = [
    step("discoverWifProvider", discoverWifProviderArgs),
    step("updateWifProviderCondition", [
      "iam", "workload-identity-pools", "providers", "update-oidc", WIF_PROVIDER,
      `--workload-identity-pool=${WIF_POOL}`,
      "--location=global",
      `--attribute-condition=${WIF_ATTRIBUTE_CONDITION}`,
      ...projectArgs,
      "--quiet",
    ]),
    step("discoverVerifiedWifProvider", discoverWifProviderArgs),
    step("discoverRuntimeServiceAccountIamPolicy", [
      "iam", "service-accounts", "get-iam-policy", VERCEL_SERVICE_ACCOUNT,
      "--format=json(bindings.role,bindings.members,bindings.condition)",
      ...projectArgs,
    ]),
    step("enableApis", [
      "services", "enable",
      "cloudkms.googleapis.com",
      "run.googleapis.com",
      "cloudscheduler.googleapis.com",
      "cloudbuild.googleapis.com",
      "artifactregistry.googleapis.com",
      "monitoring.googleapis.com",
      ...projectArgs,
      "--quiet",
    ]),
    step("discoverKeyRing", [
      "kms", "keyrings", "list",
      `--location=${REGION}`,
      `--filter=name=${keyRingName}`,
      "--format=json(name)",
      ...projectArgs,
    ]),
    step("createKeyRing", [
      "kms", "keyrings", "create", KEY_RING,
      `--location=${REGION}`,
      ...projectArgs,
      "--quiet",
    ]),
    step("discoverHmacKey", [
      "kms", "keys", "list",
      `--keyring=${KEY_RING}`,
      `--location=${REGION}`,
      `--filter=name=${hmacKeyName}`,
      "--format=json(name,purpose,versionTemplate)",
      ...projectArgs,
    ]),
    step("createHmacKey", [
      "kms", "keys", "create", HMAC_KEY,
      `--keyring=${KEY_RING}`,
      `--location=${REGION}`,
      "--purpose=mac",
      "--default-algorithm=hmac-sha256",
      "--protection-level=software",
      ...projectArgs,
      "--quiet",
    ]),
    step("discoverRefundKey", [
      "kms", "keys", "list",
      `--keyring=${KEY_RING}`,
      `--location=${REGION}`,
      `--filter=name=${refundKeyName}`,
      "--format=json(name,purpose,versionTemplate)",
      ...projectArgs,
    ]),
    step("createRefundKey", [
      "kms", "keys", "create", REFUND_KEY,
      `--keyring=${KEY_RING}`,
      `--location=${REGION}`,
      "--purpose=encryption",
      "--default-algorithm=google-symmetric-encryption",
      "--protection-level=software",
      ...projectArgs,
      "--quiet",
    ]),
    step("discoverWorkerServiceAccount", [
      "iam", "service-accounts", "list",
      `--filter=email=${WORKER_SERVICE_ACCOUNT}`,
      "--format=json(email)",
      ...projectArgs,
    ]),
    step("createWorkerServiceAccount", [
      "iam", "service-accounts", "create", "astera-security-worker",
      "--display-name=Astera Security Worker",
      ...projectArgs,
      "--quiet",
    ]),
    step("discoverWorkerFirestoreIamPolicy", [
      "projects", "get-iam-policy", PROJECT,
      "--format=json(bindings.role,bindings.members,bindings.condition)",
      ...projectArgs,
    ]),
    step("bindWorkerFirestoreUser", [
      "projects", "add-iam-policy-binding", PROJECT,
      `--member=serviceAccount:${WORKER_SERVICE_ACCOUNT}`,
      "--role=roles/datastore.user",
      ...projectArgs,
      "--quiet",
    ]),
    step("discoverSchedulerServiceAccount", [
      "iam", "service-accounts", "list",
      `--filter=email=${SCHEDULER_SERVICE_ACCOUNT}`,
      "--format=json(email)",
      ...projectArgs,
    ]),
    step("createSchedulerServiceAccount", [
      "iam", "service-accounts", "create", "astera-security-scheduler",
      "--display-name=Astera Security Scheduler",
      ...projectArgs,
      "--quiet",
    ]),
    step("discoverHmacIamPolicy", [
      "kms", "keys", "get-iam-policy", HMAC_KEY,
      `--keyring=${KEY_RING}`,
      `--location=${REGION}`,
      "--format=json",
      ...projectArgs,
    ]),
    step("bindVercelHmacSigner", [
      "kms", "keys", "add-iam-policy-binding", HMAC_KEY,
      `--keyring=${KEY_RING}`,
      `--location=${REGION}`,
      `--member=serviceAccount:${VERCEL_SERVICE_ACCOUNT}`,
      "--role=roles/cloudkms.signer",
      ...projectArgs,
      "--quiet",
    ]),
    step("bindWorkerHmacViewer", [
      "kms", "keys", "add-iam-policy-binding", HMAC_KEY,
      `--keyring=${KEY_RING}`,
      `--location=${REGION}`,
      `--member=serviceAccount:${WORKER_SERVICE_ACCOUNT}`,
      "--role=roles/cloudkms.viewer",
      ...projectArgs,
      "--quiet",
    ]),
    step("discoverRefundIamPolicy", [
      "kms", "keys", "get-iam-policy", REFUND_KEY,
      `--keyring=${KEY_RING}`,
      `--location=${REGION}`,
      "--format=json",
      ...projectArgs,
    ]),
    step("bindVercelRefundCrypto", [
      "kms", "keys", "add-iam-policy-binding", REFUND_KEY,
      `--keyring=${KEY_RING}`,
      `--location=${REGION}`,
      `--member=serviceAccount:${VERCEL_SERVICE_ACCOUNT}`,
      "--role=roles/cloudkms.cryptoKeyEncrypterDecrypter",
      ...projectArgs,
      "--quiet",
    ]),
    step("discoverArtifactRepository", [
      "artifacts", "repositories", "list",
      `--location=${REGION}`,
      `--filter=name=${artifactRepositoryName}`,
      "--format=json(name,format)",
      ...projectArgs,
    ]),
    step("createArtifactRepository", [
      "artifacts", "repositories", "create", ARTIFACT_REPOSITORY,
      "--repository-format=docker",
      `--location=${REGION}`,
      ...projectArgs,
      "--quiet",
    ]),
    step("prepareCloudRunDeployment", [
      "services", "describe", "run.googleapis.com",
      "--format=value(state)",
      ...projectArgs,
    ]),
    step("prepareSchedulerDeployment", [
      "services", "describe", "cloudscheduler.googleapis.com",
      "--format=value(state)",
      ...projectArgs,
    ]),
    step("prepareMonitoringDeployment", [
      "services", "describe", "monitoring.googleapis.com",
      "--format=value(state)",
      ...projectArgs,
    ]),
  ];
  return Object.freeze(commands);
}

/**
 * @param {string[]} argv
 * @param {{
 *   spawnSync?: (
 *     command: string,
 *     args: string[],
 *     options: { shell: false, encoding: "utf8", windowsHide: true },
 *   ) => { status: number | null, stdout?: unknown },
 *   log?: (line: string) => void,
 *   platform?: string,
 *   env?: Record<string, string | undefined>,
 * }} [dependencies]
 */
export function runProductionSecuritySetup(
  argv,
  {
    spawnSync = nodeSpawnSync,
    log = console.log,
    platform = process.platform,
    env = process.env,
  } = {},
) {
  const config = parseProductionSecurityArgs(argv);
  const commands = buildProductionSecurityCommands(config);
  const mode = config.apply ? "apply" : "dry-run";
  log(`mode=${mode}`);

  if (!config.apply) {
    for (const command of commands) {
      if (!command.name.startsWith("discover")) log(`action=${command.name}`);
    }
    return { mode, actions: commands.map(({ name }) => name) };
  }

  const state = Object.create(null);
  for (const command of commands) {
    if (shouldSkipCommand(command.name, state)) continue;
    log(`action=${command.name}`);
    const launch = resolveGcloudLaunch(command, platform, env);
    let result;
    try {
      result = spawnSync(launch.command, launch.args, {
        shell: false,
        encoding: "utf8",
        windowsHide: true,
      });
    } catch {
      throw new Error(`production_security_command_failed:${command.name}`);
    }
    if (result?.status !== 0) {
      throw new Error(`production_security_command_failed:${command.name}`);
    }
    recordDiscovery(command.name, result.stdout, state);
  }
  return { mode, actions: commands.map(({ name }) => name) };
}

function resolveGcloudLaunch(command, platform, env) {
  if (command.command !== "gcloud") {
    throw new Error("production_security_launcher_invalid");
  }
  if (platform !== "win32") return command;

  const systemRoot = String(env.SystemRoot ?? "").trim();
  const comSpec = String(env.ComSpec ?? "").trim();
  const normalizedSystemRoot = win32.normalize(systemRoot);
  if (!/^[A-Za-z]:\\Windows$/i.test(normalizedSystemRoot)) {
    throw new Error("production_security_windows_launcher_invalid");
  }
  const expectedComSpec = win32.join(normalizedSystemRoot, "System32", "cmd.exe");
  if (
    !win32.isAbsolute(comSpec)
    || win32.normalize(comSpec).toLowerCase() !== expectedComSpec.toLowerCase()
  ) {
    throw new Error("production_security_windows_launcher_invalid");
  }
  return {
    command: expectedComSpec,
    args: ["/d", "/s", "/c", "gcloud.cmd", ...command.args],
  };
}

function step(name, args) {
  return Object.freeze({ name, command: "gcloud", args: Object.freeze(args) });
}

function assertFixedConfig(config) {
  if (
    config?.project !== PROJECT
    || config?.region !== REGION
    || typeof config?.apply !== "boolean"
  ) {
    throw new Error("invalid_production_security_config");
  }
}

function shouldSkipCommand(name, state) {
  if (name === "updateWifProviderCondition") {
    return state.wifProviderConditionExact === true;
  }
  const resourceChecks = {
    createKeyRing: "keyRingExists",
    createHmacKey: "hmacKeyExists",
    createRefundKey: "refundKeyExists",
    createWorkerServiceAccount: "workerServiceAccountExists",
    createSchedulerServiceAccount: "schedulerServiceAccountExists",
    createArtifactRepository: "artifactRepositoryExists",
  };
  if (resourceChecks[name]) return state[resourceChecks[name]] === true;

  const bindings = {
    bindVercelHmacSigner: [
      "hmacBindings",
      "roles/cloudkms.signer",
      `serviceAccount:${VERCEL_SERVICE_ACCOUNT}`,
    ],
    bindWorkerHmacViewer: [
      "hmacBindings",
      "roles/cloudkms.viewer",
      `serviceAccount:${WORKER_SERVICE_ACCOUNT}`,
    ],
    bindVercelRefundCrypto: [
      "refundBindings",
      "roles/cloudkms.cryptoKeyEncrypterDecrypter",
      `serviceAccount:${VERCEL_SERVICE_ACCOUNT}`,
    ],
    bindWorkerFirestoreUser: [
      "workerFirestoreBindings",
      "roles/datastore.user",
      `serviceAccount:${WORKER_SERVICE_ACCOUNT}`,
    ],
  };
  const binding = bindings[name];
  return binding
    ? state[binding[0]]?.has(`${binding[1]}\0${binding[2]}`) === true
    : false;
}

function recordDiscovery(name, stdout, state) {
  if (!name.startsWith("discover")) return;
  const value = parseDiscoveryJson(stdout, name);
  switch (name) {
    case "discoverWifProvider":
      validateWifProviderBase(value, name);
      state.wifProviderConditionExact =
        value.attributeCondition === WIF_ATTRIBUTE_CONDITION;
      break;
    case "discoverVerifiedWifProvider":
      validateWifProviderBase(value, name);
      if (value.attributeCondition !== WIF_ATTRIBUTE_CONDITION) {
        throw new Error(`production_security_resource_incompatible:${name}`);
      }
      break;
    case "discoverRuntimeServiceAccountIamPolicy":
      validateRuntimeServiceAccountIamPolicy(value, name);
      break;
    case "discoverKeyRing":
      state.keyRingExists = validateResourceList(value, name, (resource) =>
        resource?.name === keyRingName);
      break;
    case "discoverHmacKey":
      state.hmacKeyExists = validateResourceList(value, name, (resource) =>
        resource?.name === hmacKeyName
        && resource?.purpose === "MAC"
        && resource?.versionTemplate?.algorithm === "HMAC_SHA256"
        && resource?.versionTemplate?.protectionLevel === "SOFTWARE");
      break;
    case "discoverRefundKey":
      state.refundKeyExists = validateResourceList(value, name, (resource) =>
        resource?.name === refundKeyName
        && resource?.purpose === "ENCRYPT_DECRYPT"
        && resource?.versionTemplate?.algorithm === "GOOGLE_SYMMETRIC_ENCRYPTION"
        && resource?.versionTemplate?.protectionLevel === "SOFTWARE");
      break;
    case "discoverWorkerServiceAccount":
      state.workerServiceAccountExists = validateResourceList(value, name, (resource) =>
        resource?.email === WORKER_SERVICE_ACCOUNT);
      break;
    case "discoverWorkerFirestoreIamPolicy":
      state.workerFirestoreBindings = validateIamPolicy(value, name, new Map([
        [`serviceAccount:${WORKER_SERVICE_ACCOUNT}`, "roles/datastore.user"],
      ]));
      break;
    case "discoverSchedulerServiceAccount":
      state.schedulerServiceAccountExists = validateResourceList(value, name, (resource) =>
        resource?.email === SCHEDULER_SERVICE_ACCOUNT);
      break;
    case "discoverHmacIamPolicy":
      state.hmacBindings = validateIamPolicy(value, name, new Map([
        [`serviceAccount:${VERCEL_SERVICE_ACCOUNT}`, "roles/cloudkms.signer"],
        [`serviceAccount:${WORKER_SERVICE_ACCOUNT}`, "roles/cloudkms.viewer"],
      ]));
      break;
    case "discoverRefundIamPolicy":
      state.refundBindings = validateIamPolicy(value, name, new Map([
        [
          `serviceAccount:${VERCEL_SERVICE_ACCOUNT}`,
          "roles/cloudkms.cryptoKeyEncrypterDecrypter",
        ],
        [`serviceAccount:${WORKER_SERVICE_ACCOUNT}`, null],
      ]));
      break;
    case "discoverArtifactRepository":
      state.artifactRepositoryExists = validateResourceList(value, name, (resource) =>
        resource?.name === artifactRepositoryName && resource?.format === "DOCKER");
      break;
    default:
      throw new Error(`production_security_discovery_invalid:${name}`);
  }
}

function parseDiscoveryJson(stdout, name) {
  try {
    return JSON.parse(typeof stdout === "string" ? stdout : "");
  } catch {
    throw new Error(`production_security_discovery_invalid:${name}`);
  }
}

function validateResourceList(value, name, isExact) {
  if (!Array.isArray(value) || value.length > 1) {
    throw new Error(`production_security_resource_incompatible:${name}`);
  }
  if (value.length === 0) return false;
  if (!isExact(value[0])) {
    throw new Error(`production_security_resource_incompatible:${name}`);
  }
  return true;
}

function validateWifProviderBase(value, name) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || value.state !== "ACTIVE"
    || !value.attributeMapping
    || typeof value.attributeMapping !== "object"
    || Array.isArray(value.attributeMapping)
    || value.attributeMapping["attribute.project_id"] !== "assertion.project_id"
  ) {
    throw new Error(`production_security_resource_incompatible:${name}`);
  }
}

function validateRuntimeServiceAccountIamPolicy(value, name) {
  if (!value || typeof value !== "object" || !Array.isArray(value.bindings)) {
    throw new Error(`production_security_resource_incompatible:${name}`);
  }
  let expectedMemberCount = 0;
  for (const binding of value.bindings) {
    if (typeof binding?.role !== "string" || !Array.isArray(binding?.members)) {
      throw new Error(`production_security_resource_incompatible:${name}`);
    }
    for (const member of binding.members) {
      if (typeof member !== "string") {
        throw new Error(`production_security_resource_incompatible:${name}`);
      }
      const isWorkloadIdentityPrincipalSet =
        member.startsWith("principalSet://iam.googleapis.com/projects/")
        && member.includes("/workloadIdentityPools/");
      if (isWorkloadIdentityPrincipalSet && member !== wifPrincipalSet) {
        throw new Error(`production_security_resource_incompatible:${name}`);
      }
      if (member !== wifPrincipalSet) continue;
      if (binding.role !== "roles/iam.workloadIdentityUser" || binding.condition) {
        throw new Error(`production_security_resource_incompatible:${name}`);
      }
      expectedMemberCount += 1;
    }
  }
  if (expectedMemberCount !== 1) {
    throw new Error(`production_security_resource_incompatible:${name}`);
  }
}

function validateIamPolicy(value, name, allowedTargetRoles) {
  if (!value || typeof value !== "object") {
    throw new Error(`production_security_resource_incompatible:${name}`);
  }
  const bindings = value.bindings ?? [];
  if (!Array.isArray(bindings)) {
    throw new Error(`production_security_resource_incompatible:${name}`);
  }
  const found = new Set();
  for (const binding of bindings) {
    if (typeof binding?.role !== "string" || !Array.isArray(binding?.members)) {
      throw new Error(`production_security_resource_incompatible:${name}`);
    }
    for (const member of binding.members) {
      if (!allowedTargetRoles.has(member)) continue;
      const allowedRole = allowedTargetRoles.get(member);
      if (binding.condition || allowedRole === null || binding.role !== allowedRole) {
        throw new Error(`production_security_resource_incompatible:${name}`);
      }
      found.add(`${binding.role}\0${member}`);
    }
  }
  return found;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runProductionSecuritySetup(process.argv.slice(2));
  } catch {
    console.error("production_security_setup_failed");
    process.exitCode = 1;
  }
}

export const productionSecurityResourceIdentity = Object.freeze({
  project: PROJECT,
  projectNumber: PROJECT_NUMBER,
  region: REGION,
});
