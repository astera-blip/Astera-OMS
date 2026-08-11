# Astera OMS MVP Completion Plan

Last updated: 2026-08-10 Asia/Taipei

## Execution Rules

- Source of truth: the project handoff in this task plus the existing repository docs.
- AI continuation entrypoint: `docs/20_CompleteAIHandoff_2026-07-30.md`.
- Scope: MVP only. Do not add Helper, Warehouse, CRM, Finance, Analytics, or ERP features.
- Architecture: keep Next.js 16, Firebase, Vercel, `productsInternal` private master data, and `productsPublic` public storefront projection.
- Safety: preserve the pre-existing `AGENTS.md` change and avoid staging unrelated files.

## Current Baseline

- Active isolated branch: `codex/production-security-worker` in
  `.worktrees/production-security-worker`; the primary workspace's unrelated
  changes remain untouched.
- Current local release gate: TypeScript, ESLint, Build, 374 Unit tests, 32 Rules
  tests, 34 Emulator Playwright tests, secret scan, and production dependency
  audit pass.
- Current Task 7 gate: Vercel security variables are normalized, Preview is Ready,
  the stable alias is authorized, and Google OAuth, profile save, member
  payment-account binding, member workspace rejection, a test-only Order/PaymentRequest,
  and one `pendingReview` Payment are verified. The remaining Preview flow needs a
  fresh one-pass test account/order/payment for refund mismatch/match, Owner reveal,
  and vault deletion because full synthetic account values are intentionally not
  stored.
- Production has not been redeployed or promoted by Task 7. Domain/DNS, Resend,
  final Production data and mobile acceptance remain separate release gates.

## Batch Status

| Batch | Status | Notes |
| --- | --- | --- |
| 0 Safety baseline | Partially complete | Branch created. External backup/deploy actions blocked on Firebase login and console access. |
| 1 Server trust boundary and rules | Locally complete / deployment pending | Product/classification/profile/cart/content/member-note/order/payment/cancellation/legal/notification business writes now use protected APIs or Admin-only seed paths; Client SDK writes are denied by local rules. Production deployment is pending external Firebase access. |
| 2 Product, SKU, Campaign | Core locally complete / UI clarity batch pending / migration pending | Owner Product/Variant/Campaign API and transaction SKU assignment are complete. Approved bilingual labels, classification tabs, copy-ID/SKU controls, classification server IDs, and help text are pending implementation. Formal production product re-save/migration remains pending external Firebase access. |
| 3 Checkout split and consent | In progress | Checkout UI/API require consent, split cart by Campaign, create multiple orders/payment requests/consents, and assign `AST-YYYYMMDD-0001` order numbers. |
| 4 Payments and cancellation | In progress | Payment report, owner confirmation, payment reversal, unpaid direct cancellation, paid cancellation review with refund adjustment, and overpayment reporting UI are implemented locally. Auth emulator owner/member Playwright harness is now available; detailed checkout/payment/cancellation E2E flows still need to be added. |
| 5 Storage images | In progress / bucket pending | Product image Storage rules and emulator tests are complete for the public product image namespace. Actual bucket creation/upload UI still requires Blaze bucket creation. |
| 6 Homepage, content, Resend | In progress | Content write API is complete. Formal Astera consumer copy and Resend DNS/email are still pending. |

## External Gates

- Buy `asteratw.com`.
- Enable Blaze on dev and production Firebase projects.
- Create Storage buckets in `asia-east1`.
- Configure Vercel OIDC to GCP Workload Identity.
- Verify `updates.asteratw.com` in Resend.

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
