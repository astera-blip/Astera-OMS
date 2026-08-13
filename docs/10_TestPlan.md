# Test Plan

## Day 1 Checks

- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd run test:unit`
- `npm.cmd run check:secrets`
- `npm.cmd audit --audit-level=high`
- `npm.cmd run build`
- `npm.cmd run firebase:version`
- `npm.cmd run firebase:rules:test` once Firebase Emulator is ready on the machine.
- Confirm no `.env` or secret files are tracked.
- Confirm Firebase rules are deny-by-default.

## MVP Required Checks

- Firestore rules emulator tests.
- Storage rules emulator tests.
- Google login flow test.
- First-login member profile completion test.
- Member can read own data but not another member's data.
- Public storefront cannot access private cost, CRM, finance, or audit data.
- Admin role checks for product/order/member operations.
- Order item snapshot preservation test.
- Manual payment confirmation audit log test.
- Production tool contract tests: argument confirmation, secret-safe reporting,
  anonymous HTTPS smoke, and mutation-free projection audit.

## Continuous Integration

- `verify`: ESLint, TypeScript, Unit tests, secret scan, production dependency audit, and production build.
- `firebase-rules`: Java 21 plus Firestore and Storage Emulator Rules tests.
- `playwright`: public Chromium desktop and Pixel 7 smoke tests.
- `playwright-emulated`: Auth, Firestore, and Storage Emulator owner/member flows.
- Playwright failures upload `test-results` traces without environment secrets.
- Production runtime rejects Emulator and E2E-auth public flags.

## Later Workflow Tests

- Cart and checkout flow.
- Order item cancellation request and admin review.
- Waitlist ordering and notification deadline.
- Payment allocation across multiple orders.
- Overpayment retained as an unallocated amount for manual bank refund; no Wallet.
- Underpayment to receivable.
- Supplement payment creation.
- Export logging for sensitive data.

## Production Acceptance Commands

The following commands are read-only and must run before a production release:

```powershell
npm run production:env:check
npm run production:products:audit -- --project astera-oms-prod --confirm-project astera-oms-prod
npm run production:smoke -- --base-url https://astera-oms.vercel.app --product-id prod_002
```

`--product-id` must reference a currently published public Product. Replace
`prod_002` if that test Product is archived or superseded.

`production:products:audit` compares Product IDs and counts, Variant/Campaign
counts, immutable SKU formats, projected prices, public image fields, and absence
of private Product fields. A non-zero exit blocks migration or release.

## 2026-08-02 Payment page regression

- Regression source: Firestore PaymentRequest `createdAt` Timestamp rendered as
  a React object on `/payments`.
- Test: `tests/unit/paymentRepository.test.ts` must normalize `toDate()` and
  `{ seconds, nanoseconds }` values to ISO strings.
- Production result: `/payments` HTTP 200 after redeploy; anonymous page has no
  browser errors. Authenticated member submission remains a manual acceptance
  step because it requires the member's Google session and an actual transfer.

## 2026-08-02 Payment selection and delivery regression

- Unit `tests/unit/paymentReport.test.ts` covers distribution of one transfer
  across two selected requests and remaining-balance allocation.
- UI contract verifies checkbox PaymentRequest selection, Owner payment-account
  settings entry, and absence of family-mart/address/store-information checkout
  controls.
- Production browser snapshot verifies only the disabled `7-Eleven 賣貨便`
  delivery option. Authenticated two-request reporting remains a manual gate.

## 2026-08-02 ProductWorkspace overflow regression

- Added a source contract for `min-w-0` grid tracks and full-width controls in
  Variant/Campaign forms; the contract was red before the fix and green after.
- UI contract: 14/14; Workspace UI Playwright: 4 passed, 2 expected auth-gate
  skips on desktop/mobile; TypeScript, ESLint, Build and Production smoke 5/5.

## 2026-08-02 Overpayment regression

- The emulated member payment/cancellation flow previously found a regression
  where a 700 TWD report for a 640 TWD request stored zero unallocated amount.
- The API now preserves the 60 TWD excess on the linked Payment. Focused E2E
  passed on desktop and mobile (2/2), and focused payment Unit tests passed
  (8/8).

## 2026-08-02 Storefront redesign verification

- Unit: 39 files / 178 tests.
- Firestore/Storage Rules: 31 tests.
- Public Playwright: desktop and Pixel 7, 14 passed / 2 skipped.
- Firebase Emulator Playwright: desktop and Pixel 7, 31 passed / 3 skipped.
- TypeScript, ESLint, production build, secret scan, and production dependency
  audit all passed.
- Production/Preview authenticated Google, Resend, Storage upload, and real
  bank-account acceptance remain external/manual gates.

## 2026-08-09 Bank-account fingerprint rollout final verification

Task 1–7 functional evidence:

- Task 7 protected API／Emulator acceptance was independently rerun before this
  handoff: 36 passed, 8 expected skips, 0 failed. It covers authenticated
  account binding, non-blocking duplicate detection, server-authoritative
  payment snapshots, refund fingerprint mismatch／match, Owner reveal, vault
  deletion, and Member／Helper permission denial.
- The Emulator-only KMS provider requires both
  `PLAYWRIGHT_USE_FIREBASE_EMULATORS=true` and project
  `demo-astera-oms`. Production does not meet this dual guard and continues to
  require Cloud KMS.
- Final independent review found four Important refund-verification findings.
  Fixes `4999e4c`, `6bf9f9d`, and `a276aa0` closed them, including mixed
  cancellation replay identity and legacy replay fail-closed handling. The
  final focused re-review was approved: 0 Critical, 0 Important, 0 Minor.

Fresh Task 8 command evidence:

| Command | Exit | Result |
| --- | ---: | --- |
| `npm run typecheck` | 0 | TypeScript passed. |
| `npm run lint` | 0 | ESLint passed with no reported warnings or errors. |
| `npm run test:unit` | 0 | 46 files／310 tests passed. |
| `npm run build` | 0 | Next.js production build passed. |
| `npm run firebase:rules:test` | 0 | Full Firestore／Storage Rules suite passed, 32 tests. |
| `npm run test:e2e:emulated` | 0 | Full Auth／Firestore／Storage Emulator suite passed: 36 passed, 8 expected skipped, 0 failed. |
| `npm run check:secrets` | 0 | No obvious secrets detected. |
| `npm run audit:production` | 0 | No high／critical production dependency vulnerability. |

The NanoID production override is now `3.3.17`, closing the prior high advisory.
Two remaining UUID advisories are moderate and arrive transitively through
ExcelJS; forcing their remediation would require a breaking／downgrade change to
ExcelJS, so they are documented as a non-blocking dependency follow-up.

Captured Task 8 stdout did not print full account values, HMAC fingerprints, or
HMAC canonical inputs. The local verification release gate is complete;
Production KMS／IAM／Scheduler, migration, Preview acceptance, and Production
rollout remain external gates.
## 2026-08-10 Task 6 security deployment gate

Source commits `2e246e2` and `1ac6d13` have TDD evidence and independent review.
Latest implementer evidence passed focused 42/42, Unit 44 files / 374 tests,
TypeScript, ESLint, Build, secret scan, and diff checks. Controller re-review passed
Spec and Quality with all five security findings addressed.

Controller fresh execution remains required before live apply. The attempted
sandbox-external run was rejected by the Codex managed-execution usage limit before
any command started; retry no earlier than 2026-08-16 10:05. Then run the focused
tests, full Unit, TypeScript, ESLint, Build, secret scan, diff check, and safe dry-run.
Do not treat subagent evidence alone as the final release gate.

### 2026-08-10 Task 6 controller gate resumed

The managed-execution limit no longer blocks local verification. Fresh controller
execution passed focused **42/42**, full Unit **44 files / 374 tests**, TypeScript,
ESLint, Next.js production Build, secret scan, diff check, and exact dry-run.

Production read-only preflight found no existing Worker Cloud Run service, no two
fixed Scheduler jobs, and no matching Monitoring channel/policy. Billing is linked,
but `billingbudgets.googleapis.com` is disabled, so the mandatory pre-deployment
Budget Alert cannot yet be verified. Live Task 6 apply remains blocked until that
API is explicitly enabled and the budget inventory is reviewed.

### 2026-08-10 Billing Budget gate passed

With explicit narrow authorization, `billingbudgets.googleapis.com` was enabled on
`astera-oms-prod`. A read-only budget inventory returned one monthly project-scoped
Budget Alert: TWD 200 with current-spend thresholds at 50%, 90%, and 100%.
`notificationsRule` does not disable default IAM recipients, so the standard Billing
Account Administrator/User email notifications remain active. No Budget was created,
modified, or deleted, and no Task 6 deployment ran. The Budget pre-deployment gate
is now satisfied; live apply still requires separate explicit authorization.

### 2026-08-10 Task 6 deployment and partial Production smoke

The user authorized the reviewed Task 6 blast radius. Guarded apply ultimately
exited 0 after three live-readback compatibility fixes were completed with TDD:

- accept only Cloud Scheduler's fixed `User-Agent: Google-Cloud-Scheduler` default;
- follow the Monitoring API contract that only explicit `UNVERIFIED` is unusable;
- normalize an omitted Monitoring `thresholdValue` to the protobuf default zero.

Fresh post-fix verification passed focused 33/33, full Unit 44 files / 374 tests,
TypeScript, ESLint, Next.js Build (39 pages), secret scan, and diff check. Production
readback verifies Worker Ready, max instances 1, concurrency 1, exact runtime SA,
fixed image digest/env, one Scheduler-only service-level invoker, two enabled OIDC
jobs, one enabled email channel, and one enabled two-condition alert policy.

Unauthenticated POSTs to both job routes return 403. A manual run of the pure-read
monthly key-usage job returned 200 through Scheduler OIDC. A payload-only scan of
the recent Worker logs found zero forbidden sensitive-field names, zero 10–16 digit
number matches, and zero `security_worker_failed` markers.

Monitoring delivery is now verified. The user supplied a received-email screenshot
showing `Alert firing` for policy `Astera Security Worker non-2xx or timeout`, exact
project `astera-oms-prod`, service `astera-security-worker`, region `asia-east1`, and
request-count value 4. This is accepted as the controlled non-sensitive non-2xx
delivery test; no mailbox access or additional notification mutation was performed.

Task 6 cleanup/idempotency is also complete. With explicit destructive-test
authorization, count-only Firestore aggregations returned 0 expired refund-vault
records before run 1, after run 1, and after run 2. Both Scheduler OIDC cleanup
requests returned 200, so aggregate `cleaned=0` twice and no data was deleted. A
post-run payload-only scan again found zero sensitive-key, 10–16 digit, or Worker
failure matches. The authenticated 200 monthly and cleanup routes exercise IAM,
runtime, Firestore, and KMS and are accepted as stronger evidence than `/healthz`;
no persistent human Token Creator permission was added.

### 2026-08-10 Task 7 Vercel security environment preflight

Read-only Vercel CLI inspection confirms project `astera-oms/astera-oms`, project ID
`prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`, Next.js preset, and Node.js 24.x. `vercel env ls`
returned zero custom variables. Therefore the security-only strict check cannot pass
in the current deployment; the local empty-environment run reported all 17 required
names missing.

Firebase CLI auth was expired, so no CLI data was used. Read-only Firebase
Management API via ADC confirmed one ACTIVE Production Web App and returned the six
public SDK values. Combining those with the verified Task 5 GCP/WIF/KMS identifiers,
HMAC version 1, and a preflight-only 32+ character placeholder made
`production:env:check -- --scope security --strict` exit 0. No `.env` file, Vercel
variable, secret, or deployment was created.

Next gate requires explicit Vercel mutation authorization: add the 16 non-secret
fixed values to Production and Preview, generate two independent random
`REFUND_RATE_LIMIT_HASH_SECRET` values directly through stdin into Vercel Secret
storage, verify names without reading values, and redeploy Preview only.

### 2026-08-10 Task 7 environment write and drift gate

The authorized write completed for project `astera-oms/astera-oms`: all 16 fixed
names target Production and Preview, and separate hidden Sensitive Secret records
exist for Production and Preview. The two 48-byte values were generated in memory,
sent through stdin, cleared, and never printed or persisted.

The required post-write names/targets-only check did **not** pass. It found one
pre-existing forbidden name, `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`, targeting both
Production and Preview. It also found older unscoped Preview Sensitive records for
seven GCP/WIF names that overlap the verified fixed records. No Git branch scope was
present on those records. Therefore Preview deployment and WIF/KMS flow testing were
not started; Production was not deployed.

Retest after separately authorized drift cleanup:

1. list Vercel names, types, targets, and branch metadata without values;
2. require zero Emulator/Test Auth matches;
3. require exactly one effective record per fixed key and target;
4. deploy Preview only and inspect the build/deployment result;
5. continue with the strict security check and approved non-real-bank flow.

### 2026-08-10 Task 7 drift cleanup, Preview, and local release gate

The separately authorized name-scoped cleanup completed without touching any other
Vercel setting. Fresh metadata-only inventory returned:

- 21 total Environment Variable records;
- 16/16 verified fixed records, with zero bad target/type records;
- two `REFUND_RATE_LIMIT_HASH_SECRET` Sensitive Secret records, one each for
  Preview and Production;
- zero `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` records;
- zero overlapping Preview records for the seven GCP/WIF names.

Preview deployment `dpl_BCk2r5e8ZfyeKxezbi5tffwRibmA` is Ready at
`https://astera-ix5gsqvlu-astera-oms.vercel.app`, with stable alias
`https://astera-oms-astera-blip-astera-oms.vercel.app`. The build compiled, passed
TypeScript, and generated 39/39 static pages. Browser checks passed `/`,
`/products`, `/brand`, and the empty `/cart`; `/e2e-auth` correctly returned 404.
Both Preview hosts currently reject Google sign-in because neither host is in
Firebase Authentication Authorized Domains. Therefore authenticated WIF/KMS and
refund-security flow verification remains open.

`vercel env run -e preview` cannot decrypt a Sensitive Environment Variable after
creation, so its local strict check reports only `REFUND_RATE_LIMIT_HASH_SECRET`
as missing. The two target-specific metadata records and the variable name in the
successful Vercel build are the non-disclosing configuration evidence; the secret
must not be downgraded to a readable variable to satisfy that local command.

Fresh local release evidence:

- TypeScript, ESLint, and Next.js production Build (39 pages): pass;
- Unit: 44 files / 374 tests pass;
- Firestore and Storage Rules: 2 files / 32 tests pass;
- Emulator Playwright: 34 passed / 8 intentionally skipped / 0 failed;
- secret scan, production dependency audit, and `git diff --check`: pass;
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.

The first full Emulator Playwright run found two stale Pixel 7 workspace-label
assertions. The assertions were aligned with the current bilingual accessible
names, focused Pixel 7 verification passed 3/3, and the full rerun produced the
34/8/0 result above.

### 2026-08-10 Task 7 Firebase Authorized Domain checkpoint

With exact user authorization, Firebase Authentication Authorized Domains was
read in the Production Console, and only
`astera-oms-astera-blip-astera-oms.vercel.app` was added. Firebase displayed a
success confirmation; a full settings reload preserved every prior domain and
showed exactly that one additional Custom domain. No unique deployment hostname
or other Firebase setting was added, removed, or edited.

The first Preview login attempt after the change returned
`auth/network-request-failed`; a subsequent attempt reached the Google account
chooser. The prior `auth/unauthorized-domain` blocker is therefore cleared. OAuth
then completed on the stable Preview and redirected to `/account/profile`. A
test-only member profile saved successfully and redirected home.

The authenticated member payment-account check started at `0/5`. One synthetic
test-only member payment account was added successfully; the UI then showed `1/5`,
only bank-code and masked-account display data, an empty full-account input, and a
success status. No account value, masked digits, token, fingerprint, ciphertext,
or secret is recorded here.

Read-only source audit also identified two acceptance constraints: paid refund
mismatch/match submission and Owner refund-account reveal are currently API-only;
immediate vault removal requires the full approved refund path to reach Order
`refunded`. No test payment or refund record has been created at this checkpoint.

The next authenticated acceptance segment verified that a member receives the
owner/helper gate at `/workspace`, and that a clearly labelled test checkout can
create an NT$520 Order and PaymentRequest without a real transfer. A second
synthetic account was saved and created one `pendingReview` Payment. A narrowly
scoped ADC Firestore read timed out with no result and no write; a later browser
process reset made active synthetic full values unavailable. One value briefly
appeared only in browser-tool output, not in tracked documentation or application
storage. A fresh one-pass account/order/payment is therefore required for
refund-match acceptance. The remaining expected sequence is Owner confirm, one
mismatch rejection, one match, reveal without response capture, full approved
refund, and vault-field absence. Outputs remain boolean/aggregate only.

### 2026-08-11 Redirect diagnostic build gate

The diagnostic error-retention fix is committed as `abf88be`. Its regression test
was red then green; Unit 44 files / 375 tests, TypeScript, ESLint, Build (39 pages),
secret scan, and diff check passed locally. A direct Vercel Preview deployment
remained `UNKNOWN` with a zero-ms build and no logs, so it is invalid evidence. The
stable Preview alias was restored to the earlier Ready deployment. The next test
gate is a Git-integrated Preview after explicit branch-push authorization.

### 2026-08-11 Stable Preview session-retention retest

Google account selection was completed on the stable Preview, but subsequent
application navigation rendered the signed-out state and `/account/bank-accounts`
again required login. No account, order, payment, refund, or configuration mutation
was attempted. This is an authentication-observability blocker: the redirect-result
error is currently cleared when Firebase reports signed-out, so the actual error code
is not visible. Retest the full security flow only after a browser retains the member
session; otherwise use a separately approved, test-first diagnostic change.

### 2026-08-11 Payment-report idempotency regression

- Unit covers key validation, deterministic opaque IDs, canonical payload digests,
  sequential replay, serialized concurrent replay, conflict, legitimate new keys,
  safe member output, Owner claim enforcement, rejection idempotency, and forbidden
  confirmed／reversed rejection.
- Emulator Playwright covers one rapid-double-click member submission, persistent
  status after reload, API replay, sanitized history, Owner rejection, rejected
  Payment state, and `payment.rejected` Audit Log creation.

## Guest storefront homepage acceptance (2026-08-11)

- Unit contracts cover the real `/` section order, public-only wording, `ASTERA` Header,
  Campaign deadline copy, minimal pending cart intent validation, and resilient states.
- `tests/e2e/public-home.spec.ts` covers buyer hierarchy, 390／768／1365px column counts,
  horizontal overflow, seeded `productsPublic`, and authenticated pending-intent resume.
- Focused results: regular public Playwright 16 passed／10 expected Emulator-only skips;
  Auth／Firestore／Storage Emulator public-home Playwright 10 passed.
- Fresh totals: Unit 55 files／444 tests; Rules 2 files／32 tests; regular Playwright
  18 passed／30 expected skips; Emulator Playwright 38 passed／10 expected skips.

## 2026-08-13 Taishin batch reconciliation acceptance

- Unit coverage verifies Taishin `.xlsx` parsing, transaction fingerprinting,
  pending-Payment grouping, unique／ambiguous／unmatched／insufficient／duplicate
  classification, Owner authorization, preview responses, forged selection
  rejection, and transactional batch confirmation.
- `tests/e2e/workspace-taishin-reconciliation.spec.ts` creates an in-memory
  synthetic workbook at runtime. It verifies two safe matches plus one unmatched
  row, `全選可安全認列`, manual deselection, confirmation of only the retained
  selection, Firestore state changes, and duplicate detection after reimport.
- The dedicated Emulator Playwright run passed 1/1. No real bank workbook,
  transaction row, account fragment, or original remark is committed or retained.
- Fresh release evidence for this batch: Unit 62 files／481 tests, Firestore＋Storage
  Rules 2 files／32 tests, Emulator Playwright 54 passed／10 expected skips,
  TypeScript, ESLint, Build (43 pages), secret scan, and production dependency
  audit all passed; audit reported 0 vulnerabilities.
- Preview acceptance may upload the real workbook for parse／match preview only.
  Batch recognition of real transactions remains an explicit Owner action and is
  outside automated or unattended acceptance.

### Real Taishin merged-footer regression

- A workbook may end with a merged A:F export note. ExcelJS exposes the merged master
  text as the same value in every cell of that row; this row must be ignored only when
  it follows all transactions and is neither a valid transaction date nor an amount.
- A malformed row before a later valid transaction must still reject the entire file.
  This prevents the footer exception from weakening transaction validation.
- The real workbook acceptance records aggregate structure only: 276 transactions and
  one trailing merged export note. It must never persist the workbook, transaction
  rows, balances, account fragments, or original remarks.
- Fresh verification: Unit 62 files／483 tests; Rules 2 files／32 tests; Build 43 pages;
  complete Emulator Playwright 55 passed／11 expected skips／0 failed. Preview acceptance
  remains upload-and-preview only until the Owner separately authorizes recognition.

### Real-workbook aggregate and distinct-unit summary

- Preview acceptance result: 276 bank transactions, seven pending Payment groups,
  zero unique matches and zero selected rows. No recognition action was performed.
- Summary regression verifies bank-side manual items and payment-side manual groups
  are counted separately. A one-to-one match contributes to neither manual count;
  one unmatched bank transaction plus one unmatched Payment group produces 1 and 1,
  never a combined value of 2 under a single mixed-unit label.
- Focused reconciliation Playwright verifies the two new labels are rendered and the
  old combined `需人工處理` label is absent while safe selection behavior is retained.
