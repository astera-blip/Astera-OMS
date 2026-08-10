# Deployment Readiness

This project is prepared for deployment, but production deployment is intentionally not completed until the owner logs in and confirms external service settings.

## Prepared Automatically

- GitHub repository connected.
- `main` branch pushed.
- GitHub Actions CI workflow added.
- GitHub Actions confirmed on `main`.
- CI blocks high-severity production dependency audit failures.
- Node.js version pinned in `.node-version` and `.nvmrc`.
- Firebase configuration files added.
- Firebase development project connected: `astera-oms-dev-b2b2e`.
- Firebase production project connected: `astera-oms-prod`.
- Firebase Google Authentication provider enabled for both projects.
- Firebase web apps registered for development and production.
- Firestore databases created for development and production in `asia-east1`.
- Firebase Storage buckets intentionally not created yet.
- Vercel project created and production deployment is ready at `https://astera-oms.vercel.app`.
- Local Firebase environment files created and intentionally kept out of Git.
- Environment variable names documented in `.env.example`.
- Secret scan script added.
- Build verified locally.

## Not Completed Without Owner Confirmation

- Firebase Storage bucket creation. `ASIA-EAST1` was selected, but bucket creation was skipped to avoid upgrading or adding billing before the owner is ready.
- Production environment variables in Vercel.
- Domain purchase or DNS setup, which the owner has chosen to defer for now.
- Email provider verified sender/domain.

## Vercel Future Steps

1. Confirm no private data is present.
2. Keep using the Vercel hostname until the owner decides on a domain.
3. Connect production domain only after legal/privacy pages are ready.

## Firebase Future Steps

1. Decide when to enable billing if `ASIA-EAST1` Storage is still required.
2. Create Storage buckets for development and production.
3. Run rules tests before real files are added.
4. Add the production web app environment variables to Vercel after import.

## Production Read-only Preflight

Run these commands before any production write or Rules deployment:

```powershell
npm run production:env:check
npm run production:products:audit -- --project astera-oms-prod --confirm-project astera-oms-prod
npm run production:smoke -- --base-url https://astera-oms.vercel.app
```

- The environment checker prints variable names and `configured` / `missing` only.
- The product audit uses Application Default Credentials and performs Firestore reads only.
- `--project` must exactly match `--confirm-project`; this prevents accidental inspection of the wrong project.
- The smoke command sends no credentials and requires HTTPS.
- Full backup, comparison, rollout, rollback, and recovery steps are in
  `docs/SOP/正式資料備份與商品同步SOP.md`.

Before deployment, verify both `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` and
`NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH` are absent or set to `false`.

## Vercel OIDC / GCP Workload Identity

The app is prepared to use Vercel OIDC instead of a long-lived service-account
JSON key. Firebase Admin initialization reads these Vercel environment variable
names:

- `GOOGLE_CLOUD_PROJECT=astera-oms-prod`
- `GCP_PROJECT_ID=astera-oms-prod`
- `GCP_PROJECT_NUMBER=1032606875618`
- `GCP_WORKLOAD_IDENTITY_POOL_ID=vercel-oidc`
- `GCP_WORKLOAD_IDENTITY_PROVIDER_ID=vercel`
- `GCP_WORKLOAD_IDENTITY_AUDIENCE=//iam.googleapis.com/projects/1032606875618/locations/global/workloadIdentityPools/vercel-oidc/providers/vercel`
- `GCP_SERVICE_ACCOUNT_EMAIL=astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com`

Known Vercel project ID:

- `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`

Prepared setup script:

```powershell
.\scripts\setup-vercel-gcp-oidc.ps1 `
  -ProjectId "astera-oms-prod" `
  -ProjectNumber "1032606875618" `
  -VercelProjectId "prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ"
```

The script requires `gcloud` on PATH and creates/updates:

- required Google Cloud APIs;
- service account `astera-vercel-admin`;
- Workload Identity Pool `vercel-oidc`;
- OIDC Provider `vercel`;
- `roles/iam.workloadIdentityUser` binding restricted to the Vercel project ID.

After the script prints the environment variable names/values, add those names
to Vercel Production and Preview environments, redeploy, then test
`POST /api/member/profile`, `/api/cart`, and Owner Product save.

### Completed configuration (2026-07-30)

- GCP service account created:
  `astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com`.
- Workload Identity Pool `vercel-oidc` and Provider `vercel` are active. The
  Provider accepts only the documented audience and maps the Vercel project ID
  claim.
- The service account has only `roles/datastore.user`,
  `roles/firebaseauth.viewer`, and `roles/storage.objectViewer`; it has no
  downloaded private key.
- `roles/iam.workloadIdentityUser` is restricted to Vercel Project
  `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`.
- All seven OIDC variables above were stored as sensitive variables in both
  Vercel Preview and Production, then a Preview was rebuilt successfully:
  `https://astera-n850fxxzw-astera-oms.vercel.app`.

The next release verification is authenticated: save a member profile, update
the cart, and save an Owner Product on that Preview. These operations must
succeed before promoting the branch to Production.

## GitHub Actions

The CI workflow runs on push and pull request to `main`:

- dependency install
- lint
- typecheck
- unit tests
- secret scan
- high-severity audit
- production build
- Firestore and Storage Rules tests
- regular desktop / Pixel 7 Playwright
- authenticated Auth / Firestore / Storage Emulator Playwright

If GitHub Actions is disabled or requires billing confirmation, the workflow file can remain in the repo and run after the owner enables Actions.

## 2026-08-09 Production security worker — dry run and read-only preflight

`node scripts/setup-production-security.mjs --project astera-oms-prod --confirm-project astera-oms-prod`
exited 0 with `mode=dry-run`, listing only fixed API, KMS, service-account,
key-level IAM, Artifact Registry, Cloud Run, Scheduler, and Monitoring
preparation actions. No cloud command or mutation ran.

The approved design remains: `asia-east1` key ring `astera-oms-security`; Software
`member-account-fingerprint` (`MAC` / `HMAC_SHA256`) and `refund-account-vault`
(`ENCRYPT_DECRYPT` / Google symmetric) keys; Vercel-only key-level signer and
encrypter/decrypter bindings; worker and Scheduler service accounts; `astera-ops`
Docker repository; private `astera-security-worker` Cloud Run service
(`min-instances=0`, `max-instances=1`, `concurrency=1`); daily 03:30 and monthly
day-1 04:00 Asia/Taipei jobs; and `Astera Security Worker non-2xx or timeout`.
Unauthenticated invocation and project-wide KMS roles are prohibited.

Read-only state on 2026-08-09: project ID/number, active `vercel-oidc` /
`vercel`, runtime service account, its three existing project roles, and its exact
Vercel-project `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ` principal-set binding matched.
The provider maps `attribute.project_id` from the assertion but has no separate
`attributeCondition`; the verified principal-set binding is the scope enforcement.
Only Monitoring API is enabled; KMS, Run, Scheduler, Cloud Build, and Artifact
Registry APIs are disabled. Thus planned KMS resources, repository, service, and
jobs are unverified while API disabled; only the IAM service-account lists can
establish absence. No named Monitoring policy was
listed; the email channel was not verified because local gcloud lacks the optional
beta channel command and no component was installed.

Cost: two active Software KMS versions are roughly USD 0.12/month before
free/usage effects; two Scheduler jobs are within the usual three-job allowance;
Cloud Run `min-instances=0` should remain near free tier at MVP volume, but billing
alerts are required. Future rollback: disable Scheduler jobs, remove exact
service-level invoker and key IAM bindings, then delete Cloud Run; never destroy a
KMS version while a fingerprint or payment snapshot references it. Docker remains
a parked gate because `docker build -f ops/security-worker/Dockerfile -t
astera-security-worker:test .` cannot run locally without Docker.

Next mutation, not executed:
`node scripts/setup-production-security.mjs --project astera-oms-prod --confirm-project astera-oms-prod --apply`.

### Review correction — WIF condition is a BLOCKER

This correction supersedes the preceding preflight interpretation of Provider
scope and resource presence. The empty Provider `attributeCondition` is a
load-bearing BLOCKER: do not grant any KMS permission or run the security
`--apply` command while it is empty. The matching `principalSet` binding remains
required as a second layer; it does not waive the Provider condition requirement.

gcloud `update-oidc --help` confirms that `--attribute-condition` accepts a CEL
boolean expression over `assertion`. Before KMS rollout, an authorized change
must set and then read back exactly this condition (these commands are remediation
instructions, not executed here):

```text
gcloud iam workload-identity-pools providers update-oidc vercel --location=global --workload-identity-pool=vercel-oidc --project=astera-oms-prod --attribute-condition='assertion.project_id == "prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ"'
gcloud iam workload-identity-pools providers describe vercel --location=global --workload-identity-pool=vercel-oidc --project=astera-oms-prod --format="value(attributeCondition)"
```

Review must confirm the read-back condition and the existing exact principal set
before unblocking KMS. Fixed identifiers: project `astera-oms-prod` / number
`1032606875618`, region `asia-east1`, ring `astera-oms-security`, keys
`member-account-fingerprint` and `refund-account-vault`, Vercel SA
`astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com`, Worker SA
`astera-security-worker@astera-oms-prod.iam.gserviceaccount.com`, Scheduler SA
`astera-security-scheduler@astera-oms-prod.iam.gserviceaccount.com`, repository
`astera-ops`, Cloud Run service `astera-security-worker`, jobs
`astera-refund-vault-cleanup-daily` (daily 03:30 Asia/Taipei) and
`astera-fingerprint-key-report-monthly` (day 1 monthly 04:00 Asia/Taipei), and
Monitoring policy `Astera Security Worker non-2xx or timeout` to email
`astera.0920@gmail.com`.

For every disabled API, all planned resource state is **unverified while API
disabled**, not confirmed absent. Only the Worker and Scheduler service-account
lists returned no match through an enabled IAM API. The security `--apply`
command remains BLOCKED pending the tested Provider-condition remediation and
review.

Fresh post-remediation readback is also a BLOCKER gate (commands below are not
executed here):

```text
gcloud iam workload-identity-pools providers describe vercel --location=global --workload-identity-pool=vercel-oidc --project=astera-oms-prod --format="json(state,attributeMapping,attributeCondition)"
gcloud iam service-accounts get-iam-policy astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com --project=astera-oms-prod --flatten="bindings[]" --filter="bindings.role=roles/iam.workloadIdentityUser AND bindings.members:principalSet://iam.googleapis.com/projects/1032606875618/locations/global/workloadIdentityPools/vercel-oidc/attribute.project_id/prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ" --format="table(bindings.role,bindings.members)"
```

All four must pass together: Provider state `ACTIVE`; mapping
`attributeMapping.attribute.project_id == assertion.project_id`; condition exactly
`assertion.project_id == "prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ"`; and the runtime SA
binding exactly `roles/iam.workloadIdentityUser` for the stated principal set.
The exact inventory also includes Pool `vercel-oidc`, Provider `vercel`, Vercel
project `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`, and API IDs
`cloudkms.googleapis.com`, `run.googleapis.com`, `cloudscheduler.googleapis.com`,
`cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, and
`monitoring.googleapis.com`. KMS and security `--apply` remain BLOCKED until all
four fresh readbacks pass and are reviewed.

### 2026-08-10 Task 5 authorization checkpoint

The WIF preflight in `1c8387f` has an approved review result. Worker Firestore
IAM changes in `3bec6e9` and `5961b9a` also passed approved re-review. Fresh
controller evidence passed: focused 52/52, full Unit 43 files / 334 tests,
TypeScript, ESLint, secret scan, and document diff check.

The guarded apply is READY in code but remains BLOCKED pending explicit user
authorization. It remediates the Provider condition and adds the Worker exact
`roles/datastore.user` binding; Scheduler receives no project-wide role. No cloud
command or `--apply` has run. The only next command is:

```text
node scripts/setup-production-security.mjs --project astera-oms-prod --confirm-project astera-oms-prod --apply
```

It must not continue to API/KMS work until readback proves Provider `ACTIVE`, the
exact mapping, exact Vercel-project condition, and exact `principalSet`. Docker
build remains unverified because Docker CLI is unavailable.

### 2026-08-09 Task 5 apply authorization retry

The user replied with a general approval, but the managed execution safety review
rejected the live command before it started because the approval did not explicitly
name the complete Production blast radius. No WIF, API, KMS, IAM, service-account,
or Artifact Registry mutation occurred.

The next attempt must use the same reviewed command only after the user explicitly
authorizes changes to `astera-oms-prod` covering the WIF Provider condition, six
approved APIs, both KMS keys, Worker and Scheduler service accounts, the Worker
Firestore role, key-level KMS IAM, and the `astera-ops` Artifact Registry repository.

### 2026-08-10 Task 5 Production security apply complete

The user explicitly authorized the complete Task 5 scope. Three fail-closed
compatibility stops exposed Windows gcloud behavior before later actions; reviewed
fixes `abd32a6`, `7cb07d1`, and `861a99f` replaced unsupported/projected reads with
standard JSON and exact enabled-API validation. Final controller evidence passed:
focused 35/35, full Unit 43 files / 340 tests, TypeScript, ESLint, secret scan, and
diff check. The final idempotent apply exited 0.

Readback confirms project `astera-oms-prod` / `1032606875618`; Provider `vercel`
is ACTIVE with the exact mapping, condition, and Vercel-project principal set;
all six approved APIs are enabled; HMAC key version 1 is `HMAC_SHA256`, SOFTWARE,
ENABLED; refund key primary version 1 is `GOOGLE_SYMMETRIC_ENCRYPTION`, SOFTWARE,
ENABLED. Vercel has only HMAC signer and refund encrypter/decrypter on the
individual keys. Worker has HMAC viewer plus project `roles/datastore.user`, and
no refund-key crypto grant. Scheduler has no project-wide role. Both service
accounts are active and `astera-ops` is a Docker repository in `asia-east1`.

No Cloud Run service, Scheduler job, or Monitoring policy was deployed in Task 5.
Those remain Task 6. Local Docker image construction also remains unverified because
this host has no Docker CLI.

### 2026-08-10 Task 6 source ready; live deployment blocked

Task 6 deployment tooling commits `2e246e2` and hardening fix `1ac6d13` passed
independent review: all three High and two Medium findings are addressed, Spec PASS,
Quality APPROVED. Latest implementer evidence passed focused 42/42, Unit 44 files /
374 tests, TypeScript, ESLint, Build, secret scan, and diff checks. Safe dry-run
prints only seven fixed actions.

No Task 6 Cloud Build, image push, Cloud Run service, service-level invoker binding,
Scheduler job, Monitoring channel/policy, authenticated smoke test, or alert test has
run. Controller fresh full verification was attempted but the managed-execution
usage limit rejected it before command start; retry is available after 2026-08-16
10:05.

After fresh verification and explicit Task 6 Production authorization, the exact
mutation command is:

```text
node scripts/deploy-production-security-worker.mjs --project astera-oms-prod --confirm-project astera-oms-prod --apply
```

The first run may create an email notification channel and stop safely while it is
`UNVERIFIED`. The operator must complete the Google email verification; only a
subsequent readback of `VERIFIED` permits alert-policy creation. Never bypass this
gate. Budget-alert state and current Worker/Scheduler/Monitoring resource absence
must also be read back before authorization.

### 2026-08-10 Task 6 controller gate and Production preflight

The earlier managed-execution limit is no longer active. Fresh controller checks
passed focused 42/42, Unit 44 files / 374 tests, TypeScript, ESLint, Next.js Build,
secret scan, diff check, and the seven-action dry-run.

Read-only Production state:

- Billing is enabled through `billingAccounts/01B794-2E6BD7-33D714`.
- Cloud Run service `astera-security-worker` is absent in `asia-east1`.
- Both fixed Scheduler jobs are absent in `asia-east1`.
- No matching `Astera Security Worker email` channel exists.
- No matching `Astera Security Worker non-2xx or timeout` policy exists.
- `billingbudgets.googleapis.com` is disabled, so Budget Alert state is unverified.

Design requires a Budget Alert before deployment. The next allowed mutation is
only to enable `billingbudgets.googleapis.com` after explicit authorization, then
rerun the read-only budget list. Do not run Task 6 `--apply` before this gate passes.

### 2026-08-10 Billing Budget API enabled and alert verified

The user authorized only API enablement and a read-only Budget inventory. The
following mutation completed successfully on `astera-oms-prod`:

```text
gcloud services enable billingbudgets.googleapis.com --project=astera-oms-prod --quiet
```

Readback for `billingAccounts/01B794-2E6BD7-33D714` found the existing budget
`Firebase Project astera-oms-prod`, scoped only to project number `1032606875618`:

- monthly amount: TWD 200;
- thresholds: 50%, 90%, and 100% of current spend;
- all credits included;
- default Billing Account Administrator/User email recipients are not disabled.

No Budget was created, modified, or deleted. No Cloud Build, Artifact Registry push,
Cloud Run, service IAM, Scheduler, Monitoring channel, or alert-policy mutation ran.
The Budget gate passes. The next exact step is separate explicit authorization for
the reviewed Task 6 apply blast radius before running the guarded command.
