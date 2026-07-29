# Astera OMS MVP Completion Plan

Last updated: 2026-07-29 Asia/Taipei

## Execution Rules

- Source of truth: the project handoff in this task plus the existing repository docs.
- AI continuation entrypoint: `docs/18_AIContinuationBrief.md`.
- Scope: MVP only. Do not add Helper, Warehouse, CRM, Finance, Analytics, or ERP features.
- Architecture: keep Next.js 16, Firebase, Vercel, `productsInternal` private master data, and `productsPublic` public storefront projection.
- Safety: preserve the pre-existing `AGENTS.md` change and avoid staging unrelated files.

## Current Baseline

- Branch: `codex/mvp-completion`.
- Pre-existing dirty file: `AGENTS.md`.
- Local baseline from handoff: lint, typecheck, build, unit tests, Firestore rules tests, and Playwright smoke tests pass.
- Known production gates: Firebase login, Blaze upgrade, Storage buckets, Vercel OIDC, `asteratw.com` purchase, DNS, Resend verified domain.

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
