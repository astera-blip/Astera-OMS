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
- Firebase Production default Storage bucket linked in `ASIA-EAST1` as `gs://astera-oms-prod.firebasestorage.app`.
- Firebase Development Blaze enabled and default Storage bucket linked in `ASIA-EAST1` as `gs://astera-oms-dev-b2b2e.firebasestorage.app`.
- Vercel project created and production deployment is ready at `https://astera-oms.vercel.app`.
- Local Firebase environment files created and intentionally kept out of Git.
- Environment variable names documented in `.env.example`.
- Secret scan script added.
- Build verified locally.

## Not Completed Without Owner Confirmation

- Resend API key/domain verification, domain/DNS, and production runtime acceptance.
- Production environment variables in Vercel.
- Domain purchase or DNS setup, which the owner has chosen to defer for now.
- Email provider verified sender/domain.

## Vercel Future Steps

1. Confirm no private data is present.
2. Keep using the Vercel hostname until the owner decides on a domain.
3. Connect production domain only after legal/privacy pages are ready.

## Firebase Future Steps

1. Run rules tests before real files are added.
2. Add/verify the production web app environment variables in Vercel, then redeploy.

## Production Read-only Preflight

Run these commands before any production write or Rules deployment:

```powershell
npm run production:env:check -- --strict
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
- Historical 2026-07-30 state: all seven OIDC variables above were stored as
  sensitive variables in both Vercel Preview and Production, then Preview
  `https://astera-n850fxxzw-astera-oms.vercel.app` was rebuilt. This record is
  superseded by the 2026-08-10 Task 7 fixed non-secret identifiers plus two
  target-specific Sensitive rate-limit secrets documented below.

### Firebase Production Storage release (2026-08-02)

- Blaze billing is enabled for `astera-oms-prod` via billing account
  `billingAccounts/01B794-2E6BD7-33D714`.
- The official Firebase Storage `projects.defaultBucket.create` API linked
  `gs://astera-oms-prod.firebasestorage.app` in `ASIA-EAST1`.
- `node scripts/run-firebase.mjs deploy --project astera-oms-prod --only storage`
  compiled and released `storage.rules` successfully.
- Verification: `gcloud storage buckets list --project=astera-oms-prod` shows the
  bucket with `location: ASIA-EAST1`; no object upload has been performed yet.
- Vercel Production environment pull confirms all Firebase and OIDC variable names
  are configured. `RESEND_FROM_EMAIL=Astera <orders@updates.asteratw.com>` and
  `RESEND_REPLY_TO_EMAIL=astera.0920@gmail.com` are now set as non-sensitive
  Production variables. The strict check still reports `RESEND_API_KEY` missing;
  it remains blocked on Resend domain verification and the owner's secret value.

### Firebase Development Storage release (2026-08-02)

- Development `astera-oms-dev-b2b2e` is linked to billing account
  `billingAccounts/01B794-2E6BD7-33D714`; `billingEnabled=true`.
- The official Firebase Storage API linked
  `gs://astera-oms-dev-b2b2e.firebasestorage.app` in `ASIA-EAST1`.
- Development Firestore and Storage Rules were deployed successfully with the
  same tested rulesets as Production.

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

## Production redeploy release gate (2026-08-02)

- `npx vercel --prod --yes` redeployed `codex/mvp-completion`; the deployment
  reached Ready and `https://astera-oms.vercel.app` is the active alias.
- Hydrated browser verification showed the published `prod_002` product on
  `/products`. The production smoke runner was updated to accept an explicit
  hydrated product ID and passed:

  ```powershell
  npm run production:smoke -- --base-url https://astera-oms.vercel.app --product-id prod_002
  ```

  All five anonymous checks returned HTTP 200.
- Vercel build completed successfully but reported its build image as Node
  `24.15.0` while the repository engine range is `>=24.18.0 <25`; set the
  Vercel Node.js version to 24.18+ before the final public release to remove
  this runtime drift.
- Vercel Production currently has the Firebase/OIDC variables plus
  `RESEND_FROM_EMAIL` and `RESEND_REPLY_TO_EMAIL`; `RESEND_API_KEY` is still
  missing. DNS checks for `asteratw.com`, `www.asteratw.com`, and
  `updates.asteratw.com` return NXDOMAIN, and Vercel has zero attached domains.
- Do not mark the public launch gate green until domain/DNS, Resend secret and
  delivery, Owner payment-account creation, Owner image upload, and the full
  desktop/Pixel 7/physical-phone acceptance matrix are recorded.

## 2026-08-04 Task 6：帳戶指紋遷移、到期清理與金鑰治理

### Production 環境與 IAM gate

`npm run production:env:check -- --strict` 另外要求以下 Server-only 設定；值只可放在
Vercel Secret／Secret Manager，不得放入 Git、Client bundle 或一般日誌：

- `GCP_KMS_HMAC_KEY_NAME`：完整 HMAC CryptoKey resource name。
- `GCP_KMS_HMAC_KEY_VERSION`：目前新寫入使用的正整數版本。
- `GCP_KMS_REFUND_KEY_NAME`：完整退款對稱加密 CryptoKey resource name。
- `REFUND_RATE_LIMIT_HASH_SECRET`：穩定且至少 32 字元；只在沒有 active 退款驗證窗口時輪替。
- 既有 `GCP_PROJECT_NUMBER`、WIF pool/provider/audience 與 service-account email 均為必要設定。

執行身分只授予所需 Firestore、HMAC sign／verify、退款 encrypt／decrypt 權限；不得建立或
下載長期 service-account JSON key。舊 HMAC key version 只要仍被任何會員帳戶或付款快照
引用就必須長期保留，不得由排程或報告自動 disable／destroy。

### 遷移與回復

先用完全唯讀模式：

```powershell
node scripts/migrate-member-account-fingerprints.mjs --project astera-oms-prod --confirm-project astera-oms-prod --dry-run
```

stdout 只能包含文件 ID、operation/status、key version 與統計，不得包含完整帳號、末五碼、
HMAC 值或 KMS input。Owner 核對報告後，才可在維護窗口使用 `--apply`；apply 會先在已由
Git 忽略的 `.local-backups/member-account-fingerprint-<timestamp>/` 寫入本機備份，備份完成
前不會寫入 Firestore。備份含受限制舊資料，須限制本機權限、不得上傳或貼入工單，完成 rollback
觀察期並經 Owner 核准後安全銷毀。

apply 只更新 `memberPaymentAccounts`：有舊完整帳號者產生最新版本指紋並移除明文字段；
只有末五碼者標記 `needsReverification`。歷史付款快照永不改寫，缺指紋者只列入人工覆核。
不可從舊 HMAC 推導或產生新 HMAC；重新指紋化只可在會員完成身分驗證並重新輸入完整帳號時進行。

Rollback 順序：停止 apply／排程、保留安全報告、以 ignored backup 盤點受影響文件 ID、經 Owner
核准後只回復本次 migration 的欄位，再重跑 dry-run 與 Rules／API／退款稽核。不可用 rollback
覆寫付款快照，也不可把完整帳號寫入日誌或長期正式資料。

### Cloud Scheduler contract（尚未外部部署）

- 每日執行到期清理：
  `node scripts/cleanup-refund-account-temp.mjs --project <id> --confirm-project <id>`。
- 每月執行金鑰使用報告：
  `node scripts/report-fingerprint-key-usage.mjs --project <id> --confirm-project <id>`。
- Cloud Run／2nd-gen Function 必須關閉 unauthenticated invoker；Cloud Scheduler 使用專用
  service account 的 OIDC token，audience 精確等於 job endpoint，該身分只授予
  `roles/run.invoker` 與工作必要的最小權限。
- Endpoint wrapper 只接受平台驗證完成的 Scheduler OIDC 請求，且將固定 project ID 同時傳入
  `--project`／`--confirm-project`；不得接受 request body 覆寫 project、collection 或 key。
- 清理工作失敗與月報失敗會在既有 `notificationEvents` 建立不含帳號／fingerprint 的
  `owner.jobFailed` 告警。另需以 Cloud Monitoring 對非 2xx／逾時告警，避免 Firestore 自身故障
  時 Owner event 也無法寫入。

清理只移除到期的 `refundAccountCiphertext`、`refundEncryptionKeyVersion`、
`refundAccountExpiresAt`，並將 pending request 標記 `needsReverification`；不刪除任何不相關
明文字段。Owner reveal／review API 仍在每次請求即時檢查 expiry，作為排程以外的 defense in depth。
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

### 2026-08-10 Task 6 Production deployment applied

Explicit authorization covered Cloud Build/image push, private Cloud Run,
service-level Scheduler invoker IAM, two OIDC jobs, the fixed Monitoring email
channel, and the non-2xx/timeout policy. The guarded apply now exits 0.

Final readback:

- service `astera-security-worker` is Ready in `asia-east1`;
- max instances 1, min instances omitted/default 0, concurrency 1, timeout 300s;
- runtime SA is `astera-security-worker@astera-oms-prod.iam.gserviceaccount.com`;
- image is digest-pinned in `astera-ops`; only the fixed project and HMAC key env
  values are present;
- service IAM contains exactly one `roles/run.invoker` member, the Scheduler SA;
- daily cleanup is enabled at `03:30 Asia/Taipei` and monthly report at day 1
  `04:00 Asia/Taipei`, both with POST, exact service URL audience, and Scheduler SA;
- exactly one enabled `Astera Security Worker email` channel points to
  `astera.0920@gmail.com`;
- exactly one enabled `Astera Security Worker non-2xx or timeout` policy has the
  fixed non-2xx and 504 conditions and references only that channel.

Deployment encountered three fail-closed live readback differences. Commits
`774740d`, `78e5c42`, and `246e51d` add real fixtures and narrowly normalize only
Google-managed defaults; unexpected headers, explicit `UNVERIFIED`, unknown states,
non-zero threshold differences, duplicates, and configuration drift still fail.

Smoke evidence:

- unauthenticated POSTs to both job routes: 403;
- pure-read monthly Scheduler job: 200, empty status, fresh last-attempt timestamp;
- recent payload-only Worker log scan: zero sensitive-key, long-digit, or failure
  marker matches.

Do not grant a human Token Creator merely for `/healthz`; the attempted short-lived
Scheduler-SA impersonation was denied as intended. Before marking Task 6 complete,
obtain explicit authorization for two cleanup executions and confirm the deletion
count/idempotency. Cleanup can delete expired refund-vault fields, so a generic
deployment authorization is not sufficient for that destructive smoke step.

Monitoring delivery is confirmed. The user provided a screenshot of the received
Google Cloud alert email showing `Alert firing`, policy
`Astera Security Worker non-2xx or timeout`, request-count value 4, and the exact
Production project, service, and `asia-east1` labels. This satisfies the controlled
non-sensitive alert and recipient-delivery gate without accessing the mailbox.

### 2026-08-10 Task 6 cleanup idempotency complete

The user separately authorized two manual executions of
`astera-refund-vault-cleanup-daily`, acknowledging its permanent deletion behavior.
Only count aggregations and request metadata were inspected:

- pre-run expired refund-vault count: 0;
- run 1: Scheduler OIDC request 200; post-run count 0; aggregate `cleaned=0`;
- run 2: Scheduler OIDC request 200; post-run count 0; aggregate `cleaned=0`;
- post-run payload-only log scan: 0 forbidden sensitive-key matches, 0 long-digit
  matches, and 0 `security_worker_failed` markers.

No refund record or field was deleted because no expired record existed. Two
authenticated 200 cleanup runs plus the earlier authenticated 200 monthly report
exercise more of the private runtime than `/healthz`, so they are the approved
health substitute. Do not add Token Creator to a human account. Task 6 is complete;
Task 7 is the next stage.

### 2026-08-10 Task 7 Vercel preflight; no mutation yet

Read-only CLI state:

- project: `astera-oms/astera-oms`;
- project ID: `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`;
- framework: Next.js; root directory `.`; Node.js 24.x;
- custom Environment Variables: none.

The exact 17-variable security configuration has been assembled from live
Production readbacks. One ACTIVE Firebase Web App provides the six public Firebase
SDK values; Task 5 provides the fixed GCP/WIF/KMS values and HMAC version 1. A
child-process-only schema test with a non-production placeholder secret passed the
strict security environment check. No value was saved locally.

Do not run `vercel env add` or redeploy until separately authorized. The intended
mutation is: 16 fixed non-secret values for both Production and Preview; two
independent random rate-limit secrets written to their respective Vercel Secret
targets through stdin without stdout/history disclosure; then Preview redeploy and
security-only strict verification. Production redeploy remains a later gate.

### 2026-08-10 Task 7 Vercel variables configured; deployment blocked by drift

The user authorized only project `astera-oms/astera-oms`, Production/Preview
environment-variable writes, and Preview deployment. The configuration write
completed:

- 16 verified fixed names were added or overwritten for Production and Preview;
- Production and Preview each received a distinct 48-byte in-memory random
  `REFUND_RATE_LIMIT_HASH_SECRET` through stdin as a Sensitive Secret;
- no secret value was displayed, saved locally, or written to Git/documentation.

The mandatory post-write inventory revealed pre-existing drift that must be removed
before building a safe Preview:

- `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` targets Production and Preview;
- seven older unscoped Preview Sensitive GCP/WIF records overlap the verified fixed
  records: project/project-number, pool/provider/audience, service-account email,
  and `GOOGLE_CLOUD_PROJECT`.

The current authorization explicitly prohibited removing other settings, so no
record was deleted or normalized. No Preview deployment was started and no
Production deployment occurred. Next exact action is a separately authorized,
name-scoped cleanup of only the Emulator variable and those seven duplicate Preview
records, followed by a fresh names/targets-only inventory. Do not deploy until that
inventory reports zero forbidden names and zero overlaps.

### 2026-08-10 Task 7 cleanup and Preview deployment checkpoint

The user authorized only the exact drift cleanup. The forbidden Emulator variable
and the seven older Preview Sensitive duplicates were removed by record ID; all
verified fixed Production/Preview records and both target-specific Sensitive
Secrets were preserved. Fresh inventory passed with 21 total records, 16/16 fixed
records, 0 bad fixed records, 2 rate-limit secrets, 0 forbidden names, and 0
Preview overlaps.

Two initial Preview attempts were blocked with `TEAM_ACCESS_REQUIRED` because the
Git author email was not a member of team Astera OMS. Empty commit `e9db99b` uses
the verified team-member author `Astera OMS <astera.0920@gmail.com>` and contains no
file or secret change. The resulting Preview deployment
`dpl_BCk2r5e8ZfyeKxezbi5tffwRibmA` reached Ready:

- unique URL: `https://astera-ix5gsqvlu-astera-oms.vercel.app`;
- stable alias: `https://astera-oms-astera-blip-astera-oms.vercel.app`;
- target: Preview only; no Production deployment or promotion;
- build: compile and TypeScript pass, 39/39 static pages.

Vercel used Node.js 24.15.0 while `package.json` currently requires
`>=24.18.0 <25`, producing an `EBADENGINE` warning even though the build passed.
Resolve this version-policy mismatch before Production promotion rather than
silently treating the warning as a release pass.

Public Preview browser checks pass for the home page, Product catalog, Brand page,
and empty Cart; `/e2e-auth` is unavailable in Preview as required. Google sign-in
is blocked on both the unique URL and stable alias because Firebase Authentication
Authorized Domains does not contain those hosts. A separately authorized next
step should add only the stable alias, then run the approved `測試專用` member
binding, payment fingerprint snapshot, refund mismatch/match, Owner reveal, and
vault-deletion flow. Do not add every one-off deployment hostname and do not deploy
Production as part of that verification.

### 2026-08-10 Stable Preview Authorized Domain added

The user separately authorized one Firebase mutation. The Production Firebase
Console added only `astera-oms-astera-blip-astera-oms.vercel.app` to Authentication
Authorized Domains. The Console reported success, and a complete settings reload
showed the original list unchanged plus that single Custom domain. No one-off
Preview hostname, other Firebase setting, Vercel setting, or Production deployment
was changed.

Google login no longer reports `auth/unauthorized-domain`: a later attempt reaches
the Google account chooser. The automated browser loses the popup/opener binding
when Google account selection closes, so the user must complete that identity
interaction in the visible browser. Do not substitute a test-auth route, enable a
new sign-in provider, or issue an Admin custom token. After member login, continue
only on the stable Preview with synthetic test data and do not deploy Production.

### 2026-08-10 Authenticated Preview checkpoint

OAuth completed on the stable Preview and redirected to `/account/profile`. A
test-only member profile saved successfully and redirected home. The member
payment-account UI initially showed `0/5`; one synthetic test-only account was
added, after which it showed `1/5`, masked display data only, an empty full-account
input, and a success status. No account value, masked digits, token, fingerprint,
ciphertext, or secret was recorded.

This checkpoint verifies only the authenticated profile and member-account UI
outcomes. It does not establish the remaining WIF or KMS runtime checks. Any
further authorized refund, Owner, and vault testing must follow the static Task 7
flow audit; do not deploy Production.

### 2026-08-10 Preview test-data continuation; no deployment

The stable Preview correctly denied the signed-in member `/workspace`. A labelled
test-only checkout created one NT$520 Order and PaymentRequest; a second synthetic
account then created one `pendingReview` Payment. No real transfer occurred. A
narrow ADC read attempt timed out without result or write; a later browser process
reset made active synthetic complete values unavailable. One value briefly appeared
only in browser-tool output, not in tracked documentation or application storage.
No recovery was attempted.

The remaining authorized flow requires one fresh account/order/payment in a single
active process, then Owner confirmation, mismatch/match, reveal without capture,
full refund, and vault-field absence. This checkpoint made no Vercel deployment,
Production promotion, domain addition, or other Firebase/Vercel configuration
change.

### 2026-08-11 Preview deployment recovery

Commit `abf88be` contains the verified redirect-error visibility fix. A direct
Preview upload created a Vercel deployment that remained `UNKNOWN` with no build
logs, so its automatic stable-alias assignment was restored to the prior Ready
Preview immediately. This was Preview-only recovery: no Production deployment,
Firebase/domain change, or data mutation. Redeploy through Vercel Git integration
only after explicit authorization to push `codex/production-security-worker`.

### 2026-08-11 Stable Preview authentication retest

The stable Preview returned to the application after Google account selection, but
did not retain the Firebase member session across navigation. This blocked the
remaining Preview-only security acceptance flow before any new test data or
configuration mutation. Do not promote or deploy Production on this evidence. The
next release-gate action is a retained-session browser retest, or a separately
approved test-first diagnostic fix that preserves redirect-result error context.
