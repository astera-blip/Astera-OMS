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
npm run production:smoke -- --base-url https://astera-oms.vercel.app
```

`production:products:audit` compares Product IDs and counts, Variant/Campaign
counts, immutable SKU formats, projected prices, public image fields, and absence
of private Product fields. A non-zero exit blocks migration or release.

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

Still required before Task 6 is complete:

- explicit authorization to run the cleanup job twice, because it can delete
  expired ciphertext/key-version/expiry fields and change pending requests to
  `needsReverification`;
- controlled non-sensitive alert activation and confirmation that the notification
  reached `astera.0920@gmail.com`;
- authenticated `/healthz` evidence, or an approved documented substitution. Human
  Scheduler-SA impersonation correctly failed because no Token Creator role exists;
  do not broaden IAM merely for smoke testing.
