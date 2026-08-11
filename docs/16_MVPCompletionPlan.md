# Astera OMS MVP Completion Plan

Last updated: 2026-08-02 Asia/Taipei

## Execution Rules

- Source of truth: the project handoff in this task plus the existing repository docs.
- AI continuation entrypoint: `docs/20_CompleteAIHandoff_2026-07-30.md`.
- Scope: MVP only. Do not add Helper, Warehouse, CRM, Finance, Analytics, or ERP features.
- Architecture: keep Next.js 16, Firebase, Vercel, `productsInternal` private master data, and `productsPublic` public storefront projection.
- Safety: preserve the pre-existing `AGENTS.md` change and avoid staging unrelated files.

## Current Baseline

- Branch: `codex/mvp-completion`.
- Pre-existing dirty file: `AGENTS.md`.
- Local baseline from handoff: lint, typecheck, build, unit tests, Firestore rules tests, and Playwright smoke tests pass.
- Known production gates: Firebase CLI/ADC verification, Vercel OIDC environment verification, `asteratw.com` purchase, DNS, Resend verified domain, production data sync, and device acceptance. Blaze and the Production Storage bucket are now completed.

## Batch Status

| Batch | Status | Notes |
| --- | --- | --- |
| 0 Safety baseline | Partially complete | Branch created. External backup/deploy actions blocked on Firebase login and console access. |
| 1 Server trust boundary and rules | Firestore + Storage deployed | Product/classification/profile/cart/content/member-note/order/payment/cancellation/legal/notification business writes now use protected APIs or Admin-only seed paths; Firestore and Storage Rules are deployed to `astera-oms-prod`. |
| 2 Product, SKU, Campaign | Local implementation complete / migration pending | Owner Product/Variant/Campaign API, transaction SKU assignment, bilingual labels, classification tabs, copy-ID/SKU controls, classification server IDs, help text, and Campaign UTC+8 handling are implemented. Formal production product re-save/migration remains pending external Firebase access. |
| 3 Checkout split and consent | In progress | Checkout UI/API require consent, split cart by Campaign, create multiple orders/payment requests/consents, and assign `AST-YYYYMMDD-0001` order numbers. |
| 4 Payments and cancellation | In progress | Payment report, owner confirmation, payment reversal, unpaid direct cancellation, paid cancellation review with refund adjustment, and overpayment reporting UI are implemented locally. Auth emulator owner/member Playwright harness is now available; detailed checkout/payment/cancellation E2E flows still need to be added. |
| 5 Storage images | Rules/bucket deployed; live upload pending | Product image upload UI/API, Storage rules, metadata registration, projection fields, and emulator tests are complete. The Firebase default bucket is linked in `asia-east1`; live upload and real-device image acceptance remain pending. |
| 6 Homepage, content, Resend | In progress | Content write API is complete. Formal Astera consumer copy and Resend DNS/email are still pending. |
| 7 Campaign timezone and Member Dashboard skeleton | Local implementation complete | Campaign datetime-local now round-trips as Taipei UTC+8; `/members` has a visual-only dashboard skeleton with no fake operational data. |
| 8 Receiving bank account recognition | Local implementation complete / production setup pending | Owner API/UI manages active/inactive Astera receiving accounts; member payment reports select an active account and store a masked snapshot. Production account setup remains an Owner operation. |
| 9 Visual system migration | Local implementation complete / device and Production visual gate pending | Approved Astera tokens are defined globally, legacy slate/amber utilities render through the new tokens, and the full authenticated emulator suite remains green. Real-device and Production visual acceptance remain pending. |

## External Gates

- Buy `asteratw.com`.
- Enable Blaze on dev and production Firebase projects (both confirmed; Development and Production use billing account `01B794-2E6BD7-33D714`).
- Create Storage buckets in `asia-east1` (both default buckets linked and Rules deployed).
- Configure and verify Vercel OIDC to GCP Workload Identity in the deployed Preview/Production runtime.
- Verify `updates.asteratw.com` in Resend.

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

1. Re-run ADC login/check with `ting1811tin@gmail.com`, then run the strict Vercel Production environment check against the deployed Preview/Production runtime.
2. Run the read-only production projection audit and, after its report is reviewed, perform the approved `productsInternal → productsPublic` synchronization.
3. Configure real production receiving-account records only after the audit, then run the production checklist including live image upload and device acceptance.

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
- [ ] Task 5–8：Task 4 gate 已解除，依序接續執行。Task 4 deferred Minor：over-limit mismatch 目前仍會先執行 KMS 驗證／scope hash，需在後續 rate-limit 工作加入 KMS 前置限流以控制成本。

### 2026-08-04 銀行帳號退款安全 Task 5 完成

- [x] Task 5：Firestore Rules／通知／Audit 與退款限流收緊，commits `22db1c5..7433ec3`，scoped re-review APPROVED（Critical 0、Important 0）。
- `cancellationRequests`、`memberPaymentAccounts`、`notificationEvents`、`auditLogs` 已對所有 Client SDK 角色 deny-all；匿名／Member／Helper／Owner 四角色 × 四個 protected collections read/write matrix 已於 Rules 32 tests 驗證，`productsPublic` 公開讀取保留。
- Owner 通知、取消與 Audit 顯示改走 custom-claim Server API strict allowlist；retry response 不再回傳 provider diagnostics，internal rate-limit reservation 不出現在 Audit API。
- 退款 mismatch 在 HMAC／KMS／加密前以 transaction reservation 限流；成功刪 reservation，失敗寫入安全 limiter 與 immutable audit，60 秒殘留 reservation 到期清理。
- 驗證：Rules 2 files／32 tests、focused Unit 4 files／43 tests、完整 Unit 43 files／242 tests、TypeScript、zero-warning ESLint 通過。
- [ ] Task 6：需將穩定且至少 32 字元的 `REFUND_RATE_LIMIT_HASH_SECRET` 納入 Production secret、環境檢查與部署文件，再處理 KMS／金鑰治理與月度報告。

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
- [ ] 外部 Scheduler endpoint、專用 service account、Monitoring alert 與 Production dry-run 尚未部署
  或執行；需 Owner／平台憑證與正式維護窗口，不屬於本機 Task 6 寫入範圍。

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
