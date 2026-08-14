# Astera OMS MVP Completion Plan

Last updated: 2026-08-11 Asia/Taipei

## Execution Rules

- Source of truth: the project handoff in this task plus the existing repository docs.
- AI continuation entrypoint: `docs/20_CompleteAIHandoff_2026-07-30.md`.
- Scope: MVP only. Do not add Helper, Warehouse, CRM, Finance, Analytics, or ERP features.
- Architecture: keep Next.js 16, Firebase, Vercel, `productsInternal` private master data, and `productsPublic` public storefront projection.
- Safety: preserve the pre-existing `AGENTS.md` change and avoid staging unrelated files.

## Current Baseline

- Branch: `codex/mvp-completion`; the Production Security Worker and payer-linked
  member-account work are merged, committed, pushed, and verified on the stable
  Preview alias. The latest documented remote checkpoint is `4630f72`.
- Fresh merged-tree evidence before this smoke-tool batch: 418 Unit tests,
  32 Firestore/Storage Rules tests,
  TypeScript, ESLint, Ready Vercel Preview Build, 18 regular Playwright tests,
  37 Emulator Playwright tests, secret scan, and production dependency audit all
  passed. Intentional environment/project skips remain documented.
- Member-side Preview acceptance is complete for one-time legacy payer-name
  completion and two-account switching. Both linked last-five and payer-name fields
  are read-only and Server-authoritative. One previously authorised test-only
  Payment Report exists in `pendingReview`; no later Payment Report was submitted.
- Task 7 remains open only for the Owner-side financial lifecycle: read the newest
  test-only `pendingReview` Payment, then separately authorise confirm, reverse,
  refund mismatch/match, reveal-without-capture, full refund, and vault deletion.
- Production still points to the Ready 2026-08-03 deployment, not the current
  Preview branch. Domain/DNS, Resend, live image upload, Production promotion, and
  real-device acceptance remain release gates.

## Batch Status

| Batch | Status | Notes |
| --- | --- | --- |
| 0 Safety baseline | Complete except public domain | Branch and ignored backups exist; Firebase CLI/ADC and Production infrastructure are available. `asteratw.com` is still unresolved. |
| 1 Server trust boundary and rules | Firestore + Storage deployed | Product/classification/profile/cart/content/member-note/order/payment/cancellation/legal/notification business writes now use protected APIs or Admin-only seed paths; Firestore and Storage Rules are deployed to `astera-oms-prod`. |
| 2 Product, SKU, Campaign | Implemented and Production projection audited | Owner Product/Variant/Campaign API, transaction SKU assignment, bilingual labels, classification tabs, copy-ID/SKU controls, classification server IDs, help text, and Campaign UTC+8 handling are implemented. Production projection currently audits `2 / 2` with no issues. |
| 3 Checkout split and consent | Implemented and automated | Checkout UI/API require consent, split cart by Campaign, create multiple orders/payment requests/consents, and assign `AST-YYYYMMDD-0001` order numbers; Emulator acceptance is green. |
| 4 Payments and cancellation | Code/automated tests complete; Owner Preview lifecycle pending | Payment report, Owner confirmation, reversal, unpaid direct cancellation, paid cancellation review, negative adjustment, refund vault, overpayment UI, payer-linked member accounts, and automated E2E are implemented. The remaining gate is the action-time-authorised Owner Preview lifecycle. |
| 5 Storage images | Rules/bucket deployed; live upload pending | Product image upload UI/API, Storage rules, metadata registration, projection fields, and emulator tests are complete. The Firebase default bucket is linked in `asia-east1`; live upload and real-device image acceptance remain pending. |
| 6 Homepage, content, Resend | UI/content implemented; external email pending | Consumer-facing copy and protected content APIs are implemented. `updates.asteratw.com`, `RESEND_API_KEY`, and actual delivery remain external gates. |
| 7 Campaign timezone and Member Dashboard skeleton | Local implementation complete | Campaign datetime-local now round-trips as Taipei UTC+8; `/members` has a visual-only dashboard skeleton with no fake operational data. |
| 8 Receiving bank account recognition | Local implementation complete / production setup pending | Owner API/UI manages active/inactive Astera receiving accounts; member payment reports select an active account and store a masked snapshot. Production account setup remains an Owner operation. |
| 9 Visual system migration | Local implementation complete / device and Production visual gate pending | Approved Astera tokens are defined globally, legacy slate/amber utilities render through the new tokens, and the full authenticated emulator suite remains green. Real-device and Production visual acceptance remain pending. |

## External Gates

- Buy/configure `asteratw.com`; 2026-08-11 DNS checks for root, `www`, and
  `updates` all remain unresolved.
- Enable Blaze on dev and production Firebase projects (both confirmed; Development and Production use billing account `01B794-2E6BD7-33D714`).
- Create Storage buckets in `asia-east1` (both default buckets linked and Rules deployed).
- Vercel OIDC/KMS is verified by the authenticated Preview member-account flow;
  Production still requires promotion and runtime acceptance on the promoted build.
- Verify `updates.asteratw.com` in Resend, configure `RESEND_API_KEY`, and prove one
  order plus one payment-confirmation email delivery.

## 2026-08-02 Continuation Record

- Confirmed `Member Preorder` is explicitly out of scope for this release; no Sale Type, permission path, or checkout behavior was added.
- Added `src/lib/product/campaignDates.ts` and UTC+8 Campaign input/read-back conversion. Product and storefront Campaign date displays now share the same Taipei-time formatter.
- Added a visual-only Member Dashboard skeleton at `/members`; it contains no fabricated tasks, notifications, or business data.
- Added the approved Astera visual Token contract in `src/app/globals.css`; the public home, Brand Center, and Workspace shell now use explicit `astera-*` tokens, while remaining legacy utilities render through a compatibility mapping without changing business behavior.
- Added a UI accessibility regression test for all approved tokens, legacy utility mapping, and `min-h-screen` → `100dvh` behavior.
- Production read-only checks: `astera-oms-prod` exists as project `1032606875618`; Vercel OIDC pool/provider are `ACTIVE`, and `astera-vercel-admin` has the expected workload identity binding plus `datastore.user`, `firebaseauth.viewer`, and `storage.objectViewer` roles.
- Production gate recheck: `billingEnabled=true`; Firebase default bucket `gs://astera-oms-prod.firebasestorage.app` is linked in `ASIA-EAST1`; DNS lookups for `asteratw.com`, `www.asteratw.com`, and `updates.asteratw.com` still require external verification. Firebase CLI is authenticated as `ting1811tin@gmail.com`; ADC must still be rechecked with the same Production-authorized account.
- `npm run production:env:check -- --strict` is now the release-gate form; it exits non-zero when any required Production variable is missing, while the non-strict form remains a diagnostic report.
- Current anonymous smoke against `https://astera-oms.vercel.app` is not release-ready: `/` and `/products` are 200, while `/terms` and `/privacy` are 404 and no public product detail is discoverable. The URL is serving an older deployment.
- Firestore Rules deployment: dry-run passed and `node scripts/run-firebase.mjs deploy --project astera-oms-prod --only firestore:rules` completed successfully.
- Storage default bucket creation completed through the official Firebase Storage API with `location=asia-east1`; `node scripts/run-firebase.mjs deploy --project astera-oms-prod --only storage` compiled and released `storage.rules` successfully.
- Combined release-gate redeploy `node scripts/run-firebase.mjs deploy --project astera-oms-prod --only firestore:rules,storage` completed successfully; both rulesets were compiled and released (already-up-to-date versions were reused).
- Read-only Production product audit was attempted with `npm run production:products:audit -- --project astera-oms-prod --confirm-project astera-oms-prod` and returned `7 PERMISSION_DENIED`; ADC must be re-authenticated as a Production-authorized account before the audit can run.
- After ADC re-authentication as `ting1811tin@gmail.com`, the read-only Production product audit passed: `internalCount=2`, `publicCount=2`, `issues=[]`. No production write or migration was performed in this step.
- Added `scripts/sync-product-projection.mjs` and `production:products:sync`. With Owner confirmation, it created the ignored backup `.local-backups/production-product-sync-2026-08-02T03-11-00-683Z/product-projection-backup.json`, rewrote 2 sanitized `productsPublic` documents, and completed a post-sync audit with `internalCount=2`, `publicCount=2`, `issues=[]`.
- Post-sync verification passed: TypeScript, ESLint, Unit (`28 files / 145 tests`), Production build (33 routes), and `git diff --check`.
- Production smoke recheck remains red on the current Vercel alias: `/` and `/products` return 200, but `/terms` and `/privacy` return 404 and no public product detail is discoverable; the alias still serves an older deployment and must be redeployed before release.
- Added `src/lib/payment/bankAccounts.ts`, `/api/payment-accounts`, and `/api/workspace/payment-accounts`.
- Added Owner payment workspace management for Astera receiving accounts. Accounts are soft-disabled, never hard-deleted, and expose only bank/branch/name/last-five metadata.
- Extended `/api/payments` and `LocalPayment` with optional receiving account ID plus immutable masked account snapshot. When active accounts exist, new reports must select one; legacy environments with no configured account remain backward compatible.
- Added member payment report account selector and Firestore Rules coverage proving `paymentAccounts` is server-only.
- Added `tests/unit/paymentAccounts.test.ts`; fresh Unit verification: 28 files / 142 tests passed. Fresh typecheck and lint passed.

## Next Exact Steps

1. Owner signs in to the stable Preview and performs a read-only check that the
   newest clearly test-only Payment is `pendingReview`. Obtain a new action-time
   confirmation immediately before confirm/reverse/refund mutations.
2. Complete the Preview Owner lifecycle: confirm, reverse, recreate the necessary
   test state, refund mismatch/match, reveal without recording the response, approve
   full refund, and verify vault deletion. Never use real bank data.
3. Configure `asteratw.com`/`www`/`updates` DNS and Resend, add the Production-only
   `RESEND_API_KEY`, and verify actual order/payment email delivery.
4. Create/verify the real Owner receiving account and upload at least one real
   Product image. Do not place full receiving-account data in Git or chat.
5. Promote the verified branch to Production, run strict environment validation,
   projection audit, explicit-product Production smoke, Member/Owner workflows,
   permission rejection, desktop/Pixel 7, and physical-phone acceptance.

Validation note: full Firestore + Storage Rules passed (30 tests), regular Playwright passed (16 passed / 18 expected emulator skips), and the full Auth／Firestore／Storage emulator suite passed 31/34 with 3 expected auth-gate skips. Unit now passes 28 files / 142 tests after the explicit home/Brand/Workspace token migration. Secret scan passed and production dependency audit reports 0 high-severity vulnerabilities.

Fixture correction: all legacy payment fixtures now include an explicit `receivingPaymentAccountId`; Unit and Rules suites were rerun successfully after the update.

## Completed Local Work

### 2026-07-27 Batch 0

- Created working branch `codex/mvp-completion`.
- Created this execution plan and `docs/17_ProjectHandoff.md`.
- Confirmed Sites hosting is not used because the repository has no `.openai/hosting.json`; the project remains on Vercel/Firebase.
- Reviewed local Next.js 16 route handler, authentication, and mutation docs before API edits.

### 2026-07-27 Batch 1 Partial

- Updated `src/lib/content/serverRepository.ts` to read content directly with Firebase Admin SDK.
- Server content now reads `siteSettings/site-default` directly instead of listing arbitrary site settings through a Client SDK cast.

### 2026-07-27 Batch 2 Partial

- Updated `src/lib/product/catalog.ts`.
- Updated `src/lib/catalog/publicCatalog.ts`.
- Updated `src/lib/product/repository.ts`.
- Updated `src/domain/product.ts`.
- Updated storefront product list/detail components to stop showing public SKU.
- Added formal SKU formatter helpers:
  - Product: `AST-P000001`
  - Variant: `AST-P000001-V001`
- Public projection now omits SKU and internal costs.
- Campaign status is `upcoming | open | closed | archived`.
- Campaign `salePriceTwd` is supported and overrides variant default price in public/cart calculations.
- Cart validation no longer rejects mixed sale types.

### 2026-07-27 Batch 3 Partial

- Updated `src/components/storefront/CartBoard.tsx`.
- Updated `src/app/api/checkout/route.ts`.
- Updated `src/lib/legal/documents.ts`.
- Updated `firestore.rules` and `tests/firebase/firestore-deny.test.ts`.
- Checkout UI now requires both legal/privacy consent and supplement-rule consent.
- Checkout API rejects requests without both consents.
- Consent records store `acceptedSupplementRule: true`.

### 2026-07-27 Product API / SKU / Rules Batch

- Added `src/lib/product/serverCatalog.ts`.
- Added `src/app/api/workspace/products/route.ts`.
- Added `src/app/api/workspace/classifications/route.ts`.
- `ProductWorkspace` now loads and saves products/classifications through owner-only APIs with Firebase ID tokens.
- New product saves allocate product SKU inside a Firestore transaction using `siteSettings/system-sequences`.
- Variant SKU is generated server-side from the product SKU.
- Product ID and SKU inputs in the owner UI are read-only; new records are assigned by the system.
- Firestore rules now deny Client SDK writes to `productsPublic`, `productsInternal`, `productVariants`, `saleCampaigns`, and catalog classification collections.
- `productVariants` and `saleCampaigns` are no longer directly public-readable; storefront remains on `productsPublic`.

### 2026-07-27 Checkout Split / Order Number Batch

- `POST /api/checkout` now groups cart items by Campaign.
- Each Campaign group creates its own Order, PaymentRequest, ConsentRecord, and notification event.
- Orders receive `checkoutGroupId`.
- Orders receive formal `orderNumber` values like `AST-20260727-0001`.
- Server checkout enriches order snapshots with private Variant SKU from `productVariants`, while `productsPublic` remains SKU-free.
- Checkout response now returns `orders[]` with order IDs, order numbers, payment request IDs, and totals.

### 2026-07-27 Payment Report / Owner Confirmation Batch

- Added `src/app/api/payments/route.ts`.
- Members can report bank transfers with payment request, transfer date, amount, account last five digits, payer name, and note.
- Payment reports are created as `pendingReview`.
- Owner confirmation endpoint now confirms an existing Payment ID instead of creating a new payment from owner-entered amount.
- Owner payment board lists payment reports and confirms pending reports.

### 2026-07-27 Payment Reversal / Cancellation Batch

- Added `src/app/api/workspace/payments/[id]/reverse/route.ts`.
- Added `reverseConfirmedPayment` domain logic.
- Payment reversal marks the Payment as `reversed`, appends a negative `paymentAllocations` adjustment, reopens the PaymentRequest, resets active order items to `awaitingPayment`, and writes an audit log.
- Cancellation now splits selected OrderItems:
  - `awaitingPayment` items are directly cancelled and the order/payment request totals are recalculated.
  - `paid` items create a pending cancellation request for owner review.
- Owner approval for paid cancellation requires refund amount, refund completion date, and refund reference.
- Paid cancellation approval writes a negative refund adjustment and audit log.
- Owner order board now includes refund metadata fields for cancellation approvals.

### 2026-07-27 Profile / Cart API and Rules Batch

- Added `src/app/api/member/profile/route.ts`.
- Added `src/app/api/cart/route.ts`.
- Account profile save now posts the member draft plus Firebase ID token to `/api/member/profile`.
- Storefront cart list/detail/cart pages now load, save, and clear carts through `/api/cart`.
- Firestore rules now deny Client SDK writes to `members` and `carts`.
- Rules tests now verify client profile/cart writes fail while seeded self-owned reads still pass.

### 2026-07-27 Content / Member Notes API and Rules Batch

- Added `src/app/api/workspace/content/route.ts`.
- Added `src/app/api/workspace/member-private-notes/route.ts`.
- Workspace content save now uses an owner-only Admin SDK API with Firebase ID token.
- Workspace member risk note save now uses an owner-only Admin SDK API with Firebase ID token.
- Firestore rules now deny Client SDK writes to `siteSettings`, `socialLinks`, `faqs`, `announcements`, and `memberPrivateNotes`.
- Rules tests now verify public content reads still pass, owner private-note reads still pass, and client writes fail.

### 2026-07-27 Business Rules Hardening Batch

- Firestore rules now deny Client SDK writes to:
  - `orders`
  - `orderItems`
  - `paymentRequests`
  - `payments`
  - `paymentAllocations`
  - `auditLogs`
  - `notificationEvents`
  - `legalDocumentVersions`
  - `consentRecords`
  - `cancellationRequests`
- Member/owner reads remain scoped as before.
- Public reads for `legalDocumentVersions` remain allowed.
- Rules tests were updated to seed protected business documents through emulator admin context and verify client writes fail.

### 2026-07-27 Product UI / Overpayment / Storage Rules Batch

- `ProductWorkspace` now edits multiple Variants and multiple Campaigns in one product draft.
- Variant SKU fields remain read-only and server-assigned.
- Campaign UI now includes optional `salePriceTwd`; blank value falls back to Variant default price.
- Campaign archive action marks a Campaign as `archived` instead of hard deleting it.
- `PaymentOperationsBoard` now shows payment reports, confirmed/reversed status, unallocated overpayment totals, and per-payment-request overpayment rows for manual bank refund handling.
- Owner payment confirmation now persists `unallocatedAmountTwd` to `paymentRequests`.
- Owner payment board now exposes a confirmed-payment reversal action that calls `/api/workspace/payments/[id]/reverse`.
- Added Storage rules for `product-images/{productId}/{imageId}`:
  - public read;
  - owner-only write;
  - JPEG/PNG/WebP only;
  - max 5 MB;
  - all other paths denied.
- Added Storage emulator rules tests in `tests/firebase/storage-deny.test.ts`.
- `firebase:rules:test` now starts both Firestore and Storage emulators.
- Added a Playwright smoke test for the workspace auth gate. Full owner/member Playwright flows still require an Auth emulator seed harness; current tests cannot enter owner-only workspace screens without a real/custom-claim user.

### 2026-07-27 Auth Emulator Playwright Harness Batch

- Added E2E-only `/e2e-auth` route, guarded by `NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH=true`.
- Added `tests/e2e/global-setup.ts` to seed Auth emulator users:
  - `owner-e2e@example.test` with custom claim `role: owner`;
  - `member-e2e@example.test` with custom claim `role: member`.
- Seeded matching `members/{uid}` documents so `ProfileCompletionGuard` does not redirect seeded test users to profile completion.
- Added `scripts/run-playwright-emulated.mjs`.
- Added `npm run test:e2e:emulated`, which starts Firebase Auth/Firestore/Storage emulators and then runs Playwright with emulator env vars.
- Updated Playwright config so emulated runs start Next with Firebase emulator env vars.
- Updated workspace Playwright coverage:
  - non-emulated mode still verifies unauthenticated workspace gate;
  - emulated mode verifies owner can enter product workspace and add Variant/Campaign rows;
  - emulated mode verifies member cannot enter owner/helper workspace.
- Updated Firebase Admin initialization to support local emulator project ID without service account credentials.
- Local build no longer attempts Admin content reads unless Firestore emulator, service account credentials, or actual Vercel OIDC runtime is available.

### 2026-07-27 Authenticated Checkout / Payment / Cancellation Playwright Batch

- Added `tests/e2e/member-payment-cancellation-flow.spec.ts`.
- Expanded `tests/e2e/global-setup.ts` with an emulator-only public product projection and matching `productVariants` SKU data for end-to-end checkout authority checks.
- The new emulated Playwright flow signs into Firebase Auth Emulator through REST as both:
  - `member-e2e@example.test`;
  - `owner-e2e@example.test`.
- The new flow verifies real Next API + Admin SDK behavior for:
  - Campaign-based checkout split into multiple Orders and PaymentRequests;
  - `AST-YYYYMMDD-0001` order number shape;
  - member payment report creation as `pendingReview`;
  - owner Payment ID confirmation;
  - overpayment persisted as `unallocatedAmountTwd`;
  - owner payment reversal with negative adjustment behavior;
  - unpaid item direct cancellation with no owner review request;
  - paid item cancellation request and owner approval with refund metadata.
- Updated `tests/e2e/workspace-product-ui.spec.ts` so the owner ProductWorkspace form smoke test no longer assumes localStorage-only product fixtures once emulator server products are seeded.
- Limited the owner ProductWorkspace form-edit smoke to desktop; Pixel 7 remains covered by public storefront, member workspace denial, and the authenticated API checkout/payment/cancellation flow.
- Fixed `scripts/run-firebase.mjs` to normalize the Windows Java/PATH environment for Firebase Emulator startup. The managed sandbox still blocks Java child process execution, so emulator tests must run with approved unsandboxed execution in this environment.

### 2026-07-27 Formal Consumer Copy Batch

- Updated fallback brand content in `src/lib/content/brandContent.ts` from internal MVP/test wording to Astera consumer-facing copy.
- Updated default FAQ coverage for:
  - shipping timing;
  - unpaid vs paid cancellation;
  - bank transfer payment reporting;
  - supplement payment / 二補.
- Updated default announcements to remove internal `notificationEvents`, Email-record-mode, and public projection wording.
- Updated legal document titles/body in `src/lib/legal/documents.ts` to Astera terms/privacy copy while preserving existing version IDs.
- Updated homepage copy in `src/app/page.tsx`:
  - removed `Small-circle MVP`, custom-claim, Firestore, and owner technical status wording;
  - removed public Owner backend quick link;
  - added consumer links for orders and payment reporting.
- Updated `/about`, `/payments`, `/members`, and account profile copy to remove test/internal placeholder wording.
- Updated order detail cancellation copy so paid items are described as review/refund requests instead of “contact support only”.

### 2026-07-27 Resend Notification Events / Retry Batch

- Expanded `NotificationEvent` from recorded/manual intent to Resend-ready state:
  - `status: pending | sent | failed`;
  - `provider: resend`;
  - `recipientEmail`;
  - `attemptCount`;
  - optional `lastAttemptAt`, `providerMessageId`, and sanitized `lastError`.
- Checkout now creates order-created `notificationEvents` as `pending` after the order/payment request transaction work is prepared; it still does not send email inside checkout.
- Payment confirmation now creates payment-confirmed `notificationEvents` as `pending` and reads member email from `members/{uid}` inside the transaction.
- Added `src/lib/notification/resend.ts` delivery layer:
  - missing Resend config marks the event `failed` without sending;
  - configured send records provider message ID and marks `sent`;
  - provider errors are sanitized before saving.
- Added owner-only retry API: `POST /api/workspace/notifications/[id]/retry`.
- Payment workspace now lists Email notification events and lets owner retry non-sent events. Retry only updates the notification event and does not roll back or mutate orders/payments.
- Added Resend environment placeholders to `.env.example`; `RESEND_API_KEY` remains empty until DNS/domain verification is complete.
- Updated Firestore rules fixture to use the new pending/resend event shape while preserving client-write denial.
- Added unit coverage for notification event state transitions and Resend delivery behavior.

### 2026-07-27 SKU Auto-Assignment Hardening Batch

- Confirmed the earlier implementation allocated new Product SKU through `siteSettings/system-sequences`, but found and fixed a Variant SKU trust-boundary gap.
- Added `assignServerManagedSkus` in `src/lib/product/catalog.ts`.
- Server product save now ignores all submitted Product/Variant SKU values from UI/API payloads.
- Existing Product SKU is preserved from `productsInternal/{productId}.sku`.
- Existing Variant SKU is preserved by Variant document ID from `productVariants`.
- New Variant SKU is assigned from the highest existing Variant sequence plus one, preventing collisions when variants are reordered or inserted.
- New Product SKU still uses `siteSettings/system-sequences` transaction allocation.
- Added unit tests proving:
  - submitted manual Product/Variant SKU values are ignored;
  - new variants receive `AST-P000000-V###` format;
  - existing Variant SKU values are preserved;
  - new Variant SKU numbering continues after the highest existing sequence.

### 2026-07-28 AI Handoff / GitHub Upload Batch

- Added `docs/18_AIContinuationBrief.md` as the compact handoff entrypoint for another AI agent.
- Updated this execution plan and `docs/17_ProjectHandoff.md` to reference the AI continuation brief.
- Updated `eslint.config.mjs` to ignore `.worktrees/**`; `.worktrees/` was already Git-ignored, but ESLint was still scanning unrelated local worktree files and producing warnings.

### 2026-07-29 Manual Acceptance Fix Batch

- Fixed `normalizeClassifications` so unselected optional classifications no longer throw while creating a product.
- New ProductWorkspace products now default to `published`, so a newly saved product is eligible for the public projection without an easily missed draft-state change.
- New Variants now default `originalCurrency` to `THB`.
- Added deterministic client/cloud cart merging so an empty cloud cart cannot erase a product that was just added locally during authenticated cart startup.
- Checkout now submits the active terms/privacy version IDs instead of an empty version list.
- Checkout now displays the actual Astera terms, privacy summary, and supplement-payment rules next to the two required consent controls.
- Added `scripts/seed-firebase-emulator.mjs` and `npm run firebase:emulators:seed` for repeatable owner/member manual acceptance data.
- Added regression tests for optional classifications, ProductWorkspace defaults, cart merging, legal version IDs, and supplement-rule content.

### 2026-07-29 Approved ProductWorkspace Improvement Scope

- Keep Product ID, Product SKU, and Variant SKU server-assigned and read-only in normal operations.
- Add copy controls for Product ID and SKU. Do not add an unlock/edit button.
- Reserve Product ID changes for a separate future owner-only migration tool that validates and migrates all relationships.
- Preserve sequential SKU formats `AST-P000001` and `AST-P000001-V001`.
- Never reuse archived Variant SKU numbers; after archived `V002` in a `V001`–`V003` sequence, allocate `V004`.
- Add the confirmed private `Internal Note（內部備註）` explanation below the field.
- Display Product publish, Campaign, and classification statuses as bilingual labels while preserving English stored enum values.
- Separate `Products（商品管理）` and `Classifications（分類管理）` into top-level tabs.
- Add a `管理分類` shortcut beside Product classification selectors.
- Generate classification IDs on the Server; operators enter only display names.
- Allow classification display-name edits and archive operations, never hard deletion.
- Keep new Variant currency default as THB and display all supported currencies as bilingual labels.
- Variant Name input behavior is not yet approved and is intentionally excluded from this confirmed scope.

## Verification Log

- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run test:unit`: passed, 8 files and 45 tests.
- `npm.cmd run firebase:rules:test`: passed, 1 file and 26 tests.
- `npm.cmd run build`: passed.
- 2026-07-27 02:18: `npm.cmd run lint`: passed.
- 2026-07-27 02:18: `npm.cmd run firebase:rules:test`: passed, 1 file and 26 tests.
- 2026-07-27 02:22: `npm.cmd run test:unit`: passed, 8 files and 47 tests.
- 2026-07-27 02:23: `npm.cmd run build`: passed.
- 2026-07-27 06:59: `npm.cmd run test:unit`: passed, 8 files and 50 tests.
- 2026-07-27 07:00: `npm.cmd run typecheck`: passed.
- 2026-07-27 07:00: `npm.cmd run lint`: passed.
- 2026-07-27 07:00: `npm.cmd run firebase:rules:test`: passed, 1 file and 26 tests.
- 2026-07-27 07:01: `npm.cmd run build`: passed.
- 2026-07-27 07:17: `npm.cmd run typecheck`: passed after Profile/Cart API changes.
- 2026-07-27 07:17: `npm.cmd run lint`: passed after Profile/Cart API changes.
- 2026-07-27 07:17: `npm.cmd run test:unit`: passed, 8 files and 50 tests.
- 2026-07-27 07:18: `npm.cmd run firebase:rules:test`: passed, 1 file and 26 tests.
- 2026-07-27 07:18: `npm.cmd run build`: passed.
- 2026-07-27 07:21: `npm.cmd run typecheck`: passed after Content/Notes API changes.
- 2026-07-27 07:21: `npm.cmd run lint`: passed after Content/Notes API changes.
- 2026-07-27 07:21: `npm.cmd run test:unit`: passed, 8 files and 50 tests.
- 2026-07-27 07:21: `npm.cmd run firebase:rules:test`: passed, 1 file and 26 tests.
- 2026-07-27 07:22: `npm.cmd run build`: passed.
- 2026-07-27 07:25: `npm.cmd run typecheck`: passed after business rules hardening.
- 2026-07-27 07:25: `npm.cmd run lint`: passed after business rules hardening.
- 2026-07-27 07:25: `npm.cmd run firebase:rules:test`: passed, 1 file and 26 tests.
- 2026-07-27 07:25: `npm.cmd run test:unit`: passed, 8 files and 50 tests.
- 2026-07-27 07:26: `npm.cmd run build`: passed.
- 2026-07-27 07:42: `npm.cmd run typecheck`: passed after Product UI / payment / Storage changes.
- 2026-07-27 07:42: `npm.cmd run lint`: passed after Product UI / payment / Storage changes.
- 2026-07-27 07:42: `npm.cmd run test:unit`: passed, 8 files and 51 tests.
- 2026-07-27 07:43: `npm.cmd run firebase:rules:test`: passed, 2 files and 29 tests.
- 2026-07-27 07:45: `npm.cmd run build`: passed.
- 2026-07-27 07:45: `npm.cmd run test:e2e`: passed, 8 tests across desktop Chromium and Pixel 7.
- 2026-07-27 08:00: `npm.cmd run test:e2e:emulated`: passed, 10 tests and 2 intentional skips across desktop Chromium and Pixel 7.
- 2026-07-27 08:01: `npm.cmd run test:e2e`: passed, 8 tests and 4 intentional skips across desktop Chromium and Pixel 7. Local non-emulated run may emit ADC warnings if Admin credentials are absent before the content fallback patch.
- 2026-07-27 08:02: `npm.cmd run typecheck`: passed.
- 2026-07-27 08:02: `npm.cmd run lint`: passed.
- 2026-07-27 08:02: `npm.cmd run test:unit`: passed, 8 files and 51 tests.
- 2026-07-27 08:02: `npm.cmd run firebase:rules:test`: passed, 2 files and 29 tests.
- 2026-07-27 08:06: `npm.cmd run build`: passed with clean local Admin content fallback.
- 2026-07-27 08:28: `npm.cmd run test:e2e:emulated`: passed, 11 tests and 3 intentional skips across desktop Chromium and Pixel 7. Required approved unsandboxed execution because Firebase Emulator needs Java child process execution.
- 2026-07-27 08:30: `npm.cmd run typecheck`: passed.
- 2026-07-27 08:30: `npm.cmd run lint`: passed.
- 2026-07-27 08:30: `npm.cmd run test:unit`: passed, 8 files and 51 tests.
- 2026-07-27 08:31: `npm.cmd run firebase:rules:test`: passed, 2 files and 29 tests. Required approved unsandboxed execution for Java emulator startup.
- 2026-07-27 08:31: `npm.cmd run build`: passed.
- 2026-07-27 08:35: `npm.cmd run typecheck`: passed after Formal Consumer Copy changes.
- 2026-07-27 08:35: `npm.cmd run lint`: passed after Formal Consumer Copy changes.
- 2026-07-27 08:36: `npm.cmd run build`: passed after Formal Consumer Copy changes. Required approved unsandboxed execution after sandbox `spawn EPERM`.
- 2026-07-27 08:36: `npm.cmd run test:e2e`: passed, 8 tests and 6 intentional emulator-only skips across desktop Chromium and Pixel 7. Required approved unsandboxed execution after sandbox `spawn EPERM`.
- 2026-07-27 08:37: `npm.cmd run test:unit`: passed, 8 files and 51 tests. Required approved unsandboxed execution after sandbox `spawn EPERM`.
- 2026-07-27 08:49: `npm.cmd run typecheck`: passed after Resend notification event changes.
- 2026-07-27 08:50: `npm.cmd run test:unit`: passed, 9 files and 55 tests.
- 2026-07-27 08:51: `npm.cmd run firebase:rules:test`: passed, 2 files and 29 tests. Required approved unsandboxed execution for Java emulator startup.
- 2026-07-27 08:51: `npm.cmd run build`: passed.
- 2026-07-27 08:52: `npm.cmd run typecheck`: passed after lint warning cleanup.
- 2026-07-27 08:52: `npm.cmd run lint`: passed with no warnings after cleanup.
- 2026-07-27 08:52: `npx.cmd vitest run tests/unit/notificationEvents.test.ts tests/unit/resendNotificationDelivery.test.ts`: passed, 2 files and 6 tests.
- 2026-07-27 08:53: `npm.cmd run test:e2e`: passed, 8 tests and 6 intentional emulator-only skips across desktop Chromium and Pixel 7.
- 2026-07-27 08:54: `npm.cmd run test:e2e:emulated`: passed, 11 tests and 3 intentional skips across desktop Chromium and Pixel 7.
- 2026-07-27 17:45: `npx.cmd vitest run tests/unit/productCatalog.test.ts`: RED confirmed missing `assignServerManagedSkus`.
- 2026-07-27 17:46: `npx.cmd vitest run tests/unit/productCatalog.test.ts`: passed, 1 file and 12 tests after SKU hardening.
- 2026-07-27 17:47: `npm.cmd run typecheck`: passed after SKU hardening.
- 2026-07-27 17:47: `npm.cmd run lint`: passed after SKU hardening.
- 2026-07-27 17:47: `npm.cmd run test:unit`: passed, 9 files and 57 tests.
- 2026-07-27 17:49: `npm.cmd run build`: passed after SKU hardening.
- 2026-07-27 17:50: `npm.cmd run test:e2e:emulated`: passed, 11 tests and 3 intentional skips across desktop Chromium and Pixel 7.
- 2026-07-28 09:47: `npm.cmd run check:secrets`: passed, no obvious secrets detected.
- 2026-07-28 09:47: `npm.cmd run typecheck`: passed.
- 2026-07-28 09:47: `npm.cmd run lint`: passed after `.worktrees/**` ESLint ignore update.
- 2026-07-28 09:47: `npm.cmd run test:unit`: passed, 9 files and 57 tests.
- 2026-07-28 09:48: `npm.cmd run firebase:rules:test`: passed, 2 files and 29 tests.
- 2026-07-28 09:48: `npm.cmd run build`: passed.
- 2026-07-28 09:49: `npm.cmd run test:e2e`: passed, 8 tests and 6 intentional emulator-only skips across desktop Chromium and Pixel 7.
- 2026-07-28 09:50: `npm.cmd run test:e2e:emulated`: passed, 11 tests and 3 intentional skips across desktop Chromium and Pixel 7.
- 2026-07-29 01:10: `npm.cmd run typecheck`: passed after manual acceptance fixes.
- 2026-07-29 01:10: `npm.cmd run lint`: passed after manual acceptance fixes.
- 2026-07-29 01:10: `npm.cmd run check:secrets`: passed, no obvious secrets detected.
- 2026-07-29 01:10: `npm.cmd run test:unit`: passed, 12 files and 64 tests. Required approved unsandboxed execution after sandbox `spawn EPERM`.
- 2026-07-29 01:11: `npm.cmd run test:rules`: passed against the already-running Firestore/Storage Emulators, 2 files and 29 tests.
- 2026-07-29 01:12: `npm.cmd run audit:production`: passed, 0 vulnerabilities.
- 2026-07-29 01:13: `npm.cmd run build`: passed. Required approved unsandboxed execution after sandbox `spawn EPERM`.
- 2026-07-29 01:14: `npm.cmd run test:e2e`: passed, 8 tests and 6 intentional emulator-only skips across desktop Chromium and Pixel 7.
- 2026-07-29 01:15: `node scripts/run-playwright-emulated.mjs`: passed against the already-running Auth/Firestore/Storage Emulators, 11 tests and 3 intentional skips across desktop Chromium and Pixel 7.

## Next Exact Steps

1. Execute `docs/superpowers/plans/2026-07-29-mvp-local-completion.md` Task 1 to add CI and production/test isolation.
2. Continue Tasks 2–3 to remove production local fallbacks and harden Checkout/Payment/Cancellation boundaries before further UI work.
3. Complete the approved ProductWorkspace/Classification batch, followed by Emulator-backed Product images and homepage presentation.
4. Finish Member, Legal, Email, mobile acceptance, and read-only production preparation tasks.
5. After full local verification, deploy production Firestore/Storage Rules and data only when Firebase/Vercel external access is available.

## 2026-07-29 Consolidated Local Completion Plan

- Design: `docs/superpowers/specs/2026-07-29-mvp-local-completion-design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-29-mvp-local-completion.md`
- The plan consolidates the twelve remaining locally executable areas into thirteen independently verifiable tasks.
- Ordering prevents duplicate edits by establishing CI/environment guards first, combining fallback cleanup with transaction-boundary work, combining ProductWorkspace with Classification, and completing the Product image contract before storefront/homepage rendering.

## 2026-07-29 06:49 Execution Update

- Tasks 1–10 are implemented, verified, and committed on `codex/mvp-completion`.
- Task 8 evidence: Unit 89/89, Rules 29/29, member desktop/Pixel 7 E2E 4/4, TypeScript, ESLint, and build passed.
- Task 9 evidence: legal Unit 3/3, public desktop/Pixel 7 E2E 8 passed with 2 emulator-only skips, TypeScript, ESLint, and build passed.
- Task 10 evidence: full Unit 93/93, TypeScript, ESLint, and build passed. Real Resend delivery remains externally gated by DNS/API key.
- Task 11 is in progress: workspace navigation/status copy is bilingual/Chinese and `tests/e2e/workspace-mobile-acceptance.spec.ts` has been added; TypeScript and ESLint pass. The new acceptance test and full suite still need execution before Task 11 can be committed.
- Tasks 12–13 remain pending.

### Next exact steps

1. Start Auth/Firestore/Storage Emulators, run `node scripts/run-playwright-emulated.mjs tests/e2e/workspace-mobile-acceptance.spec.ts`, fix any overflow, then run the full regular and emulated Playwright suites.
2. Run Unit, Rules, TypeScript, ESLint, and build; commit Task 11 as `fix: complete desktop and mobile acceptance`.
3. Implement Task 12 read-only production readiness scripts/SOP with tests.
4. Run Task 13 full verification, update all handoff documents, commit, and push.

### 2026-07-29 07:14 Task 11 update

- UI/UX high-priority shared foundation is implemented and locally checked: focus-visible, skip link, route focus target, reduced motion, Checkout submission lock/live status, 44px Product/Image actions, and root `min-h-dvh`.
- `tests/unit/uiAccessibility.test.ts` passes 3/3; TypeScript and ESLint pass.
- Task 11 remains in progress until all async operations receive the same treatment and the complete desktop/Pixel 7 suites pass.

### 2026-07-29 07:17 Task 12/13 status

- Task 12 has started with backup-path isolation (`.local-backups/` ignored), but its scripts, tests, and SOP are still pending.
- Task 13 remains blocked by incomplete Task 11/12 verification; do not report the local MVP as complete.

### 2026-07-29 07:21 verification evidence

- Task 11 TypeScript, ESLint, and Unit (21 files / 96 tests) pass.
- Production build must be rerun because only compilation and the start of its TypeScript phase were captured.
- Rules, regular Playwright, emulated Playwright, Task 12 implementation, and Task 13 finalization remain pending.

## 2026-07-29 07:49 Final Local Completion

- Tasks 1–13 in
  `docs/superpowers/plans/2026-07-29-mvp-local-completion.md` are complete locally.
- Task 11 committed as `9c9104f`; stateful Emulator E2E now uses one worker
  because it shares seeded Firebase state.
- Task 12 committed as `ae32900`; added three read-only production commands,
  6 contract tests, Deployment/Test Plan updates, and the backup/sync SOP.
- Final review fixes committed as `e84047f`; production tool coverage is now
  8 contract tests and Pixel 7 explicitly covers Classification management.
- Final verification:
  - secret scan: passed, no obvious secrets;
  - production dependency audit: 0 vulnerabilities;
  - TypeScript and ESLint: passed;
  - Unit: 22 files / 104 tests passed;
  - Firestore + Storage Rules: 2 files / 29 tests passed;
  - Next.js build: passed, 31 application routes;
  - regular desktop/Pixel 7 Playwright: 10 passed, 18 emulator-only skips;
  - authenticated Emulator desktop/Pixel 7 Playwright: 25 passed, 3
    mode-specific skips.
- Non-blocking local warnings: Firebase Admin attempted metadata discovery without
  a cloud metadata server, and Playwright reported `NO_COLOR` overridden by
  `FORCE_COLOR`. Neither affected exit status or assertions.

### Remaining external production gates

1. Enable Firebase Blaze and create development/production Storage buckets.
2. Configure Vercel OIDC → GCP Workload Identity and production environment values.
3. Deploy tested Firestore/Storage Rules to development, then production.
4. Back up production and run the read-only Product audit; re-save formal Products
   through the Owner API and verify `productsInternal → productsPublic`.
5. Verify `updates.asteratw.com`, set Resend production credentials, and prove
   actual delivery.
6. Confirm final legal wording, domain/DNS, production smoke, Pixel 7, and physical
   phone acceptance.

No remaining locally executable MVP implementation task is known.

## 2026-07-29 Storefront Manual-Test Fixes

- Verified the production `/brand` 500 is real on `https://astera-oms.vercel.app`; Vercel logs show the same `firebase-admin/auth ERR_REQUIRE_ESM` runtime issue. The code fix is on `codex/mvp-completion` but production remains old until the branch is deployed/merged.
- Added `serverExternalPackages: ["firebase-admin"]` to `next.config.ts` and regression coverage in `tests/unit/nextRuntimeConfig.test.ts`.
- Fixed storefront UX issues found during manual review:
  - `/products` only shows product counts after catalog data is ready;
  - empty catalog copy is consumer-facing and no longer mentions owner setup;
  - `/cart` disables order creation when the cart is empty and shows `請先加入商品`;
  - Cart recipient/shipping/consent fields now include stable `id`, `name`, and useful autocomplete attributes;
  - homepage, brand page, Product listing/detail sidebars, and footer no longer expose buyer-visible system English labels such as `Shopping guide`, `Cart summary`, `Rules`, `Recipient`, or `Checkout`;
  - Footer and Brand contact areas avoid `尚未設定` placeholders and show actionable fallback copy.
- Fresh validation for this batch:
  - `npm.cmd run test:unit -- tests/unit/uiAccessibility.test.ts tests/unit/productionDataSource.test.ts`: passed, 23 files / 107 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed.
  - `npm.cmd run build`: passed, 31 routes.

### Next exact production step

Deploy or merge `codex/mvp-completion` so production receives the Vercel runtime fix. After deployment, rerun route smoke for `/`, `/products`, `/brand`, `/cart`, `/account/profile`, and `/workspace`.

## 2026-07-29 Google Sign-in Follow-up

- Manual preview testing showed the generic `Google 登入未完成，請再試一次。` message after clicking Google sign-in.
- Root-cause investigation found no server-side auth route failure for the sign-in click; the current UI only used `signInWithPopup`, which is fragile on mobile, embedded browsers, and popup-restricted contexts.
- Updated `src/components/auth/AuthProvider.tsx` to:
  - call `getRedirectResult(auth)` during auth initialization;
  - fall back to `signInWithRedirect` when popup sign-in is blocked, closed, cancelled, or unsupported;
  - show clearer messages for `auth/unauthorized-domain`, `auth/popup-blocked`, `auth/popup-closed-by-user`, and other Firebase Auth codes.
- Added regression coverage in `tests/unit/uiAccessibility.test.ts`.
- Fresh validation:
  - `npm.cmd run test:unit -- tests/unit/uiAccessibility.test.ts`: passed, 23 files / 108 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed.
  - `npm.cmd run build`: passed, 31 routes.

If sign-in still fails after this deployment, the next exact check is Firebase Console → Authentication → Settings → Authorized domains. The tested Preview/Production host must be listed there.

## 2026-07-29 Product Publishing Runtime Follow-up

- Manual Preview testing confirmed Google sign-in now works, then raised the next concern: whether the site can publish new Products.
- Root-cause check against latest Preview logs showed multiple server routes still failing before business logic with `firebase-admin/auth ERR_REQUIRE_ESM`, including `/brand`, `/api/cart`, and Product detail routes. Owner-only Product APIs would be affected by the same shared server Auth import.
- Implemented a focused runtime fix:
  - removed the static `firebase-admin/auth` import and `getAdminAuth()` export from `src/lib/firebase/admin.ts`;
  - changed `src/lib/firebase/serverAuth.ts` to verify Firebase ID tokens through Firebase Identity Toolkit `accounts:lookup`;
  - kept custom-claim owner checks using the verified token's `customAttributes.role`;
  - preserved Auth Emulator support by using `FIREBASE_AUTH_EMULATOR_HOST` when present.
- Added regression coverage in `tests/unit/nextRuntimeConfig.test.ts` so shared server Admin SDK code cannot reintroduce `firebase-admin/auth`.
- Fresh validation for this runtime fix:
  - `npm.cmd run test:unit -- tests/unit/nextRuntimeConfig.test.ts`: first failed as expected, then passed after the fix; current result 23 files / 109 tests passed.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed.
  - `npm.cmd run build`: passed, 31 routes.

### Next exact Preview verification

Deploy/push this fix, wait for the `codex/mvp-completion` Preview to become Ready, then test:

1. open `/brand` and confirm it no longer returns 500;
2. sign in as Owner;
3. create a Product and verify the Product save API returns success;
4. confirm the Product appears in `productsPublic`-backed storefront pages.

If `/brand` is fixed but Product save still fails, the next exact check is Vercel runtime credentials for Admin Firestore: Vercel OIDC / GCP Workload Identity or another approved non-long-lived credential path must allow `getAdminFirestore()` to write `productsInternal`, `productVariants`, `saleCampaigns`, classifications, and `productsPublic`.

## 2026-07-29 Storefront/Profile UI Follow-up

- Completed requested UI/behavior updates:
  - homepage header placement now uses `ASTERA OMS` as the large brand heading and `泰國 GL / 藝人周邊代購` as the smaller category line;
  - member profile form now displays separate `姓` and `名` fields;
  - profile save still submits the existing combined `displayName`, preserving the current API and Firestore model;
  - successful profile save redirects to `/`;
  - public footer no longer renders disabled social placeholders such as `Instagram：暫不提供`.
- Follow-up verification found the member profile save failure on Preview is caused by missing Vercel Admin Firestore credentials: Vercel logs for `POST /api/member/profile` show `Could not load the default credentials`. This is not caused by blank birthday; blank birthday is accepted and now omitted from the client payload.
- Fresh validation:
  - `npm.cmd run test:unit -- tests/unit/uiAccessibility.test.ts`: red before fix, green after fix; current result 23 files / 112 tests passed.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed.
  - `npm.cmd run build`: passed, 31 routes.

## 2026-07-29 Vercel OIDC / GCP Workload Identity Preparation

- Confirmed latest Preview profile/cart failures are Admin Firestore credential failures, not Firebase Auth or form validation failures.
- Local shell cannot find `gcloud` on PATH, so GCP IAM resources could not be created from this environment. A `winget install Google.CloudSDK` attempt reached the installer/UAC stage but did not return a completion result inside this Codex session.
- Firebase CLI read-only project list confirmed:
  - production Project ID: `astera-oms-prod`;
  - production Project Number: `1032606875618`.
- Vercel local project file confirmed:
  - Vercel Project ID: `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`.
- Program-side OIDC support is implemented:
  - `src/lib/firebase/admin.ts` now uses `@vercel/oidc` and `google-auth-library` `IdentityPoolClient` when Workload Identity env vars are present;
  - no long-lived service-account private key is required for Vercel runtime;
  - `scripts/check-production-env.mjs` reports OIDC env var presence without printing values;
  - `scripts/setup-vercel-gcp-oidc.ps1` contains the exact `gcloud` setup commands.
- Fresh validation:
  - `npm.cmd run test:unit -- tests/unit/nextRuntimeConfig.test.ts tests/unit/productionScripts.test.ts`: passed, 23 files / 114 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed.
  - `npm.cmd run build`: passed, 31 routes.

### Next exact external step

Install or expose Google Cloud SDK `gcloud` on PATH, then run:

```powershell
.\scripts\setup-vercel-gcp-oidc.ps1 `
  -ProjectId "astera-oms-prod" `
  -ProjectNumber "1032606875618" `
  -VercelProjectId "prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ"
```

Then add the printed `GCP_*` / `GOOGLE_CLOUD_PROJECT` values to Vercel Production
and Preview, redeploy, and retest member profile save, cart API, and Owner
Product save.

## 2026-07-29 Manual UI/UX Follow-up

- Completed buyer-facing manual-test fixes without changing Firestore
  collections, product/cart data, prices, or checkout APIs:
  - `/products` and homepage recommendations now separate loading, empty, and
    error states; errors provide a 44px `重新載入` control.
  - `/brand` renders social entries only when the channel is active and has a
    URL. Unavailable-social and Instagram placeholder copy is not shown.
  - Public route headings and transaction copy use buyer-facing Traditional
    Chinese, replacing visible `Storefront`、`Checkout`、`Cart`、`Customer`、
    `Owner`、`Order`、`Actions`、`items` and `bank transfer` wording.
  - Footer/navigation/product controls use 44px touch targets, and touched
    public route shells use `min-h-dvh` for mobile browser chrome stability.
  - Empty-cart checkout stays natively disabled; browser coverage protects its
    CTA and checkout form semantic attributes.
- Regression evidence:
  - `tests/e2e/public-smoke.spec.ts` failed before implementation because
    `/brand` showed unavailable-social copy and public pages showed English
    developer labels; it passed afterward for Desktop Chrome and Pixel 7.
  - The focused empty-cart suite passed for Desktop Chrome and Pixel 7.
- Final validation: `typecheck`, `lint`, and `build` passed; Unit Test passed
  24 files / 116 tests; Firestore/Storage Rules passed 2 files / 29 tests;
  full public Smoke and authenticated Emulator Playwright passed. The two
  recommendation checks are intentionally skipped only outside Emulator mode.
- Next local UI task: give authenticated payment, order-history, and order-detail
  data boards the same retry/loading pattern, then validate through Emulator
  Playwright. Preview testing of those writes remains gated by OIDC credentials.

## 2026-07-29 Authenticated Member Board Reliability Follow-up

- Updated the member-facing payment request, order history, and order detail
  boards without changing Collections, API payloads, pricing, or permissions:
  - `PaymentRequestsBoard` and `OrderHistoryBoard` now expose announced error
    states with a 44px `重新載入` action, and payment requests have a distinct
    no-data state instead of an unusable empty form.
  - `OrderDetailBoard` now shows login/loading/error states before evaluating
    whether an order exists, preventing an initial false `找不到這張訂單` message.
  - Payment reports and cancellation requests disable their action while a
    request is in flight and announce status feedback to assistive technology.
- Added `productionDataSource.test.ts` regression coverage. The new assertion
  failed first because the three boards did not contain retry controls, then
  passed after the implementation.
- Fresh local validation passed:
  - `npm.cmd run test:unit`: 24 files / 117 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed.
  - `npm.cmd run firebase:rules:test`: 2 files / 29 tests.
  - `npm.cmd run build`: Turbopack compilation and TypeScript stage completed
    successfully.
- Emulator Playwright was started in an isolated 3100 test server with Auth,
  Firestore, and Storage emulators confirmed on ports 9099/8080/9199. The
  managed execution layer did not return a final Playwright result and left
  child processes running, so those exact test processes were stopped. Do not
  record Emulator Playwright as passed for this batch; rerun
  `npm.cmd run test:e2e:emulated` in a persistent terminal before release.

### Next exact step

Rerun the authenticated Emulator Playwright suite in a persistent terminal, then
commit this member-board batch without staging the user-owned `AGENTS.md`. After
that, no locally executable MVP implementation task is known; continue with the
external production gates listed above.

## 2026-07-29 Vercel OIDC / GCP Workload Identity Execution Attempt

- Google Cloud SDK is installed and interactive login completed with
  `astera.0920@gmail.com`; no password or secret was recorded.
- Executed `scripts/setup-vercel-gcp-oidc.ps1` with the confirmed values:
  - Firebase/GCP project: `astera-oms-prod` (`1032606875618`)
  - Vercel project: `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`
  - intended service account:
    `astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com`
- GCP rejected the operation before any OIDC resource could be created:
  `astera.0920@gmail.com does not have permission to access projects/astera-oms-prod`.
  API enablement and service-account lookup both returned permission denied.
- Root cause is therefore missing project-level GCP IAM authority for the logged
  in account, not an application code failure. No Vercel environment variable
  was written and no long-lived credential was created.
- Follow-up screenshot showed `astera.0920@gmail.com` listed as Owner in the
  Console, but a refreshed access-token check and a second read-only
  `gcloud projects describe astera-oms-prod` still returned
  `PERMISSION_DENIED`. Treat the grant as unverified until GCP API access works;
confirm the Console-selected Project ID is exactly `astera-oms-prod` and that
the IAM change is saved/has propagated.
- Console inspection on 2026-07-30 found the browser itself is signed in as
  `ting1811tin@gmail.com`, an explicit project Owner. A CLI login request for
  that account was rejected because the browser consent flow auto-selected
  `astera.0920@gmail.com`. Explicitly select `ting1811tin@gmail.com` in the
  Google consent chooser, then rerun the OIDC script; no IAM resource has been
  changed by this diagnosis.

### Next exact external step

An existing `astera-oms-prod` project Owner/IAM administrator must grant
`astera.0920@gmail.com` either temporary `roles/owner`, or the least-privilege
combination needed by `setup-vercel-gcp-oidc.ps1`: Service Usage Admin, Service
Account Admin, Project IAM Admin, and Workload Identity Pool Admin. Once the
role assignment has propagated, rerun the same script, add its printed
`GOOGLE_CLOUD_PROJECT`/`GCP_*` values in Vercel Preview and Production, redeploy,
and verify profile, cart, and Owner Product writes.
## 2026-07-30 Vercel OIDC / GCP Workload Identity Completed

- Switched the Google Cloud CLI to `ting1811tin@gmail.com`, which is a verified
  `astera-oms-prod` Owner. `astera.0920@gmail.com` remains a pending
  `roles/resourcemanager.projectOwnerInvitee`, not an effective API Owner.
- Fixed a Windows PowerShell first-run issue in
  `scripts/setup-vercel-gcp-oidc.ps1`: an expected `gcloud ... describe`
  not-found response no longer terminates the script before it can create the
  resource. Added focused regression coverage in
  `tests/unit/productionScripts.test.ts`.
- Created and read-back verified:
  - service account `astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com`;
  - active Workload Identity Pool `vercel-oidc`;
  - active Provider `vercel` at `https://oidc.vercel.com`;
  - project-claim-restricted `roles/iam.workloadIdentityUser` binding for
    Vercel Project `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`.
- Confirmed the service account has only the required project roles:
  `roles/datastore.user`, `roles/firebaseauth.viewer`, and
  `roles/storage.objectViewer`. No service-account key was created.
- Added the seven documented OIDC environment variables as Vercel Sensitive
  variables to both Preview and Production; the Vercel CLI read-back lists all
  fourteen target bindings.
- Rebuilt the existing `codex/mvp-completion` Preview successfully with the
  new settings: `https://astera-n850fxxzw-astera-oms.vercel.app`.

### Verification and next exact step

- GCP resource and IAM read-backs passed.
- Vercel environment-variable read-back passed for Preview and Production.
- Vercel Preview build status is `Ready`.
- Still required: authenticate on the rebuilt Preview, then verify member
  profile save, cart update, and Owner Product save. This is the first runtime
  proof that Vercel can exchange its OIDC token and call Firestore. Do not
  promote to Production before these three tests pass.

## 2026-07-30 Runtime verification: Firebase Admin OIDC compatibility correction

### Reproduced failure and root cause

- On Preview deployment `dpl_5LiQ4kpw5HbEwVTLX4qJP7151cXW`, the signed-in
  member profile form again failed using the non-personal verification values
  `測試`, `preview-oidc-test`, and `0900000000` (birthday blank).
- The safe diagnostic log recorded:
  `Failed to initialize Google Cloud Firestore client with the available
  credentials. Must initialize the SDK with a certificate credential or
  application default credentials to use Cloud Firestore API.`
- This proves the provider issuer/audience correction is not the failing layer.
  Firebase Admin 14 rejects the custom `IdentityPoolClient` wrapper before any
  Firestore request or IAM data-permission check occurs.

### Corrective change ready for Preview

- `src/lib/firebase/admin.ts` now writes the short-lived Vercel OIDC subject
  token and external-account configuration only to the isolated runtime temp
  directory, then initializes Firebase Admin via `applicationDefault()`.
- No long-lived service-account key is introduced. The subject-token file is
  refreshed before later Firestore/Storage calls so a warm Function can use a
  newly issued Vercel OIDC token.
- `tests/unit/nextRuntimeConfig.test.ts` was updated red first to require this
  Firebase-Admin-compatible credential path, then passed after implementation.
- Fresh local verification passed: Unit tests **24 files / 120 tests**,
  TypeScript, and ESLint.

### Next exact step

1. Commit and push this source/docs change, then wait for the branch-stable
   Preview alias to point to its Ready deployment.
2. Repeat the same profile save. Expected result: a redirect to `/`.
3. If it succeeds, continue directly with cart persistence, then Owner Product
   API/projection verification. If it fails, read only the new Vercel Function
   log before changing any IAM configuration.

## 2026-07-30 Manual Preview product verification: SKU and campaign projection fixes

### Reproduced defects

- After a successful Owner no-content-change save of existing test product
  `prod_002`, Product SKU changed from the UI fallback `AST-P000001` to
  `AST-P000002`. The actual saved identifier must come from the Server, never
  from a client-generated fallback or list position.
- The same save correctly refreshed the front-end variant name and price, but
  the front-end still rendered `活動：未設定` and rejected the cart action. The
  public projection contained campaigns without `productId`; the public mapper
  rejects such records as invalid, so it removed every Campaign client-side.

### Corrective source changes ready for Preview

- `resolveServerManagedProductSku()` now establishes a deterministic formal
  SKU for legacy documents, advances `siteSettings/system-sequences` past it,
  and ignores all client SKU values. Formal existing SKUs remain unchanged.
- An existing legacy Variant SKU is migrated to the formal sequence only when
  no `orderItems` document references that Variant. Referenced Variant SKUs
  remain immutable, preserving order snapshots and the formal SKU rule.
- `productsPublic.campaigns[]` now includes `productId`, matching its typed
  public contract and allowing the storefront to retain an open Campaign.
- Regression tests were added red first for legacy SKU migration, ordered
  Variant preservation, and the public Campaign identifier; all are green.
- Fresh checks passed: product unit test (15 tests), TypeScript, and ESLint.

### Next exact step

1. Push the changes and wait for Preview.
2. Re-save `prod_002` once: it must remain `AST-P000002`, migrate its
   unreferenced legacy Variant to `AST-P000002-V001`, and show its Campaign
   and price in `/products`.
3. Add it to the signed-in cart, reload, and confirm the saved cart item
   remains. Do not proceed to Checkout until this persistence test passes.

## 2026-07-30 Manual Preview cart persistence verification

### Passed runtime checks

- The signed-in member added `92帽子` to cart; the storefront summary showed one
  item, NT$520, and Preorder.
- After navigating to `/cart` and performing a full reload, the server-backed
  cart still contained the item. This is direct evidence that the protected
  `/api/cart` write/read path works with Vercel OIDC and Firestore.

### Defect found and source fix ready for Preview

- The saved cart row displayed internal IDs (`prod_002`, `var_002`) instead of
  the public Product and Variant names. This exposes implementation details and
  prevents a member from confidently checking the item.
- `CartBoard` now resolves each cart line against the already loaded public
  catalog and displays the Product / Variant names. During initial catalog load
  it uses a buyer-facing loading label rather than an internal ID.
- A red-green UI regression test requires those public names and rejects the
  former internal-ID markup. Fresh checks passed: focused UI unit tests (9),
  TypeScript, and ESLint.

### Next exact step

1. Push this cart display fix and wait for Preview.
2. Reload `/cart` with the persisted item; it must display `92帽子` and
   `一般款`, not document IDs.
3. Then perform a separate validated Checkout smoke test without submitting a
   real order unless the test-data handling decision permits it.

## 2026-07-30 Cart hydration overwrite defect

### Reproduced runtime failure

- The first full reload within the prior Preview retained the signed-in cart.
  After the next Preview deployment, opening `/cart` rendered an empty cart.
- Root cause: `CartBoard` initialized with an empty local cart and its sync
  effect immediately issued `PUT /api/cart` before its member-cart `GET` had
  completed. The empty write overwrote the valid Firestore cart.

### Corrective change ready for Preview

- Added `shouldSyncCloudCart(memberUid, loadedMemberUid)` and a
  `loadedMemberUid` hydration guard. A signed-in cart cannot be written until
  that same member's cloud cart GET completes successfully.
- The guard also prevents the previous member's cart from being sent while a
  different signed-in member is still loading.
- Regression tests were written red first for pre-hydration, cross-member, and
  anonymous behavior, then passed. Fresh checks passed: cart unit tests (4),
  TypeScript, and ESLint.

### Next exact step

1. Push this change and wait for Preview.
2. Add `92帽子` again (the accidental empty overwrite already happened), reload
   `/cart` twice, and confirm it remains with public Product / Variant names.
3. Only then resume Checkout testing with deliberate test-data handling.

### Preview validation completed

- Preview deployment `dpl_4yxfij3Hc9csf2GaQsQhamvPxEgV` reached Ready.
- The member added `92帽子` again, then `/cart` was reloaded twice. The cart
  retained one item and displayed `92帽子` / `一般款`, total NT$520, Preorder.
- The hydration guard therefore prevents the empty initial state from
  overwriting Firestore, and the buyer-facing cart label fix is verified.
## 2026-07-30 OIDC Runtime Verification Root Cause and Correction

- Authenticated Preview verification reached the signed-in member profile form.
  The random, one-off Preview hostname is not a Firebase Authorized Domain, so
  verification continued on the branch-stable Preview alias instead.
- Submitting a deliberately non-personal test profile (name `測試`, community ID
  `preview-oidc-test`, mobile `0900000000`, blank birthday) reproduced the
  server-side save failure. The form remained on `/account/profile` and showed
  the standard failure message; this is not a birthday-validation failure.
- Vercel Security settings were inspected: Secure Backend Access with OIDC
  Federation is already enabled in **Team** issuer mode. Its live issuer is
  `https://oidc.vercel.com/astera-oms` and its audience is
  `https://vercel.com/astera-oms`.
- Root cause: the first GCP Provider setup used Vercel's global issuer and the
  Google provider resource name as allowed audience. The server also requested
  a custom Vercel token audience. These values do not match the enabled Vercel
  Team-mode token. This conclusion is confirmed against Vercel's official GCP
  OIDC guide and the live Project Security settings.
- Corrected the active GCP Provider with:
  - issuer `https://oidc.vercel.com/astera-oms`;
  - allowed audience `https://vercel.com/astera-oms`.
- Added a red-green regression assertion and changed
  `src/lib/firebase/admin.ts` to obtain the default Vercel Function token with
  `getVercelOidcToken()` rather than requesting the Google audience as a custom
  Vercel audience.
- The subsequent Preview must be rebuilt from this source revision before the
  profile, cart, and Owner Product runtime tests can be repeated.

### Follow-up diagnostic deployment

- The first rebuilt Preview still returned a generic member-profile failure.
  Vercel request logs confirm `POST /api/member/profile` reached the Function,
  but caught errors are not included in standard request logs.
- Added a safe server-side diagnostic that records only the error message under
  `member_profile_save_failed`; it does not record the Firebase token, email,
  phone number, name, or request body. A dedicated unit test first failed and
  then passed. Deploy this diagnostic revision, repeat the same test profile
  save, and use the resulting Vercel Function log as the next root-cause input.

## 2026-07-30 Reversible Checkout Preview test — baseline

- Approved test design: `docs/superpowers/specs/2026-07-30-reversible-checkout-test-design.md`.
- Execution plan: `docs/superpowers/plans/2026-07-30-reversible-checkout-preview-test.md`.
- Environment: branch-stable Preview `https://astera-oms-git-codex-mvp-completion-astera-oms.vercel.app/`; Production was not opened or modified.
- Authenticated account: `astera.0920@gmail.com` (Owner custom claim). This Checkout run verifies member data paths but not non-Owner Workspace denial.
- Browser baseline at `2026-07-30 07:48:40 +08:00`: `/cart` loaded successfully with zero items and its CTA disabled; no pre-existing cart item was removed.
- Approved safety boundary: create only clearly labelled `TEST-ONLY` data, use NT$1, do not report/confirm/reverse payment or issue a refund, cancel the unpaid item through the member UI, and archive rather than delete the test catalog data.

## 2026-07-30 Reversible Checkout Preview test — ProductWorkspace load-race incident

### Reproduction and impact

- During the approved test-data setup, `/workspace/products` visibly displayed `商品資料載入中。` while its Product form remained editable and its `儲存商品` action remained enabled.
- Entering the dedicated test values before the product GET completed caused the later asynchronous selection of the first list row, `prod_002`, to supply that document ID to the save request. The first save therefore changed `prod_002` rather than creating a new Product.
- The test run stopped immediately before cart, Checkout, payment, cancellation, notification, or archival testing. No Order, PaymentRequest, ConsentRecord, Audit Log, Payment, Adjustment, or CancellationRequest was created.

### Safe data correction

- The known pre-test values verified in prior Preview evidence were restored through the protected Owner API: Product `92帽子`, Variant `一般款`, Campaign `92帽子預購`, Variant default price NT$520, Campaign price NT$520, `Published` Product state and `Open` Campaign state.
- Product ID remains `prod_002`; formal Product SKU remains `AST-P000002`; formal Variant SKU remains `AST-P000002-V001`. No SKU was manually changed.
- The existing public description, internal note, artist classification and supplement flag were preserved from the loaded record. Start/end date fields are currently blank after restoration; this matches the final returned Preview record but the earlier handoff did not record their original values, so date precision cannot be asserted retroactively.

### Root cause and source correction pending Preview verification

- Root cause is client-side state ownership, not Firestore rules or Server SKU allocation: `ProductWorkspace` auto-selected the first product after `GET /api/workspace/products` while allowing a blank initial form to be edited and submitted.
- `src/components/workspace/ProductWorkspace.tsx` now has an explicit `isProductsLoading` guard. Until the first product load settles, it disables the New Product action, product selection, save action, Product form fieldset, Variant/Campaign fieldsets and archive action; the submit handler independently rejects a request during loading.
- `tests/unit/uiAccessibility.test.ts` contains the red-green regression contract for the loading gate. The test first failed against the old source, then passed after the guard was added.
- Fresh local evidence: Unit tests **24 files / 126 tests**, TypeScript and ESLint all pass. Preview deployment and live browser confirmation remain required before resuming Task 2.

### Exact resume sequence

1. Commit and push only the ProductWorkspace guard, its test, and these execution documents; keep user-owned `AGENTS.md` unstaged.
2. Wait for the `codex/mvp-completion` Preview deployment, reload `/workspace/products`, and verify no Product mutation control is enabled while `商品資料載入中。` appears.
3. Wait for `商品資料已載入。`, click `新增` deliberately, then create a new clearly labelled test Product. Confirm its server-generated ID is not `prod_002` before entering a Campaign or opening `/products`.
4. Resume the existing reversible Checkout test plan only after that public projection check passes.

## 2026-07-30 Reversible Checkout Preview test — live data creation and order-reader incident

### Completed Preview evidence before the reader failure

- The deployed loading guard was exercised by waiting for `商品資料已載入。`, clicking `新增`, and confirming the blank Product ID displayed `儲存時自動建立` before any test value was entered.
- The protected Owner Product API created a distinct test Product with browser-visible ID `ZdW58A6aZqJLVHvioU6W`, Product SKU `AST-P000003`, Variant SKU `AST-P000003-V001`, name `【測試專用】Preview Checkout — 請勿付款`, Variant `Test Variant（測試規格）`, published state, Open preorder Campaign, and NT$1 default/Campaign price.
- `/products` verified the `productsPublic` projection: the test Product, Variant, Campaign and NT$1 price are public; SKU, cost and internal note are not visible. `/cart` retained the single test line after a full reload.
- One and only one Checkout was submitted with the approved non-real recipient data and both legal consents. The buyer UI returned order number `AST-20260730-0001`, cleared the cart, and reported that its payment request was created. No payment report, confirmation, reversal, refund, adjustment or second Checkout was submitted.
- Browser automation could display Campaign start/end datetime values before save but the returned record did not preserve them. The Open Campaign remains purchasable because its explicit saved state is Open; record this as an unresolved datetime-input verification item, not as a Checkout blocker.

### New blocker: order history rendered Firestore Timestamp directly

- Opening `/orders` for the newly created test order produced the Next error page. The captured browser console error was React error #31 for an object with keys `{seconds, nanoseconds}`.
- Root cause: `src/lib/order/repository.ts:listMemberOrders()` cast Firestore document data directly to `OrderRecord` / `OrderItemRecord`; `OrderHistoryBoard` then rendered `order.createdAt` directly. Firestore client Timestamp objects crossed the repository boundary into React.
- `tests/unit/orderRepository.test.ts` was written first with real `listMemberOrders()` behavior and controlled Firestore Timestamp-shaped documents. It failed because `createdAt` remained an object.
- Source correction pending Preview deployment: normalize order and order-item `createdAt` / `updatedAt` values to ISO strings at the repository boundary, supporting both Firebase `toDate()` and `{ seconds, nanoseconds }` representations. Focused suite now passes **25 files / 127 tests**, plus TypeScript and ESLint.

### Exact resume sequence

1. Commit/push the Timestamp normalization and handoff update, keeping `AGENTS.md` unstaged.
2. Reload `/orders` in the stable Preview; it must show `AST-20260730-0001` without a React error and show a textual created date.
3. Open its detail page, verify its single item is awaiting payment and select it for the normal direct-cancellation path.
4. Submit exactly one cancellation with `Preview Checkout reversible test — no payment, do not fulfil`, verify all terminal statuses, then archive the Product and Campaign.

## 2026-07-30 Reversible Checkout Preview test — cancellation-record timestamp correction

- After the order-history correction deployed, `/orders` correctly displayed the isolated order `AST-20260730-0001`; the test Product and cart were already verified. Direct navigation to that order's detail route then still showed the member-safe read failure.
- Firestore Rules are not the cause: `cancellationRequests` grants a signed-in member `get` / `list` access when `resource.data.memberUid == request.auth.uid`.
- The remaining repository path, `listMemberCancellationRequests()`, returned raw Firestore Timestamp-shaped `createdAt`, `reviewedAt`, and `refundCompletedAt` values. Such an object must never cross the repository boundary into React.
- Red-green test added in `tests/unit/orderRepository.test.ts`: the raw structural Timestamp test initially failed with `{ seconds, nanoseconds }`; it now passes after `src/lib/order/repository.ts` normalizes all cancellation request time fields using the same ISO conversion as orders.
- Local verification after this correction: Unit **25 files / 128 tests**, TypeScript, ESLint, and `next build` pass. No Rules, schema, payment, cancellation transaction, production data, or production deployment was changed.
- Next exact action: deploy this Preview-only reader correction, reload the existing `order_h6rg9HE7zrVrnNqzOaF6CLCVERB2_20260730000428083_1` detail page, and only if its sole item is visibly awaiting payment submit exactly one approved direct cancellation. Do not perform any payment action.

## 2026-07-30 Reversible Checkout Preview test — protected member-detail reader

- Preview browser evidence isolated the remaining detail failure to `Missing or insufficient permissions` on the Client SDK query for `cancellationRequests`. This is an undeployed-production-Rules mismatch; it is not an Order, PaymentRequest, or data-integrity failure.
- Added protected `GET /api/orders/[id]`. It requires the Firebase ID token, reads with the existing OIDC-backed Admin SDK, verifies `order.memberUid === claims.uid`, returns only that member's Order, OrderItems, one same-member PaymentRequest, and same-member CancellationRequests, and serializes Firebase Timestamp values before JSON leaves the server.
- `OrderDetailBoard` now uses this endpoint instead of a Client SDK cancellation-request query. It displays the formal `orderNumber` (with document-ID fallback only for legacy data) and PaymentRequest status / payable amount. `OrderHistoryBoard` also now displays the formal `orderNumber`.
- Tests first failed for the missing route and raw structural Timestamp; `tests/unit/memberOrderDetailApi.test.ts` now proves own-member access and cross-member `403`, while `tests/unit/productionDataSource.test.ts` guards protected endpoint use and formal order-number display. Fresh local result: Unit **26 files / 133 tests**, TypeScript, ESLint, and production build all pass.
- Next exact action: wait for this branch Preview, open the existing test order detail, verify `AST-20260730-0001`, one awaiting-payment item and open NT$1 PaymentRequest, then submit exactly one approved direct unpaid cancellation. No payment operation is permitted.

## 2026-07-30 Reversible Checkout Preview test — completed evidence

- Environment: branch-stable Preview only, `https://astera-oms-git-codex-mvp-completion-astera-oms.vercel.app`; Production was never opened, changed, or deployed.
- Isolated catalog data created through the Owner API: Product ID `ZdW58A6aZqJLVHvioU6W`, Product SKU `AST-P000003`, Variant SKU `AST-P000003-V001`, Product `【測試專用】Preview Checkout — 請勿付款`, Variant `Test Variant（測試規格）`, Campaign `TEST-ONLY Preview Checkout — 請勿付款`, NT$1. It was publicly visible without SKU/cost/internal-note disclosure before Checkout.
- Exactly one Checkout created Order document `order_h6rg9HE7zrVrnNqzOaF6CLCVERB2_20260730000428083_1` and formal order number `AST-20260730-0001`. Browser evidence confirmed the cart cleared. The confirmed pre-cancellation state was one `awaitingPayment` item and one open PaymentRequest for NT$1. The approved non-real recipient details were used. Notification status is not exposed in the member UI; no duplicate Checkout was sent.
- One and only one direct unpaid cancellation was submitted with reason `Preview Checkout reversible test — no payment, do not fulfil`. The immediately reloaded and separately reloaded terminal UI shows Order `已取消 / NT$0`, the sole Item `已取消`, and PaymentRequest `已取消 / 應付 NT$0`. No pending CancellationRequest was created; no payment report, confirmation, reversal, adjustment, refund, or Owner approval action occurred.
- The test Product and its Campaign were saved as `Archived` through the Owner Workspace, never deleted. A fresh public `/products` read showed only existing `92帽子`; the exact test Product is no longer public.
- Retained intentionally: Order, OrderItem, PaymentRequest, ConsentRecord, Audit Log, and any Checkout notification-event record. They are immutable operational evidence and must not be deleted to make a test look clean.
- All acceptance criteria in `docs/superpowers/specs/2026-07-30-reversible-checkout-test-design.md` are met, except non-Owner authorization and Campaign datetime input persistence, which were explicitly out of this run's scope / recorded follow-up. The next independent work item is the production Firestore Rules deployment checklist, then non-Owner emulator / Preview authorization coverage.

## 2026-08-02 上線收尾：Vercel redeploy 與 Production smoke

### Completed

- Vercel Production was redeployed from `codex/mvp-completion` with
  `npx vercel --prod --yes`; the deployment reached Ready and the alias remains
  `https://astera-oms.vercel.app`.
- Live browser verification after Client Firestore hydration displayed the
  published Production `92帽子` product, campaign, price and detail link.
- `scripts/smoke-production.mjs` now accepts `--product-id` for hydrated
  storefront pages. The explicit Production check passed all five routes:
  `/`, `/products`, `/terms`, `/privacy`, and `/products/prod_002`.
- Focused smoke Unit tests passed 16/16. Firebase Rules Emulator passed 30/30;
  TypeScript, ESLint and secret scan passed. Production product projection
  remains audited clean at two internal / two public products with zero issues.

### External blockers and exact next steps

1. Vercel Production has Firebase/OIDC variables and the two Resend address
   variables, but no `RESEND_API_KEY`. Add it as a Production Secret only after
   Resend domain verification, then redeploy and perform actual order and
   payment-confirmation delivery tests.
2. `asteratw.com`, `www.asteratw.com`, and `updates.asteratw.com` currently
   return NXDOMAIN and no domains are attached to the Vercel project. Register
   or connect the domain, configure the Vercel records and `www` redirect,
   add Firebase Authorized Domains, then add Resend SPF/DKIM records.
3. A formal Production payment account cannot be created without Owner-provided
   bank name, branch, account name and last five digits. Enter it once in
   `/workspace/payments`; never send a full account number in chat.
4. Production image upload is code- and Rules-ready, but needs an Owner session
   and a real JPEG/PNG/WebP file (max 5 MB, max 8 per product) to verify upload,
   ordering, alt text, projection and responsive rendering.
5. Final member/Owner, non-Owner/Helper, desktop, Pixel 7 and physical-phone
   acceptance remains pending until these external gates are cleared.

## 2026-08-02 外部上線關卡再次檢查

- DNS read-only check: `asteratw.com`, `www.asteratw.com`, and
  `updates.asteratw.com` are still NXDOMAIN.
- `npx vercel domains ls` reports zero domains attached to the Vercel project.
- Vercel Production variable names include Firebase/OIDC and
  `RESEND_FROM_EMAIL` / `RESEND_REPLY_TO_EMAIL`; `RESEND_API_KEY` is absent.
- Payment account and image upload remain intentionally Owner-operated because
  they require real bank metadata and an approved image file. No sensitive
  values were entered or transmitted by automation.
- Anonymous responsive smoke passed at 390×844, 768×900 and 1365×900 with no
  horizontal overflow. Authenticated member/Owner and physical-device checks
  remain pending.

## 2026-08-02 Production `/payments` runtime fix

- Production member navigation to `/payments` could render the Next error page
  after a PaymentRequest existed. Root cause was `listMemberPaymentRequests()`
  returning Firestore Timestamp objects; `PaymentRequestsBoard` rendered
  `request.createdAt` directly, causing React error #31.
- Added a red-green regression in `tests/unit/paymentRepository.test.ts`, then
  normalized `createdAt`, `dueAt` and `updatedAt` at the payment repository
  boundary for both Firebase `toDate()` and structural `{ seconds, nanoseconds }`
  timestamps. Owner payment-request reads use the same normalization.
- Verification: focused test 1/1, full Unit 29 files / 148 tests, TypeScript,
  ESLint, Build and Production smoke 5/5 passed.
- Deployed to Production with Vercel; `/payments` now returns HTTP 200 and the
  anonymous page renders without browser errors. Authenticated payment-report
  submission still requires a signed-in member session for final confirmation.

## 2026-08-02 收款帳戶、付款複選與配送方式更新

- Workspace dashboard now has an explicit `收款帳戶設定` card linking to
  `/workspace/payments#payment-accounts`; the Owner-only panel remains protected
  and stores only bank name, branch, account name and last five digits.
- Member `/payments` now uses checkbox selection for multiple PaymentRequests.
  One report sends the transfer amount to the protected Server API, which creates
  linked pending-review Payment records with a shared `paymentGroupId` and keeps
  each PaymentRequest independently confirmable/auditable.
- Checkout now offers only `7-Eleven 賣貨便`. New orders no longer collect or
  persist address/store fields; legacy order records remain readable for history.
- Production browser verification after deployment showed the disabled single
  delivery option and removed store-information field. Full multi-request
  reporting still needs an authenticated Member session and real transfer data.

## 2026-08-02 付款複選超額保留修正

- 修正多筆付款請求回報的超額金額遺失問題：Server 將無法分配到請求餘額的
  金額保留在同一 `paymentGroupId` 的最後一筆 Payment，Owner 確認後會正確
  寫入 `unallocatedAmountTwd`，不建立 Wallet。
- 驗證：付款／取消流程 Playwright（桌機、手機）2/2 通過；付款 Unit
  8/8 通過。完整 Unit、Rules、TypeScript、ESLint、Build 與 Production
  smoke 的既有綠燈結果保留。
- 修正已部署至 `https://astera-oms.vercel.app`；Production smoke 5/5
  通過，`/workspace`、`/workspace/payments`、`/payments`、`/cart`、`/brand`
  皆回傳 HTTP 200。

## 2026-08-02 ProductWorkspace 欄位溢出修正

- 修正 Variant／Campaign 在窄欄位或平板寬度下 label 與 input/select 黏在一起的
  問題。欄位網格、卡片與控制項加入 `min-w-0`／`w-full`，讓雙語 label 正常
  換行且控制項不超出自己的 grid track。
- UI contract 14/14、Workspace UI Playwright 桌機／手機 4/4、TypeScript、
  ESLint、Build 與 Production smoke 5/5 通過；修正已部署 Production。

## 2026-08-02 會員匯款帳戶與訪客登入閘門

- 新增 `memberPaymentAccounts` Server-only Collection：會員最多 5 筆、完整帳號只在 Server 保存、前端只收到遮罩值；封存採會員申請／Owner 核准，不實體刪除。
- `POST /api/payments` 現在要求並保存會員來源帳戶與 Astera 收款目的地帳戶的遮罩快照；建立訂單前不攔截帳戶，付款回報時才驗證。
- 新增 `/account/bank-accounts`、Owner 封存申請審核面板與付款回報來源帳戶選擇。
- 公開商品列表／詳情加入購物車前要求 Google 登入；Checkout Server 驗證會員資料完整性；商品列表改響應式 Grid、商品圖片 4:5，並加入公開 Header。
- 驗證：Unit 36 files／169 tests、Rules 31 tests、Emulator Playwright 31 passed／3 skipped、公開 smoke 桌機／手機 16 passed；TypeScript、ESLint、Build 與 secret scan 通過。Production 部署與真人帳戶驗收尚待下一批。

## 2026-08-02 Preview 真人驗收準備

- 以目前 `codex/mvp-completion` 建立 Vercel Preview：
  `https://astera-6pgj8iggp-astera-oms.vercel.app`；Vercel build 完成，路由包含
  `/account/bank-accounts`、會員帳戶 API、付款回報與 `/terms`／`/privacy`。
- 直接 HTTP smoke 收到 Vercel SSO 302，確認 Preview 專案啟用存取保護；未以
  `--public` 或其他方式繞過保護。
- In-app browser 可載入 Preview，但 Google `signInWithPopup` 未開出可操作的登入
  視窗；會員新增／封存／付款回報真人驗收尚未開始，Production 部署刻意暫停。
- 下一精確步驟：使用者在自己的瀏覽器開啟上述 Preview 並完成 Google 登入，回覆
  「Preview 已登入」；接著驗收 `/account/bank-accounts` 新增一筆、提出封存申請、
  Owner 核准，再於 `/payments` 選兩筆付款請求提交一次付款回報。驗收通過後才執行
  `npx vercel --prod --yes`。

## 2026-08-02 整站改版與台新對帳第一批

- 新增設計規格與執行計畫：
  `docs/superpowers/specs/2026-08-02-astera-storefront-redesign-design.md`、
  `docs/superpowers/plans/2026-08-02-astera-storefront-redesign.md`。
- 新增 `/checkout` presentation route；購物車新增 `前往結帳` 入口，仍沿用既有
  `POST /api/checkout`、Campaign 拆單、Consent 與冪等邏輯，建立訂單不檢查銀行帳戶。
- 公開 Header、首頁、Campaign／商品推薦、商品 Grid、商品列表與商品詳情已開始套用
  新版品牌層級、4:5 圖片、桌面／平板／手機欄數與買家文案。
- 讀取使用者提供的 `D:\ting1\Desktop\code\main.py` 與台新交易明細格式；新增
  `src/lib/reconciliation/taishin.ts`、Owner-only
  `/api/workspace/reconciliation/taishin` 與 Workspace 對帳面板。解析規則為：第二列
  標題、備註最長連續數字末五碼、金額整數化、金額＋末五碼比對；原始檔不保存，
  不覆寫 Payment／Allocation／Audit Log。
- 使用 ExcelJS 取代有高風險公告的 SheetJS `xlsx`；`npm audit --omit=dev --audit-level=high`
  現在無 high severity（仍有既有／轉移的 moderate advisory，未使用 `--force`）。
- 驗證：Unit 39 files／178 tests、TypeScript、ESLint、Build 通過；完整 Playwright 與
  Preview 真人驗收尚未因登入阻塞而重跑。

### 2026-08-02 改版驗收修正

- 會員資料、銀行帳戶、付款回報與訂單頁進一步套用新版 page／surface／service
  Token、`min-h-dvh`、44px 控制項與 aria 狀態；付款回報仍只在付款回報階段要求
  選擇會員匯款帳戶與 Astera 收款帳戶。
- Owner ProductWorkspace 的 Variant／Campaign 欄位改為較寬的 responsive grid，並
  讓雙語 label 可換行，避免欄位黏在一起；Product ID／SKU 維持唯讀並提供複製。
- 公開驗收先發現 `/brand` 500 與過期頁面內容，確認來源為舊的 Next.js server
  process；清理舊程序後重新啟動，最新版 `/brand`、`/cart`、`/checkout` 均正常。
- 驗證結果：公開 Playwright 桌機／Pixel 7 14 passed／2 skipped；Firebase Emulator
  Playwright 31 passed／3 skipped；Unit 39 files／178 tests、Firestore／Storage Rules
  31 tests、TypeScript、ESLint、Build 全部通過。
- 尚待：Owner Workspace 各子頁完整 Token 遷移、Firebase Emulator authenticated E2E、
  Rules／Production smoke、正式 Preview／Production 部署與真人驗收。

### 2026-08-03 Preview／Production 部署與驗收

- Preview：`https://astera-isf54e52l-astera-oms.vercel.app`；主要公開路由均通過頁面驗收。
- Production：`https://astera-icaqtdzea-astera-oms.vercel.app`，已 alias 至
  `https://astera-oms.vercel.app`。
- Production smoke 使用正式商品 `prod_002` 通過 5/5；Production 公開 Playwright 桌機／
  Pixel 7 通過 14 passed／2 skipped。
- 首次 smoke 未指定商品 ID 而回報 `public_product_not_found`，補入 `prod_002` 後通過，
  確認是測試參數問題，不是網站路由錯誤。
- 新分頁逐一檢查 Production 主要路由，未發現 404、500 或新的 Console error。真人 Google
  登入、付款回報、Owner 圖片／對帳與 Resend 仍需外部帳號與服務驗收。

### 2026-08-03 Vercel Node runtime 檢查

- `vercel project inspect astera-oms` 確認 Project Node.js Version 已是 `24.x`。
- Repository `package.json` 已要求 `>=24.18.0 <25`；目前 Vercel build image 實際回報
  `v24.15.0`，因此出現 EBADENGINE warning，但建置仍成功。
- Vercel Project Settings／CLI 目前只提供 major Node 版本選擇，不能直接指定
  `24.18.0` minor 版本；未將設定降級或改成不符合正式需求的範圍。待 Vercel 24.x
  build image 更新至 24.18+ 後重新部署並確認 warning 消失。

## 2026-08-03 銀行帳號資料最小化執行補充

- [x] Task 1：正規化與 HMAC 身分服務（review clean）。
- [x] Task 2：會員帳戶移除新明文保存、碰撞通知與封存流程（review clean；consumer baseline Minor deferred）。
- [x] Task 3：付款指紋快照、Client identity 不信任、legacy manual-review fallback 與 Owner UI 快照顯示完成；commit `96dbc7e..39d19b2`，Task 3 獨立複審通過。
- [x] Task 4：14 天退款帳號加密暫存、歷史版本 HMAC 驗證、三層節流、過期重驗、Owner reveal、一般 API 私密欄位清除、付款來源拆分與 refunded 交易式密文刪除完成；commits `9433a77..3e09b8c`，三輪 scoped re-review 最終 APPROVED。
- [x] 舊 `paymentAccountSelectionApi.test.ts` source-contract 名稱已於 `dd2d8e5` 修正；完整 Unit 現為 42 files／219 tests 全通過。
- [x] Task 5–8：後續 Rules／限流、migration／cleanup／key governance、Emulator
  E2E 與完整本機 Gate 均已完成；Production Security Worker、Scheduler、Monitoring
  與 Vercel security environment 亦已在後續 2026-08-10 紀錄完成。原 deferred
  KMS 前置限流已於 Task 5 關閉。

### 2026-08-04 銀行帳號退款安全 Task 5 完成

- [x] Task 5：Firestore Rules／通知／Audit 與退款限流收緊，commits `22db1c5..7433ec3`，scoped re-review APPROVED（Critical 0、Important 0）。
- `cancellationRequests`、`memberPaymentAccounts`、`notificationEvents`、`auditLogs` 已對所有 Client SDK 角色 deny-all；匿名／Member／Helper／Owner 四角色 × 四個 protected collections read/write matrix 已於 Rules 32 tests 驗證，`productsPublic` 公開讀取保留。
- Owner 通知、取消與 Audit 顯示改走 custom-claim Server API strict allowlist；retry response 不再回傳 provider diagnostics，internal rate-limit reservation 不出現在 Audit API。
- 退款 mismatch 在 HMAC／KMS／加密前以 transaction reservation 限流；成功刪 reservation，失敗寫入安全 limiter 與 immutable audit，60 秒殘留 reservation 到期清理。
- 驗證：Rules 2 files／32 tests、focused Unit 4 files／43 tests、完整 Unit 43 files／242 tests、TypeScript、zero-warning ESLint 通過。
- [x] Task 6：Production／Preview 已分別設定不揭露的 48-byte
  `REFUND_RATE_LIMIT_HASH_SECRET`；環境檢查、KMS／金鑰治理與月度報告均已完成。

### 2026-08-04 Task 6 baseline 決策已解除

- [x] 已提交安全可隔離部分：commit `81cb342`，新增 member account fingerprint migration、退款暫存 cleanup、fingerprint key usage 月報三個腳本與 migration tests。
- 驗證：focused Unit 2 files／26 tests、完整 Unit 44 files／252 tests、TypeScript、ESLint 通過；dry-run 預設唯讀，`--apply` 需 project double-confirmation 與本機 ignored backup，stdout 不印完整帳號、末五碼或 HMAC fingerprint。
- [x] 使用者已選方案 A；`cbf9648` 正式收錄 `scripts/check-production-env.mjs` 與 `tests/unit/productionScripts.test.ts` 完整 baseline，版本控制阻塞已解除。
- Task 6 已進入 independent review fix loop；文件 14／16／17 仍維持只追加、不 stage，待後續文件整合批次處理。

### 2026-08-04 Task 6 本機完成紀錄

- [x] 新增會員帳戶指紋 migration runner：預設／`--dry-run` 完全唯讀；`--apply` 需 exact
  project confirmation，且 ignored 本機備份成功後才更新會員帳戶。
- [x] 舊完整帳號只在 migration runner 記憶體內交給 KMS HMAC；apply 移除明文字段。只有末五碼
  的舊帳戶標 `needsReverification`；歷史付款快照不改寫，缺指紋者只列人工覆核 ID。
- [x] Migration CLI stdout 使用白名單，只列 ID、status／operation、key version 與統計；
  不列完整帳號、末五碼、HMAC 或 canonical input。
- [x] 新增退款密文到期清理工具：只刪三個限時密文字段，pending request 改為
  `needsReverification`，不刪 unrelated plaintext。Reveal／review 仍逐次檢查到期。
- [x] 新增月度 HMAC key usage report：分別統計會員帳戶與付款快照引用數、最早／最近引用、
  未引用版本與無法分類文件 ID；報告不會自動 disable／destroy key。
- [x] 清理／月報失敗使用既有 `notificationEvents` 建立安全 Owner alert，不新增 Collection。
- [x] `production:env:check -- --strict` 納入 HMAC key name/latest version、退款 encryption key、
  WIF 設定與至少 32 字元的穩定 `REFUND_RATE_LIMIT_HASH_SECRET`。
- [x] 部署文件記錄舊 key 長期保留、只在 authenticated re-entry 重新指紋化、每日清理／每月報告、
  protected Scheduler OIDC → Cloud Run／2nd-gen Function contract 與 rollback。
- [x] 外部 private Cloud Run Worker、兩個 Scheduler OIDC jobs、專用 service
  accounts、Monitoring email channel／alert policy 與 Production authenticated
  dry-run 已於 2026-08-10 部署及驗證；cleanup 連跑兩次均為 `cleaned=0`。

### 2026-08-04 Task 6 複審結案

- [x] Task 6 commits `81cb342..135a42e` 已完成三輪 scoped re-review，最終為 Critical 0、Important 0、Minor 0。
- [x] 遷移僅對可正規化的舊明文帳號建立 latest-version HMAC；合法既有指紋才可 backfill
  `verified`，不改變既有 lifecycle status；未知或不合法資料 fail-closed 為需重新驗證。
- [x] 退款比對的 expected／actual 指紋都必須是 canonical HMAC-SHA-256 Base64（固定 44 字元）；
  新註冊在 transaction 前先完成 strict KMS identity derivation，避免不完整資料進入永久帳戶。
- 驗證記錄：完整 Unit 45 files／291 tests、TypeScript、完整 ESLint 通過。Task 7 可開始 Emulator
  端到端驗收；Task 6 的外部 Scheduler／IAM／Production dry-run 仍是上線前 external gate。

### 2026-08-09 Task 7／8 最終修正與發布 Gate

- [x] Task 7 commits `572e53f..fc9ecdd` 完成並通過 scoped re-review，Critical 0、
  Important 0、Minor 0。
- [x] 真實受保護 API Emulator 測試涵蓋：會員綁定、重複末五碼事件、付款指紋快照、
  退款帳號不符／符合、Owner reveal、完成退款後刪除所有相關 vault、Member／Helper 403。
- [x] exact `npm run test:e2e:emulated` 的 Task 7 獨立證據為 36 passed／8 expected skipped／
  0 failed。
- [x] Emulator KMS 具有雙重 guard：只在
  `PLAYWRIGHT_USE_FIREBASE_EMULATORS=true` 且 project 為
  `demo-astera-oms` 時啟用；Production 永遠走 Cloud KMS。
- [x] final broad review 的 I1–I4 已由 `4999e4c` 修正；scoped fix re-review 發現的
  mixed cancellation replay regression 已由 `6bf9f9d` 修正，`a276aa0` 再將 legacy
  cancellation replay 改為 fail-closed。最終 focused review APPROVED：Critical 0、
  Important 0、Minor 0。
- [x] Task 8 final fresh：TypeScript、ESLint、Unit 46 files／310 tests、Build、
  Firestore／Storage Rules 32 tests、Emulator E2E 36 passed／8 expected skipped／
  0 failed、secret scan、production dependency audit exit 0。
- [x] NanoID override 為 `3.3.17`，已消除先前 high advisory。ExcelJS 的 transitive UUID
  仍有 2 項 moderate advisories；強制修正將導致 ExcelJS breaking／downgrade，列為非阻擋
  dependency follow-up。
- [x] Task 8 本機完整驗證 release gate 已完成。

### Production rollout 尚待外部完成

1. 在 `astera-oms-prod` 建立／驗證不可匯出的 Cloud KMS HMAC key 與退款 encryption key；
   最新 HMAC version 僅供新永久指紋寫入，舊 version 只供既有資料驗證。
2. 將最小權限授予 Vercel Production service account：必要 Firestore、KMS MAC、
   KMS encrypt／decrypt 與 Firebase Auth 驗證權限；不可使用長期私鑰。
3. 設定穩定且至少 32 字元的 `REFUND_RATE_LIMIT_HASH_SECRET`，並以
   `npm run production:env:check -- --strict` 驗證所有 WIF／KMS／Firebase／Resend 變數。
4. 先執行會員帳戶 migration dry-run 與 ignored local backup；人工核對報告後才可用 exact
   project confirmation apply。歷史付款 snapshot 不遷移，缺指紋保留人工覆核。
5. 部署受保護的每日 vault cleanup 與每月 key-usage report；使用 Scheduler OIDC、
   exact audience、專用 service account、`roles/run.invoker` 與 Cloud Monitoring
   非 2xx／逾時告警。
6. 舊 HMAC key version 在仍有任何永久帳戶或付款 snapshot 引用時不得停用或銷毀；
   系統禁止從舊 HMAC 推導新 HMAC，只有會員重新輸入完整帳號才能建立最新版指紋。
7. 本機 Build、完整 Firestore／Storage Rules、Emulator E2E 已全部 exit 0；下一階段為
   Preview 真人驗收，完成後才可進 Production rollout。
## 2026-08-09 Production security worker — infrastructure preflight

- The guarded local planner exited 0 with `mode=dry-run` and only preparation
  actions; it made no cloud call or mutation.
- Pending exact design: `asia-east1` / `astera-oms-security`, the two Software
  KMS keys, Vercel key-level grants, worker and Scheduler identities,
  `astera-ops`, private single-instance `astera-security-worker`, two fixed
  Asia/Taipei Scheduler jobs, and the named Monitoring alert. No public invoker
  or project-wide KMS role is allowed.
- Read-only state on 2026-08-09 matched `astera-oms-prod` / `1032606875618`,
  active Vercel WIF, the runtime account, its exact Vercel project principal set,
  and only its Firestore/Firebase Auth viewer/Storage object-viewer project roles.
  The provider maps the Vercel project claim but has no independent attribute
  condition; the exact principal-set binding remains the effective restriction.
- Monitoring API is enabled. KMS, Run, Scheduler, Cloud Build, and Artifact
  Registry are disabled; planned resources are unverified while API disabled. No named
  Monitoring policy was listed. The email channel remains unverified because the
  local read-only gcloud beta command is unavailable; no install was attempted.
- Two Software KMS active versions cost roughly USD 0.12/month before
  free/usage effects; two Scheduler jobs fit the usual three-job allowance; Cloud
  Run `min-instances=0` should be near free tier at MVP volume, with billing alerts
  required. Roll back a future deployment by disabling jobs, removing exact
  service invoker/key IAM bindings, then deleting Cloud Run; do not destroy a
  referenced KMS version.
- Docker is a parked release gate: `docker build -f ops/security-worker/Dockerfile
  -t astera-security-worker:test .` requires CI or a Docker-capable host.
- Exact next mutation, not executed: `node scripts/setup-production-security.mjs
  --project astera-oms-prod --confirm-project astera-oms-prod --apply`.

### Review correction — WIF condition blocks KMS rollout

This correction supersedes the prior interpretation of the empty Provider
condition and planned-resource presence. Empty `attributeCondition` is a
load-bearing BLOCKER: do not grant KMS permissions or run security `--apply`.
The exact Vercel `principalSet` remains required as a second layer, not a waiver.
Local gcloud help verifies `update-oidc --attribute-condition` accepts CEL over
`assertion`; an authorized remediation must set and read back:

```text
gcloud iam workload-identity-pools providers update-oidc vercel --location=global --workload-identity-pool=vercel-oidc --project=astera-oms-prod --attribute-condition='assertion.project_id == "prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ"'
gcloud iam workload-identity-pools providers describe vercel --location=global --workload-identity-pool=vercel-oidc --project=astera-oms-prod --format="value(attributeCondition)"
```

Review must confirm that condition and the expected principal set before KMS is
unblocked. Fixed identifiers: project/number `astera-oms-prod` / `1032606875618`;
region `asia-east1`; ring `astera-oms-security`; keys
`member-account-fingerprint` and `refund-account-vault`; Vercel/Worker/Scheduler
SAs `astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com`,
`astera-security-worker@astera-oms-prod.iam.gserviceaccount.com`, and
`astera-security-scheduler@astera-oms-prod.iam.gserviceaccount.com`; repository
`astera-ops`; Cloud Run `astera-security-worker`; jobs
`astera-refund-vault-cleanup-daily` (daily 03:30 Asia/Taipei) and
`astera-fingerprint-key-report-monthly` (day 1 monthly 04:00 Asia/Taipei); and
policy `Astera Security Worker non-2xx or timeout` to `astera.0920@gmail.com`.

Where APIs are disabled, every planned resource is **unverified while API
disabled**, not confirmed absent. Only the two service-account list results are
absent. The next security `--apply` remains BLOCKED pending the tested
Provider-condition remediation and review.

Fresh post-remediation readback is required before KMS/apply can proceed (not run
here):

```text
gcloud iam workload-identity-pools providers describe vercel --location=global --workload-identity-pool=vercel-oidc --project=astera-oms-prod --format="json(state,attributeMapping,attributeCondition)"
gcloud iam service-accounts get-iam-policy astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com --project=astera-oms-prod --flatten="bindings[]" --filter="bindings.role=roles/iam.workloadIdentityUser AND bindings.members:principalSet://iam.googleapis.com/projects/1032606875618/locations/global/workloadIdentityPools/vercel-oidc/attribute.project_id/prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ" --format="table(bindings.role,bindings.members)"
```

Review must prove together: Provider `ACTIVE`; mapping
`attributeMapping.attribute.project_id == assertion.project_id`; exact condition
`assertion.project_id == "prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ"`; and exactly
`roles/iam.workloadIdentityUser` for the stated runtime-SA principal set. The
exact inventory additionally includes Pool `vercel-oidc`, Provider `vercel`,
Vercel project `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`, and API IDs
`cloudkms.googleapis.com`, `run.googleapis.com`, `cloudscheduler.googleapis.com`,
`cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, and
`monitoring.googleapis.com`. KMS and security `--apply` remain BLOCKED until all
four fresh readbacks pass and are reviewed.

## 2026-08-10 Task 5 authorization checkpoint

- WIF preflight commit `1c8387f` received approved review. Worker Firestore IAM
  commits `3bec6e9` and `5961b9a` received approved re-review.
- Fresh controller checks passed: focused **52/52**, full Unit **43 files / 334
  tests**, TypeScript, ESLint, secret scan, and document diff check.
- The code-ready dry-run plan remediates the Provider condition and creates the
  Worker exact `roles/datastore.user` binding. Scheduler has no project-wide role.
- No cloud command or `--apply` ran. Live mutation is READY in code but BLOCKED
  until the user explicitly authorizes this exact command:

  ```text
  node scripts/setup-production-security.mjs --project astera-oms-prod --confirm-project astera-oms-prod --apply
  ```

- The command must stop before API/KMS work unless readback verifies Provider
  `ACTIVE`, the exact mapping, exact Vercel-project condition, and exact
  `principalSet`. Docker build remains unverified because Docker CLI is absent.

## 2026-08-09 Task 5 authorization retry status

- A general user approval was received, but the managed safety review rejected the
  Production command before execution because the approval did not explicitly list
  the full multi-resource blast radius.
- No Production mutation occurred. Task 5 remains in progress and Tasks 6–7 remain
  pending.
- Exact continuation: obtain explicit authorization for `astera-oms-prod` WIF
  Provider condition, API enablement, KMS keys, Worker/Scheduler service accounts,
  Worker `roles/datastore.user`, key-level KMS IAM, and Artifact Registry; then run
  the already reviewed command without changing its arguments.

## 2026-08-10 Task 5 completed

- Explicit authorization was received and the guarded apply completed with exit 0.
- Three environment-compatibility fixes were completed through strict TDD and
  independent review: `abd32a6`, `7cb07d1`, `861a99f`.
- Fresh verification: focused **35/35**, Unit **43 files / 340 tests**, TypeScript,
  ESLint, secret scan, and diff check passed.
- Live readback passed for WIF, six APIs, both KMS keys/version 1, exact key-level
  IAM, Worker Firestore role, Scheduler no-project-role, both service accounts, and
  `astera-ops` Artifact Registry.
- Task 5 is complete. Task 6 is now in progress and must implement/test the private
  Cloud Run, Scheduler OIDC jobs, and Monitoring alert deployment. No Task 6 live
  deployment has occurred.

## 2026-08-10 Task 6 source/review checkpoint

- Implementation commits: `2e246e2`, `1ac6d13`.
- Independent controller re-review: five findings addressed, no new breakage,
  Spec PASS, Quality APPROVED; live apply is code-ready but not authorized/executed.
- Implementer evidence: focused 42/42, Unit 44 files / 374 tests, TypeScript,
  ESLint, Build, secret scan, and diff checks pass.
- Controller fresh full gate is still pending because managed execution was rejected
  before startup by the Codex usage limit. Retry after 2026-08-16 10:05.
- Before Task 6 apply: rerun the full controller gate, verify budget alert and current
  read-only cloud state, then obtain explicit authorization for Cloud Build/image,
  private Cloud Run, service IAM, two OIDC Scheduler jobs, email notification
  channel, and Monitoring policy.
- Task 7 remains pending. No Task 6 cloud mutation or smoke test occurred.

## 2026-08-10 Task 6 controller gate resumed

- Fresh controller gate now passes: focused 42/42, Unit 44 files / 374 tests,
  TypeScript, ESLint, Build, secret scan, diff check, and dry-run.
- Production read-only inventory confirms Worker service, both Scheduler jobs, and
  matching Monitoring channel/policy are absent.
- Billing is enabled, but Billing Budget API is disabled; the required Budget Alert
  cannot be verified. Task 6 live apply remains blocked.
- Next exact step: obtain explicit authorization to enable only
  `billingbudgets.googleapis.com`, list budgets read-only, and confirm an acceptable
  alert before requesting the larger Task 6 deployment authorization.

## 2026-08-10 Billing Budget pre-deployment gate complete

- Explicit authorization was received to enable only
  `billingbudgets.googleapis.com` and query the linked Billing Account read-only.
- API enablement completed successfully.
- Existing project-scoped monthly Budget Alert verified: TWD 200, with 50%, 90%,
  and 100% current-spend thresholds and default role-based email recipients active.
- No Budget setting was changed and no Task 6 deployment action ran.
- Task 6 remains in progress. Next exact step: obtain separate authorization for
  Cloud Build/image push, private Cloud Run, service-level invoker IAM, two OIDC
  Scheduler jobs, Monitoring email channel, and Monitoring alert policy; then run
  the already reviewed guarded apply.

## 2026-08-10 Task 6 deployment checkpoint

- Guarded Production apply completed successfully after three TDD-backed
  Google-managed readback compatibility fixes (`774740d`, `78e5c42`, `246e51d`).
- Private Worker, exact service IAM, both OIDC Scheduler jobs, Monitoring channel,
  and alert policy all pass fresh readback.
- Pure-read monthly job authenticated through Scheduler and returned 200.
- Unauthenticated job requests return 403; recent Worker payload logs contain no
  detected sensitive field names, long account-number patterns, or failure marker.
- Task 6 is complete. Cleanup ran twice after explicit authorization; aggregate
  expired-vault counts were 0 before/after both runs, both requests returned 200,
  and idempotency was confirmed without reading IDs or sensitive fields.
- Do not add human Service Account Token Creator just to test `/healthz`; preserve
  the current least-privilege boundary and document an approved substitute if needed.
- Monitoring delivery gate is complete: the recipient supplied a screenshot of the
  received firing email for the exact policy/project/service/region and a
  non-sensitive request-count value of 4.
- Task 7 is now the next executable stage: Vercel security environment preflight,
  strict environment checks, Preview verification, and full release gates.

## 2026-08-10 Task 7 Vercel preflight

- Vercel project identity and Node.js 24.x are correct.
- Read-only inventory found zero custom Vercel Environment Variables.
- All 17 Production/Preview security values have authoritative sources and pass the
  strict checker when injected only into a local child process. No real secret was
  generated or saved during preflight.
- Task 7 remains in progress. Next exact step requires explicit authorization to
  write 16 fixed variables plus independently generated Production/Preview secrets
  to Vercel, followed by Preview-only redeployment and verification.

## 2026-08-10 Task 7 environment configuration checkpoint

- Explicit authorization was received for `astera-oms/astera-oms` only.
- All 16 verified fixed variables were added or overwritten for Production and
  Preview.
- Two different 48-byte random rate-limit values were generated in memory and sent
  directly through stdin to separate Production/Preview Sensitive Secret records;
  they were not printed, persisted, or documented.
- The post-write inventory failed the isolation gate because the pre-existing
  `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` name targets both environments.
- Seven older unscoped Preview Sensitive GCP/WIF records also overlap the verified
  fixed records.
- No Preview or Production deployment was started.
- Task 7 remains in progress. Exact continuation: obtain explicit authorization to
  remove only the Emulator variable and normalize only the seven duplicate Preview
  records; rerun the metadata-only inventory; then deploy and verify Preview only.

## 2026-08-10 Task 7 cleanup and Preview release-gate checkpoint

- Exact Vercel cleanup completed: `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` was removed
  from Production/Preview and only the seven named legacy Preview Sensitive
  duplicates were removed. No other Vercel setting changed.
- Fresh environment inventory passes: 21 total records, fixed 16/16, bad fixed 0,
  rate-limit secrets 2, forbidden names 0, Preview overlaps 0.
- Preview `dpl_BCk2r5e8ZfyeKxezbi5tffwRibmA` is Ready at
  `https://astera-ix5gsqvlu-astera-oms.vercel.app`; stable alias is
  `https://astera-oms-astera-blip-astera-oms.vercel.app`. Production was not
  deployed or promoted.
- Public browser checks pass for `/`, `/products`, `/brand`, and `/cart`;
  `/e2e-auth` returns 404. Google sign-in is blocked on both Preview hosts because
  Firebase Authorized Domains is not yet configured for either host, so the
  authenticated WIF/KMS flow is not claimed complete.
- Fresh local gate passes: Unit 44 files / 374 tests; Rules 2 files / 32 tests;
  Emulator Playwright 34 passed / 8 skipped; TypeScript, ESLint, Build (39 pages),
  secret scan, production audit, and diff check.
- Vercel built with Node 24.15.0 while project engines request `>=24.18.0 <25`.
  Build passed but the `EBADENGINE` warning remains a Production release warning.
- Next exact action requires separate authorization: add only the stable Preview
  alias to Firebase Authentication Authorized Domains, then use explicitly named
  `測試專用` data for member binding, payment fingerprint snapshot, refund
  mismatch/match, Owner reveal, and vault deletion. Do not deploy Production.

## 2026-08-10 Stable Preview authentication checkpoint

- Exact Firebase authorization was received and only
  `astera-oms-astera-blip-astera-oms.vercel.app` was added to Production
  Authentication Authorized Domains.
- Firebase Console success plus a full settings reload proves the original domain
  set was preserved and exactly one Custom domain was appended. No one-off Preview
  domain or other Firebase setting changed.
- Google login now reaches the account chooser instead of the former
  `auth/unauthorized-domain` error. The browser-control session cannot retain the
  OAuth opener after Google account selection, so the user must finish that
  identity interaction before the authenticated flow resumes.
- OAuth later completed on the stable Preview and redirected to `/account/profile`.
  A test-only member profile saved and redirected home. The member payment-account
  UI moved from `0/5` to `1/5` after one synthetic test-only account was added;
  it displayed masked data only, retained an empty full-account input, and reported
  success. No account value, masked digits, token, fingerprint, ciphertext, or
  secret was recorded.
- No CancellationRequest, refund reveal, or vault deletion was created at this
  checkpoint. The remaining authorized refund and vault checks are governed by the
  static Task 7 flow audit; do not extend this continuation beyond that audit or
  deploy Production.

## 2026-08-10 Preview payment/refund continuation gate

- The authenticated member was correctly denied `/workspace`, which displayed the
  owner/helper permission gate.
- A clearly labelled test-only checkout created one Order and PaymentRequest for
  NT$520. A second synthetic member account was then saved and used to create one
  `pendingReview` Payment. No real transfer occurred.
- Complete synthetic values were not written to the repository or application
  storage. One value briefly appeared in browser-tool output during automation, but
  it was never copied into tracked documentation. A narrowly scoped ADC Firestore
  read timed out without returning data or performing a write; a later browser
  process reset made the active complete values unavailable. They cannot and must
  not be reconstructed from the stored HMAC.
- Exact continuation: log in as the test member again, create one fresh synthetic
  account, and use a fresh clearly labelled test Order/Payment so the complete value
  stays available through the entire mismatch/match, Owner reveal, full-refund, and
  vault-absence sequence. Never print or document account digits, document IDs,
  token, fingerprint, ciphertext, key material, or rate-limit material. Do not add
  a domain, deploy Production, or change another Firebase/Vercel setting.

## 2026-08-11 Task 7 authenticated-session blocker

- A stable Preview retest completed Google account selection but the application
  returned in signed-out state; `/account/bank-accounts` continued to require
  Google login after navigation.
- No new test data or external configuration was created. The in-app browser is
  the only available automated browser surface for this run, and it did not retain
  this Firebase redirect session. The current client code also clears a redirect
  error when the following Firebase state is signed-out, hiding the diagnostic code.
- Keep the one-pass payment/refund acceptance gate blocked. Resume only after a
  retained authenticated session is available, or after a separately scoped,
  test-first diagnostic change proves the underlying redirect failure.

## 2026-08-11 Redirect diagnostic fix; Preview restored

- Commit `abf88be` preserves redirect-result error context through a subsequent
  signed-out Firebase state. The regression test was red before the fix and green
  afterwards; fresh Unit (44 files / 375 tests), TypeScript, ESLint, Build (39
  pages), secret scan, and diff check passed.
- A direct Vercel Preview deploy produced an `UNKNOWN` / zero-ms-build deployment
  with no logs. Its automatic stable-alias assignment was reverted immediately to
  the previous Ready Preview. No Production, Firebase, domain, or data mutation
  occurred.
- Next exact step: obtain explicit GitHub push authorization for
  `codex/production-security-worker`, allow Vercel Git integration to create the
  replacement Preview, and retest authentication before any new test data.

## 2026-08-11 Preview redirect-login root-cause checkpoint

- Commit `bed5f01` removes the mobile-incompatible popup attempt and uses Firebase
  `signInWithRedirect` directly. The focused unit suite (44 files / 375 tests),
  TypeScript, ESLint, Build, secret scan, and diff check passed before the commit;
  the branch was pushed and Vercel produced a Ready Preview. The stable authorized
  Preview alias was moved to that Ready deployment. Production was not deployed.
- Browser verification confirms the former popup flash is fixed: Google account
  chooser opens through the redirect flow. After account selection, however, the
  app returns to the stable Preview in a signed-out state. No error, test data,
  Firebase configuration, or Production resource was changed during this retest.
- Root cause is the cross-origin Firebase redirect helper: the Vercel app uses a
  Firebase-hosted `authDomain`, and browsers that block third-party storage cannot
  retain the redirect helper session. Firebase documents a transparent reverse
  proxy for `/__/auth/` plus same-origin `authDomain` as the applicable solution
  when the app is hosted outside Firebase Hosting.
- Exact next action requires separate authorization because it changes Preview
  configuration: add a transparent Vercel rewrite for `/__/auth/:path*` to the
  Firebase Auth handler and change only the Preview Firebase `authDomain` to the
  already-authorized stable Preview hostname. Then deploy Preview only and repeat
  the sign-in test. Do not change Production, create a new authorized domain, or
  create new payment/refund test records until authenticated state persists.

## 2026-08-11 Preview authDomain replacement safety stop

- The transparent Auth-helper rewrite is committed as `6398a22` after a red/green
  regression test. Focused Unit, TypeScript, ESLint, Next build (39 routes), secret
  scan, and diff check passed. Git push can trigger Preview only; Production was
  not deployed.
- Vercel Preview's old `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` record was removed under
  the approved Preview-only scope. The replacement-add command was rejected before
  execution because its hostname letter case did not exactly match the approved
  stable alias. No replacement value, Firebase setting, authorized domain, or
  Production setting was written.
- The currently deployed Preview remains unchanged until a future deployment; do
  not trigger another deployment while the Preview build variable is absent.
- Exact next action requires fresh confirmation due to the rejected command: add
  only the Preview non-sensitive variable
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=astera-oms-astera-blip-astera-oms.vercel.app`
  with the exact lowercase hostname, then verify metadata and continue the
  Preview-only deployment. Do not change Production.

## 2026-08-11 Preview authDomain replacement resumed

- After fresh explicit authorization, Vercel confirmed the exact lowercase
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` was added as a non-sensitive **Preview-only**
  variable. Production and all other variables were not changed.
- The source rewrite was already committed and pushed. The next Git-integrated
  Preview must be built after this environment replacement, reach Ready, and then
  receive only the existing stable Preview alias before the same-origin helper and
  Google redirect session are retested.

## 2026-08-11 Same-origin Auth helper verification; client blocker

- Vercel confirmed a Ready Git-integrated Preview and the existing stable Preview
  alias now points to it. The Preview-only public Firebase `authDomain` was present
  before this build. Production was not deployed or changed.
- Direct browser verification passed for `/__/auth/iframe`: it remained on the
  stable Preview origin and loaded the helper script from that same origin. This
  proves the transparent rewrite path is working.
- Google sign-in did not proceed to Google account selection and displayed no
  error. The client imports Firebase before its `try/catch`, so a missing/failed
  Firebase initialization can reject the event handler without rendering the
  existing user-facing error. This is the leading hypothesis, but no error value
  has been read or inferred from storage.
- No member account, order, payment, refund, Firebase, or Production mutation was
  created. Exact next action needs a narrowly scoped diagnostic approval: move the
  Firebase dynamic imports inside the existing Google sign-in `try/catch`, add a
  red/green regression test for an initialization rejection, deploy Preview only,
  and retry the button. Do not change login provider, proxy, or Production.

## 2026-08-11 Preview Google initialization diagnostic fix

- A red/green regression test now requires Firebase initialization to occur inside
  the Google sign-in `try/catch`; the source was changed only to satisfy that
  requirement. Initialization failures now use the existing safe Google error UI
  instead of leaving the button inert.
- Fresh evidence before release: focused auth/proxy tests 16/16; full Unit 44 files
  / 377 tests; TypeScript, ESLint, Next build (39 routes), secret scan, and diff
  check passed.
- Exact next action: wait for the Git-integrated Preview from this commit, assign
  only the existing stable Preview alias after Ready, and click Google sign-in. If
  an error appears, record only its safe displayed code/text and stop; if Google
  opens and authentication persists, resume the already-authorized one-pass test
  flow without creating data until that persistence check passes.

## 2026-08-11 Preview OAuth redirect-URI blocker

- The latest Git-integrated Preview is Ready and the existing stable alias now
  targets it. A direct CLI Preview upload timed out without becoming the stable
  alias; it was not used. Production was not deployed or changed.
- Retest proves the client fix and same-origin proxy now reach the stable Preview
  `/__/auth/handler`, after which Google returns `redirect_uri_mismatch`. This is
  the expected external OAuth allowlist requirement for a custom `authDomain`, not
  a Firebase session or application-data error.
- No member/payment/order/refund test data was created and no browser storage,
  tokens, or account values were inspected. Exact next action requires explicit
  authorization for Google Cloud Console: add only
  `https://astera-oms-astera-blip-astera-oms.vercel.app/__/auth/handler` to the
  existing OAuth Client's Authorized redirect URIs, save, and retry Preview Google
  login. Do not alter other OAuth settings, add a one-off Vercel hostname, or change
  Production.

## 2026-08-11 Preview OAuth redirect URI configured

- Under explicit authorization, exactly one stable Preview handler URI was appended
  to the existing Google OAuth Client's Authorized redirect URI list. Existing URI
  entries, OAuth consent screen, Firebase domains, and Production settings were not
  changed. The saved value was re-opened and verified in the Console.
- Immediate Preview retest now reaches Google account selection without the prior
  `redirect_uri_mismatch` error. The browser is held at account selection for the
  user to choose the intended test member; no account was selected automatically.
- Exact next action: user selects the intended Preview test member, then verify
  authenticated state survives return to `/account/bank-accounts` and a normal
  navigation. Do not create any payment-account, order, payment, cancellation, or
  refund test data until that session-persistence check passes.

## 2026-08-11 Legacy member payment-account compatibility repair

- The authenticated Preview retest retained the member session but the account
  list returned a safe generic read error. Read-only server diagnostics located
  the failure in legacy-record serialization, not Firebase Auth, WIF, or
  Firestore IAM. A value-free aggregate audit found legacy records that lack the
  bank-code field required by the current account contract.
- The API now returns such records as inactive `needsReverification` snapshots:
  they are visible only as masked legacy data, cannot be selected for payment,
  and do not consume a usable-account slot. The UI explains that the member must
  register a new account. No account number, fingerprint, member identity, or
  document ID was read into documentation or browser output.
- Regression coverage: legacy GET compatibility plus five-account limit behavior.
  Fresh verification: Unit 44 files / 379 tests, TypeScript, ESLint, Build, and
  diff check passed locally. Next: deploy this repair to the stable Preview,
  re-check the signed-in account page, and only then create explicitly authorised
  test-only payment/refund data.

## 2026-08-11 Preview member-flow continuation

- Stable Preview now verifies the repaired signed-in account list after a normal
  navigation. A clearly test-only member account was added through the UI; the
  UI retained only masked display data and cleared the full-account input.
- A clearly test-only public product was added, checked out with synthetic
  recipient data and both required consents, and created one new test-only order
  plus payment request. No old order or payment request was selected for the
  next step.
- The Payment Report form is now ready with only the new request selected and
  the test-only member account selected. The browser automation cannot input the
  native `type=date` control, even though the other controlled fields retain
  their values. No Payment was created. Exact next step: manually choose the
  test transfer date in the visible Preview form, submit once, confirm
  `pendingReview`, then continue Owner confirmation/reverse and refund-vault
  acceptance. Treat this as an automation limitation until a manual date-control
  test proves otherwise, not as an application defect.

## 2026-08-11 Payment Report native date-event repair

- Manual mobile evidence showed the transfer-date field visibly populated while
  the submit button remained disabled and validation still reported a missing
  date. This is an application event-handling defect, not merely automation:
  the native date control can emit `input` before the React `change` path used
  by the form state.
- The date control now updates `receivedAt` on both `change` and native `input`.
  A regression test first failed without the `onInput` handler and now passes.
  Fresh local verification: Unit 44 files / 380 tests, TypeScript, ESLint,
  Build, and diff check passed. Next: deploy Preview, choose the date again,
  confirm that `送出付款回報` enables, then submit only the prepared test request.

## 2026-08-11 Payment Report submit-action contrast repair

- Fresh manual Preview evidence showed that the payment-report submit control was
  rendered but its white label sat on the page background. The control referenced
  `bg-astera-brand`, while the current global Tailwind theme did not define that
  color token. This is a visible UI defect, independent of payment validation.
- The control now uses the approved Astera brand color directly, including an
  accessible hover color and a visible disabled background. A regression test first
  failed against the unresolved token and now asserts the verified class contract.
- Fresh verification: Unit 44 files / 381 tests, TypeScript, ESLint, Next build,
  and diff check passed. Exact next action: deploy Preview, refresh `/payments`,
  and confirm the purple `送出付款回報` button is plainly visible. Only after the
  user explicitly confirms the prepared test-only Payment creation may it be
  submitted once.

## 2026-08-11 Preview test-only Payment Report accepted

- After the member explicitly confirmed the test-only financial action, the member
  manually submitted exactly one Payment Report from the stable Preview. A read-only
  browser check confirmed the success message and that the report form was cleared;
  no duplicate submission was performed.
- The member-facing PaymentRequest remains labelled unpaid until Owner review. This
  is expected: the newly created Payment is the separate `pendingReview` record.
- No internal IDs, member identity, bank fragments, or other account values are
  recorded here. Exact next action: sign in with the Owner test account, open the
  Preview payment workspace, locate only the newly submitted test report, and verify
  `pendingReview` before any confirmation action. Owner confirmation requires a new
  action-time authorization.

## 2026-08-11 Payer-linked member payment accounts implemented locally

- New member payment-account registrations now require and persist a normalized
  payer name alongside the bank code, last five digits and HMAC identity. The full
  account number remains transient and is not returned by the API or stored as a
  permanent plaintext field.
- Legacy verified accounts without a payer name remain visible but cannot be used
  for Payment Reports until the member completes the name once. The protected
  completion API cannot overwrite an existing payer name and does not alter bank or
  fingerprint identity fields.
- Payment Report UI now selects a verified member account and renders its last five
  digits and payer name as linked read-only values. The Payment API ignores forged
  client values and snapshots the selected Server account payer name and identity.
- Evidence: focused tests 27/27; Unit 45 files / 395 tests; Firestore + Storage Rules
  2 files / 32 tests; emulated Playwright 35 passed / 9 conditionally skipped;
  regular Playwright 16 passed / 28 Emulator-only skipped; TypeScript, ESLint,
  Next build (39 routes), secret scan, production dependency audit and diff check
  passed. The Windows Emulator commands used the approved elevated execution path.
- This batch has not been pushed or deployed to Preview, and no Production setting
  or financial record was changed. Exact next action after branch review is to push
  `codex/production-security-worker`, deploy only Preview, then manually verify one
  legacy-name completion and switching between two test-only accounts before
  submitting a newly authorised test Payment Report.

## 2026-08-11 Local integration into `codex/mvp-completion`

- The committed `codex/production-security-worker` work was locally merged into
  `codex/mvp-completion`. Merge conflicts were resolved by retaining both the
  production-security/payment-account implementation and the newer storefront,
  product-projection, documentation, and acceptance-test changes.
- The projection sync now remains authoritative from `productsInternal` to
  `productsPublic`, removes orphaned public projections, excludes private fields,
  and performs before/after audits. The payment-account payer-name flow and
  Production Security Worker remain included.
- Root cause of the merged Emulator E2E failure: the mobile workspace tests still
  asserted obsolete `Operations Workspace` and old bilingual navigation labels.
  The application had loaded correctly. The selectors now match the approved
  `Owner 營運工作區` and current navigation wording.
- Fresh merged-tree verification: Unit 50 files / 417 tests; Firestore + Storage
  Rules 2 files / 32 tests; TypeScript; ESLint; Next build with 42 routes; regular
  Playwright 18 passed / 28 Emulator-only skipped; emulated Playwright 37 passed /
  9 intentional skips; secret scan; production dependency audit with zero
  vulnerabilities; all passed.
- No GitHub push, Vercel deployment, or Production mutation was performed by this
  local integration batch.

## 2026-08-11 Merged Preview verification checkpoint

- The prior unsafe-merge blocker is resolved: all overlapping tracked and
  untracked work was organized into commits, the feature branch was merged into
  `codex/mvp-completion`, the worktree was cleaned up, and local/remote both point
  to merge commit `b79bd98`.
- Git integration created a Ready Preview. The existing authorized stable Preview
  alias `astera-oms-astera-blip-astera-oms.vercel.app` was reassigned to that Ready
  deployment. Production was not deployed or changed.
- Browser verification under the authenticated Preview session passed for `/`,
  `/products`, `/brand`, `/cart`, `/terms`, and `/privacy`; no Next.js error page
  appeared. Empty-cart order creation remains disabled.
- The merged payer-name flow is present: the legacy bank-code `000` test account is
  masked, marked `needsPayerName`, and offers the one-time completion action. Until
  it is completed, `/payments` correctly excludes it from the usable-account
  selector and keeps linked last-five/payer fields read-only.
- Exact next action requiring member-data confirmation: provide the payer name to
  store once on that clearly test-only account, then save it and verify that the
  Payment Report account selector automatically links the masked last five digits
  and payer name. Do not submit a Payment Report without separate action-time
  authorization.

## 2026-08-11 Preview payer-name acceptance completed

- With explicit action-time approval, the clearly test-only bank-code `000` legacy
  account received the one-time payer name `測試專用匯款人` through the protected
  member API. The account page returned a success status and no longer exposed the
  completion input.
- A fresh `/payments` readback showed the account in the member-account selector.
  Its masked last-five value and payer name were populated from the selected Server
  account. DOM verification confirmed both linked fields are `readOnly`; they are
  not separate client-authoritative inputs.
- No Payment Report was submitted, no payment request was modified, and no
  Production deployment occurred. Testing a switch between two usable accounts
  still requires a second explicitly authorised synthetic account.

## 2026-08-11 Second-account acceptance profile gate

- The user approved creating a second synthetic member payment account, but no
  account write was attempted because `/account/bank-accounts` first presented the
  required member-profile completion form. The current test member lacks a social
  ID and phone number.
- `/payments` remains readable and continues to show the first verified test
  account correctly. The application was not bypassed through a direct API call.
- Exact next action requiring separate member-data approval: preserve the existing
  first/last name, save synthetic social ID `測試專用會員` and phone `0900000000`
  with birthday blank, then return to account management and create the already
  approved second synthetic account. Do not save those profile values without
  explicit confirmation.

## 2026-08-11 Two-account switching accepted and profile error guard repaired

- The member-data write was approved but ultimately not needed: on the fresh
  authenticated read, the account page loaded normally, so no social ID, phone, or
  birthday value was changed.
- The approved second synthetic account was created with bank code `001`. The full
  synthetic account input cleared after submission; the page shows only masked
  data and reports two usable accounts out of five.
- `/payments` switching was verified in both directions. Account `000` links its own
  masked last five and `測試專用匯款人`; account `001` links its own masked last five
  and `測試專用匯款人二`. Both linked fields remain DOM `readOnly`, and no Payment
  Report was submitted.
- The intermittent earlier profile form was traced to a guard edge case: a failed
  profile read set auth to signed-in with `profile=null`, which was indistinguishable
  from a confirmed missing profile. A red/green regression now requires the guard
  to suppress profile-completion redirects while an auth/profile error exists.
- Fresh evidence so far: focused test 6/6; Unit 50 files / 418 tests; Rules 2 files /
  32 tests; TypeScript and ESLint passed. Local Next compilation succeeded, but the
  managed Windows sandbox denied its later worker spawn (`EPERM`) after two external
  approval-review timeouts. The Git-integrated Vercel Preview build is the next
  build gate; do not claim Build passed until it is Ready.

## 2026-08-11 Profile guard fix final verification

- Git-integrated Preview for commit `1c10bee` reached Ready and the existing stable
  Preview alias was moved to it. This supplies the production-equivalent Build gate
  that the managed local sandbox could not finish after compilation.
- Online readback stayed on `/account/bank-accounts`, rendered `我的匯款帳戶`, and
  loaded both usable test accounts. The deployed `/payments` page again passed
  two-way selector switching with matching read-only last-five and payer-name data.
- Final automated evidence: focused 6/6; Unit 50 files / 418 tests; Rules 2 files /
  32 tests; TypeScript; ESLint; Vercel Preview Build Ready; regular Playwright 18
  passed / 28 Emulator-only skipped; emulated Playwright 37 passed / 9 intentional
  skips; secret scan; production audit with zero vulnerabilities.
- No Payment Report or Production deployment was performed.

## 2026-08-11 Production read-only release inventory and smoke-tool repair

- Firebase CLI readback lists both `astera-oms-dev-b2b2e` and `astera-oms-prod` as
  active Firebase projects with default Storage buckets. GCP Storage confirms the
  Production default bucket in `ASIA-EAST1`.
- Fresh Production projection audit passes with `internalCount=2`, `publicCount=2`,
  and `issues=[]`. Aggregate status readback finds one published and one archived
  public product; no product content, account value, or private field was printed.
- The first Production smoke command omitted `--product-id` and falsely reported
  `public_product_not_found`: the deployed `/products` page is Client-rendered, so
  a raw HTTP response cannot be used to discover the hydrated Product link. With
  the known public Product ID supplied, all five checks pass: home, products,
  terms, privacy, and Product detail return 200.
- `scripts/smoke-production.mjs` now requires an explicit `--product-id` at CLI
  parsing time. A red/green Unit regression prevents this CSR false-negative from
  returning. Deployment, Test Plan, and Product sync SOP commands were updated.
- Vercel direct inspection confirms Production is Ready but still points to the
  2026-08-03 deployment. The stable Preview alias resolves to the Ready 2026-08-11
  merged Preview. No deployment or alias mutation occurred in this inventory.
- DNS remains unresolved for `asteratw.com`, `www.asteratw.com`, and
  `updates.asteratw.com`. The current gcloud account received 403 when directly
  listing Firebase Rules release metadata; no Rules mutation was attempted, and
  the existing successful combined Rules deployment record remains the latest
  deployment evidence.
- Exact continuation: complete the read-only Owner check for the newest test-only
  `pendingReview` Payment. Obtain a new action-time confirmation before confirm,
  reverse, mismatch/match, reveal, refund approval, or vault deletion. Production
  promotion, domain/DNS, Resend, receiving-account, image upload, and device
  acceptance remain separate gates.
- Fresh validation for this batch: focused Production script 26/26, full Unit
  50 files / 419 tests, TypeScript, ESLint, Next Build (42 routes), `git diff
  --check`, secret scan, production dependency audit (0 vulnerabilities), and
  explicit-product Production smoke 5/5 all pass.

## 2026-08-11 Latest Preview release and role-gate checkpoint

- Commit `694257b` contains the smoke-tool fix and current runbook/handoff cleanup.
  Because its Git author is not a Vercel Team member, no deployment was created for
  that commit. Empty commit `44cc5b1`, authored by the already verified Astera OMS
  team identity and containing no file change, triggered the Git-integrated build.
- The new Preview reached Ready, and the existing Firebase/OAuth-authorized stable
  Preview alias was moved to it. Production was not deployed or promoted.
- Browser reload on the stable alias retained the existing Member session. The home
  page rendered the published Product/Campaign, while direct `/workspace` access
  resolved to `需要後台權限`; this verifies the Member role is not Owner/Helper.
- The active browser account therefore cannot perform the next Owner read-only
  `pendingReview` check. Exact continuation: the user signs out and signs in with
  the Owner custom-claim account on the same stable Preview, then reports that the
  Owner session is ready. Reading the newest clearly test-only Payment is allowed;
  confirm/reverse/refund/vault mutations still need new action-time approval.

## 2026-08-11 Owner payment confirmation checkpoint

- [x] Verify the Owner custom claim on the stable Preview.
- [x] Read and uniquely identify the `測試專用 Task7` `pendingReview` Payment without
  changing other Payments.
- [x] With fresh approval, confirm the `NT$ 520` test Payment and verify that Payment,
  Order, and OrderItem become `confirmed` / `paid` as applicable.
- [x] Verify that a failed notification attempt does not roll back the financial
  transaction and exposes only a sanitized failure message.
- [ ] Re-run direct-load and in-app-navigation Owner route checks because one direct
  `/workspace/orders` load transiently rendered the role gate and could not be
  reproduced with normal in-app navigation.
- [ ] Configure Resend DNS/API key and verify actual order/payment notification
  delivery before public launch.
- [ ] Obtain separate action-time authorization before test Payment reversal, paid
  cancellation approval, refund match/mismatch, reveal, or vault cleanup operations.

## 2026-08-11 Owner payment reversal checkpoint

- [x] Obtain fresh authorization and uniquely select the previously confirmed
  `測試專用 Task7` `NT$ 520` Payment.
- [x] Reverse the Payment without overwriting its history.
- [x] Verify Payment=`reversed`, a negative adjustment, and Audit Log action
  `payment.reversed` with the test-only reason.
- [x] Verify the linked Order and OrderItem recalculate from `paid` to
  `awaitingPayment`.
- [x] Verify notification failure does not roll back the financial reversal.
- [ ] Prepare a separate, clearly labelled paid-cancellation test case. Obtain new
  action-time approval before cancellation review, refund match/mismatch, reveal,
  approval, or vault deletion.

## 2026-08-11 Paid-cancellation member UI checkpoint

- [x] Use only `AST-20260811-0001` / `測試專用會員` for the next paid-cancellation
  path; submit and Owner-confirm a new `NT$ 520` test Payment.
- [x] Reproduce and trace the missing paid-item cancellation control to
  `OrderDetailBoard`, which incorrectly accepted only `awaitingPayment` items.
- [x] Add red/green API and UI regressions.
- [x] Add sanitized confirmed-Payment options to the protected Order-detail API;
  exclude HMAC fingerprints and all full account values from its response.
- [x] Add paid-item selection, original Payment selection, bank-code/full-account
  verification inputs, 14-day retention copy, and safe Chinese failure messages.
- [x] Pass focused 12/12, full Unit 420/420, TypeScript, ESLint, and Next Build.
- [ ] Push and wait for a Ready Preview, then verify the deployed form. The member
  enters the exact original full account directly in the password field; never send
  it through chat. Obtain fresh confirmation immediately before the final POST if
  the user has not personally clicked submit.

## 2026-08-11 Paid-cancellation Preview readiness

- [x] Push `d543094`; wait for a Ready Vercel Preview; move only the existing stable
  Firebase-authorized Preview alias. Production remains unchanged.
- [x] Verify the deployed paid item is selectable and the masked confirmed-Payment,
  bank-code, full-account password field, retention notice, and submit button render.
- [ ] User enters the exact original full account directly in the browser without
  sharing it in chat, then confirms readiness before the cancellation POST.
- [ ] After submission, verify `cancelRequested`, pending Owner review, encrypted
  vault metadata without plaintext, mismatch/match semantics, and Audit Log.

## 2026-08-11 Payment-report idempotency and review status

- [x] Require a bounded client idempotency key and derive opaque deterministic
  Payment／group IDs with server-side SHA-256.
- [x] Return the original Payment group for an identical replay; reject key reuse
  with different immutable input as `409 idempotency_conflict`.
- [x] Add a protected member-only Payment history API that excludes fingerprints,
  KMS versions, full account values, internal reasons, and other members' data.
- [x] Add a synchronous UI submission lock, stable retry key, disabled
  `送出中…` state, and persistent `我的付款回報` statuses.
- [x] Add Owner-only rejection of `pendingReview` reports with a required reason,
  immutable `payment.rejected` Audit Log, and no financial-state mutation.
- [x] Verify rapid double click creates one Payment and the status survives reload
  in Auth／Firestore／Storage Emulator Playwright.
- [x] Deploy the commits to Preview and run an authenticated Owner read-only browser
  acceptance pass. Do not alter the two existing duplicate Preview Payments until
  exact action-time approval identifies which record to reject.

Preview deployment update:

- [x] Push through `e844505`; Vercel deployment `dpl_7Y3oLMmmBExgZ1Y9AwpLYUoTaif1`
  reached Ready and the existing authorized stable Preview alias was moved to it.
- [x] Owner session loaded `/workspace/payments`; the deployed UI shows the required
  `處理理由` field and enabled `拒絕回報` action for the selected pending report.
- [x] With fresh action-time approval, retain the earlier Payment
  `lA8Fje6lU2vAqLvdp0VN` as `pendingReview` and reject only the later duplicate
  `pdfwANGEnxaldM6iM3Q7` with reason `測試專用：重複付款回報`.
- [x] Verify both the deployed success status and production Firestore state:
  the later Payment is `rejected`, the earlier Payment remains `pendingReview`,
  and `audit_reject_pdfwANGEnxaldM6iM3Q7` records `payment.rejected` with the
  exact safe reason. No Payment was confirmed or deleted.

## 2026-08-11 Guest storefront homepage redesign

- [x] Rebuild the existing `/` route in place; no alternate homepage or mockup route was added.
- [x] Keep `productsPublic` and existing catalog helpers as the only homepage product／Campaign source.
- [x] Replace the public `ASTERA OMS` tooling presentation with an `ASTERA` buyer Header,
  curated Hero, Campaign cards, 2／4-column product Grid, shopping guide, supplement,
  FAQ／support, and the existing shared Footer.
- [x] Add minimal session-only guest cart intent preservation. After existing Firebase
  redirect login and profile completion, the homepage reloads current public catalog data,
  validates IDs/status, writes through protected `/api/cart`, and clears the intent only
  after success. Price and permissions are never persisted in the intent.
- [x] Verify focused Unit 29/29, full Unit 56 files／450 tests, TypeScript, ESLint,
  Next Build 42 routes, regular public Playwright 16 passed／10 expected skips,
  Emulator homepage Playwright 10/10, and Rules 2 files／32 tests. Implementation
  commit: `54a8b03`.
- [x] Preview and Production deployment were completed later; the active Production
  record is maintained in the 2026-08-12 deployment update below.

### 2026-08-12 Production deployment update

- [x] Locally merge the approved public storefront redesign into `main` at
  `189b3c8` and add `cbb8dc1` to remove a parallel-test timing failure in the
  payer-name route test.
- [x] Deploy Vercel Production deployment `dpl_8FPCjc99CzRMXrfFo6GEhTLpsmek`
  (`https://astera-llgfemo41-astera-oms.vercel.app`) and assign the production
  alias `https://astera-oms.vercel.app`.
- [x] Fresh verification before release: Unit 56 files／450 tests; Firestore and
  Storage Rules 2 files／32 tests; TypeScript; ESLint; Next Build 42 routes; and
  public Playwright 16 passed／10 expected Emulator-only skips.
- [x] Production anonymous smoke against the alias: `/`, `/products`, `/terms`,
  `/privacy`, and `/products/prod_002` all returned HTTP 200.
- [x] Add the missing Production-only `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` as
  `astera-oms-prod.firebaseapp.com`, then redeploy as
  `dpl_79zMNBTmdKrsNq58pcx6tK3fMJeH`
  (`https://astera-1nmgtq5nv-astera-oms.vercel.app`), now the active alias.
  The Firebase default Auth domain is used deliberately: it requires no new DNS,
  Authorized Domain, OAuth redirect URI, or secret.
- [ ] Production authenticated Member／Owner acceptance, real email delivery,
  custom domain DNS, and Resend remain separate release gates.

### 2026-08-12 Remaining external release gates (read-only recheck)

- [x] Confirm the active Production alias is Ready and public smoke remains 5/5.
- [x] Confirm production product projection audit: `productsInternal=2`,
  `productsPublic=2`, and zero pricing／SKU／private-field issues.
- [x] Confirm secret scan and production dependency audit: no obvious repository
  secrets and zero high-or-greater production dependency vulnerabilities.
- [ ] Register and configure `asteratw.com`, `www.asteratw.com`, and
  `updates.asteratw.com`; all three DNS lookups remain unresolved.
- [ ] Verify `updates.asteratw.com` SPF／DKIM in Resend and add the missing
  Production-only `RESEND_API_KEY`. Sender and Reply-To names exist, but no API
  key is configured, so notification delivery cannot yet be proven.
- [ ] Conduct real Google sign-in and the protected Member／Owner acceptance flow
  from the Production alias. This needs a person to complete OAuth and explicit
  action-time authority before any test Payment, reversal, cancellation, or refund.

### 2026-08-12 Production Google redirect-session blocker

- [x] Do not use `astera-oms-prod.firebaseapp.com` as the Vercel Production
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`. It is a cross-origin redirect helper and can
  lose the Firebase redirect session in browsers that block third-party storage;
  this exactly matches the reported "Google account completes, site remains signed
  out" symptom.
- [x] Firebase Console readback confirmed `astera-oms.vercel.app` already existed
  in Authorized Domains; no domain was added or removed.
- [x] Append only `https://astera-oms.vercel.app/__/auth/handler` to the existing
  Google OAuth Client's Authorized redirect URIs, set Vercel Production
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=astera-oms.vercel.app`, and redeploy as
  `dpl_A8uq9wwsdtzZLRWR85VzBh9wgE6a`. The existing `next.config.ts` transparent
  `/__/auth/:path*` proxy is unchanged; no Collection, Firebase Rule, Checkout, or
  payment logic changed.
- [x] Verify the active alias proxy returns HTTP 200 for `/__/auth/iframe` and
  `/__/auth/handler`; an unsigned browser test reaches Google account selection
  with the same-origin redirect URI and no `redirect_uri_mismatch`.
- [x] A user manually completed Google login on the Production alias and confirmed
  that the session now persists. The same-origin Auth repair is accepted for the
  signed-in cart continuation.

### 2026-08-12 Production cart validation follow-up

- [x] Reproduce the signed-in Production cart issue without creating an Order:
  with one cart item present, blank recipient details, and both required consents
  unchecked, `建立訂單` was enabled. Server-side validation still rejected incomplete
  requests, but the client did not provide the expected prevention.
- [x] Add `isCheckoutSubmissionReady`, which reuses the existing shipping validator
  and requires both legal and supplement consents. `CartBoard` now disables the
  Order CTA until the member is signed in, catalog data is available, recipient
  details are valid, and both consents are checked.
- [x] Add regression coverage. Focused checkout Unit: 11/11; complete Unit:
  56 files／451 tests; TypeScript; ESLint; Next Build 42 routes; regular Playwright:
  20 passed／38 expected Emulator-only skips.
- [x] Under fresh authorization, deploy the client-only prevention change to Vercel
  Production as `https://astera-20qm8k0i8-astera-oms.vercel.app`; the alias
  `https://astera-oms.vercel.app` now points to it. A signed-in Production cart
  with one item, blank recipient fields, and unchecked consents showed the disabled
  CTA and its prerequisite message. No Order was submitted.
- [x] Production anonymous smoke: `/`, `/products`, `/terms`, `/privacy`, and
  `/products/prod_002` returned HTTP 200.

### 2026-08-12 Checkout self-link cleanup

- [x] Reproduce the self-referential UI on `/checkout`: `CartBoard` was shared by
  `/cart` and `/checkout`, so the checkout page itself rendered a `前往結帳` link.
- [x] Add the `showCheckoutStep` presentation prop. It defaults to `true` for
  `/cart`; `/checkout` sets it to `false`, leaving its existing recipient, consent,
  and order creation controls intact.
- [x] Fresh verification: targeted checkout route Unit 2/2, complete Unit 56
  files／451 tests, TypeScript, ESLint, Build 42 routes, public Playwright
  14 passed／2 expected skips.
- [x] Under explicit authorization, deploy Vercel Production
  `https://astera-czlg1up5n-astera-oms.vercel.app` and assign
  `https://astera-oms.vercel.app`. A fresh `/checkout` browser inspection confirms
  the self-link card is absent and the receipt form remains visible; public smoke
  remains 5/5 HTTP 200.

### 2026-08-14 Owner role assignment — local implementation

- [x] Formal roles are `owner | partner | helper | member`; Firebase Custom Claims
  remain authoritative. The website can assign Partner, Helper, or Member but
  cannot grant, remove, or transfer Owner.
- [x] Server APIs verify revoked tokens. Role changes preserve unrelated claims,
  revoke target sessions, append an immutable Audit Log and a one-time notice,
  with compensation on Auth or Firestore persistence failure.
- [x] `/workspace/members` has role display, selection, and second confirmation.
  Current Workspace business functions remain Owner-only pending the later
  Partner／Helper functional batches.
- [x] Verification: TypeScript; ESLint; Unit 60 files／481 tests; Rules 2 files／33
  tests; Build 43 routes; secret scan; production audit 0 vulnerabilities;
  regular Playwright 20 passed／40 expected Emulator-only skips; targeted desktop
  member/role E2E 3 passed.
- [x] Full Auth／Firestore／Storage Emulator Playwright completed with a longer
  timeout: 49 passed／11 intentional project skips／0 failed.
- [x] The full-data Pixel 7 run exposed two stale role assertions and a real
  `/workspace/payments` horizontal overflow caused by unbroken Payment IDs.
  Commit `7b84ab6` aligns the mobile role contract with the Owner-only Workspace
  gate and lets long payment/request identifiers wrap without hiding them.
- [x] Fast-forward `codex/role-assignment` into local `main` at `0e488c7`, rerun
  `npm test` on the merged tree (481 Unit／33 Rules), and remove the clean feature
  worktree and merged local branch.
- [x] Push GitHub `main` from `d0d9302` to `0e488c7`. The Git integration created
  Ready Production deployment `dpl_AF8HKGiBwk7feed6Dby33J8xA839` at
  `https://astera-7yzyqpecr-astera-oms.vercel.app` and assigned
  `https://astera-oms.vercel.app`.
- [x] Create protected Preview `https://astera-helt9y17m-astera-oms.vercel.app`;
  its 43-route build completed and all five protected smoke routes passed through
  the Vercel bypass. Production smoke passed `/`, `/products`, `/terms`,
  `/privacy`, and `/products/prod_002` with HTTP 200.
- [ ] Vercel still builds with Node 24.15.0 while `package.json` requests
  `>=24.18.0 <25`; the warning does not fail the build but remains a release
  configuration follow-up. The next functional batch is Partner catalog drafts.

### 2026-08-12 Storefront product, order, and navigation refinement

- [x] Create the isolated `codex/storefront-product-order` worktree and implement
  the approved mobile Header (fixed ASTERA／cart／menu; vertical menu below Header),
  a dismissible Header cart drawer, responsive public Product cards, Product image
  gallery controls, separated cart／checkout presentation, and clear Order action
  cards.
- [x] Preserve all existing Firebase, `productsPublic`, Cart API, Checkout, pricing,
  Rules, and Order business logic. No Collection or Rule change was made.
- [x] Add regression coverage for responsive navigation／cart drawer, guest checkout
  presentation, and order-action payment-request selection.
- [x] Fix two release-relevant regressions found during verification: the cart drawer
  now safely degrades when public Firebase configuration is unavailable, and the
  `/payments` query-driven preselection is wrapped in the required Next.js Suspense
  boundary for production static builds.
- [x] Verification: TypeScript; ESLint; Unit 57 files／457 tests; Firestore＋Storage
  Rules 2 files／32 tests; Build 42 routes; focused public navigation E2E 4/4;
  public smoke 14 passed／2 expected Emulator-only skips; and Emulator homepage E2E
  10/10 (390px／768px／1365px plus signed-in cart continuation).
- [x] Re-run the complete regular Playwright suite on a fresh isolated server after
  confirming no stale listener remained: 24 passed／38 expected Emulator-only skips.
  The earlier 404 sequence was caused by a timed-out development server being reused,
  not by application routing.
- [x] Push `codex/storefront-product-order` to GitHub through `44138b4`. Vercel
  automatically built Preview `dpl_7BsLuhmHK8zFZteMHKHPY3dk4FK3` and reported
  `Ready`. The stable branch alias is protected by Vercel SSO, so anonymous requests
  correctly redirect to Vercel login; authenticated read-only checks returned HTTP
  200 for `/`, `/products`, `/terms`, `/privacy`, and `/products/prod_002`.
- [ ] Production remains unchanged. Merge／Production deployment requires a separate
  explicit decision after manual Preview acceptance.

### 2026-08-12 Approved guest／member homepage correction

- [x] Identify why the Preview did not match the approved homepage: the branch had
  navigation／product refinements but `src/app/page.tsx` still rendered the earlier
  ASTERA SELECT hero, four-step guide, supplement, and FAQ hierarchy.
- [x] Replace the real `/` homepage with the approved auth-aware experience. Guests
  now see the member-login card, three-step purchasing card, and side-by-side
  closing-soon／latest product groups. Signed-in members see actionable payment
  items first, then latest and closing-soon products. No alternate mock route was
  created.
- [x] Preserve Firebase Auth, Profile guard, `productsPublic`, Cart API, pending
  guest cart intent, Server price／Campaign validation, Checkout, Collections, and
  Rules. Guest Header cart is hidden by design; signed-in members retain the cart
  drawer, orders, profile, and custom-claim Owner workspace link.
- [x] TDD evidence: the new latest／closing-soon ranking tests first failed because
  both functions were absent, then the complete Unit suite passed at 57 files／459
  tests. TypeScript, ESLint, Rules 2 files／32 tests, Build 42 routes, secret scan,
  and production dependency audit (0 vulnerabilities) passed.
- [x] Browser evidence: regular Playwright 22 passed／42 expected Emulator-only
  skips; complete Auth／Firestore／Storage Emulator Playwright 54 passed／10 expected
  skips. The suite covers 390px, 768px, 1365px, signed-in member ordering, guest
  cart-intent continuation, Header states, desktop, and Pixel 7.
- [ ] Push and Vercel Preview deployment are the next release step. Production is
  unchanged and still requires separate explicit authorization.

### 2026-08-14 Approved homepage integration into current main

- [x] Confirm the missing homepage lived at `c9dfc49` and required the seven
  preceding storefront commits after `dca4eaf`; integrating only the final commit
  would omit the mobile navigation and Header cart dependencies.
- [x] Merge the complete storefront dependency range into an isolated branch based
  on `main` `5890948`. Preserve the newer role-assignment work and combine both
  execution/handoff histories. No Collection, Checkout rule, or Firebase Rule was
  changed.
- [x] Independent review found and closed two Important issues: serialize homepage
  cart writes so rapid additions cannot overwrite each other, and show only the
  remaining balance for partially paid member actions. Both fixes have red／green
  regression tests.
- [x] Verification on the final integrated tree: TypeScript pass; ESLint pass; Unit
  62 files／492 tests; Firestore＋Storage Rules 2 files／33 tests; Build 43 routes;
  regular Playwright 22 passed／44 expected Emulator-only skips; full Emulator
  Playwright 55 passed／11 intentional project skips; secret scan pass; production
  dependency audit 0 vulnerabilities.
- [x] Fast-forward the reviewed integration to `main` and push GitHub at `0b81cd1`.
  Vercel Preview `dpl_2vVMrLwHr1HqRncWp8rgLAJaW1jE` reached Ready at
  `https://astera-6gd2psiv9-astera-oms.vercel.app`.
- [x] Verify the hydrated Preview guest homepage: public Header, Google member
  login, three-step purchase flow, closing-soon area, and latest real
  `productsPublic` product all render; the removed legacy workflow／supplement／FAQ
  homepage sections do not return.
- [x] Git-integrated Production `dpl_Gfx2vDL85fqkNXQECT6LUxrVSQNR` reached Ready
  and owns `https://astera-oms.vercel.app`. The hydrated signed-in homepage shows
  actionable payment items before latest and closing-soon products. Production
  smoke passed `/`, `/products`, `/terms`, `/privacy`, and
  `/products/prod_002` with HTTP 200.

### 2026-08-14 Partner Product／Variant／Campaign 草稿審核

- [x] 在隔離分支 `codex/partner-catalog-drafts` 完成 Partner 商品草稿工作流；本批只涵蓋 Product／Variant／Campaign，不改既有正式商品 Collections、Checkout 或 `productsPublic` 前台來源。
- [x] 新增 `catalogChangeRequests` domain、Server repository 與受保護 API。Partner 只能建立或修正自己的草稿；Owner 核准時以單一 Firestore transaction 同時套用正式商品、Variant、Campaign、`productsPublic`、審核結果與 Audit Log，不存在先發布再補償的中間狀態。
- [x] Partner Workspace 僅允許 `/workspace`、`/workspace/products` 與 `/workspace/catalog-reviews`；直接輸入會員、訂單、付款、內容或 Audit 路徑亦會拒絕。正式商品儲存仍為 Owner-only，Helper／Member 仍不可進入商品工作區。
- [x] 修正駁回草稿重新載入競態，並加入 loaded base version／revision guard；商品、分類或子項目在送審期間變動時回傳衝突，要求重新載入，不會靜默覆蓋正式資料。
- [x] Partner payload 嚴格驗證型別、enum、成本、唯一 Variant／Campaign ID、Default Variant 與 Owner-only 圖片邊界。新 Product／Variant／Campaign ID 由 Server 派發；封存 ID、其他商品子項目及舊 SKU 不可重用。
- [x] 核准交易以分類主檔的 active ID／label 為權威，保留已封存 Variant 的原幣成本歷史，並在 Owner 審核畫面明示核准後將封存的 Variant／Campaign。
- [x] exact review replay 以 decision digest 保持冪等；每次駁回修訂保留不可變 revision snapshot。桌機與 Pixel 7 已涵蓋送審、過期衝突、駁回、修正、重送、核准及測試資料還原。
- [x] `catalogChangeRequests` 已在 Firestore Rules 明確 deny-all Client SDK；匿名、Member、Helper、Partner、Owner 的讀寫矩陣均通過。
- [x] 獨立安全複審最終為 Critical 0／Important 0。驗證：TypeScript、zero-warning ESLint、Build 45 routes；Unit 66 files／541 tests；Rules 2 files／34 tests；一般 Playwright 22 passed／46 預期 skips；完整 Emulator Playwright 57 passed／11 預期 project skips；secret scan 通過；Production dependency audit 0 vulnerabilities。
- [ ] 尚未部署 Preview／Production，也未部署本批 Firestore Rules。下一精確批次為 Partner 分類／品牌內容草稿，或依已確認 rollout 開始 Rush Purchase contribution／Helper 分紅資料層；部署需另行決定。
