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
