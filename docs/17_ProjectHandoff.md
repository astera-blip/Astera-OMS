# Astera OMS Project Handoff

Last updated: 2026-08-10 Asia/Taipei

## Active Objective

Complete the Production security release gates without redesigning the existing
Astera OMS MVP architecture. Task 7 currently stops before Production deployment.

Current execution plan:

- Active plan:
  `docs/superpowers/plans/2026-08-09-production-security-worker-implementation.md`
  (Task 7).
- Legacy MVP plans remain historical context; do not restart already completed
  Tasks 1–6.

## Repository State

- Working branch: `codex/production-security-worker` in isolated worktree
  `.worktrees/production-security-worker`.
- Preserve all unrelated changes in the primary workspace; Task 7 has no push
  authorization.
- Existing product authority remains `productsInternal`; public storefront reads only `productsPublic`.
- Complete continuation entrypoint for another AI: `docs/20_CompleteAIHandoff_2026-07-30.md`.

## Decisions Confirmed

- Product collection: preserve current `productsInternal` authority.
- Refund after paid cancellation: manual bank refund with audit and negative adjustment, no Wallet/Finance module.
- Firebase Admin on Vercel: use OIDC/GCP Workload Identity, no long-lived private key.
- Domain: `asteratw.com`; Resend sender domain: `updates.asteratw.com`.
- Storage region: `asia-east1`.
- Product ID, Product SKU, and Variant SKU remain server-assigned and read-only; normal UI adds copy controls only.
- SKU sequences are immutable and never reused after archive.
- ProductWorkspace uses bilingual UI labels while preserving existing English API/Firestore values.
- Classification management moves to its own ProductWorkspace tab with server-generated IDs, rename, and archive-only lifecycle.
- New Variant currency remains THB by default with bilingual THB/TWD/JPY/KRW/USD options.

## Approved ProductWorkspace Changes Pending Implementation

- Add `Products（商品管理）` and `Classifications（分類管理）` tabs.
- Add Product ID and SKU copy buttons; do not add direct identifier editing.
- Add the confirmed Internal Note privacy/purpose help text.
- Translate Product publish, Campaign, and classification status options into bilingual labels.
- Add `管理分類` shortcuts beside Product classification selectors.
- Move classification creation/edit/archive into the classification tab.
- Generate classification IDs on the protected Server API.
- Preserve classification history through archive rather than hard delete.
- Display supported currencies as bilingual labels while retaining THB as the default.
- Keep future Product ID migration as a separate owner-only tool, outside the normal editor.
- Variant Name suggested/custom input behavior remains under discussion and is not approved yet.

## Validation Log

- 2026-07-29: Manual acceptance fixes prepared for product creation, product visibility defaults, THB Variant defaults, authenticated cart startup, and checkout consent content.
- 2026-07-29: Product classification normalization now ignores unselected optional classification entries instead of reading `id` from `undefined`.
- 2026-07-29: New products default to `published`; new Variant original currency defaults to `THB`.
- 2026-07-29: Storefront and cart startup merge local and cloud cart lines, preventing an empty cloud response from clearing a newly added local line.
- 2026-07-29: Checkout displays the current terms/privacy text and supplement-payment rules and submits the current legal version IDs.
- 2026-07-29: Added repeatable Firebase Emulator manual-test seeding through `npm run firebase:emulators:seed`.
- 2026-07-29: Post-fix validation passed: secret scan, typecheck, lint, 64 unit tests, 29 Firestore/Storage Rules tests, production dependency audit, production build, 8 regular Playwright tests, and 11 authenticated emulator Playwright tests.

- 2026-07-27: Branch `codex/mvp-completion` created.
- 2026-07-27: Sites skill checked. No `.openai/hosting.json`; project stays on existing Vercel/Firebase stack.
- 2026-07-27: Next.js 16 route handler, auth, and mutation docs reviewed before API-related edits.
- 2026-07-27: Product/public catalog partial batch complete. Public projection omits SKU, campaign status uses `upcoming | open | closed | archived`, campaign `salePriceTwd` overrides default variant price in public/cart calculations, and mixed sale type cart validation no longer rejects.
- 2026-07-27: Server brand content repository now uses Firebase Admin SDK directly and reads `siteSettings/site-default`.
- 2026-07-27: Checkout consent partial batch complete. UI and API require legal/privacy consent plus supplement-rule consent; `ConsentRecord` stores `acceptedSupplementRule`.
- 2026-07-27: Validation passed: typecheck, lint, unit tests, Firestore rules tests, production build.
- 2026-07-27: Product owner APIs added. `ProductWorkspace` product/classification writes now go through owner-only Admin SDK APIs. SKU and product IDs are read-only in UI, and new product SKU allocation uses `siteSettings/system-sequences` in a transaction.
- 2026-07-27: Firestore rules tightened for product business collections. Client SDK writes to product projection, private product master, variants, campaigns, and catalog classifications are denied. Public storefront still reads `productsPublic`; direct public reads of `productVariants` and `saleCampaigns` are denied.
- 2026-07-27: Checkout split implemented. `/api/checkout` groups by Campaign, creates multiple Orders/PaymentRequests/ConsentRecords, assigns `checkoutGroupId`, and generates `AST-YYYYMMDD-0001` order numbers.
- 2026-07-27: Payment report partial flow implemented. Members create `pendingReview` payment reports via `/api/payments`; owner confirmation now confirms Payment ID through `/api/workspace/payments/[id]/confirm`.
- 2026-07-27: Validation passed after these changes: typecheck, lint, unit tests, Firestore rules tests, production build.
- 2026-07-27: Payment reversal implemented locally. `/api/workspace/payments/[id]/reverse` marks confirmed payments reversed, appends negative adjustment allocation, reopens payment requests, resets active order items, and writes audit logs.
- 2026-07-27: Cancellation flow rewritten locally. Unpaid items cancel directly and recalculate order/payment request totals. Paid items create cancellation requests; owner approval requires manual refund metadata and writes negative adjustment/audit records.
- 2026-07-27: Validation passed after payment/cancellation changes: typecheck, lint, unit tests, Firestore rules tests, production build.
- 2026-07-27: Member profile and cart writes moved behind protected Admin SDK APIs. Client SDK writes to `members` and `carts` are denied by rules; member self reads remain allowed.
- 2026-07-27: Workspace content and member private-note writes moved behind owner-only Admin SDK APIs. Client SDK writes to `siteSettings`, `socialLinks`, `faqs`, `announcements`, and `memberPrivateNotes` are denied by rules; public content reads and owner note reads remain allowed.
- 2026-07-27: Validation passed after trust-boundary changes: typecheck, lint, unit tests, Firestore rules tests, production build.
- 2026-07-27: Firestore rules hardened for remaining business collections. Client SDK writes to `orders`, `orderItems`, `paymentRequests`, `payments`, `paymentAllocations`, `auditLogs`, `notificationEvents`, `legalDocumentVersions`, `consentRecords`, and `cancellationRequests` are denied. Reads remain member/owner/public scoped according to collection.
- 2026-07-27: Validation passed after business rules hardening: typecheck, lint, unit tests, Firestore rules tests, production build.
- 2026-07-27: ProductWorkspace now supports multiple Variants and multiple Campaigns per product. Variant SKU remains read-only/server-assigned. Campaign UI supports `salePriceTwd` and archive status.
- 2026-07-27: Overpayment operations UI added. Owner payment board shows `unallocatedAmountTwd` totals and rows for manual bank refund handling. Payment confirmation now persists unallocated overpayment to `paymentRequests`.
- 2026-07-27: Owner payment reversal UI added for confirmed payments, using `/api/workspace/payments/[id]/reverse`.
- 2026-07-27: Storage product image namespace rules added and tested. `product-images/{productId}/{imageId}` allows public read and owner-only JPEG/PNG/WebP uploads up to 5 MB; all other Storage paths are denied.
- 2026-07-27: Validation passed after Product UI / payment / Storage changes: typecheck, lint, unit tests, Firestore+Storage rules tests, production build, and Playwright smoke tests.
- 2026-07-27: Auth emulator Playwright harness added. `npm run test:e2e:emulated` starts Auth/Firestore/Storage emulators, seeds owner/member users with custom claims and member profiles, enables E2E-only email/password sign-in, and runs Playwright.
- 2026-07-27: Emulated Playwright now verifies owner access to ProductWorkspace multi Variant/Campaign UI and member denial from workspace.
- 2026-07-27: Firebase Admin initialization now supports emulator project ID without service account credentials. Local build uses an Admin content fallback unless Firestore emulator, service account credentials, or actual Vercel OIDC runtime is available.
- 2026-07-27: Validation passed after Auth emulator harness: typecheck, lint, unit tests, Firestore+Storage rules tests, production build, regular Playwright, and emulated Playwright.
- 2026-07-27: Authenticated checkout/payment/cancellation Playwright coverage added. The emulator suite now signs in real Auth emulator owner/member users and verifies checkout split by Campaign, order number shape, payment report pending review, owner payment confirmation, overpayment `unallocatedAmountTwd`, payment reversal, unpaid direct cancellation, paid cancellation request, and owner refund approval.
- 2026-07-27: Playwright global setup now seeds an emulator-only public product projection plus matching `productVariants` SKU data for checkout authority tests.
- 2026-07-27: `scripts/run-firebase.mjs` now normalizes the Windows Java/PATH environment for Firebase Emulator startup. In the managed sandbox, Java child execution still requires approved unsandboxed execution.
- 2026-07-27: Validation passed after authenticated Playwright flow: typecheck, lint, unit tests, Firestore+Storage rules tests, production build, and emulated Playwright.
- 2026-07-27: Formal consumer copy batch completed locally. Homepage, fallback brand content, legal terms/privacy, About, Payments, Members, account profile, and order cancellation copy no longer expose internal MVP/custom-claim/Firestore/Email-record-mode wording.
- 2026-07-27: Homepage public quick links now point to products, brand, profile, orders, and payments instead of exposing Owner workspace.
- 2026-07-27: Validation passed after formal copy batch: typecheck, lint, production build, regular Playwright, and unit tests. Build/Playwright/Vitest required approved unsandboxed execution when the managed sandbox returned `spawn EPERM`.
- 2026-07-27: Local Resend notification event schema/retry batch completed. `notificationEvents` now track `pending | sent | failed`, Resend provider, recipient email, attempt count, provider message ID, and sanitized error.
- 2026-07-27: Checkout and payment confirmation create pending notification events only after business transaction work is prepared; email delivery failure does not roll back orders or payments.
- 2026-07-27: Added owner-only `POST /api/workspace/notifications/[id]/retry`; Payment workspace lists notification events and lets owner retry non-sent events.
- 2026-07-27: Resend env placeholders added to `.env.example`. Real DNS verification, production `RESEND_API_KEY`, and actual send test remain external gates.
- 2026-07-27: Validation passed after Resend local batch: typecheck, lint, unit tests, Firestore+Storage rules tests, production build, regular Playwright, and emulated Playwright.
- 2026-07-27: SKU auto-assignment hardened. Server product save now ignores submitted Product/Variant SKU values, preserves existing Product SKU from `productsInternal`, preserves existing Variant SKU by variant document ID, and assigns new Variant SKU after the highest existing sequence.
- 2026-07-27: Validation passed after SKU hardening: typecheck, lint, unit tests, production build, and emulated Playwright.
- 2026-07-28: Added compact AI continuation brief at `docs/18_AIContinuationBrief.md` for handoff to another AI agent.
- 2026-07-28: Updated ESLint global ignores to exclude `.worktrees/**`, preventing unrelated local worktree files from producing lint warnings.
- 2026-07-28: Full push-readiness validation passed: secret scan, typecheck, lint, unit tests, Firestore+Storage rules tests, production build, regular Playwright, and emulated Playwright.

## Changed Files So Far

- `docs/16_MVPCompletionPlan.md`
- `docs/17_ProjectHandoff.md`
- `docs/18_AIContinuationBrief.md`
- `firestore.rules`
- `eslint.config.mjs`
- `package.json`
- `playwright.config.ts`
- `scripts/run-firebase.mjs`
- `scripts/run-playwright-emulated.mjs`
- `storage.rules`
- `.env.example`
- `src/app/account/profile/page.tsx`
- `src/app/about/page.tsx`
- `src/app/e2e-auth/E2EAuthForm.tsx`
- `src/app/e2e-auth/page.tsx`
- `src/app/members/page.tsx`
- `src/app/page.tsx`
- `src/app/payments/page.tsx`
- `src/app/api/cart/route.ts`
- `src/app/api/checkout/route.ts`
- `src/app/api/member/profile/route.ts`
- `src/app/api/payments/route.ts`
- `src/app/api/workspace/classifications/route.ts`
- `src/app/api/workspace/cancellations/[id]/review/route.ts`
- `src/app/api/workspace/content/route.ts`
- `src/app/api/workspace/member-private-notes/route.ts`
- `src/app/api/workspace/notifications/[id]/retry/route.ts`
- `src/app/api/workspace/payments/[id]/confirm/route.ts`
- `src/app/api/workspace/payments/[id]/reverse/route.ts`
- `src/app/api/workspace/products/route.ts`
- `src/components/storefront/CartBoard.tsx`
- `src/components/storefront/OrderDetailBoard.tsx`
- `src/components/storefront/PaymentRequestsBoard.tsx`
- `src/components/storefront/PublicProductDetailBoard.tsx`
- `src/components/storefront/PublicProductsBoard.tsx`
- `src/components/workspace/PaymentOperationsBoard.tsx`
- `src/components/workspace/ContentOperationsBoard.tsx`
- `src/components/workspace/MemberOperationsBoard.tsx`
- `src/components/workspace/OrderOperationsBoard.tsx`
- `src/components/workspace/ProductWorkspace.tsx`
- `src/domain/product.ts`
- `src/lib/catalog/publicCatalog.ts`
- `src/lib/content/serverRepository.ts`
- `src/lib/content/brandContent.ts`
- `src/lib/legal/documents.ts`
- `src/lib/notification/events.ts`
- `src/lib/notification/resend.ts`
- `src/lib/order/cancellation.ts`
- `src/lib/order/checkout.ts`
- `src/lib/product/catalog.ts`
- `src/lib/product/repository.ts`
- `src/lib/product/serverCatalog.ts`
- `src/lib/payment/manualBankTransfer.ts`
- `src/lib/payment/repository.ts`
- `tests/firebase/firestore-deny.test.ts`
- `tests/firebase/storage-deny.test.ts`
- `tests/e2e/global-setup.ts`
- `tests/e2e/member-payment-cancellation-flow.spec.ts`
- `tests/e2e/workspace-product-ui.spec.ts`
- `tests/unit/checkoutFlow.test.ts`
- `tests/unit/cancellationFlow.test.ts`
- `tests/unit/paymentFlow.test.ts`
- `tests/unit/notificationEvents.test.ts`
- `tests/unit/resendNotificationDelivery.test.ts`
- `tests/unit/productCatalog.test.ts`

## Known Remaining Gaps

- Actual product image upload UI/API is still pending; Storage bucket creation requires external Firebase Blaze/bucket access.
- Product API still needs real Storage metadata validation once upload flow/bucket is available.
- Formal production product re-save/sync still needs Firebase production access; local `productsInternal → productsPublic` projection logic is implemented.
- Resend DNS verification, production API key setup, and real send test remain pending external gates.
- Production rules deploy and production/mobile acceptance remain pending.
- Production rules have not been deployed; Firebase CLI login and production access are still external gates.

## Next Exact Step

Implement actual product image upload UI/API after Firebase Blaze bucket creation is available. If external bucket access is still unavailable, the remaining work is mostly external-gated: production rules deploy, Resend DNS/API-key real send test, Vercel OIDC, and production/mobile acceptance.

## 2026-07-29 06:49 Continuation Record

- Branch: `codex/mvp-completion`.
- Completed commits through Task 10:
  - `e63c543 feat: harden member risk operations`
  - `8752919 feat: publish legal information pages`
  - `e62cffc feat: deliver transactional email notifications`
- Task 11 uncommitted files:
  - `src/components/workspace/WorkspaceShell.tsx`
  - `src/components/workspace/PaymentOperationsBoard.tsx`
  - `src/components/workspace/ContentOperationsBoard.tsx`
  - `src/app/orders/page.tsx`
  - `tests/e2e/workspace-mobile-acceptance.spec.ts`
- Task 11 current validation: `npm.cmd run typecheck` passed; `npm.cmd run lint` passed. Playwright, Unit, Rules, and build are not yet rerun for this uncommitted batch.
- Preserve the user-owned uncommitted `AGENTS.md`; do not stage it.
- External gates after local Tasks 11–13: Firebase Blaze/production bucket, production Firebase/Vercel OIDC access, Resend DNS/API key and real inbox test, legal professional review, and physical-device acceptance.

## 2026-07-29 07:14 UI/UX Priority Remediation

- Applied `ui-ux-pro-max` high-priority rules:
  - global `:focus-visible` and reduced-motion fallback in `src/app/globals.css`;
  - skip link plus route-change focus target through `src/components/accessibility/RouteFocusManager.tsx`;
  - root mobile viewport container changed to `min-h-dvh`;
  - Checkout now prevents duplicate submission, displays `建立中…`, and announces status through `aria-live`;
  - Product Variant/Campaign add buttons and Product image reorder/unreference controls now meet the 44px minimum target;
  - Product image operation messages now use `aria-live`.
- Added `tests/unit/uiAccessibility.test.ts`; RED was observed before implementation, then 3/3 passed.
- Fresh `npm.cmd run typecheck` and `npm.cmd run lint` passed.
- Still required before committing Task 11:
  1. extend async submit locks and live regions to Product save, Payment confirm/reverse, Cancellation review, Classification, and Content;
  2. add skeleton/progress states, consumer-only empty/error copy, retry actions, and remaining `min-h-dvh` conversions;
  3. run the new Pixel 7 overflow suite plus full regular/emulated Playwright, Unit, Rules, and build;
  4. fix findings and commit `fix: complete desktop and mobile acceptance`.

## 2026-07-29 07:17 Task 12/13 Start

- Task 12 context and current deployment/test documents were inspected.
- Added `.local-backups/` to `.gitignore` so future production backups cannot be committed accidentally.
- No Task 12 script is being marked complete: `check-production-env.mjs`, `audit-product-projection.mjs`, `smoke-production.mjs`, their Unit tests, and backup/sync SOP remain to be implemented.
- Task 13 has not started because Task 11 and Task 12 are not yet verified or committed.
- Exact continuation order:
  1. finish and verify Task 11;
  2. write failing `tests/unit/productionScripts.test.ts`;
  3. implement the three read-only production scripts and package commands;
  4. update Deployment/Test Plan/SOP;
  5. run the full Task 13 command matrix, fix failures, update final handoff, commit, and push.

## 2026-07-29 07:21 Task 11 Verification Update

- Fresh checks after the UI/UX accessibility batch:
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed.
  - `npm.cmd run test:unit`: passed, 21 files / 96 tests.
  - `npm.cmd run build`: compilation passed and TypeScript phase started, but the command result was not fully captured before the execution window ended; rerun before claiming build success.
- Rules and Playwright suites still need fresh execution for Task 11.
- Task 12 scripts/tests/SOP and Task 13 final verification/commit/push remain pending.

## 2026-07-29 07:49 Final Task 11–13 Handoff

### Completed

- Task 11 UI/accessibility/mobile acceptance committed as `9c9104f`.
- Task 12 read-only production tooling and SOP committed as `ae32900`.
- Final readiness review fixes committed as `e84047f`.
- Task 13 full local validation completed. Final documentation commit and remote
  push are the only repository operations following this entry.

### Production tools

```powershell
npm run production:env:check
npm run production:products:audit -- --project astera-oms-prod --confirm-project astera-oms-prod
npm run production:smoke -- --base-url https://astera-oms.vercel.app
```

Related files:

- `scripts/check-production-env.mjs`
- `scripts/audit-product-projection.mjs`
- `scripts/smoke-production.mjs`
- `tests/unit/productionScripts.test.ts`
- `docs/SOP/正式資料備份與商品同步SOP.md`

All three commands are read-only. The product audit uses ADC/OIDC and contains no
Firestore mutation calls. It requires an exact repeated Project ID.

### Final verification evidence

- `npm run check:secrets`: passed.
- `npm run audit:production`: passed, 0 vulnerabilities.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 22 files, 104 passed.
- `npm run firebase:rules:test`: 2 files, 29 passed.
- `npm run build`: passed, 31 routes.
- `npm run test:e2e`: 10 passed, 18 intentional emulator-only skips.
- `npm run test:e2e:emulated`: 25 passed, 3 intentional mode skips.

### External-only next step

The next agent must first obtain Owner confirmation/access for Firebase Blaze and
Storage bucket, Vercel OIDC/GCP identity, Firebase production deployment, Resend
DNS/API key, and domain/legal/real-device acceptance. Follow
`docs/SOP/正式資料備份與商品同步SOP.md`; do not invent external state or introduce a
long-lived service-account key.

The pre-existing user change in `AGENTS.md` remains intentionally uncommitted and
must not be staged.

Final code review findings were resolved before handoff: nested public records are
checked for private fields, production smoke fails without a discoverable public
Product detail, and Pixel 7 acceptance explicitly opens Classification management.

## 2026-07-29 Storefront Manual-Test Follow-up

- Confirmed production `/brand` currently returns 500 because production is still on an older deployment with `firebase-admin/auth ERR_REQUIRE_ESM`.
- Pushed the runtime fix to `codex/mvp-completion` as commit `f82b032`: `next.config.ts` now explicitly sets `serverExternalPackages: ["firebase-admin"]`.
- Completed the buyer-facing UI fixes requested after manual testing:
  - Product list loading and empty states are separated.
  - Empty cart disables `建立訂單` and displays `請先加入商品`.
  - Cart checkout fields have stable `id`/`name` plus relevant autocomplete attributes.
  - Storefront visible English labels and low-trust `尚未設定` fallbacks were replaced with consumer-facing Chinese copy.
- Validation for the follow-up batch:
  - `npm.cmd run test:unit -- tests/unit/uiAccessibility.test.ts tests/unit/productionDataSource.test.ts`: passed, 23 files / 107 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed.
  - `npm.cmd run build`: passed, 31 routes.
- Remaining action: production must be redeployed from `codex/mvp-completion` or after merging it to `main`; otherwise `https://astera-oms.vercel.app` will continue serving the older `/brand` 500 deployment.

## 2026-07-29 Google Sign-in Follow-up

- Screenshot showed Google sign-in returning the generic front-end error: `Google 登入未完成，請再試一次。`
- Investigation: latest Preview logs only showed page GETs and the known `/brand` server runtime issue, not a member profile API write failure from this click. The sign-in path was popup-only.
- Implemented redirect fallback in `src/components/auth/AuthProvider.tsx`:
  - `getRedirectResult` is handled during auth subscription startup.
  - popup blocked/closed/cancelled/unsupported cases call `signInWithRedirect`.
  - Firebase Auth codes now produce actionable Traditional Chinese messages, including unauthorized-domain guidance.
- Validation:
  - `npm.cmd run test:unit -- tests/unit/uiAccessibility.test.ts`: passed, 23 files / 108 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed.
  - `npm.cmd run build`: passed, 31 routes.
- If the next deployment still shows an unauthorized-domain message, add the exact tested Vercel host or canonical domain to Firebase Authentication authorized domains.

## 2026-07-29 Product Publishing Runtime Follow-up

- User confirmed Preview Google sign-in works, then asked whether the site cannot publish new Products.
- Investigation found the likely blocker is server runtime, not ProductWorkspace UI:
  - latest Preview logs still showed `firebase-admin/auth ERR_REQUIRE_ESM`;
  - the failure occurred while loading shared server modules, before route business logic;
  - affected examples included `/brand`, `/api/cart`, and Product detail routes, and owner-only Product APIs import the same auth boundary.
- Code changes:
  - `src/lib/firebase/admin.ts`: removed static `firebase-admin/auth` import and removed `getAdminAuth()`.
  - `src/lib/firebase/serverAuth.ts`: replaced Admin Auth token verification with Firebase Identity Toolkit `accounts:lookup`, including Auth Emulator support through `FIREBASE_AUTH_EMULATOR_HOST`.
  - `tests/unit/nextRuntimeConfig.test.ts`: added a regression test that fails if `firebase-admin/auth` is reintroduced into shared server Admin/Auth code.
  - `docs/11_Changelog.md` and `docs/16_MVPCompletionPlan.md`: updated runtime-fix and next-step records.
- Verification:
  - `npm.cmd run test:unit -- tests/unit/nextRuntimeConfig.test.ts`: red before fix, green after fix; current result 23 files / 109 tests passed.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed.
  - `npm.cmd run build`: passed, 31 routes.

### Next exact handoff step

Commit and push the runtime fix. After Vercel Preview redeploys, verify `/brand` first. If `/brand` is fixed but Product publishing still fails, inspect Vercel function logs for Admin Firestore credential errors. That would indicate the remaining blocker is external Vercel OIDC / GCP Workload Identity or approved production Firebase credential setup, not a ProductWorkspace form bug.

## 2026-07-29 Storefront/Profile UI Follow-up

- User requested four UI/behavior updates:
  - swap the homepage header placement of `泰國 GL / 藝人周邊代購` and `ASTERA OMS`;
  - split member profile name entry into `姓` and `名`;
  - redirect to `/` after successful member profile save;
  - remove `Instagram：暫不提供` from public UI.
- Code changes:
  - `src/app/page.tsx`: small eyebrow now shows the buyer-facing category; main heading now shows `ASTERA OMS`.
  - `src/app/account/profile/page.tsx`: added separate last-name and first-name fields with `family-name` / `given-name` autocomplete; submission still combines them into existing `displayName`, so Firestore/API schema is unchanged.
  - `src/app/account/profile/page.tsx`: successful save calls `router.replace("/")` after `refreshProfile()`.
  - `src/components/storefront/StorefrontFooter.tsx`: footer now renders only active social channels with URLs; disabled placeholders are not shown.
  - `tests/unit/uiAccessibility.test.ts`: added regression coverage for these UI behaviors.
- Follow-up correction:
  - removed `/ Aatera` from the homepage title entirely;
  - `src/app/account/profile/page.tsx` now omits blank `birthday` from the save payload;
  - `src/app/api/member/profile/route.ts` maps missing Admin Firestore credentials to `admin_credentials_not_configured`;
  - Vercel logs confirmed Preview profile save is failing at Admin Firestore credential loading with `Could not load the default credentials`, not because of blank birthday.
- Verification:
  - `npm.cmd run test:unit -- tests/unit/uiAccessibility.test.ts`: red before fix, green after fix; current result 23 files / 112 tests passed.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed.
  - `npm.cmd run build`: passed, 31 routes.

## 2026-07-29 Vercel OIDC / GCP Workload Identity Preparation

- User confirmed the target is production Firebase project `astera-oms-prod`.
- Local checks:
  - `gcloud` is not available on PATH in this PowerShell session.
  - `winget install Google.CloudSDK` was attempted and reached the installer/UAC stage, but did not return a completion result inside this Codex session.
  - Firebase CLI can list projects; `astera-oms-prod` project number is `1032606875618`.
  - `.vercel/project.json` shows Vercel project ID `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`.
  - Vercel env currently lacks GCP/OIDC variables.
- Implemented code-side OIDC support:
  - added dependencies `@vercel/oidc` and `google-auth-library`;
  - `src/lib/firebase/admin.ts` creates a Firebase Admin `Credential` from Vercel OIDC + Google Workload Identity when `GCP_PROJECT_NUMBER`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER_ID`, and `GCP_SERVICE_ACCOUNT_EMAIL` are configured;
  - service-account JSON remains supported only through `GOOGLE_APPLICATION_CREDENTIALS` for approved local ADC-style work; no key is introduced for Vercel.
- Added operational support:
  - `scripts/setup-vercel-gcp-oidc.ps1` contains the exact `gcloud` commands to create/enable APIs, service account, Workload Identity Pool/Provider, IAM bindings, and output Vercel env values;
  - `scripts/check-production-env.mjs` now reports OIDC env names without exposing values;
  - `docs/14_Deployment.md` documents the env names, project number, Vercel project ID, and next verification flow.
- Verification:
  - `npm.cmd run test:unit -- tests/unit/nextRuntimeConfig.test.ts tests/unit/productionScripts.test.ts`: passed, 23 files / 114 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed.
  - `npm.cmd run build`: passed, 31 routes.

### Remaining blocker

The actual GCP IAM resources are not yet confirmed created because `gcloud` is not
available on PATH. Next operator must either install/expose Google Cloud SDK or
run the documented commands in Google Cloud Shell. After IAM and Vercel env vars
are set, redeploy `codex/mvp-completion` and verify:

1. member profile save succeeds;
2. authenticated `/api/cart` read/write succeeds;
3. Owner Product save succeeds and writes `productsPublic`.

## 2026-07-29 GCloud Login Attempt

- User approved direct computer assistance for Vercel OIDC / GCP Workload Identity.
- Google Cloud SDK was found at:
  `C:\Users\ting1\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`.
- `gcloud --version` passed: Google Cloud SDK `578.0.0`.
- No active gcloud account was found.
- Started `gcloud auth login`; it opened Chrome to the Google OAuth consent flow.
- Current blocker: `gcloud auth login` is still waiting for the browser OAuth callback. The user must complete Google account selection, 2FA if prompted, and consent approval. Codex must not enter passwords or verification codes.
- Exact next step after the OAuth callback completes:

```powershell
& "C:\Users\ting1\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" config set project astera-oms-prod
.\scripts\setup-vercel-gcp-oidc.ps1 `
  -ProjectId "astera-oms-prod" `
  -ProjectNumber "1032606875618" `
  -VercelProjectId "prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ"
```

- Then add the printed `GCP_*` and `GOOGLE_CLOUD_PROJECT` values to Vercel
  Production and Preview, redeploy, and test member profile save, cart API, and
  Owner Product save.

## 2026-07-29 Manual UI/UX Follow-up

### Files changed

- `src/components/storefront/PublicProductsBoard.tsx`
- `src/components/storefront/FeaturedProductsBoard.tsx`
- `src/app/brand/page.tsx`
- `src/components/storefront/StorefrontFooter.tsx`
- `src/app/page.tsx`
- `src/app/products/page.tsx`
- `src/app/products/[id]/page.tsx`
- `src/app/cart/page.tsx`
- `src/app/payments/page.tsx`
- `src/app/orders/page.tsx`
- `src/app/orders/[id]/page.tsx`
- `src/app/members/page.tsx`
- `src/app/about/page.tsx`
- `src/components/storefront/PaymentRequestsBoard.tsx`
- `src/components/storefront/OrderDetailBoard.tsx`
- `tests/e2e/public-smoke.spec.ts`

### Completed behavior

- Product-list and homepage-recommendation failures render an announced error
  with a 44px `重新載入` control; loading, empty, and error states are mutually
  exclusive.
- Brand social cards render only active channels with non-empty URLs. The no-
  channel fallback contains no `暫不提供` or Instagram placeholder.
- Public route headings and visible transaction copy are buyer-facing Traditional
  Chinese. Stored status, identifiers, and API payloads are unchanged.
- Footer legal/navigation links, public product actions, product-detail links,
  catalog filters, and reload controls have `min-h-11` touch targets.
- Touched public route shells use `min-h-dvh`; empty-cart checkout remains
  natively disabled and retains stable form attributes.

### Test sequence and result

1. New public UI regression tests failed as expected because `/brand` displayed
   `目前暫不提供社群入口` and route shells displayed `Storefront`, `Checkout`,
   `Cart`, and `Customer`.
2. After the minimal UI changes, the focused customer-route suite passed:
   **2 passed** (Desktop Chrome and Pixel 7).
3. Focused empty-cart suite passed: **2 passed** (Desktop Chrome and Pixel 7).
4. Full `tests/e2e/public-smoke.spec.ts` recorded `status: passed` with no
   failed tests in `test-results/.last-run.json`.

### Final validation

- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run test:unit`: 24 files / 116 tests passed.
- `npm.cmd run firebase:rules:test`: 2 files / 29 tests passed.
- `npm.cmd run test:e2e -- tests/e2e/public-smoke.spec.ts --reporter=list`:
  passed; `test-results/.last-run.json` reports no failed tests. The two
  Emulator-only recommendation checks remain intentionally skipped in this
  non-Emulator run.
- `npm.cmd run build`: passed; Next.js 16 generated all 31 static/dynamic
  application routes successfully.
- `npm.cmd run test:e2e:emulated`: passed; Auth, Firestore, and Storage
  Emulator run recorded no failed Playwright tests.
- Independent code review after the final changes: no Critical or Important
  issue remains.

### Next exact step

Committed and pushed as `f954e2e` (`fix: polish storefront manual test ux`) to
`origin/codex/mvp-completion`. Vercel Preview may now deploy this commit; manually
check `/`, `/products`, `/brand`, `/cart`, `/payments`, `/orders`, `/members`, and
`/about` after Preview is Ready. Do not stage the existing user modification in
`AGENTS.md`. The preceding GCloud login/OIDC step remains independently pending.

## 2026-07-29 Authenticated Member Board Reliability Follow-up

### Files changed

- `src/components/storefront/PaymentRequestsBoard.tsx`
- `src/components/storefront/OrderHistoryBoard.tsx`
- `src/components/storefront/OrderDetailBoard.tsx`
- `tests/unit/productionDataSource.test.ts`
- `docs/16_MVPCompletionPlan.md`
- `docs/17_ProjectHandoff.md`

### Completed behavior

- Payment requests and order history now provide mutually exclusive loading,
  empty, or announced error states. Error cards include a 44px `重新載入` action.
- Order detail now prioritizes signed-out, loading, and error states before the
  final not-found state; it no longer tells a signed-in member that an order is
  absent while the Firestore read is still in progress.
- Payment-report and cancellation-submit actions become disabled and show
  `送出中…` during their own request. Result messages use `aria-live="polite"`.
- No data model, API contract, order calculation, payment allocation, or
  authorization behavior was changed.

### Test sequence and result

1. Added a focused regression assertion for retryable member-board states.
2. Ran it before implementation: failed as expected because `重新載入` was not
   present in the three boards.
3. After implementation, `npm.cmd run test:unit` passed: **24 files / 117
   tests**.
4. `npm.cmd run typecheck`, `npm.cmd run lint`, and
   `npm.cmd run firebase:rules:test` passed (**2 files / 29 Rules tests**).
5. `npm.cmd run build` compiled successfully and completed its TypeScript stage.
6. Authenticated Emulator Playwright requires a rerun: an isolated 3100 Next
   server and Auth/Firestore/Storage emulators were confirmed reachable, but
   the managed execution layer did not return the Playwright final result and
   left child processes active. Only the newly created test PIDs were stopped;
   no production service or user source file was removed.

### Next exact step

In a persistent terminal, run `npm.cmd run test:e2e:emulated`, wait for
`test-results/.last-run.json`, and confirm no failed tests. Then stage only the
six files listed above (never `AGENTS.md`), commit, push
`codex/mvp-completion`, and wait for the Vercel Preview deployment. The following
MVP work is external-gated: Firebase Blaze/Storage bucket, GCP Workload Identity
and Vercel env variables, production Rules/data migration, Resend DNS/API key,
legal review, domain/DNS, and physical-device acceptance.

## 2026-07-29 Vercel OIDC / GCP Workload Identity Execution Attempt

### Evidence

- Google Cloud interactive login completed for `astera.0920@gmail.com`.
- Ran `scripts/setup-vercel-gcp-oidc.ps1` against `astera-oms-prod` with
  Project Number `1032606875618` and Vercel Project ID
  `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`.
- The script correctly calculated the expected pool/provider/service-account
  names, then stopped at GCP IAM:
  - `gcloud services enable`: permission denied.
  - `gcloud iam service-accounts describe`: project/service-account access
    denied/not found because the caller has no project access.
- No Workload Identity Pool, provider, service account, IAM binding, Vercel
  environment variable, private key, Rules change, or production data change was
  created by this attempt.
- A later Console screenshot listed the same email as Owner, but refreshing the
  local Google access token and retrying `gcloud projects describe` still
  returned `PERMISSION_DENIED`. Verify the selected Console Project ID is
  `astera-oms-prod`, the policy update was saved, and propagation is complete
  before resuming; the yellow basic-role warning does not prove API access.

### Blocking authority and resume steps

`astera.0920@gmail.com` needs project access from an existing
`astera-oms-prod` Owner/IAM administrator. The simplest temporary grant is
`roles/owner`; otherwise grant Service Usage Admin, Service Account Admin,
Project IAM Admin, and Workload Identity Pool Admin for this one-time setup.
After it propagates:

1. Re-run `scripts/setup-vercel-gcp-oidc.ps1` with the same Project Number and
   Vercel Project ID.
2. Add its printed `GOOGLE_CLOUD_PROJECT` and `GCP_*` variables to both Vercel
   Preview and Production.
3. Redeploy Preview and test profile save, cart API, and Owner Product save.
4. Only after Preview succeeds, repeat the verification on Production.

### 2026-07-30 Console/CLI account mismatch follow-up

- The user-provided IAM Console page confirmed the selected project URL is
  `astera-oms-prod`; its browser account is `ting1811tin@gmail.com`, which has
  an explicit Owner role. The same page also lists `astera.0920@gmail.com` as
  Owner, but GCP API calls for that account remain denied.
- A `gcloud auth login ting1811tin@gmail.com` attempt opened the Google consent
  screen, but the browser automatically returned credentials for
  `astera.0920@gmail.com`; `gcloud` safely rejected the mismatch. No IAM or
  production resource changed.
- Resume: on the Google consent page, explicitly choose
  `ting1811tin@gmail.com` (not the auto-selected `astera.0920@gmail.com`),
  complete consent, verify `gcloud auth list` marks it active, then rerun
  `scripts/setup-vercel-gcp-oidc.ps1`.
## 2026-07-30 OIDC setup completed with verified Owner account

### External changes made

- Active gcloud account: `ting1811tin@gmail.com` (verified project Owner).
- Created GCP service account:
  `astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com`.
- Created Workload Identity Pool / Provider: `vercel-oidc` / `vercel`, Provider
  state `ACTIVE`, issuer `https://oidc.vercel.com`.
- Added `roles/iam.workloadIdentityUser` only for the Vercel Project ID claim
  `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`.
- Granted the service account only `roles/datastore.user`,
  `roles/firebaseauth.viewer`, and `roles/storage.objectViewer`. No long-lived
  JSON key was generated, stored, or displayed.
- Stored the documented seven OIDC variables as Vercel Sensitive variables in
  both Preview and Production. CLI read-back showed every variable in both
  targets.
- Rebuilt Preview deployment `dpl_H5qAEehRU6chfaVnjBFJY4UiS5es`, status `Ready`:
  `https://astera-n850fxxzw-astera-oms.vercel.app`.

### Local source and verification

- Fixed `scripts/setup-vercel-gcp-oidc.ps1` so a missing first-run resource
  does not terminate PowerShell before creation; added a regression assertion
  in `tests/unit/productionScripts.test.ts`.
- Focused verification passed:
  `npm.cmd run test:unit -- tests/unit/productionScripts.test.ts`
  (24 files / 118 tests).
- GCP service-account IAM policy, Provider configuration, and Vercel
  environment-variable names/targets were read back successfully.

### Precise remaining verification

1. On the rebuilt Preview, sign in and save a valid member profile.
2. Add/remove a cart item and confirm the cart persists after reload.
3. Sign in with an Owner custom-claim account and save a Product; verify the
   server writes its `productsPublic` projection.
4. If any call fails, obtain the Vercel Function log for that route before
   modifying credentials or source. Only promote to Production after all three
   calls work.
## 2026-07-30 OIDC runtime root cause and exact resume point

### Reproduction evidence

- The stable branch Preview permitted Google sign-in with
  `astera.0920@gmail.com`; the member profile page rendered after sign-in.
- Saving non-personal verification values (`測試`, `preview-oidc-test`,
  `0900000000`; birthday left blank) failed and remained on
  `/account/profile`. This confirms the prior profile issue is server
  credentials/federation related, not browser form validation.
- Vercel Project Settings → Security shows OIDC federation already enabled in
  Team mode. The rendered live values are:
  - issuer `https://oidc.vercel.com/astera-oms`;
  - audience `https://vercel.com/astera-oms`;
  - project `astera-oms`, team `astera-oms`.

### Root cause and correction applied

- The original GCP Provider was incorrectly global issuer mode and allowed the
  Google provider resource name rather than Vercel's Team audience. The app
  also passed the Google resource audience to `getVercelOidcToken`.
- GCP Provider `vercel` was updated in `astera-oms-prod` to:
  - issuer URI `https://oidc.vercel.com/astera-oms`;
  - allowed audience `https://vercel.com/astera-oms`.
- The pending source change in `src/lib/firebase/admin.ts` calls
  `getVercelOidcToken()` with no custom audience, matching Vercel's official
  GCP example. `tests/unit/nextRuntimeConfig.test.ts` first failed against the
  old call and then passed after this change.

### Exact next step

1. Commit and push the current source revision (never stage `AGENTS.md`).
2. Wait for its `codex/mvp-completion` Preview deployment.
3. Repeat member profile save; a successful save redirects to `/`.
4. Use the same signed-in member to verify cart persistence, then an Owner
   account to verify Product save and its `productsPublic` projection.
5. If the first post-deploy save still fails, obtain the Vercel Function error
   before changing credentials again.

### Diagnostic follow-up after first corrected Preview

- First corrected Preview deployment `dpl_4QdE1Tq9jaXBdvomgrXRzT2K4kUN`
  accepted the request but the profile save still returned the generic error.
  Vercel logs proved the route was invoked but omitted the caught exception.
- Pending source adds `console.error("member_profile_save_failed", { message })`
  in the profile API catch path. It deliberately logs only the error message,
  not request data or credentials.
- `tests/unit/memberProfile.test.ts` was red before the diagnostic and green
  after it (**24 files / 120 tests**).
- Exact resume: deploy this diagnostic revision, submit the same non-personal
  test profile once, run `vercel logs <new-deployment> --since 15m --expand`,
  then fix only the reported error.

## 2026-07-30 Active work: Firebase Admin OIDC runtime compatibility

### Evidence recorded

- Stable Preview member-profile submission reproduced after the GCP issuer and
  audience correction. The precise Function diagnostic is:
  `Failed to initialize Google Cloud Firestore client with the available
  credentials. Must initialize the SDK with a certificate credential or
  application default credentials to use Cloud Firestore API.`
- The exception occurs inside Firebase Admin Firestore initialization, before a
  Firestore data request or IAM role check. It is not caused by profile fields,
  including the optional blank birthday.

### Pending deployment change

- Replaced the unsupported custom `IdentityPoolClient` Firebase credential in
  `src/lib/firebase/admin.ts` with Firebase Admin `applicationDefault()` backed
  by an ephemeral Vercel OIDC external-account configuration and subject-token
  file in the Function temp directory.
- The implementation continues to use the existing GCP Workload Identity Pool,
  provider, and service account. It does not create, store, or require a
  service-account private key.
- Regression source assertion changed in
  `tests/unit/nextRuntimeConfig.test.ts`; it was red before the implementation
  and green afterwards. Fresh local checks passed: Unit 24 files / 120 tests,
  TypeScript, ESLint.

### Resume sequence

1. Push this change on `codex/mvp-completion` (keep user-owned `AGENTS.md`
   unstaged).
2. Wait for the new branch Preview to be Ready and use the existing
   Firebase-authorized stable alias.
3. Save the same non-personal member profile; success must redirect to `/`.
4. Continue with cart create/reload persistence, then Owner Product save and
   `productsPublic` projection verification. Capture Function logs before any
   further external/IAM change if a route fails.

## 2026-07-30 Manual Preview verification: Product persistence defects found

### Direct browser evidence

- Signed-in Owner access to `/workspace/products` works and loads `prod_002`.
- A no-content-change save succeeds, proving the protected Product API reaches
  Firestore and regenerates `productsPublic`.
- That save exposed two defects:
  1. legacy Product SKU display used a public-list-position fallback while the
     Server saved a different ID-derived SKU;
  2. public Campaign records omitted `productId`, causing the strict client
     mapper to discard them and the storefront to report no purchasable
     Campaign despite the Owner workspace showing `Open（開放中）`.

### Pending source fix

- `src/lib/product/catalog.ts`: server-managed legacy Product SKU resolver,
  immutable ordered-Variant exception, and public Campaign `productId`.
- `src/lib/product/serverCatalog.ts`: Server ignores client SKU values,
  reserves the sequence after legacy migration, and detects referenced Variants
  via `orderItems.variantId` before any legacy SKU rewrite.
- `tests/unit/productCatalog.test.ts`: red-green coverage for deterministic
  legacy Product SKU, formal unlocked Variant migration, ordered legacy
  Variant preservation, and the public Campaign shape.
- Focused product test (15 tests), TypeScript, and ESLint passed.

### Resume sequence

1. Push this second runtime-fix commit and wait for branch Preview.
2. Re-save `prod_002` exactly once; expected Product SKU is unchanged at
   `AST-P000002`, while its unreferenced legacy Variant becomes
   `AST-P000002-V001`.
3. Confirm `/products` shows Campaign `92帽子預購`, price NT$520 and permits
   adding the item to the signed-in cart; reload `/cart` to verify persistence.
4. Record the result before testing Checkout, payment, or cancellation.

## 2026-07-30 Cart persistence passed; buyer-facing item label defect

### Runtime result

- Preview cart write and reload persistence passed for signed-in member
  `astera.0920@gmail.com`: one `92帽子` Preorder item, total NT$520, remains
  after navigating to `/cart` and reloading.
- This is the first verified member profile + cart + Owner Product protected
  Firestore runtime path on the Vercel OIDC Preview.

### Pending source change

- Cart row UI exposed `prod_002` and `var_002`, rather than buyer-facing
  names. `src/components/storefront/CartBoard.tsx` now resolves the saved line
  against `productsPublic` catalog data and renders Product / Variant names,
  with a safe loading label while catalog data is unavailable.
- `tests/unit/uiAccessibility.test.ts` gained a red-green regression assertion
  that rejects the former internal-ID markup. Focused UI tests (9), TypeScript,
  and ESLint passed.

### Resume sequence

1. Push cart label fix, wait for Preview, reload `/cart` and verify `92帽子` /
   `一般款` are rendered.
2. Decide whether the existing Preview test order can be created and later
   cancelled, or seed a dedicated disposable test product/member, before
   submitting Checkout. Do not create an accidental real operational order.

## 2026-07-30 Cart cloud-hydration overwrite: fix pending Preview validation

### Evidence

- Although cart persistence first passed after a same-deployment reload, the
  next deployment's first `/cart` visit showed an empty cart. This is a real
  server-data-loss risk, not a display-only issue.
- The browser sequence identified the race: initial React state is empty;
  signed-in sync PUT runs before member-cart GET resolves; the empty PUT
  overwrites the Firestore cart.

### Pending source change

- `src/lib/cart/clientCart.ts` adds pure
  `shouldSyncCloudCart(memberUid, loadedMemberUid)`.
- `CartBoard` tracks the member UID whose cloud cart has successfully loaded
  and skips all signed-in writes until it matches the active Firebase user.
  Anonymous local-cart saving remains unchanged; a user switch also remains
  blocked until the new member hydrates.
- `tests/unit/clientCart.test.ts` has red-green coverage for all three cases.
  Cart unit tests (4), TypeScript, and ESLint passed.

### Resume sequence

1. Push hydration fix and wait for Preview.
2. Re-add `92帽子`, reload `/cart` twice, and confirm it persists and renders
   `92帽子` / `一般款` without internal IDs.
3. Do not use this cart to create a non-disposable operational order until a
   specific test-order cleanup approach is chosen.

### Preview validation completed

- Deployment `dpl_4yxfij3Hc9csf2GaQsQhamvPxEgV` is Ready.
- The signed-in test flow added `92帽子` after the hydration fix, navigated to
  `/cart`, and reloaded the page twice. The server-backed cart retained the
  item each time and rendered buyer labels `92帽子` / `一般款`, NT$520,
  Preorder. No internal document IDs were visible.
- Member profile save, Owner Product save/projection, and cart write/read
  persistence are now verified on the stable Vercel OIDC Preview.
- Next operational test remains Checkout. It requires an explicit disposable
  test-order / cancellation-cleanup decision; do not create a real order merely
  for smoke testing.

## 2026-07-30 Reversible Checkout Preview test — baseline

- User approved the dedicated Preview-only Checkout test design and use of `astera.0920@gmail.com`.
- Source design: `docs/superpowers/specs/2026-07-30-reversible-checkout-test-design.md`; execution plan: `docs/superpowers/plans/2026-07-30-reversible-checkout-preview-test.md`.
- Browser verified the branch-stable Preview, never Production. At `2026-07-30 07:48:40 +08:00`, the signed-in cart was empty, loaded successfully, and no pre-existing item was changed.
- The account has Owner custom claim; record member-flow behavior separately from future non-Owner authorization testing.
- Test stop condition: the first product projection, cart, Checkout, cancellation, or archive failure stops the next mutation. Record only safe identifiers and error evidence, repair, redeploy, then start a newly named isolated test run.

## 2026-07-30 Reversible Checkout Preview test — ProductWorkspace load-race incident

- Task 2 exposed a real Owner Workspace defect before any Checkout mutation. The UI displayed `商品資料載入中。` yet allowed Product form editing and saving. When the protected product GET resolved, it selected existing `prod_002`; the pending form values then saved against that selected document instead of creating a new Product.
- Immediate scope stop: no cart item was added and no Checkout, Order, PaymentRequest, ConsentRecord, payment report, cancellation request, adjustment, audit record, refund, or notification event was created by this run.
- The protected Owner API restored the known existing test record values: `92帽子`, `一般款`, `92帽子預購`, default / campaign price NT$520, Product `Published`, Campaign `Open`. Identifiers remain `prod_002`, `AST-P000002`, `AST-P000002-V001`; no SKU was edited. Existing public description, internal note, classification and supplement setting were retained. Start/end campaign times are currently blank and had not been recorded before the attempted test setup.
- Source fix is in `src/components/workspace/ProductWorkspace.tsx`: an explicit initial product-load state disables all Product mutation routes and the submit handler rejects loading-time submits. `tests/unit/uiAccessibility.test.ts` first failed and then passed for this contract.
- Fresh local verification: Unit **24 files / 126 tests**, TypeScript, ESLint passed. Do not restart browser test-data creation until the new branch Preview is Ready and its loading gate is manually confirmed.
- Exact next action: push the source/docs fix excluding user-owned `AGENTS.md`; on Preview, wait for `商品資料已載入。`, click `新增`, ensure the Product ID field remains `儲存時自動建立`, then save a new explicitly named test Product and verify the generated ID is not `prod_002`.

## 2026-07-30 Reversible Checkout Preview test — live order and order-history blocker

- After the ProductWorkspace guard deployed, the test intentionally clicked `新增` only after `商品資料已載入。`. The protected Owner Product API created isolated Product `ZdW58A6aZqJLVHvioU6W` / `AST-P000003`, Variant `AST-P000003-V001`, name `【測試專用】Preview Checkout — 請勿付款`, Variant `Test Variant（測試規格）`, and an Open preorder NT$1 Campaign.
- The public storefront verified the product projection contains correct public data only; its single cart line remained after full reload.
- Exactly one Checkout was then submitted using the approved Preview-only non-real recipient data and both consent checkboxes. The UI confirmed `AST-20260730-0001` and one PaymentRequest; cart cleared. No Payment, payment report, confirmation, reversal, refund, adjustment, cancellation request, or duplicate Checkout has been created.
- Blocker before cancellation: `/orders` crashes with React error #31 because `OrderHistoryBoard` renders the Firestore Timestamp `createdAt` object. Console evidence explicitly identifies object keys `{seconds, nanoseconds}`.
- Root cause is `listMemberOrders()` raw Firestore casting. The pending source fix in `src/lib/order/repository.ts` normalizes order/item timestamps to ISO strings before returning to React. Test `tests/unit/orderRepository.test.ts` failed red against the raw Timestamp then passed green; fresh local results are Unit **25 files / 127 tests**, TypeScript, ESLint.
- Campaign datetime inputs displayed during browser automation but did not persist in the returned record. The Campaign explicit Open state and public availability passed; record this separately for manual datetime/E2E follow-up.
- Exact next action: deploy Timestamp normalization, reload `/orders`, use the same `AST-20260730-0001` detail page to directly cancel its only unpaid item, verify cancelled terminal states, then archive the isolated test catalog data. Do not submit any payment action.

## 2026-07-30 Reversible Checkout Preview test — cancellation-record timestamp correction

- `/orders` subsequently loaded `AST-20260730-0001` correctly after order / order-item timestamp normalization, but the member detail route still reported a safe read error before any cancellation mutation.
- Rules inspection confirms a member may read only its own `cancellationRequests`; the defect is not an authorization broadening request.
- `listMemberCancellationRequests()` and the Owner counterpart `listCancellationRequests()` are now defensive repository boundaries: they convert `createdAt`, `reviewedAt`, and `refundCompletedAt` Firestore Timestamp values to ISO strings before React receives them.
- `tests/unit/orderRepository.test.ts` added a red-green regression covering both structural `{ seconds, nanoseconds }` and Firebase-style `toDate()` Timestamp forms. It initially failed; all **25 files / 128 tests**, TypeScript, ESLint, and `next build` subsequently passed.
- Exact resume instruction: wait for the branch Preview generated from this correction, open only `order_h6rg9HE7zrVrnNqzOaF6CLCVERB2_20260730000428083_1`, confirm the test item remains unpaid, submit the single pre-approved cancellation reason, reload to capture terminal order/item/payment-request states, and archive Product `ZdW58A6aZqJLVHvioU6W` with its Campaign. Never delete the retained consent/audit/notification records and never touch Production.

## 2026-07-30 Reversible Checkout Preview test — protected member-detail reader

- Browser diagnostic evidence: the direct detail page's only remaining failure was `Missing or insufficient permissions` from the Client SDK cancellation-request read. The same signed-in session can read the Order list, including the test Order, so this is not an authentication or Checkout failure.
- `src/app/api/orders/[id]/route.ts` is a read-only protected detail boundary. It authenticates the Firebase ID token, checks exact member ownership, uses the OIDC-backed Admin SDK to read related records, filters all returned records to the owner, and serializes both Firebase `toDate()` and structural Timestamp forms to JSON-safe ISO strings.
- `src/components/storefront/OrderDetailBoard.tsx` now calls the protected endpoint. It no longer makes the blocked Client SDK `cancellationRequests` query and surfaces the associated PaymentRequest status / amount. Both it and `OrderHistoryBoard` show the official `orderNumber` rather than exposing Firestore document IDs when the official number exists.
- Verification before deployment: Unit **26 files / 133 tests**, TypeScript, ESLint, `next build` all pass. Tests include own-order response, cross-member `403`, timestamp serialization, protected endpoint use, and order-number display.
- Exact resume: after the Preview deployment becomes current, load only `order_h6rg9HE7zrVrnNqzOaF6CLCVERB2_20260730000428083_1`; confirm formal number `AST-20260730-0001`, test item `awaitingPayment`, PaymentRequest `open` / NT$1; submit one approved unpaid cancellation; reload and capture all cancelled / NT$0 terminal states; archive test Product `ZdW58A6aZqJLVHvioU6W` and Campaign. No payment, refund, or Production action is allowed.

## 2026-07-30 Reversible Checkout Preview test — completed handoff

- Scope executed only on the stable `codex/mvp-completion` Vercel Preview. Production was not accessed or changed.
- Test catalog identity: Product `ZdW58A6aZqJLVHvioU6W` / `AST-P000003`; Variant `AST-P000003-V001`; Campaign `TEST-ONLY Preview Checkout — 請勿付款`; all were server-generated / Owner-saved. Public projection passed at NT$1 and exposed none of SKU, cost or internal note.
- Test business identity: Order document `order_h6rg9HE7zrVrnNqzOaF6CLCVERB2_20260730000428083_1`; customer-facing order number `AST-20260730-0001`; one test item; one PaymentRequest. Before cancellation, order/item were awaiting payment and request was open NT$1.
- Single direct cancellation submitted: `Preview Checkout reversible test — no payment, do not fulfil`. A fresh detail-page reload persisted Order `cancelled` / NT$0, Item `cancelled`, PaymentRequest `cancelled` / NT$0. No pending request is shown; no Payment, Payment Report, confirmation, reversal, adjustment, refund, or Owner cancellation review was created.
- The Product and Campaign were archived through the protected Owner Product API and the public listing was reloaded: only existing Product `92帽子` remains. Do not hard-delete the archived catalog record or Order, Item, PaymentRequest, ConsentRecord, Audit Log, or notification event; they are retained test evidence.
- Runtime fixes discovered and deployed during this run: ProductWorkspace initial-load mutation gate; repository Timestamp normalization; protected member detail API with member ownership verification and JSON-safe Timestamp serialization; customer-facing orderNumber plus PaymentRequest detail UI. Current source commit before final documentation is `c3825e4`.
- Verification before final documentation commit: Unit **26 files / 133 tests**, TypeScript, ESLint, production `next build`; browser passed the full Preview-only checkout / direct-cancel / archive lifecycle. Known follow-up: Campaign `datetime-local` values entered by browser automation did not persist in the returned record; explicit Campaign status still controlled this test. Production Rules deployment and non-Owner authorization remain separate, unperformed tasks.

## 2026-08-09 Production security worker — handoff state

The no-`--apply` planner run exited 0 with `mode=dry-run`; no resource, API, IAM,
or deployment change occurred. The next approved command is still not executed:
`node scripts/setup-production-security.mjs --project astera-oms-prod --confirm-project astera-oms-prod --apply`.

Pending design is fixed to `asia-east1` key ring `astera-oms-security`, the
Software fingerprint and refund-vault KMS keys, Vercel key-level permissions,
worker/Scheduler identities, `astera-ops`, private `astera-security-worker`
(`min=0`, `max=1`, concurrency 1), two fixed Scheduler jobs, and the named
Monitoring policy. No unauthenticated invoker, service-account JSON key, or
project-wide KMS grant is permitted.

Read-only GCP inspection on 2026-08-09 confirmed project `astera-oms-prod` /
`1032606875618`, active pool/provider, expected runtime account, exact Vercel
project principal-set binding, and only the three existing Firestore/Firebase Auth
viewer/Storage object-viewer project roles. The provider maps the Vercel project
claim but has no independent attribute condition; binding scope is the enforcement
point. Only Monitoring API is enabled. KMS, Run, Scheduler, Cloud Build, and
Artifact Registry APIs are disabled, so planned KMS resources, repository,
service, and jobs are unverified while API disabled. Only the Worker/Scheduler
service-account list reads can establish absence. The named policy was
not listed; email-channel state is unverified because the local beta read command
is unavailable and no component install was attempted.

Budget/rollback: two active Software KMS versions are roughly USD 0.12/month
before free/usage effects; two Scheduler jobs are within the usual three-job
allowance; Cloud Run `min-instances=0` should be near free tier at MVP volume, but
billing alerts remain required. Roll back a future deployment by disabling both
jobs, removing exact service invoker/key bindings, deleting Cloud Run, and never
destroying a KMS version referenced by a fingerprint or payment snapshot. Docker
build verification remains parked because Docker is unavailable locally; CI or a
Docker-capable host must run `docker build -f ops/security-worker/Dockerfile -t
astera-security-worker:test .`.

### Review correction — do not waive the WIF Provider condition

This correction supersedes the earlier scope and resource-presence interpretation.
The empty Provider `attributeCondition` is a load-bearing BLOCKER: do not grant
KMS permissions or execute security `--apply`. The exact Vercel `principalSet`
binding remains mandatory as a second layer and cannot substitute for a Provider
condition. Local `gcloud iam workload-identity-pools providers update-oidc --help`
verified CEL over `assertion` as the supported condition syntax. An authorized
remediation must set and then read back (not executed here):

```text
gcloud iam workload-identity-pools providers update-oidc vercel --location=global --workload-identity-pool=vercel-oidc --project=astera-oms-prod --attribute-condition='assertion.project_id == "prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ"'
gcloud iam workload-identity-pools providers describe vercel --location=global --workload-identity-pool=vercel-oidc --project=astera-oms-prod --format="value(attributeCondition)"
```

KMS is unblocked only after review confirms this read-back and the original exact
principal set. Fixed identifiers: project `astera-oms-prod`, number
`1032606875618`, region `asia-east1`, ring `astera-oms-security`, keys
`member-account-fingerprint` / `refund-account-vault`, Vercel SA
`astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com`, Worker SA
`astera-security-worker@astera-oms-prod.iam.gserviceaccount.com`, Scheduler SA
`astera-security-scheduler@astera-oms-prod.iam.gserviceaccount.com`, repository
`astera-ops`, Cloud Run `astera-security-worker`, Scheduler
`astera-refund-vault-cleanup-daily` (daily 03:30 Asia/Taipei) and
`astera-fingerprint-key-report-monthly` (day 1 monthly 04:00 Asia/Taipei), and
policy `Astera Security Worker non-2xx or timeout` to `astera.0920@gmail.com`.

For disabled APIs, planned resource state is **unverified while API disabled**;
it must not be documented as confirmed absent. Only the successful Worker and
Scheduler service-account list reads found no matches. The next apply command is
BLOCKED pending tested Provider-condition remediation and review.

Fresh post-remediation readback remains a BLOCKER gate (not run here):

```text
gcloud iam workload-identity-pools providers describe vercel --location=global --workload-identity-pool=vercel-oidc --project=astera-oms-prod --format="json(state,attributeMapping,attributeCondition)"
gcloud iam service-accounts get-iam-policy astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com --project=astera-oms-prod --flatten="bindings[]" --filter="bindings.role=roles/iam.workloadIdentityUser AND bindings.members:principalSet://iam.googleapis.com/projects/1032606875618/locations/global/workloadIdentityPools/vercel-oidc/attribute.project_id/prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ" --format="table(bindings.role,bindings.members)"
```

KMS/apply is unblocked only if one fresh review proves all four: Provider state
`ACTIVE`; `attributeMapping.attribute.project_id == assertion.project_id`; exact condition
`assertion.project_id == "prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ"`; and the exact
`roles/iam.workloadIdentityUser` runtime-SA principal-set member. The inventory
also includes Pool `vercel-oidc`, Provider `vercel`, Vercel project
`prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`, and all planned API IDs:
`cloudkms.googleapis.com`, `run.googleapis.com`, `cloudscheduler.googleapis.com`,
`cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, and
`monitoring.googleapis.com`. Until then KMS and security `--apply` remain
BLOCKED.

## 2026-08-10 Task 5 authorization checkpoint

WIF preflight commit `1c8387f` has approved review; Worker Firestore IAM commits
`3bec6e9` and `5961b9a` have approved re-review. Fresh controller results pass:
focused 52/52, full Unit 43 files / 334 tests, TypeScript, ESLint, secret scan,
and document diff check.

The apply path is READY in code but BLOCKED for live mutation until explicit user
authorization. It includes Provider-condition remediation and the Worker exact
`roles/datastore.user` binding; Scheduler has no project-wide role. No cloud
command or `--apply` has run. The exact next command is:

```text
node scripts/setup-production-security.mjs --project astera-oms-prod --confirm-project astera-oms-prod --apply
```

The command will not proceed to API/KMS until readback verifies Provider `ACTIVE`,
the exact mapping, exact Vercel-project condition, and exact `principalSet`.
Docker build remains unverified because Docker CLI is absent.

## 2026-08-09 Task 5 apply attempt blocked before mutation

The managed execution safety review rejected the live apply before command startup.
The user's brief approval did not explicitly enumerate the persistent Production
changes. Therefore no WIF condition, API, KMS key, IAM binding, service account, or
Artifact Registry resource was changed.

Resume by obtaining explicit approval for the complete `astera-oms-prod` scope:
WIF Provider condition, six approved APIs, two KMS keys, Worker and Scheduler
service accounts, Worker Firestore role, key-level KMS IAM, and the `astera-ops`
Artifact Registry repository. Then run exactly:

```text
node scripts/setup-production-security.mjs --project astera-oms-prod --confirm-project astera-oms-prod --apply
```

Do not bypass the managed safety review or split the operation into indirect
commands to avoid the authorization gate.

## 2026-08-10 Task 5 Production security resources completed

Explicit authorization was received. The apply encountered three fail-closed
gcloud compatibility boundaries; each was fixed with RED/GREEN tests and independent
review in commits `abd32a6`, `7cb07d1`, and `861a99f`. Final apply exited 0.

Verified Production state:

- WIF Provider ACTIVE with exact mapping, Vercel project condition, and principalSet.
- Six approved APIs enabled.
- `member-account-fingerprint` version 1: HMAC_SHA256 / SOFTWARE / ENABLED.
- `refund-account-vault` primary version 1: Google symmetric / SOFTWARE / ENABLED.
- Vercel key-level HMAC signer and refund encrypter/decrypter only.
- Worker key-level HMAC viewer plus project `roles/datastore.user`; no refund crypto.
- Scheduler service account has no project-wide role.
- Worker/Scheduler service accounts active.
- `astera-ops` Docker Artifact Registry exists in `asia-east1`.

Fresh local verification passed focused 35/35, Unit 43 files / 340 tests,
TypeScript, ESLint, secret scan, and diff check. Task 6 is the next exact step:
implement and review the private Worker deployment planner, then deploy Cloud Run,
OIDC Scheduler jobs, and Monitoring only after its source and Docker/image build
gate pass. This host still has no Docker CLI.

## 2026-08-10 Task 6 continuation checkpoint

Task 6 source is implemented in `2e246e2`; security hardening is in `1ac6d13`.
Controller review originally found three High and two Medium issues; the scoped
re-review confirms all addressed, no new breakage, Spec PASS, Quality APPROVED.
Implementer evidence passes focused 42/42, Unit 44 files / 374 tests, TypeScript,
ESLint, Build, secret scan, and diff checks.

No Task 6 live operation ran. A controller fresh full gate was requested, but the
managed executor rejected it before command startup because the Codex usage limit
was reached. The UI states retry availability at 2026-08-16 10:05. Do not report
Task 6 complete and do not attempt alternate execution to bypass this limit.

Exact resume sequence:

1. Run controller focused 42/42, full Unit, TypeScript, ESLint, Build, secret scan,
   diff check, and exact dry-run.
2. Read back the budget alert and confirm existing Cloud Run/Scheduler/Monitoring
   state without mutation.
3. Obtain explicit authorization for Cloud Build/image push, private Cloud Run,
   service-level Scheduler invoker, two OIDC jobs, email notification channel, and
   Monitoring policy.
4. Run `node scripts/deploy-production-security-worker.mjs --project
   astera-oms-prod --confirm-project astera-oms-prod --apply`.
5. If it stops on `UNVERIFIED`, complete the external email-channel verification
   and rerun only after readback is `VERIFIED`.
6. Perform private/public IAM readback, authenticated `/healthz` and both job route
   smoke tests, idempotency, controlled 405 alert delivery, and sensitive-log audit.

Task 7 remains pending. No branch push or integration authorization has been given.

## 2026-08-10 Task 6 resumed after managed-execution limit

The controller reran the full local gate successfully: focused 42/42, full Unit
44 files / 374 tests, TypeScript, ESLint, Next.js Build, secret scan, diff check,
and exact dry-run all exited 0.

Read-only Production findings:

- Billing enabled; linked billing account ID recorded in Deployment only.
- Worker Cloud Run service absent.
- Daily and monthly Scheduler jobs absent.
- Matching Monitoring email channel and alert policy absent.
- Billing Budget API disabled; budget inventory therefore unverified.

Task 6 remains BLOCKED from live deployment because the approved design requires a
Budget Alert before deployment. Exact continuation:

1. Obtain explicit authorization to enable `billingbudgets.googleapis.com` on
   `astera-oms-prod`.
2. List budgets read-only for the linked billing account.
3. If no acceptable budget exists, obtain a separate decision/authorization for
   amount, thresholds, and recipients before creating it.
4. Only after budget verification, obtain explicit Task 6 authorization for Cloud
   Build/image push, private Cloud Run, service IAM, two OIDC jobs, Monitoring email
   channel, and alert policy.

No Task 6 Production mutation occurred in this resumed step.

## 2026-08-10 Billing Budget gate continuation

The user explicitly authorized only enabling `billingbudgets.googleapis.com` on
`astera-oms-prod` and a read-only query of Billing Account
`01B794-2E6BD7-33D714`. API enablement completed successfully. The inventory found
one existing monthly Budget Alert, `Firebase Project astera-oms-prod`, scoped to
project number `1032606875618`, with TWD 200 amount and current-spend thresholds at
50%, 90%, and 100%. Default Billing Account Administrator/User recipients are not
disabled, so the required pre-deployment Budget Alert gate passes.

No Budget was created, modified, or deleted. No Task 6 Cloud Build, image push,
Cloud Run, IAM, Scheduler, Monitoring channel, or alert-policy deployment occurred.
Task 6 remains in progress. Exact continuation:

1. Obtain explicit authorization for the complete reviewed Task 6 Production blast
   radius: Cloud Build/image push, private Cloud Run, service-level Scheduler
   invoker IAM, two OIDC Scheduler jobs, Monitoring email channel, and alert policy.
2. Run the guarded apply command once with unchanged reviewed arguments.
3. If the new email channel is `UNVERIFIED`, stop and have the operator complete
   Google's email verification; rerun only after readback is `VERIFIED`.
4. Complete authenticated/private/public IAM, route, idempotency, alert-delivery,
   and sensitive-log verification before marking Task 6 complete.

## 2026-08-10 Task 6 deployed; destructive smoke still gated

The explicitly authorized Task 6 guarded apply completed with exit 0. Production
now has a Ready private Worker, digest-pinned image, fixed project/HMAC env, max 1,
default min 0, concurrency 1, the Worker runtime SA, exact Scheduler-only invoker,
two enabled Asia/Taipei OIDC jobs, one enabled email channel, and one enabled
non-2xx/timeout policy.

Three fail-closed compatibility findings were diagnosed from live Google readback
and fixed through red/green tests:

- `774740d`: accept the sole Cloud Scheduler platform User-Agent while rejecting
  every additional or altered header;
- `78e5c42`: accept undefined/UNSPECIFIED Monitoring verification status per the
  API contract, while explicit UNVERIFIED and unknown states still fail;
- `246e51d`: normalize omitted thresholdValue to protobuf default zero while
  retaining exact semantic policy comparison.

Post-fix evidence: focused 33/33, Unit 44 files / 374 tests, TypeScript, ESLint,
Build 39 pages, secret scan, and diff check passed. Monthly key-usage Scheduler run
returned 200. Unauthenticated job POSTs returned 403. A recent payload-only log
scan counted 0 forbidden sensitive keys, 0 long-digit matches, and 0 Worker failure
markers. No human Token Creator permission was added; Scheduler-SA impersonation
was denied, preserving least privilege.

Monitoring delivery subsequently passed. The user supplied a screenshot of the
received Google Cloud email showing `Alert firing` for the fixed
`Astera Security Worker non-2xx or timeout` policy, request-count value 4, project
`astera-oms-prod`, service `astera-security-worker`, and location `asia-east1`.
No mailbox access was performed and the attachment was not copied into the
repository. The remaining Task 6 gate is cleanup idempotency plus the documented
authenticated-health substitution decision.

Those remaining gates subsequently passed. The user explicitly authorized two
cleanup executions. Count-only Firestore aggregation was 0 before run 1, 0 after
run 1, and 0 after run 2. Both Scheduler OIDC requests returned 200, proving
aggregate `cleaned=0` idempotency; no record was deleted and no ID/payload was read.
Post-run payload log scanning again returned zero sensitive-key, long-digit, and
failure-marker matches. The authenticated 200 monthly and cleanup routes are the
documented stronger substitute for `/healthz`, so no human Token Creator role is
needed. Task 6 is complete. Exact continuation is Task 7 Vercel security environment
preflight and strict release gates; do not mutate Vercel environment or redeploy
without its separately authorized scope.

## 2026-08-10 Task 7 read-only Vercel preflight

Task 6 is complete and Task 7 is in progress. Vercel CLI 58.9.0 readback found the
linked project `astera-oms/astera-oms` with ID
`prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`, Next.js, root `.`, and Node.js 24.x. The project
currently has no custom Environment Variables.

The local strict security check initially listed all 17 variables missing because
the shell had no Vercel environment. Firebase CLI auth had expired; instead, the
read-only Firebase Management API was called through existing ADC and confirmed the
ACTIVE Production Web App plus all six public SDK values. Those values, the verified
Task 5 GCP/WIF/KMS values, key version 1, and a deliberately non-production
placeholder secret passed the strict checker in a child process. Nothing was saved
to `.env`, Vercel, Git, or documentation as a secret.

Exact continuation requires separate authorization to:

1. Add the 16 fixed non-secret variables to both Vercel Production and Preview.
2. Generate two independent cryptographically random 48-byte values in memory and
   pipe each directly to `REFUND_RATE_LIMIT_HASH_SECRET` for its target with
   sensitive/secret visibility; never print, document, or save them.
3. List variable names/targets only and confirm no Emulator or E2E-auth variable.
4. Redeploy Preview only, run the strict security gate in that environment, and
   perform the approved non-real-bank-account security flow.

No Vercel variable or deployment mutation has occurred in Task 7 yet. Production
redeploy is not part of the next authorization unless explicitly added later.

## 2026-08-10 Task 7 authorized write; Preview deployment paused

The user explicitly authorized Vercel project `astera-oms/astera-oms` only. The 16
fixed Production/Preview names were added or overwritten. Separate Production and
Preview `REFUND_RATE_LIMIT_HASH_SECRET` values were each generated from 48 random
bytes in process memory and written via stdin as Sensitive Secrets. The values were
not output, saved, or recorded. The initial static RNG call was unavailable in the
host PowerShell runtime and failed before generation or Vercel input; the compatible
`RandomNumberGenerator.Create().GetBytes()` path was length/distinctness tested and
then completed successfully.

The metadata-only verification found 29 records and exposed pre-existing drift:

1. `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` exists for Production and Preview.
2. Older unscoped Preview Sensitive records overlap the newly verified fixed record
   for `GOOGLE_CLOUD_PROJECT`, `GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`,
   `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER_ID`,
   `GCP_WORKLOAD_IDENTITY_AUDIENCE`, and `GCP_SERVICE_ACCOUNT_EMAIL`.
3. No branch restriction is attached to those conflicting records.

Because the authorization prohibited removing other settings, nothing was deleted
or normalized. The Emulator/Test Auth gate is not satisfied, so no Preview build,
deployment, authenticated security flow, or Production deployment was attempted.

Exact continuation requires a new narrow authorization to remove
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS` from Production and Preview and normalize only
the seven named duplicate Preview records while retaining the verified values. Then
rerun `vercel env ls` metadata-only, require zero forbidden names/overlaps, deploy
Preview only, and continue Task 7 verification. Branch
`codex/production-security-worker` remains isolated; no push is authorized.

## 2026-08-10 Task 7 cleanup, Ready Preview, and exact continuation

The name-scoped cleanup completed exactly as authorized. It removed
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS` and only the seven legacy Preview Sensitive
duplicates for the GCP/WIF identifiers. Fresh metadata inventory is clean: 21 total
records, fixed 16/16, bad fixed 0, rate-limit Sensitive Secrets 2, forbidden 0,
and Preview overlaps 0. Both target-specific secrets remain hidden and distinct.

The first deployments exposed Vercel's `TEAM_ACCESS_REQUIRED` Git-author gate.
Empty commit `e9db99b`, authored by verified team member
`Astera OMS <astera.0920@gmail.com>`, contains no source or secret change and allowed
deployment `dpl_BCk2r5e8ZfyeKxezbi5tffwRibmA` to reach Ready. Preview URLs:

- `https://astera-ix5gsqvlu-astera-oms.vercel.app`;
- stable alias `https://astera-oms-astera-blip-astera-oms.vercel.app`.

Production was not deployed, promoted, or otherwise changed. Build compile,
TypeScript, and 39/39 page generation passed. Vercel actually used Node 24.15.0,
which is below the repository's declared `>=24.18.0` floor and produced an
`EBADENGINE` warning; retain this as a Production release warning.

Public browser verification passes `/`, `/products`, `/brand`, and `/cart`, and
confirms `/e2e-auth` returns 404. Google sign-in on both Preview hosts is currently
blocked by Firebase Authentication Authorized Domains. Thus public Preview health
is proven, but authenticated WIF/KMS and refund-flow verification is not.

Local evidence is green: TypeScript, ESLint, Build 39 pages, Unit 44/374, Rules
2/32, Emulator Playwright 34 passed / 8 skipped / 0 failed, secret scan, production
dependency audit (0 vulnerabilities), and diff check. The only source test change
aligns stale Pixel 7 workspace assertions with the current bilingual accessible
names; focused verification passed 3/3 and independent review found no issue.

Exact continuation, requiring separate authorization: add only
`astera-oms-astera-blip-astera-oms.vercel.app` to Firebase Production Authentication
Authorized Domains. Then sign in through that stable Preview alias and create only
explicitly named `測試專用` records to verify member binding, payment fingerprint
snapshot, refund mismatch and match, Owner reveal, and vault deletion. Do not add
one-off Preview hosts, do not deploy Production, and do not push this branch without
new authorization.

## 2026-08-10 Firebase Authorized Domain and authenticated Preview checkpoint

The user explicitly authorized only the stable Preview alias. Attempts to read the
Identity Toolkit admin config through both locally authenticated gcloud accounts
returned 403 and performed no mutation. The already signed-in Firebase Console
session was therefore used. Its Authorized Domains table showed the prior set;
adding `astera-oms-astera-blip-astera-oms.vercel.app` returned Success. Reloading
the full settings route showed the exact prior set plus that one Custom domain.
No existing domain was removed, no unique deployment hostname was added, no other
Firebase setting changed, and Production was not deployed.

The original `auth/unauthorized-domain` blocker is resolved: a retry reached the
Google chooser after one `auth/network-request-failed` attempt. OAuth then
completed on the stable Preview and redirected to `/account/profile`. A test-only
member profile saved successfully and redirected home.

The member payment-account UI initially showed `0/5`. One synthetic test-only
member payment account was added successfully; the UI then showed `1/5`, only
bank-code and masked-account display data, an empty full-account input, and a
success status. No account value, masked digits, token, fingerprint, ciphertext,
or secret is recorded. No test Payment, CancellationRequest, refund reveal, or
vault deletion has been created.

The remaining authorized refund, Owner, and vault work is limited to the static
Task 7 flow audit. Do not add operational detail here beyond that audit, and do not
push, deploy Production, add another domain, or change any other Firebase setting.

## 2026-08-10 Preview payment/refund handoff

The signed-in test member was denied `/workspace` as expected. A clearly marked
test-only checkout then created one NT$520 Order and PaymentRequest. A second
synthetic member account was saved and used to create one `pendingReview` Payment;
no real transfer occurred.

Complete synthetic values were not written to the repository or application
storage. One value briefly appeared in browser-tool output during automation, but
was never copied into tracked documentation. A narrowly scoped ADC Firestore read
timed out before returning data and made no write. A later browser process reset
made the active complete values unavailable, so neither account can be used for a
successful refund match. This is the expected irreversibility property of stored
HMAC data, not a reason to attempt recovery.

Exact next action: log in as the test member again, bind one new synthetic account,
and create a fresh clearly labelled test Order/Payment. Keep that complete value
only in the active process through Owner confirm, one mismatch and one match, reveal
without capturing the response body, full refund approval, and vault-field absence.
Do not record account digits, masked digits, IDs, token, fingerprint, ciphertext,
KMS material, or rate-limit material. Do not push, deploy Production, add another
domain, or change any other Firebase/Vercel setting.

## 2026-08-11 Task 7 Preview authentication retest blocker

- The stable Preview login was retested with the same test member. Google account
  selection completed and returned to the stable Preview home page, but the
  application then rendered the signed-out state. Navigating to
  `/account/bank-accounts` still displayed the Google login prompt.
- This run made no account, order, payment, refund, Firebase, Vercel, or Production
  mutation. It did not inspect browser storage, cookies, tokens, or account values.
- The current client error lifecycle clears a redirect-result error when Firebase
  subsequently reports a signed-out state, so the visible page does not retain the
  diagnostic error code. This establishes an authentication-observability defect,
  but does not yet establish whether the underlying cause is the redirect runtime
  or an external Firebase configuration.
- The controlled in-app browser is the only available browser surface in this run;
  no external Chrome extension session is connected. Do not create another test
  account or test order until an authenticated session is demonstrably retained.
- Exact next action: obtain an authenticated stable-Preview browser session that
  remains signed in after navigation, then run the one-pass synthetic account/order/
  payment flow already documented above. If the same failure occurs in a normal
  browser, create a narrowly scoped diagnostic fix and test before retrying; do not
  bypass Firebase Auth with test auth, custom tokens, or client storage access.

## 2026-08-11 Redirect-error visibility fix and Preview deployment recovery

- The minimal client fix is committed as `abf88be`: a Google redirect-result error
  is retained when the following Firebase state is signed-out, and cleared only
  when there is no redirect error or a real Firebase user is present. The static
  regression test first failed, then passed. Fresh local verification: Unit 44
  files / 375 tests, TypeScript, ESLint, Next build (39 static pages), secret
  scan, and diff check all passed.
- A direct local Vercel Preview deployment created
  `dpl_G5ALjYiQMUnEQxJ4baZFqnzwtxNS`, but Vercel reported `UNKNOWN` with a
  zero-ms build and no logs after the CLI upload timed out. It is not a valid
  release.
- The stable Preview alias was automatically pointed to that unknown deployment,
  then immediately restored to the prior Ready Preview. Production was not
  deployed or changed; no Firebase setting or domain changed.
- Exact continuation requires explicit authorization to push
  `codex/production-security-worker` to the existing GitHub remote so Vercel Git
  integration can build the Preview normally. After that Preview is Ready, repeat
  Google login and record the retained Firebase redirect error code or authenticated
  state before creating any new test data.

## 2026-08-11 Stable Preview redirect-login diagnosis

- Git-integrated Preview deployment for `bed5f01` is Ready and is assigned to the
  existing authorized stable Preview alias. The source changes direct Google sign-in
  to `signInWithRedirect`, eliminating the mobile popup-flash behaviour. Focused
  unit, TypeScript, ESLint, Build, secret scan, and diff-check evidence passed
  before push. Production was not deployed.
- Retest result: the browser reaches Google account selection, then returns to the
  Preview application signed out. No Firebase error remains visible and no test
  account, order, payment, refund, or configuration was created in this retest.
- Cause established from Firebase's current redirect guidance: Vercel uses a
  different origin from the Firebase Auth helper. Third-party storage blocking
  loses the redirect helper session. The documented applicable remedy is a
  transparent reverse proxy for `/__/auth/` and a same-origin Preview `authDomain`.
- Next action requiring fresh explicit authorization: modify only Preview to proxy
  `/__/auth/:path*` transparently to the existing Firebase handler, change only
  Preview `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` to the stable authorized Preview
  hostname, deploy Preview, and retest sign-in. Do not modify Production, add a
  Firebase authorized domain, or start the payment/refund acceptance data flow
  before the session persists.

## 2026-08-11 Preview authDomain safety checkpoint

- Commit `6398a22` adds the documented transparent Firebase helper rewrite. The
  focused regression test first failed and then passed; TypeScript, ESLint, Next
  build (39 routes), secret scan, and diff check passed. The branch was pushed;
  Production was not deployed.
- Only the existing Vercel Preview `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` record was
  removed. The intended replacement was rejected before execution by the safety
  layer because the entered hostname differed in case from the approved stable
  alias. No replacement was written and no Firebase/Production mutation occurred.
- Do not trigger another Preview deployment while this build-time value is absent.
  Resume after the user explicitly confirms the exact lowercase replacement:
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=astera-oms-astera-blip-astera-oms.vercel.app`
  for Preview only. Then re-check metadata, wait for a Ready Preview, assign only
  the existing stable alias, and repeat sign-in. No test banking/payment data may be
  created before session persistence is proven.

## 2026-08-11 Preview authDomain restored

- Fresh explicit authorization was received after the safety rejection. Vercel
  confirmed the exact lowercase stable Preview hostname was added to
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` as Preview-only non-sensitive configuration.
  Production and all other environment variables remain unchanged.
- Exact continuation: trigger a Git-integrated Preview after this replacement,
  wait for Ready, attach only the existing stable Preview alias, then verify
  `/__/auth/iframe` and retained Google redirect login. Do not create test
  banking/payment/refund data before authenticated state is retained.

## 2026-08-11 Same-origin helper pass; Google-button diagnostic blocker

- A Ready Git-integrated Preview was verified and only the existing stable Preview
  alias was assigned to it. Production was not deployed. The exact lowercase
  Preview `authDomain` existed before this build.
- `/__/auth/iframe` returned under the stable Preview hostname and loaded its
  helper script under the same hostname, proving the proxy rewrite is transparent
  to the browser.
- The Google button now remains on the account page without navigating and without
  a visible error. `AuthProvider` imports Firebase outside the handler's `try/catch`;
  a client initialization rejection therefore bypasses the current error UI. This
  is a testable leading hypothesis, not yet a claimed root cause.
- No payment-account or financial acceptance data was created. Resume only after
  fresh authorization for a test-first, Preview-only diagnostic: move those dynamic
  imports into the current `try/catch`, render its existing safe error text on
  failure, deploy Preview, and retest the button. Do not alter proxy routing,
  providers, Firebase domains, or Production.

## 2026-08-11 Google initialization diagnostic fix ready for Preview

- Following fresh approval, a test-first change moves the Firebase imports inside
  `signInWithGoogle`'s existing `try/catch`. An initialization rejection can now
  render the existing safe Google sign-in error rather than leaving the button
  inert. No provider, proxy, Firebase-domain, financial-data, or Production change
  was made.
- Verification before Preview: focused auth/proxy tests 16/16; full Unit 44 files /
  377 tests; TypeScript, ESLint, Next build (39 routes), secret scan, and diff
  check passed.
- Exact continuation: use the Ready Git-integrated Preview, attach only the stable
  Preview alias, and retry Google sign-in. Record only safe visible error text if
  it fails; do not create any test banking/payment/refund data until signed-in state
  persists on `/account/bank-accounts`.

## 2026-08-11 Preview OAuth redirect-URI gate

- The latest Git-integrated Preview was Ready and received only the existing stable
  Preview alias. A separate direct CLI Preview upload timed out and was not assigned
  to that alias. Production was not deployed or changed.
- The corrected client flow reaches the same-origin Preview Auth handler and then
  Google. Google rejects it with `redirect_uri_mismatch`, establishing that the
  outstanding blocker is the OAuth Client redirect-URI allowlist.
- Exact action requiring fresh external-configuration authorization: in the existing
  Google OAuth Client, add only
  `https://astera-oms-astera-blip-astera-oms.vercel.app/__/auth/handler` to
  Authorized redirect URIs and save. Do not change the OAuth consent screen,
  client credentials, other redirect URIs, Firebase domains, one-off Vercel hosts,
  or Production. After saving, retry Preview sign-in and only then test retained
  session state; no payment/refund test data may be created beforehand.

## 2026-08-11 Preview OAuth redirect URI saved

- The user explicitly authorized one exact change. The stable Preview handler URI
  was appended to the existing Google OAuth Client, saved, and re-opened to verify
  it persisted. No existing URI, OAuth consent configuration, Firebase domain,
  one-off Vercel host, or Production setting was changed.
- Retest reaches the Google account chooser without `redirect_uri_mismatch`. The
  chooser is deliberately held for the user to select the intended test account;
  no account was selected by automation and no member/payment/order/refund record
  was created.
- Exact continuation: after the user completes account selection, verify retained
  authenticated state on `/account/bank-accounts` and after normal navigation.
  Only then resume the one-pass synthetic payment/refund acceptance flow.

## 2026-08-11 Member account legacy-data repair pending Preview retest

- The selected Preview member stayed authenticated after return to the account
  page, but the API returned a generic list-read error. Safe server diagnostics
  proved the request reaches serialization; Firebase Auth, Workload Identity, and
  Firestore IAM readbacks remain healthy. A read-only aggregate health check found
  pre-contract account records without a bank code. It emitted no account values,
  IDs, or member identities.
- The repair converts incomplete legacy records to inactive, masked
  `needsReverification` snapshots. They cannot be used for payment and do not
  count against the five usable-account cap; the member is told to register a new
  account. New unit regressions cover list recovery and limit handling.
- Local evidence after repair: Unit 44 files / 379 tests, TypeScript, ESLint,
  Next build, and diff check pass. Exact continuation: deploy the repair to the
  stable Preview, verify the signed-in list renders, then resume only the approved
  test-only payment/refund flow.

## 2026-08-11 Preview test-only flow checkpoint

- The repaired stable Preview retained member authentication through normal
  navigation and rendered incomplete legacy accounts as masked, inactive
  re-verification records. A new clearly test-only member account was added;
  its full-account input was cleared and only masked UI information remained.
- A clearly test-only product was checked out using synthetic recipient data and
  both required consents, creating one new test-only Order and PaymentRequest.
  The payment form was explicitly narrowed to that new request; no historical
  request was submitted.
- No Payment exists from this run. Browser automation cannot commit a value into
  the native transfer-date input, so client validation correctly prevented
  submission. The visible Preview form remains the exact handoff point: manually
  select a transfer date, submit once, confirm `pendingReview`, then use the
  separate Owner account for confirmation, reverse, mismatch/match, reveal, and
  cleanup verification. Do not classify this date-control limitation as an app
  defect without a manual browser result.

## 2026-08-11 Payment Report date-state repair pending Preview retest

- The member's manual mobile screenshot proved a real form bug: a native date
  value was visibly present but React validation retained an empty `receivedAt`,
  leaving the submit control disabled. The control now handles both `change` and
  `input` events. A test was added first, observed failing, then passed after the
  minimal handler addition.
- Evidence: Unit 44 files / 380 tests, TypeScript, ESLint, Next build, and diff
  check pass. Exact continuation: deploy this commit to stable Preview, pick the
  date for the already-prepared test-only payment report, verify the button
  enables, submit once, and then continue Owner-side lifecycle tests.
