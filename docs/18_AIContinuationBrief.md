# Astera OMS AI Continuation Brief

Last updated: 2026-07-28 Asia/Taipei

This file is the compact handoff for another AI agent. Treat it together with:

- `docs/16_MVPCompletionPlan.md`
- `docs/17_ProjectHandoff.md`
- `AGENTS.md`

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

## Important Validation Results

Latest known passing checks:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run test:unit`
  - 9 files / 57 tests
- `npm.cmd run firebase:rules:test`
  - 2 files / 29 tests
- `npm.cmd run build`
- `npm.cmd run test:e2e`
  - 8 passed / 6 emulator-only skips
- `npm.cmd run test:e2e:emulated`
  - 11 passed / 3 skips

Managed sandbox note:

- Firebase Emulator needs Java child process execution.
- Playwright and Vitest can hit `spawn EPERM` inside the managed sandbox.
- Use approved unsandboxed execution for:
  - `npm.cmd run firebase:rules:test`
  - `npm.cmd run test:e2e`
  - `npm.cmd run test:e2e:emulated`
  - sometimes `npm.cmd run test:unit` or `npm.cmd run build`

## Recommended Next Step

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

