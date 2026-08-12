# Changelog

## 2026-07-29

- Corrected the homepage brand heading to `ASTERA OMS` only, omitted blank `birthday` from member profile save payloads, and mapped missing Admin Firestore credentials to an explicit profile-save error.
- Updated storefront and member profile UX: homepage header now shows `ASTERA OMS` as the main brand heading, member profile splits name input into `姓` and `名`, successful profile save redirects home, and disabled Instagram placeholders are removed from the public footer.
- Removed `firebase-admin/auth` from shared server Admin SDK imports and moved server ID-token verification to Firebase Identity Toolkit REST so Vercel API routes no longer fail while loading Admin Auth.
- Fixed Vercel runtime bundling for `firebase-admin` by explicitly keeping it external in server bundles.
- Added Google sign-in redirect fallback and clearer Firebase Auth error messages for popup-blocked, closed-popup, unsupported-environment, and unauthorized-domain cases.
- Improved buyer-facing storefront UX: Product listing loading/empty states no longer conflict, empty cart disables order creation, checkout fields have stable form attributes, homepage/brand/product/cart labels use consumer Chinese copy, and unset footer/contact values no longer display as low-trust placeholders.
- Fixed ProductWorkspace product creation when optional classifications are unselected.
- Defaulted new products to `published` and new Variant original currency to `THB`.
- Prevented an empty authenticated cloud cart from clearing newly added local cart lines.
- Added visible checkout terms/privacy and supplement-payment rule content and submitted the active legal version IDs.
- Added a repeatable Firebase Emulator seed script for manual owner/member acceptance.
- Added regression tests for product defaults, optional classifications, cart merging, and checkout legal content.

## 2026-07-26

- Installed Node.js LTS `v24.18.0`.
- Created the Next.js, TypeScript, Tailwind, and ESLint app.
- Removed build-time Google Fonts dependency from the default template.
- Set the app language to Traditional Chinese for Taiwan.
- Connected the local Git repository to `https://github.com/astera-blip/Astera-OMS.git`.
- Created and pushed the initial app commit.
- Added Day 1 foundation documentation and Firebase scaffolding.
- Added CI, Dependabot, local test tooling, Firebase rules tests, and local development guide.
- Created Firebase development project `astera-oms-dev-b2b2e`.
- Created Firebase production project `astera-oms-prod`.
- Enabled Google Authentication provider for both Firebase projects.
- Registered Firebase web apps for development and production.
- Connected Firebase project aliases in `.firebaserc`.
- Added production dependency audit script for CI.
- Overrode vulnerable Next.js transitive production dependencies while waiting for an upstream Next.js release.
- Confirmed GitHub Actions CI passes on `main`.
- Created development and production Firestore databases in `asia-east1`.
- Intentionally skipped Firebase Storage bucket creation until the owner is ready for the billing/location decision.
- Created the Vercel project and confirmed the production deployment is live at `https://astera-oms.vercel.app`.
- Deferred domain purchase and will use the Vercel hostname for now.
- Confirmed the Day 1 foundation passes `typecheck`, `build`, and unit tests after generating Next.js route types with `next typegen`.
- Replaced the default Next.js landing page with the Astera OMS operations workspace shell.
- Added first entry pages for products, members, orders, and payments to prepare Day 3 module work.
- Confirmed the Day 2 and Day 3 shell pages pass lint, typecheck, build, and unit tests after environment-specific Windows reruns.
- Added the Phase 2 product workspace shell, product catalog normalization helpers, and local CRUD UI for products, variants, and sale campaigns.
- Added the Phase 3 local storefront checkout flow with cart storage, order snapshots, customer order history, and checkout unit tests.
- Added the Phase 4 manual bank-transfer flow with payment requests, confirmed payments, allocations, audit logs, and workspace order/payment review pages.
- Added the Phase 5 legal/content baseline with terms/privacy versions, order consent records, public about page, and workspace content/audit-log views.
- Added Firestore repositories and rules for public product projections, private product internals, and member-owned carts.
- Wired product browsing, product workspace sync, and member carts to Firestore with local fallback.
- Added Firestore rules and repositories for orders, order items, payment requests, payments, payment allocations, audit logs, legal versions, consent records, and member private notes.
- Wired checkout, order history, payment requests, payment confirmation, audit log, legal content, and member operations screens to Firestore with local fallback where appropriate.
- Added owner/helper workspace route guards and owner-only guards for payment, audit, member, and content operations.
- Added catalog classification masters for companies, artists, CPs, brands, and series, with non-sensitive classification labels in public product projections.
- Added recorded notification events for order creation and manual payment confirmation without connecting an external email provider.
- Tightened Firestore rules for order items, payment requests, consent records, catalog classifications, and notification events.
- Expanded the small-circle smoke test checklist and manual export backup SOP.

## 2026-07-29: Local MVP Tasks 1–13 completed

- Completed protected Server/API trust boundaries and removed production business
  persistence fallbacks.
- Completed idempotent Campaign-split Checkout, immutable order numbers, payment
  report/confirm/reverse, unallocated overpayment, item cancellation/refund
  adjustments, and audit history.
- Completed bilingual ProductWorkspace, Classification Master, immutable/copyable
  IDs and SKUs, multi-Variant/Campaign editing, and server sequence allocation.
- Completed Storage Emulator image upload, metadata registration, max-eight
  references, cover ordering, alt text, public projection, and storefront images.
- Completed featured storefront, member duplicate-phone/risk operations, public
  Terms/Privacy, and idempotent post-transaction notification delivery.
- Completed accessibility/mobile acceptance: global focus-visible, skip link,
  route focus, live async status, duplicate-submit locks, 44px controls,
  reduced-motion support, and Pixel 7 overflow coverage.
- Added read-only production environment, Product projection audit, and anonymous
  HTTPS smoke tools plus backup/sync/rollback SOP.
- Final validation: secret scan passed; production audit found 0 vulnerabilities;
  TypeScript and ESLint passed; Unit 22 files / 104 tests; Rules 2 files / 29
  tests; Build 31 routes; regular Playwright 10 passed / 18 mode skips;
  Emulator Playwright 25 passed / 3 mode skips.
- Final review hardened nested private-field detection, made public Product-detail
  discovery mandatory in production smoke, and added Classification-tab Pixel 7
  overflow acceptance.

## 2026-08-02: Production payment page Timestamp fix

- Fixed `/payments` crash after a member has a PaymentRequest: Firestore
  Timestamp values are now normalized at `src/lib/payment/repository.ts` before
  React renders `createdAt`, `dueAt`, or `updatedAt`.
- Added `tests/unit/paymentRepository.test.ts` covering Firebase-style and
  structural Timestamp values.
- Deployed to Vercel Production. Verification passed: Unit 29/148, TypeScript,
  ESLint, Build, Production smoke 5/5, and `/payments` HTTP 200.

## 2026-08-02: Payment account entry, multi-request reports, and delivery policy

- Added an explicit Owner Workspace `收款帳戶設定` entry and retained the
  Owner-only API boundary.
- Added multi-select PaymentRequest reporting with per-request pending-review
  Payments linked by `paymentGroupId`.
- Restricted new Checkout delivery to `7-Eleven 賣貨便` and removed new
  address/store-information collection while preserving historical order reads.

## 2026-08-02: Preserve multi-request overpayment

- When one transfer is reported against multiple PaymentRequests, any amount
  beyond the selected outstanding balances is attached to the last linked
  Payment. Owner confirmation now persists the excess as
  `unallocatedAmountTwd` instead of silently dropping it.
- Focused payment/cancellation Playwright: 2/2 desktop/mobile passed.
- Deployed the fix to Vercel Production; smoke checks passed 5/5 and the
  payment/workspace/public routes returned HTTP 200.

## 2026-08-02: ProductWorkspace responsive field layout

- Prevented bilingual Variant and Campaign labels/controls from overlapping in
  narrow workspace panels by constraining grid children with `min-w-0` and
  full-width controls.
- Workspace UI Playwright passed on desktop/mobile (4/4); Production smoke 5/5.

## 2026-08-02: Storefront redesign and Taishin reconciliation

- Added the buyer-facing `/checkout` presentation route and refreshed public
  Header, Home, Brand, Product Grid, Product Detail, Member Profile, Payments,
  Orders, and Workspace shell styling with the approved Astera tokens.
- Adjusted ProductWorkspace responsive breakpoints so bilingual Variant/Campaign
  labels and controls remain separated on narrow panels.
- Added Owner-only Taishin `.xlsx` preview reconciliation API/UI using ExcelJS;
  original files are not persisted and payment history is not overwritten.
- Verification: Unit 39 files/178 tests, Rules 31 tests, public Playwright
  14 passed/2 skipped, Emulator Playwright 31 passed/3 skipped, TypeScript,
  ESLint, Build, secret scan, and production dependency audit passed.

## 2026-08-06／09: Bank-account fingerprint and refund security rollout

- Task 1 (`db51c0f..b93e447`) added strict bank-account normalization and a
  versioned Cloud KMS HMAC-SHA-256 identity service.
- Task 2 (`cd2660c..20a7b9e`) changed member account persistence to bank code,
  last five, canonical HMAC fingerprint, and key version. Same bank-code／last-five
  combinations remain bindable and create an Owner review event.
- Task 3 (`96dbc7e..39d19b2`, contract correction `dd2d8e5`) made payment
  account snapshots server-authoritative and routed legacy missing-fingerprint
  records to manual review.
- Task 4 (`9433a77..3e09b8c`) added source-specific refund verification,
  fourteen-day encrypted refund-account vaults, immutable adjustments／audit
  records, multi-payment-source refunds, and transactional deletion of all
  related vaults after final refund.
- Task 5 (`22db1c5..7433ec3`) moved private audit／cancellation／notification
  reads behind protected APIs, denied direct Client SDK access, added safe Owner
  alerts, and reserved mismatch rate limits before KMS work.
- Task 6 (`81cb342..135a42e`) added dry-run-first fingerprint migration,
  expired-vault cleanup, monthly key-usage reporting, strict KMS／WIF production
  environment validation, and fail-closed canonical fingerprint validation.
- Task 7 (`572e53f..fc9ecdd`) exercised the protected account／refund APIs with
  owner, helper, member A, and member B in the Firebase Emulator. Its scoped
  review was approved; the exact suite passed 36, skipped 8 expected cases, and
  failed 0.
- Final refund-verification hardening commits `4999e4c`, `6bf9f9d`, and
  `a276aa0` resolved the final broad-review Important findings and one
  mixed-cancellation replay regression found during scoped re-review. The final
  focused review was approved: 0 Critical, 0 Important, 0 Minor.
- The test KMS implementation is doubly restricted to the Playwright Emulator
  flag and `demo-astera-oms`; Production continues to use Cloud KMS.
- Task 8 final fresh results: TypeScript, ESLint, Unit (46 files／310 tests), Build,
  Firestore／Storage Rules (32 tests), Emulator E2E (36 passed／8 expected
  skipped／0 failed), secret scan, and production dependency audit all passed.
- NanoID is overridden to `3.3.17`, resolving the earlier high advisory. Two
  ExcelJS transitive UUID advisories remain moderate; forcing a fix would be a
  breaking／downgrade ExcelJS change, so this is a non-blocking dependency follow-up.
  Local verification is complete; Production infrastructure and live acceptance
  remain external release gates.

## 2026-08-11 Payment report idempotency and rejection

- Replaced random Payment creation with deterministic, opaque report-group and
  allocation IDs derived from member intent plus a bounded idempotency key.
- Added identical-replay success and conflicting-replay `409` handling.
- Added sanitized member Payment history and persistent Chinese review statuses.
- Added synchronous double-submit prevention and retry-key preservation.
- Added Owner-only rejection of pending reports with immutable audit history and no
  allocation／Order／PaymentRequest mutation.
- Added Unit and Emulator Playwright coverage, including double click, reload, safe
  history, rejection, and Audit Log verification.
- 2026-08-12: Deployed the rebuilt public Astera storefront to Vercel Production
  (`dpl_8FPCjc99CzRMXrfFo6GEhTLpsmek`), now available at
  `https://astera-oms.vercel.app`. Added a test-only import stabilization for the
  payer-name route; no Collection, Rules, Checkout, pricing, or Order logic changed.
- 2026-08-12: Added the missing Production Firebase client `authDomain` using the
  existing Firebase default host and redeployed as
  `dpl_79zMNBTmdKrsNq58pcx6tK3fMJeH`; this prevents client initialization from
  failing solely because the public auth configuration is absent.
- 2026-08-12: Replaced that cross-origin fallback with the Production same-origin
  Auth domain, appended only the matching Google OAuth redirect URI, and deployed
  `dpl_A8uq9wwsdtzZLRWR85VzBh9wgE6a`. This addresses redirect-session loss in
  browsers that block third-party storage; cart, Checkout, Rules, and data models
  were not changed.
