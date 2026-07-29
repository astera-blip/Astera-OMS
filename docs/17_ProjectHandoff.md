# Astera OMS Project Handoff

Last updated: 2026-07-29 Asia/Taipei

## Active Objective

Complete the Astera OMS MVP according to the handoff spec without redesigning the existing architecture.

Current execution plan:

- `docs/superpowers/specs/2026-07-29-mvp-local-completion-design.md`
- `docs/superpowers/plans/2026-07-29-mvp-local-completion.md`
- Start at Task 1. Do not skip production/test isolation or fallback/boundary Tasks 2–3 before Product image/storefront work.

## Repository State

- Working branch: `codex/mvp-completion`.
- Preserve existing user change: `AGENTS.md`.
- Existing product authority remains `productsInternal`; public storefront reads only `productsPublic`.
- Compact continuation brief for another AI: `docs/18_AIContinuationBrief.md`.

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
