# Astera OMS AI Continuation Brief

Last updated: 2026-07-29 Asia/Taipei

This file is the compact handoff for another AI agent. Treat it together with:

- `docs/16_MVPCompletionPlan.md`
- `docs/17_ProjectHandoff.md`
- `AGENTS.md`

> **2026-07-30 status override:** This is now a historical compact brief.
> Start from `docs/20_CompleteAIHandoff_2026-07-30.md` for the current complete
> requirement, implementation, verification, external-gate, and continuation
> record. This file remains for historical detail only.

## Final Status Override — 2026-07-29 07:49 Asia/Taipei

This section supersedes the older “Current Remaining Gaps”, “Approved … Pending
Implementation”, validation counts, and recommended Task 1–13 steps later in this
file.

- All locally executable Tasks 1–13 are implemented.
- Product image upload/API/metadata validation works with Storage Emulator; only
  the real Blaze bucket and production upload remain external.
- ProductWorkspace/Classification decisions listed below are implemented, except
  Variant Name intentionally remains free text because no replacement behavior was
  approved.
- Resend delivery orchestration is implemented and tested; only DNS/API key/real
  delivery remains external.
- Read-only production tools and the backup/sync SOP are complete.
- Latest validation: Unit 22/104, Rules 2/29, Build 31 routes, regular E2E
  10 passed/18 skips, Emulator E2E 25 passed/3 skips, typecheck/lint/secret scan
  passed, production audit 0 vulnerabilities.
- Commits immediately before this handoff:
  - `9c9104f fix: complete desktop and mobile acceptance`
  - `ae32900 chore: add production readiness tooling`
  - `e84047f fix: address final readiness review`
- Preserve the user-owned uncommitted `AGENTS.md`.

Remaining work requires external state:

1. Firebase Blaze and real development/production Storage buckets.
2. Vercel OIDC/GCP Workload Identity and production environment values.
3. Firestore/Storage Rules development then production deployment.
4. Production backup, read-only audit, and Owner-API Product re-save/sync.
5. `updates.asteratw.com` verification, Resend API key, and actual delivery proof.
6. Final legal text, domain/DNS, production smoke, Pixel 7, and real-device signoff.

Use `docs/SOP/正式資料備份與商品同步SOP.md` and never add a long-lived service
account key.

## Project Goal

Astera OMS is an MVP order management system for Thai GL / artist merchandise proxy buying.

Keep the scope MVP-only:

- Google login
- member profile
- public products
- product management
- cart
- checkout
- manual bank transfer
- order management
- payment management
- cancellation requests
- brand/content management
- notification event tracking

Do not add ERP modules such as Helper, Warehouse, CRM, Finance, Analytics, or Wallet.

## Architecture Rules

- Framework: Next.js 16, React, TypeScript.
- Backend: Firebase Auth, Firestore, Firebase Admin SDK.
- Hosting target: Vercel.
- Product authority: `productsInternal`.
- Public storefront source: `productsPublic` only.
- Server trust boundary:
  - frontend sends intent only;
  - server validates price, campaign, order, payment, and permissions;
  - client Firestore writes are denied for business collections.
- Owner permission source: Firebase custom claim `role: owner`.
- Do not use email as owner authority.
- Do not redesign collections or merge Product/Variant.

## Current Branch / Repo State

- Working branch: `codex/mvp-completion`.
- Remote: `origin https://github.com/astera-blip/Astera-OMS.git`.
- Preserve pre-existing user change: `AGENTS.md`.
- If committing, do not stage `AGENTS.md` unless the user explicitly asks.

## Completed Local Work

### Product / Variant / Campaign

- Owner-only Product API exists: `src/app/api/workspace/products/route.ts`.
- Owner-only classifications API exists: `src/app/api/workspace/classifications/route.ts`.
- ProductWorkspace loads/saves through protected APIs.
- ProductWorkspace supports multiple Variants and multiple Campaigns.
- Campaign supports `salePriceTwd`.
- Campaign status is `upcoming | open | closed | archived`.
- Campaign archive is soft archive, not hard delete.
- Public projection omits SKU, original costs, and internal notes.
- Frontend storefront reads only `productsPublic`.

### SKU

- Product SKU format: `AST-P000001`.
- Variant SKU format: `AST-P000001-V001`.
- Product SKU is assigned transactionally through `siteSettings/system-sequences`.
- Server ignores all submitted Product/Variant SKU values.
- Existing Product SKU is preserved from `productsInternal/{productId}.sku`.
- Existing Variant SKU is preserved by variant document ID.
- New Variant SKU is assigned after the highest existing Variant sequence.
- Relevant files:
  - `src/lib/product/catalog.ts`
  - `src/lib/product/serverCatalog.ts`
  - `tests/unit/productCatalog.test.ts`

### Checkout

- `POST /api/checkout` validates Firebase ID token.
- Checkout validates cart against authoritative public product data plus server-side variant SKU lookup.
- Checkout requires legal/privacy consent and supplement-rule consent.
- Cart can contain different sale types/campaigns.
- Checkout groups cart lines by Campaign.
- Each Campaign group creates:
  - Order
  - PaymentRequest
  - ConsentRecord
  - pending NotificationEvent
- Orders have:
  - `checkoutGroupId`
  - `orderNumber` like `AST-YYYYMMDD-0001`
- Firestore document ID is not used as the member-facing order number.

### Payments

- Member payment report API exists: `src/app/api/payments/route.ts`.
- Member reports:
  - payment request ID
  - transfer date
  - amount
  - account last five digits
  - payer name
  - note
- Payment is created as `pendingReview`.
- Owner confirms by Payment ID through:
  - `src/app/api/workspace/payments/[id]/confirm/route.ts`
- Confirmation handles:
  - cumulative allocation
  - `partiallyPaid`
  - `paid`
  - `unallocatedAmountTwd` for overpayment
  - audit log
  - pending payment-confirmed NotificationEvent
- Owner reverses confirmed payments through:
  - `src/app/api/workspace/payments/[id]/reverse/route.ts`
- Reversal:
  - marks Payment `reversed`
  - appends negative `paymentAllocations` adjustment
  - recalculates PaymentRequest / Order / OrderItem state
  - writes audit log

### Cancellation

- Cancellation API exists: `src/app/api/cancellations/route.ts`.
- Cancellation unit is OrderItem.
- Unpaid items are cancelled directly.
- Paid items create cancellation requests.
- Mixed selected items are split by server logic.
- Owner review API exists:
  - `src/app/api/workspace/cancellations/[id]/review/route.ts`
- Owner approval of paid cancellation requires:
  - refund amount
  - refund completed date
  - refund reference
- Approval writes negative adjustment and audit log.

### Profile / Cart / Content Trust Boundary

- Member profile writes moved to:
  - `src/app/api/member/profile/route.ts`
- Cart writes moved to:
  - `src/app/api/cart/route.ts`
- Workspace content writes moved to:
  - `src/app/api/workspace/content/route.ts`
- Member private notes moved to:
  - `src/app/api/workspace/member-private-notes/route.ts`
- Firestore rules deny client writes to business collections.

### Storage Rules

- `storage.rules` has product image namespace:
  - `product-images/{productId}/{imageId}`
- Public read allowed.
- Owner-only writes allowed.
- Accepted file types:
  - JPEG
  - PNG
  - WebP
- Max file size: 5 MB.
- All other paths denied.
- Rules tests exist:
  - `tests/firebase/storage-deny.test.ts`

### Resend / Notifications

- `notificationEvents` now support:
  - `pending | sent | failed`
  - `provider: resend`
  - `recipientEmail`
  - `attemptCount`
  - `lastAttemptAt`
  - `providerMessageId`
  - sanitized `lastError`
- Delivery layer exists:
  - `src/lib/notification/resend.ts`
- Owner retry API exists:
  - `src/app/api/workspace/notifications/[id]/retry/route.ts`
- Payment workspace lists notification events and lets owner retry non-sent events.
- Email failure does not roll back order/payment transactions.
- Real Resend sending is still externally gated by DNS/API key.

### Auth Emulator / Playwright

- E2E auth helper route exists:
  - `src/app/e2e-auth/page.tsx`
  - `src/app/e2e-auth/E2EAuthForm.tsx`
- Guarded by `NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH=true`.
- Playwright global setup seeds:
  - owner user with custom claim
  - member user with custom claim
  - member profile docs
  - public product projection for checkout flow tests
- Script:
  - `scripts/run-playwright-emulated.mjs`
- NPM script:
  - `npm run test:e2e:emulated`

## Current Remaining Gaps

These are not locally complete:

1. Product image upload UI/API
   - blocked by Firebase Blaze / actual Storage bucket creation.
   - Storage rules are already implemented and tested.

2. Product API Storage metadata validation
   - requires real Storage object metadata from bucket/emulator upload flow.

3. Formal production product re-save/sync
   - needs Firebase production access.
   - local `productsInternal → productsPublic` projection logic is implemented.

4. Production Firestore/Storage rules deploy
   - needs Firebase CLI login and production project access.

5. Resend production sending
   - needs `updates.asteratw.com` DNS verification.
   - needs production `RESEND_API_KEY`.
   - after setup, send real test email and verify `sent/providerMessageId`.

6. Vercel OIDC / production acceptance
   - needs external Vercel/GCP setup.
   - then run production desktop, Pixel 7, and real phone acceptance.

## 2026-07-29 Manual Acceptance Fixes

- Product creation no longer crashes when optional classifications are unselected.
- ProductWorkspace defaults new products to `published` and new Variant original currency to `THB`.
- Authenticated storefront/cart startup merges local and cloud cart lines instead of letting an empty cloud cart erase a newly added item.
- Checkout displays the current Astera terms/privacy and supplement-payment rules and sends the current legal version IDs.
- Manual emulator data can be seeded with `npm run firebase:emulators:seed`.
- Regression coverage was added in:
  - `tests/unit/productCatalog.test.ts`
  - `tests/unit/workspaceDefaults.test.ts`
  - `tests/unit/clientCart.test.ts`
  - `tests/unit/legalDocuments.test.ts`

## Approved ProductWorkspace Decisions Pending Implementation

- Normal Product ID/Product SKU/Variant SKU fields remain read-only and server-managed.
- Add copy buttons; never add a normal unlock/edit action.
- Any future Product ID correction requires a separate owner-only relationship-aware migration tool.
- Preserve `AST-P000001` and `AST-P000001-V001`.
- Never reuse archived Variant sequences; allocate after the highest historical number.
- Show ProductWorkspace technical labels as `English（中文）` without changing stored English values.
- Confirmed display values:
  - `Draft（草稿）`, `Published（已刊登）`, `Archived（已封存）`
  - `Upcoming（即將開始）`, `Open（開放中）`, `Closed（已結束）`, `Archived（已封存）`
  - `Active（啟用）`, `Archived（已封存）`
- Add the exact Internal Note helper text recorded in `docs/12_DecisionLog.md`.
- Split ProductWorkspace into `Products（商品管理）` and `Classifications（分類管理）` tabs.
- Add `管理分類` shortcuts next to Product classification selectors.
- Classification IDs become server-generated; display names can be edited and records can be archived, never hard-deleted.
- Currency labels are bilingual for THB/TWD/JPY/KRW/USD; THB remains the new-Variant default.
- Do not assume approval for Variant Name suggested/custom input; that decision is still open.

## Important Validation Results

Latest known passing checks:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run test:unit`
  - 12 files / 64 tests
- `npm.cmd run firebase:rules:test`
  - 2 files / 29 tests
- `npm.cmd run build`
- `npm.cmd run test:e2e`
  - 8 passed / 6 emulator-only skips
- `npm.cmd run test:e2e:emulated`
  - 11 passed / 3 skips

Latest full verification: 2026-07-29 Asia/Taipei.

Managed sandbox note:

- Firebase Emulator needs Java child process execution.
- Playwright and Vitest can hit `spawn EPERM` inside the managed sandbox.
- Use approved unsandboxed execution for:
  - `npm.cmd run firebase:rules:test`
  - `npm.cmd run test:e2e`
  - `npm.cmd run test:e2e:emulated`
  - sometimes `npm.cmd run test:unit` or `npm.cmd run build`

## Recommended Next Step

Execute the consolidated plan:

- Design: `docs/superpowers/specs/2026-07-29-mvp-local-completion-design.md`
- Plan: `docs/superpowers/plans/2026-07-29-mvp-local-completion.md`

Start with Task 1 (CI and production/test isolation), then Tasks 2–3 (production fallback cleanup and transaction boundaries). ProductWorkspace/Classification is Tasks 4–5; images and homepage are Tasks 6–7. Variant Name behavior remains unchanged and does not block the approved work.

If Firebase Blaze / Storage bucket is ready:

1. Build product image upload UI/API.
2. Validate owner upload, public read, max 8 images, cover image, sort order, alt text.
3. Save public image projection to `productsPublic`.
4. Add metadata validation in Product API.
5. Add Playwright coverage.

If external Firebase/Resend/Vercel gates are still not ready:

1. Do not invent external state.
2. Prepare production deployment scripts/checklists only.
3. Keep updating `docs/16_MVPCompletionPlan.md` and `docs/17_ProjectHandoff.md`.

## 2026-07-29 Product Publishing Runtime Follow-up

- Latest manual Preview state: Google sign-in works.
- User asked whether new Product publishing is unavailable.
- Preview logs showed `firebase-admin/auth ERR_REQUIRE_ESM` in shared server runtime paths. This likely blocks owner-only Product APIs before business logic.
- Fix implemented:
  - remove static `firebase-admin/auth` from `src/lib/firebase/admin.ts`;
  - verify server Firebase ID tokens with Firebase Identity Toolkit `accounts:lookup` in `src/lib/firebase/serverAuth.ts`;
  - keep custom claim `role === "owner"` checks;
  - support Auth Emulator via `FIREBASE_AUTH_EMULATOR_HOST`;
  - add regression coverage in `tests/unit/nextRuntimeConfig.test.ts`.
- Validation passed:
  - `npm.cmd run test:unit -- tests/unit/nextRuntimeConfig.test.ts`: 23 files / 109 tests;
  - `npm.cmd run typecheck`;
  - `npm.cmd run lint`;
  - `npm.cmd run build`, 31 routes.
- Next exact verification after push/deploy:
  1. verify Preview `/brand` no longer 500;
  2. sign in as Owner;
  3. create/publish a Product;
  4. confirm public projection appears in storefront.
- If Product publishing still fails after `/brand` is fixed, check Vercel logs for Admin Firestore credential/OIDC errors. That is external environment setup, not ProductWorkspace UI.
