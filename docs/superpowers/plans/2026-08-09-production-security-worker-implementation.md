# Production Security Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `astera-oms-prod` 啟用不可匯出的 Cloud KMS 金鑰、既有 Vercel Workload Identity 的最小權限，以及由 Cloud Scheduler 以 OIDC 呼叫的私有 Cloud Run 治理 Worker。

**Architecture:** 將既有退款暫存清除與 HMAC key usage 月報抽成可注入依賴的 Server-only job functions，CLI 與 Cloud Run Worker 共用同一套邏輯。Production 資源由 dry-run-first 的設定工具建立；Vercel 只取得兩把 key 的必要權限，Worker 只取得 Firestore 與 HMAC key metadata viewer，Scheduler 只取得指定 Cloud Run service 的 invoker 權限。

**Tech Stack:** Node.js 24、ES modules、Firebase Admin SDK、Firestore、Cloud KMS、Google Cloud Run、Cloud Scheduler、Cloud Monitoring、Vercel OIDC／Workload Identity、Vitest。

## Global Constraints

- Production project 固定為 `astera-oms-prod`，project number 固定為 `1032606875618`，region 固定為 `asia-east1`。
- Key ring 固定為 `astera-oms-security`。
- HMAC key 固定為 `member-account-fingerprint`，purpose `MAC`，algorithm `HMAC_SHA256`，protection level `SOFTWARE`。
- Refund key 固定為 `refund-account-vault`，purpose `ENCRYPT_DECRYPT`，algorithm `GOOGLE_SYMMETRIC_ENCRYPTION`，protection level `SOFTWARE`。
- Vercel runtime service account 固定為 `astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com`。
- Worker service account 固定為 `astera-security-worker@astera-oms-prod.iam.gserviceaccount.com`。
- Scheduler invoker service account 固定為 `astera-security-scheduler@astera-oms-prod.iam.gserviceaccount.com`。
- Cloud Run service 固定為 `astera-security-worker`；禁止 unauthenticated invoker，`min-instances=0`、`max-instances=1`、`concurrency=1`。
- Scheduler jobs 固定為 `astera-refund-vault-cleanup-daily`（每日 03:30 Asia/Taipei）與 `astera-fingerprint-key-report-monthly`（每月 1 日 04:00 Asia/Taipei）。
- Monitoring email channel 固定寄送至既有客服信箱 `astera.0920@gmail.com`；alert policy 固定為 `Astera Security Worker non-2xx or timeout`。
- CLI 與 infrastructure scripts 預設唯讀／dry-run；任何 Production mutation 必須同時提供 `--apply --project astera-oms-prod --confirm-project astera-oms-prod`。
- 不使用 Service Account JSON private key；Vercel 使用既有 `vercel-oidc` Pool／Provider。
- 不在 stdout、Cloud Logging、Scheduler body、Git 或聊天輸出完整帳號、HMAC canonical input、fingerprint、ciphertext 或完整 secret。
- Worker 不可取得 HMAC sign、refund encrypt 或 refund decrypt 權限；只取得 HMAC key metadata viewer。
- Vercel 的 KMS 權限必須綁在 individual CryptoKey，不可授予 project-wide KMS role。
- `REFUND_RATE_LIMIT_HASH_SECRET` 至少 32 字元，僅存於 Vercel Secret；不可由程式碼或呼叫端指定 HMAC key version。
- 舊 HMAC key version 只要仍被會員帳戶或付款 snapshot 引用就不得停用或銷毀。

---

### Task 1: Extract reusable refund-governance job functions

**Files:**
- Create: `ops/security-worker/job-functions.mjs`
- Modify: `scripts/cleanup-refund-account-temp.mjs`
- Modify: `scripts/report-fingerprint-key-usage.mjs`
- Modify: `tests/unit/fingerprintMigration.test.ts`

**Interfaces:**
- `runRefundAccountCleanup({ db, FieldValue, project, now }): Promise<{ ok: true; project: string; cleaned: number }>`
- `runFingerprintKeyUsageReport({ db, project, now, listKnownKeyVersions }): Promise<{ ok: true; project: string; report: FingerprintKeyUsageReport }>`
- `emitGovernanceJobFailure({ db, project, job, occurredAt }): Promise<void>`
- Existing CLI arguments and safe stdout contracts remain unchanged.

- [ ] **Step 1: Write failing shared-job tests.**

Add tests proving dependency injection, idempotent cleanup, safe aggregate results,
monthly key-version statistics, and `owner.jobFailed` creation without raw errors:

```ts
it("runs cleanup without accepting a caller-selected project", async () => {
  const result = await runRefundAccountCleanup({
    db: fakeDbWithExpiredVault(),
    FieldValue: fakeFieldValue,
    project: "astera-oms-prod",
    now: new Date("2026-08-09T00:00:00.000Z"),
  });
  expect(result).toEqual({ ok: true, project: "astera-oms-prod", cleaned: 1 });
});

it("reports a safe failure event", async () => {
  const writes: unknown[] = [];
  await emitGovernanceJobFailure({
    db: fakeNotificationDb(writes),
    project: "astera-oms-prod",
    job: "refundAccountCleanup",
    occurredAt: new Date("2026-08-09T00:00:00.000Z"),
  });
  expect(JSON.stringify(writes)).not.toContain("ciphertext");
  expect(JSON.stringify(writes)).not.toContain("accountFingerprint");
});
```

- [ ] **Step 2: Run the focused test and verify RED.**

Run: `npx vitest run tests/unit/fingerprintMigration.test.ts`

Expected: FAIL because `ops/security-worker/job-functions.mjs` and its exports do not exist.

- [ ] **Step 3: Move Firestore job orchestration into the shared module.**

The shared module owns the collection reads, transaction updates, safe report
assembly, and failure-event write. It receives Firebase SDK objects through its
arguments and never initializes an app or reads process arguments.

```js
export async function runRefundAccountCleanup({ db, FieldValue, project, now }) {
  assertProductionJobInput(project, now);
  const records = await loadExpiredRecords(db, now);
  const plan = buildExpiredRefundCleanupPlan(records, now);
  const cleaned = await applyCleanupPlan(db, FieldValue, plan, now);
  return { ok: true, project, cleaned };
}
```

- [ ] **Step 4: Convert both CLI files into thin adapters.**

Each CLI continues to parse exact project confirmation, initialize ADC Firebase
Admin, call the shared function, print only safe JSON, emit a safe failure event,
and exit non-zero on failure.

- [ ] **Step 5: Run focused and full unit verification.**

Run:

```text
npx vitest run tests/unit/fingerprintMigration.test.ts tests/unit/productionScripts.test.ts
npm run test:unit
npm run typecheck
npm run lint
```

Expected: all commands exit 0 and existing CLI behavior remains compatible.

- [ ] **Step 6: Commit.**

```text
git add ops/security-worker/job-functions.mjs scripts/cleanup-refund-account-temp.mjs scripts/report-fingerprint-key-usage.mjs tests/unit/fingerprintMigration.test.ts
git commit -m "refactor: share refund governance jobs"
```

### Task 2: Build the private Cloud Run worker

**Files:**
- Create: `ops/security-worker/server.mjs`
- Create: `ops/security-worker/package.json`
- Create: `ops/security-worker/package-lock.json`
- Create: `ops/security-worker/Dockerfile`
- Create: `tests/unit/productionSecurityWorker.test.ts`

**Interfaces:**
- `createSecurityWorker({ project, initializeDependencies, now }): http.RequestListener`
- `POST /jobs/refund-account-cleanup`
- `POST /jobs/fingerprint-key-usage`
- `GET /healthz`
- All other paths return `404`; non-POST job calls return `405`.
- Cleanup success returns `{ ok: true, job: "refundAccountCleanup", cleaned: number }`.
- Report success returns `{ ok: true, job: "fingerprintKeyUsageReport", versionCount: number, malformedMemberAccounts: number, malformedPaymentSnapshots: number }` and never returns document IDs or fingerprints.
- Health success returns `{ ok: true }`.

- [ ] **Step 1: Write failing HTTP contract tests.**

```ts
it("runs only the fixed cleanup job for the fixed project", async () => {
  const response = await invokeWorker("POST", "/jobs/refund-account-cleanup");
  expect(response.status).toBe(200);
  expect(response.json).toEqual({ ok: true, job: "refundAccountCleanup", cleaned: 1 });
  expect(runCleanup).toHaveBeenCalledWith(expect.objectContaining({
    project: "astera-oms-prod",
  }));
});

it.each([
  ["GET", "/jobs/refund-account-cleanup", 405],
  ["POST", "/jobs/unknown", 404],
])("rejects %s %s", async (method, path, status) => {
  expect((await invokeWorker(method, path)).status).toBe(status);
});
```

- [ ] **Step 2: Run the worker test and verify RED.**

Run: `npx vitest run tests/unit/productionSecurityWorker.test.ts`

Expected: FAIL because the server module does not exist.

- [ ] **Step 3: Implement the minimal HTTP worker.**

The server reads only `GOOGLE_CLOUD_PROJECT`, requires exact value
`astera-oms-prod`, initializes Firebase Admin with ADC, and returns safe aggregate
JSON. It never accepts project, key, document IDs, or account data in request body,
query parameters, or headers. Cloud Run IAM is the authentication boundary.

```js
const routes = new Map([
  ["/jobs/refund-account-cleanup", runCleanupRoute],
  ["/jobs/fingerprint-key-usage", runKeyReportRoute],
]);
```

- [ ] **Step 4: Add isolated runtime packaging.**

`ops/security-worker/package.json` uses Node `>=24.18.0 <25` and contains only
`@google-cloud/kms` and `firebase-admin`. The Dockerfile uses
`node:24.18.0-bookworm-slim`, runs `npm ci --omit=dev`, exposes `$PORT`, uses the
non-root `node` user, and starts `node server.mjs`.

- [ ] **Step 5: Verify worker behavior and container construction.**

Run:

```text
npx vitest run tests/unit/productionSecurityWorker.test.ts tests/unit/fingerprintMigration.test.ts
npm run typecheck
npm run lint
docker build -t astera-security-worker:test ops/security-worker
```

Expected: tests and static checks exit 0; Docker image builds without copying root
`.env*`, `.git`, `.local-backups`, test artifacts, or documentation.

- [ ] **Step 6: Commit.**

```text
git add ops/security-worker tests/unit/productionSecurityWorker.test.ts
git commit -m "feat: add private refund governance worker"
```

### Task 3: Add dry-run-first Production infrastructure tooling

**Files:**
- Create: `scripts/setup-production-security.mjs`
- Create: `tests/unit/productionSecurityInfrastructure.test.ts`
- Modify: `scripts/check-production-env.mjs`
- Modify: `tests/unit/productionScripts.test.ts`

**Interfaces:**
- `parseProductionSecurityArgs(argv): { project: "astera-oms-prod"; apply: boolean; region: "asia-east1" }`
- `buildProductionSecurityCommands(config): ReadonlyArray<{ name: string; command: string; args: string[] }>`
- `node scripts/setup-production-security.mjs --project astera-oms-prod --confirm-project astera-oms-prod`
- Mutation additionally requires `--apply`.
- `node scripts/check-production-env.mjs --scope security --strict` validates Firebase/WIF/KMS/rate-limit variables without requiring Resend.

- [ ] **Step 1: Write failing argument and command-plan tests.**

```ts
it("defaults to dry-run and exact production resources", () => {
  const config = parseProductionSecurityArgs([
    "--project", "astera-oms-prod",
    "--confirm-project", "astera-oms-prod",
  ]);
  expect(config).toMatchObject({ apply: false, region: "asia-east1" });
  expect(buildProductionSecurityCommands(config)).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "enableApis" }),
    expect.objectContaining({ name: "createHmacKey" }),
    expect.objectContaining({ name: "bindVercelHmacSigner" }),
  ]));
});

it("rejects every non-production project or missing confirmation", () => {
  expect(() => parseProductionSecurityArgs([
    "--project", "astera-oms-dev-b2b2e",
    "--confirm-project", "astera-oms-dev-b2b2e",
    "--apply",
  ])).toThrow("production_project_required");
});
```

- [ ] **Step 2: Run focused tests and verify RED.**

Run:

```text
npx vitest run tests/unit/productionSecurityInfrastructure.test.ts tests/unit/productionScripts.test.ts
```

Expected: FAIL because the setup module and security-only environment scope do not exist.

- [ ] **Step 3: Implement idempotent resource discovery and command planning.**

The command plan enables `cloudkms.googleapis.com`, `run.googleapis.com`,
`cloudscheduler.googleapis.com`, `cloudbuild.googleapis.com`,
`artifactregistry.googleapis.com`, and `monitoring.googleapis.com`; creates the
fixed key ring, keys, service accounts, Artifact Registry repository `astera-ops`,
and exact key-level IAM bindings only when absent. Dry-run prints resource names
and actions but never values, access tokens, IAM policies, secrets, or account data.

- [ ] **Step 4: Add explicit mutation execution.**

`--apply` executes the precomputed `gcloud` argv arrays with `shell: false`, stops
at the first non-zero exit, and emits only a safe step name. It never invokes
`gcloud auth`, never changes the active project, and passes `--project
astera-oms-prod` to every applicable command.

- [ ] **Step 5: Add the security-only environment gate.**

`--scope security --strict` requires project aliases, WIF settings, KMS key names,
positive HMAC key version, Firebase public config, Storage bucket, and the stable
rate-limit secret. The existing default strict scope continues to require Resend.

- [ ] **Step 6: Verify and commit.**

Run:

```text
npx vitest run tests/unit/productionSecurityInfrastructure.test.ts tests/unit/productionScripts.test.ts
npm run test:unit
npm run typecheck
npm run lint
npm run check:secrets
```

Expected: all commands exit 0; dry-run output contains no secret or sensitive bank data.

```text
git add scripts/setup-production-security.mjs scripts/check-production-env.mjs tests/unit/productionSecurityInfrastructure.test.ts tests/unit/productionScripts.test.ts
git commit -m "ops: add production security provisioning gates"
```

### Task 4: Validate the infrastructure plan without mutation

**Files:**
- Modify: `docs/14_Deployment.md`
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`
- Create: `.superpowers/sdd/2026-08-09-production-security-worker-implementation/production-dry-run.txt` (ignored evidence only)

**Interfaces:**
- Dry-run must report the exact resources from Global Constraints.
- Production state reads use explicit `--project astera-oms-prod` and never rely on the active gcloud project.

- [ ] **Step 1: Run the local provisioning dry-run.**

Run:

```text
node scripts/setup-production-security.mjs --project astera-oms-prod --confirm-project astera-oms-prod
```

Expected: exit 0, `mode=dry-run`, and an action list containing API enablement,
two KMS keys, two service accounts, key-level IAM, Artifact Registry, Cloud Run,
Scheduler, and Monitoring preparation without executing them.

- [ ] **Step 2: Compare the dry-run to current read-only cloud state.**

Read-only checks must confirm project number `1032606875618`, existing
`vercel-oidc` Pool/Provider, Vercel project binding
`prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`, and existing Vercel runtime service account.
Any mismatch is a blocker; do not apply.

- [ ] **Step 3: Update deployment and handoff records.**

Record exact resources, current API/KMS/IAM state, dry-run result, expected cost,
rollback procedure, and the next approved mutation command. Do not record secret
values, access tokens, full bank accounts, fingerprints, or ciphertext.

- [ ] **Step 4: Verify documentation and commit only safely isolated hunks.**

Run: `git diff --check -- docs/14_Deployment.md docs/16_MVPCompletionPlan.md docs/17_ProjectHandoff.md`

If any document contains pre-existing user-owned hunks that cannot be safely
isolated, leave it unstaged and record the exact blocker in the SDD ledger. Never
stage an entire mixed document by assumption.

### Task 5: Apply KMS and least-privilege IAM resources

**Files:**
- No source change unless the dry-run exposes a tested provisioning defect.
- Update ignored SDD evidence and handoff status only.

**Interfaces:**
- Exact command:

```text
node scripts/setup-production-security.mjs --project astera-oms-prod --confirm-project astera-oms-prod --apply
```

- [ ] **Step 1: Confirm the authenticated principal and billing project.**

Expected active principal: an authorized Owner of `astera-oms-prod`. Verify Blaze
billing remains linked and the project number is `1032606875618`. Stop if either
value differs.

- [ ] **Step 2: Apply API, KMS, service-account, and key-level IAM creation.**

The script may enable the approved APIs and create the fixed resources. It must
not deploy the Worker or Scheduler until source verification in Task 6 passes.

- [ ] **Step 3: Read back the effective state.**

Verify:

- HMAC key purpose is `MAC`, algorithm is `HMAC_SHA256`, primary version is enabled;
- refund key purpose is `ENCRYPT_DECRYPT` with a primary enabled version;
- Vercel runtime has signer only on the HMAC key and encrypter/decrypter only on the refund key;
- Worker has viewer only on the HMAC key and no crypto operation permission;
- Scheduler invoker has no project-wide role.

- [ ] **Step 4: Record environment identifiers without secrets.**

Record complete KMS resource names and the positive HMAC version number in the
ignored evidence file and deployment checklist. Do not generate the rate-limit
secret in a command whose output is captured.

### Task 6: Deploy and verify the private Worker and Scheduler

**Files:**
- Create: `scripts/deploy-production-security-worker.mjs`
- Create: `tests/unit/productionSecurityDeployment.test.ts`
- Modify: `docs/14_Deployment.md`

**Interfaces:**
- `node scripts/deploy-production-security-worker.mjs --project astera-oms-prod --confirm-project astera-oms-prod` is dry-run.
- Mutation additionally requires `--apply`.
- Deploys `astera-security-worker` from `ops/security-worker` with authentication required.

- [ ] **Step 1: Write failing deployment-plan tests.**

Assert exact region, service name, service account, `min=0`, `max=1`,
`concurrency=1`, no `--allow-unauthenticated`, two OIDC Scheduler jobs, exact
audience equal to the deployed service URL, and fixed Asia/Taipei schedules.

- [ ] **Step 2: Implement the dry-run deployment planner and guarded executor.**

The planner builds argv arrays for Cloud Run deploy, service-level
`roles/run.invoker`, Scheduler creation/update, and Monitoring policy creation.
Mutation requires exact project confirmation and uses `shell: false`.

- [ ] **Step 3: Run focused and full local checks.**

Run:

```text
npx vitest run tests/unit/productionSecurityDeployment.test.ts tests/unit/productionSecurityWorker.test.ts
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run check:secrets
```

Expected: all commands exit 0.

- [ ] **Step 4: Apply the deployment.**

Run:

```text
node scripts/deploy-production-security-worker.mjs --project astera-oms-prod --confirm-project astera-oms-prod --apply
```

Expected: Cloud Run service is private, both Scheduler jobs are enabled, and no
`allUsers` or `allAuthenticatedUsers` invoker binding exists.

- [ ] **Step 5: Run authenticated smoke tests.**

Use an identity token with audience equal to the Cloud Run URL. Call `/healthz`,
then each job route once. Verify cleanup is idempotent, the report is read-only,
unauthenticated calls return 401/403, and no response/log contains sensitive data.

- [ ] **Step 6: Verify Monitoring and commit.**

Trigger one controlled non-sensitive `405` response, verify alert policy
`Astera Security Worker non-2xx or timeout` receives the non-2xx metric and sends
to `astera.0920@gmail.com` without logging request data, then commit the deployment
tool and its tests.

```text
git add scripts/deploy-production-security-worker.mjs tests/unit/productionSecurityDeployment.test.ts docs/14_Deployment.md
git commit -m "ops: deploy refund governance worker"
```

### Task 7: Configure Vercel security environment and run release gates

**Files:**
- Modify: `docs/14_Deployment.md`
- Modify: `docs/10_TestPlan.md`
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

**Interfaces:**
- `npm run production:env:check -- --scope security --strict`
- Existing full gate remains `npm run production:env:check -- --strict`.

- [ ] **Step 1: Add non-secret Vercel Production and Preview identifiers.**

Set the verified project, WIF, service-account, KMS key names, and HMAC version.
Confirm no Emulator/Test Auth variable is present in either environment.

- [ ] **Step 2: Add the stable rate-limit secret without disclosure.**

Generate at least 32 cryptographically random bytes directly into the Vercel
Secret input. Do not display, copy into documentation, save locally, or include in
shell history. Apply the same stable value to Production and Preview only if both
environments intentionally share the Production backend; otherwise use separate
values and document only that they are configured.

- [ ] **Step 3: Redeploy Preview and verify WIF/KMS access.**

Run the security-only environment gate, then perform authenticated member binding,
payment fingerprint snapshot, refund mismatch, refund match, Owner reveal, and
vault deletion tests with records explicitly named `測試專用`. Do not use a real
bank account or real payment.

- [ ] **Step 4: Run the full local release gate.**

Run:

```text
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run firebase:rules:test
npm run test:e2e:emulated
npm run check:secrets
npm run audit:production
```

Expected: every command exits 0. Existing ExcelJS transitive UUID moderate
advisories may remain documented; no high or critical production advisory is allowed.

- [ ] **Step 5: Update handoff and stop before migration apply.**

Record KMS, IAM, Worker, Scheduler, Monitoring, Preview, and test results. The next
Production data step is migration dry-run and ignored local backup. Do not run
`--apply` migration in this task; it requires its own exact user confirmation after
the dry-run report has been reviewed.

- [ ] **Step 6: Commit safely isolated documentation and push only after authorization.**

Never include unrelated dirty UI, reconciliation, product, or user documentation
changes. If the required documentation hunks cannot be isolated, leave them
unstaged and record the exact continuation step in the SDD ledger.
