# Astera OMS Project Handoff

Last updated: 2026-08-11 Asia/Taipei

## Active Objective

Complete the Production security release gates without redesigning the existing
Astera OMS MVP architecture. Task 7 has completed member-side Preview acceptance
and currently stops before the action-time-authorised Owner financial lifecycle and
Production promotion.

Current execution plan:

- Active plan:
  `docs/superpowers/plans/2026-08-09-production-security-worker-implementation.md`
  (Task 7).
- Legacy MVP plans remain historical context; do not restart already completed
  Tasks 1–6.

## Repository State

- Working branch: `codex/mvp-completion`; the previously isolated Production
  security worker branch is merged and its worktree/local branch were safely removed.
- Local and GitHub were synchronized through documented checkpoint `4630f72` before
  the current Production smoke-tool batch. The stable Preview alias runs the Ready
  merged Preview; Production still runs the older Ready 2026-08-03 deployment.
- Existing product authority remains `productsInternal`; public storefront reads only `productsPublic`.
- Complete continuation entrypoint for another AI: `docs/20_CompleteAIHandoff_2026-07-30.md`.

Current release evidence:

- Prior merged-tree gate: Unit 50 files / 418 tests, Firestore + Storage Rules
  32 tests, TypeScript, ESLint,
  Ready Vercel Preview Build, regular Playwright 18 passed, Emulator Playwright
  37 passed, secret scan, and production dependency audit all passed.
- Production project and `asia-east1` default Storage bucket exist. Projection audit
  passes `internalCount=2`, `publicCount=2`, `issues=[]`.
- Explicit-product Production smoke passes all five routes. The script now requires
  `--product-id` because `/products` is Client-rendered and its raw HTML cannot
  reliably expose a detail link.
- `asteratw.com`, `www.asteratw.com`, and `updates.asteratw.com` remain unresolved.

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
- `Member Preorder` is deferred and must not be implemented in this release.
- Member Dashboard is currently a visual skeleton only; do not invent operational metrics, reminders, or notification business rules.
- Astera receiving-bank account recognition is approved for MVP: Owner creates/activates/deactivates accounts; members choose an active account when reporting a transfer; payment history stores a masked snapshot.

## Approved ProductWorkspace Changes (Completed)

The following approved ProductWorkspace scope is implemented and retained here as
the acceptance contract, not as a pending work list:

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

- Product image upload UI/API、Storage Rules 與 Emulator Playwright 已在本地完成；正式 bucket 已建立並連結，仍需 production upload 與實機圖片驗收。
- Product API still needs real Storage metadata validation once upload flow/bucket is available.
- Formal production product re-save/sync still needs Firebase production access; local `productsInternal → productsPublic` projection logic is implemented.
- Resend DNS verification, production API key setup, and real send test remain pending external gates.
- Production Firestore and Storage Rules are deployed; production/mobile acceptance remains pending.
- Receiving payment-account local API/UI and authenticated Playwright are complete; production receiving-account records and live payment acceptance remain pending.
- The approved visual Token contract is now defined in `src/app/globals.css`; legacy `slate`／`amber` utilities are mapped to the new Astera palette and `min-h-screen` behavior is normalized to `100dvh`. Full visual device acceptance remains pending.
- Development and Production Firestore/Storage Rules are deployed; live upload and production/mobile acceptance remain pending.

## 2026-08-02 Handoff Update

- Campaign `datetime-local` now uses a shared Taipei UTC+8 conversion module for save, read-back, projection, and storefront display.
- `/members` now provides the approved visual dashboard skeleton without fake member data.
- Bank-account recognition is implemented locally:
  - `src/lib/payment/bankAccounts.ts` validates and masks account metadata.
  - `/api/workspace/payment-accounts` is Owner-only CRUD with soft disable.
  - `/api/payment-accounts` returns only active public summaries to authenticated members.
  - `/api/payments` validates the selected active account when configured and stores a masked receiving-account snapshot on the Payment.
  - `src/components/workspace/PaymentAccountsBoard.tsx` and `src/components/storefront/PaymentRequestsBoard.tsx` expose the management/selection UI.
  - `paymentAccounts` has no Client SDK read/write permission in Firestore Rules.
- Verification completed: typecheck, lint, Unit (`28 files / 140 tests`).
- Initial targeted Unit execution in the managed sandbox hit `spawn EPERM`; the same full Unit suite was rerun with approved unsandboxed execution and passed.
- Full Firestore + Storage Rules verification passed (`30 tests`).
- Focused authenticated payment/cancellation Playwright passed on Chromium desktop and Pixel 7 (`2/2`), including Owner account management, Member account visibility, Member management denial, account selection, and masked payment snapshot.
- The broader emulator suite reached `29 passed / 34 total` with the existing skips. Its first run found one old exact-payment test payload missing `receivingPaymentAccountId`; the test fixture was corrected and the focused rerun passed.
- 2026-08-02 fixture follow-up: updated all legacy payment fixtures in `tests/unit/paymentFlow.test.ts` and `tests/firebase/firestore-deny.test.ts` with `receivingPaymentAccountId: "account-test"`／`"account-a"`; the Emulator seed already uses `e2e-account`. Full Unit (`140/140`) and Rules (`30/30`) passed after the correction.
- 2026-08-02 UI Token follow-up: added the approved ten-token Astera palette, migrated home/Brand/Workspace shells to explicit tokens, and retained a compatibility mapping for remaining utility classes; typecheck, lint, build, Unit (`142/142`), regular Playwright (`16 passed / 18 expected skips`), authenticated emulator Playwright (`31 passed / 3 expected skips`), and Rules (`30/30`) passed.
- 2026-08-02 Production gate audit: project `astera-oms-prod` / number `1032606875618` is reachable; Vercel OIDC pool/provider are active and the production service account has the expected minimal roles. Blaze is enabled and the Firebase default bucket is linked at `gs://astera-oms-prod.firebasestorage.app` in `ASIA-EAST1`.
- 2026-08-02 Firebase release: Firebase CLI is authenticated as `ting1811tin@gmail.com`; Firestore Rules and Storage Rules deployments completed successfully. `gcloud storage buckets list --project=astera-oms-prod` confirms the bucket and region.
- 2026-08-02 combined Firebase release gate: `node scripts/run-firebase.mjs deploy --project astera-oms-prod --only firestore:rules,storage` completed successfully; both rulesets are active in Production.
- 2026-08-02 remaining external gates: ADC account recheck, strict Vercel Production environment verification, product projection audit/sync, Resend/DNS, real image upload, and device acceptance.
- 2026-08-02 Development Firebase release: `astera-oms-dev-b2b2e` is linked to billing account `01B794-2E6BD7-33D714` with `billingEnabled=true`; default bucket `gs://astera-oms-dev-b2b2e.firebasestorage.app` is linked in `ASIA-EAST1`; Development Firestore/Storage Rules deployment completed successfully.
- 2026-08-02 Vercel environment audit: Production contains all Firebase and OIDC variable names. `RESEND_FROM_EMAIL` and `RESEND_REPLY_TO_EMAIL` were added as non-sensitive variables; the strict check now has only `RESEND_API_KEY` remaining, and no secret value was printed or added.
- 2026-08-02 ADC audit attempt: `npm run production:products:audit -- --project astera-oms-prod --confirm-project astera-oms-prod` returned `7 PERMISSION_DENIED`. Re-run `gcloud auth application-default login` and select the Production-authorized account before reading or synchronizing products.
- 2026-08-02 ADC correction and audit: `gcloud auth application-default login` completed with quota project `astera-oms-prod`; the read-only audit then passed with `internalCount=2`, `publicCount=2`, `issues=[]`. No production product write was performed; the next write requires explicit Owner approval and backup confirmation.
- 2026-08-02 approved product sync: `production:products:sync --project astera-oms-prod --confirm-project astera-oms-prod --apply` created the ignored local backup `production-product-sync-2026-08-02T03-11-00-683Z`, rewrote 2 public projection documents, and the post-sync audit passed with `internalCount=2`, `publicCount=2`, `issues=[]`.
- 2026-08-02 post-sync verification: TypeScript, ESLint, Unit (`28 files / 145 tests`), Production build (33 routes), and `git diff --check` passed.
- 2026-08-02 post-sync Production smoke: `/` and `/products` returned 200, while `/terms` and `/privacy` returned 404 and no public product detail was discovered. The current `astera-oms.vercel.app` alias still serves an older deployment; redeploy the release branch before public launch.
- 2026-08-02 anonymous Production smoke against `https://astera-oms.vercel.app`: `/` and `/products` returned 200, but `/terms` and `/privacy` returned 404 and no public product detail was discovered. This confirms the current Production URL is still an older deployment and must not be treated as the release candidate.
- 2026-08-02 local release-candidate verification after the explicit token migration: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit`, `npm run firebase:rules:test`, `npm run test:e2e`, and `npm run test:e2e:emulated` all passed. Regular Playwright was `16 passed / 18 expected emulator skips`; authenticated emulator Playwright was `31 passed / 3 expected auth-gate skips`; Rules were `30/30`; Unit was `142/142`; secret scan passed; production dependency audit reported 0 high-severity vulnerabilities.

### Next Exact Continuation Step

Recheck ADC with `ting1811tin@gmail.com`, verify the strict Vercel Production environment, run the read-only production projection audit, and only then perform the approved product sync. Do not configure production account records until the audit is reviewed.

## Next Exact Step

Run the first real product image upload against the linked Production bucket, then complete Resend DNS/API-key real-send, production projection sync, and production/mobile acceptance.

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
- External gates after local Tasks 11–13: Resend DNS/API key and real inbox test, production Firebase/Vercel runtime verification, legal professional review, and physical-device acceptance. Firebase Blaze and both default Storage buckets are complete.

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
npm run production:smoke -- --base-url https://astera-oms.vercel.app --product-id prod_002
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
MVP work is external-gated: GCP Workload Identity and Vercel env variables,
production runtime verification, Resend DNS/API key,
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

## 2026-08-02 Production redeploy and release-gate status

- Production was redeployed from `codex/mvp-completion` with Vercel CLI;
  deployment reached Ready and the alias is `https://astera-oms.vercel.app`.
- Browser inspection after hydration showed `/products` rendering the published
  Production `92帽子` record from `productsPublic`. The earlier smoke failure was
  a tooling limitation: the script searched only server HTML while the product
  card is created by Client Firestore hydration.
- `scripts/smoke-production.mjs` now accepts `--product-id`; this command passed:

  ```text
  npm run production:smoke -- --base-url https://astera-oms.vercel.app --product-id prod_002
  ```

  All five checks returned HTTP 200. Focused Unit passed 16/16; Rules Emulator
  passed 30/30; TypeScript, ESLint and secret scan passed.

### Current release blockers

1. Vercel Production has Firebase/OIDC variables and
   `RESEND_FROM_EMAIL` / `RESEND_REPLY_TO_EMAIL`, but `RESEND_API_KEY` is not
   configured. Resend verification and actual delivery are pending.
2. `asteratw.com`, `www.asteratw.com`, and `updates.asteratw.com` are not yet
   registered/attached in DNS (NXDOMAIN; Vercel reports zero project domains).
3. Production payment account data is not yet created. Owner must enter bank
   name, branch, account name and last five digits in `/workspace/payments`.
4. Image upload needs an authenticated Owner session and a real image for the
   end-to-end Production check; the Storage bucket and Rules are deployed in
   `ASIA-EAST1`.
5. Final Production acceptance (member Checkout/payment report, Owner
   confirm/reverse/cancellation review, Helper/member denial, desktop, Pixel 7
   and physical mobile) remains pending.

### Exact continuation order

1. Register/attach the domain; finish Firebase Authorized Domains and Resend
   SPF/DKIM.
2. Add `RESEND_API_KEY` to Vercel Production, redeploy, and verify one order and
   one payment-confirmation email with `notificationEvents` status.
3. Owner creates the real active payment account in `/workspace/payments`.
4. With Owner signed in, upload one approved product image and verify public
   projection plus mobile rendering.
5. Run the complete Production desktop / Pixel 7 / physical-phone acceptance
   matrix and record pass/fail evidence here before public launch.

## 2026-08-02 External gate recheck

- DNS remains unconfigured: all three requested hostnames return NXDOMAIN.
- Vercel project domain list is empty.
- Production environment is missing only the Resend secret required for actual
  delivery (`RESEND_API_KEY`); Firebase/OIDC and Resend address variables are
  present.
- No bank metadata or personal image was transmitted by automation. The next
  handoff action is for the Owner to complete domain/DNS and secret setup, then
  create the payment account and upload the first approved image through the
  authenticated Owner UI.
- Anonymous responsive smoke passed at 390×844, 768×900 and 1365×900: home and
  products rendered, `92帽子` was visible, and no horizontal overflow was
  detected. Authenticated member/Owner and real-device flows still require the
  user's signed-in accounts and devices.

## 2026-08-02 Production `/payments` runtime fix

- The reported `/payments` failure was reproduced from code/data flow: once a
  member had a PaymentRequest, Firestore `createdAt` Timestamp crossed the
  repository boundary and was rendered as an object by React. This caused the
  Next error page; anonymous `/payments` did not reproduce because it has no
  request list.
- `src/lib/payment/repository.ts` now normalizes PaymentRequest date fields to
  ISO strings for member and Owner reads. Regression test:
  `tests/unit/paymentRepository.test.ts`.
- Fresh evidence: focused test 1/1; full Unit 29/148; TypeScript, ESLint, Build;
  Production smoke 5/5; `/payments` HTTP 200 after redeploy. Production alias
  remains `https://astera-oms.vercel.app`.
- Next manual step: refresh the existing signed-in `/payments` tab and confirm
  the previously created order's PaymentRequest renders its form. Submit no
  duplicate report unless the current status is still open and the user has
  actually transferred funds.

## 2026-08-02 Payment account visibility, multi-request report, and delivery

- Added a clear Owner Workspace dashboard entry `收款帳戶設定` to
  `/workspace/payments#payment-accounts`; the API remains Owner custom-claim
  protected.
- Member payment report now supports selecting multiple open PaymentRequests.
  The Server API accepts `paymentRequestIds`, distributes one reported transfer
  across remaining balances, creates linked `pendingReview` Payments with a
  shared `paymentGroupId`, and preserves the legacy single-ID response shape.
- Checkout delivery is now fixed to `7-Eleven 賣貨便`; the address/family-mart
  choices and store-information input were removed from new checkout UI and
  persisted snapshots. Historical orders retain their old fields for reading.
- Verification: Unit 30 files / 152 tests, Rules 30/30, TypeScript, ESLint,
  Build and Production smoke 5/5 passed. Production cart browser snapshot shows
  only the disabled `7-Eleven 賣貨便` option and no store-information field.
- Remaining manual gate: Owner must add a real active payment account, then a
  signed-in Member must select two open requests and submit one real transfer
  report (do not duplicate an existing report).

## 2026-08-02 付款複選超額保留修正

- `src/app/api/payments/route.ts` 現在會將複選付款請求無法分配的超額保留在
  最後一筆 linked Payment；Owner confirm 後可稽核 `unallocatedAmountTwd`。
- E2E 付款／取消流程（chromium-desktop、chromium-mobile）2/2 通過。
- 尚待真人驗收：Owner 在 `/workspace/payments#payment-accounts` 建立正式
  啟用帳戶，Member 在 `/payments` 選兩筆開放中的付款請求，使用實際匯款資料
  送出一次回報。
- 最新 Production deployment 已通過 Vercel build 與 smoke 5/5；正式別名仍為
  `https://astera-oms.vercel.app`。真人收款帳戶與實際匯款仍是外部驗收，不可
  由自動測試代替。

## 2026-08-02 ProductWorkspace 欄位溢出修正

- `src/components/workspace/ProductWorkspace.tsx` 的 Variant／Campaign 表單
  已加入 grid track 寬度約束，修正雙語欄位在窄面板重疊。Production 已重新部署。
- 手動驗收請重新整理 `/workspace/products`，確認 Default Price、Original Cost、
  Sale Type、Campaign Status、Start／End Time 的 label 與輸入框各自分離。

## 2026-08-02 目前交接：會員帳戶與前台 UI 批次

已完成本地程式：

- `src/lib/payment/memberBankAccounts.ts`：會員帳戶驗證、五筆上限所需型別、遮罩與 Server-safe snapshot。
- `src/app/api/member/payment-accounts/route.ts`：會員 GET／POST，transaction 強制五筆上限與重複檢查。
- `src/app/api/member/payment-accounts/[id]/deletion-request/route.ts`：會員提出封存申請。
- `src/app/api/workspace/member-payment-account-requests/route.ts`：Owner 查詢／核准封存並追加 Audit Log。
- `src/app/account/bank-accounts/page.tsx`、`src/components/account/MemberPaymentAccountsBoard.tsx`：會員帳戶管理 UI。
- `src/app/api/payments/route.ts`、`src/components/storefront/PaymentRequestsBoard.tsx`：付款回報同時選擇來源／目的帳戶。
- `src/components/storefront/PublicProductsBoard.tsx`、`PublicProductDetailBoard.tsx`、`ProductCoverImage.tsx`：登入閘門、Grid、4:5 圖片與最佳化圖片。
- `src/components/storefront/StorefrontHeader.tsx`、`src/app/layout.tsx`：公開前台 Header。

認證結果：Unit 36 files／169 tests、Rules 31 tests、Emulator Playwright 31 passed／3 skipped、公開 smoke 桌機／手機 16 passed；TypeScript、ESLint、Build 與 secret scan 通過。下一步是 Preview 部署、會員新增帳戶／封存申請／付款回報真人驗收，再進行 Production 部署；目前尚未宣稱正式站已套用本批程式。

## 2026-08-02 Preview 部署與真人驗收阻塞

- Preview deployment：`https://astera-6pgj8iggp-astera-oms.vercel.app`。
- Vercel build：Ready；HTTP 公開請求受 Vercel SSO 保護（302），未停用保護或建立公開繞過版本。
- In-app browser 可讀取 Preview 頁面，但 Google 登入按鈕未產生可操作登入視窗，故尚未
  寫入會員銀行帳戶、封存申請或付款回報資料，也未部署 Production。
- 使用者需在自己的已登入 Google／Vercel 瀏覽器中開啟 Preview 完成 Google 登入，並回覆
  `Preview 已登入`。後續依序：會員新增帳戶 → 會員提出封存 → Owner 核准 → 付款頁選兩筆
  PaymentRequest 回報一次 → 讀取成功狀態，再執行 Production deploy。

## 2026-08-02 整站改版與台新對帳交接

- 設計與計畫已提交：commit `54ba945`；主要執行文件為
  `docs/superpowers/specs/2026-08-02-astera-storefront-redesign-design.md` 與
  `docs/superpowers/plans/2026-08-02-astera-storefront-redesign.md`。
- 新增 `src/app/checkout/page.tsx`，`/cart` 增加 `前往結帳`；Server Checkout contract 未變。
- 公開前台已先完成 Header、首頁 Hero／流程區、Campaign 摘要、商品推薦 Grid、商品列表
  與詳情的新版 Token／欄數／4:5 圖片／買家文案批次。
- 新增 `src/lib/reconciliation/taishin.ts`（ExcelJS）、
  `src/app/api/workspace/reconciliation/taishin/route.ts` 與
  `src/components/workspace/TaishinReconciliationBoard.tsx`。API 只允許 Owner，限制
  `.xlsx` 10 MB，解析第二列欄位並回傳安全化交易摘要與金額＋末五碼 matches；本批不寫入
  Payment 歷史，也不保存原始檔案。
- 使用者提供的台新檔已確認為 `Sheet1`、`A1:F279`、第一列標題、第二列欄位：交易日／帳務日／
  摘要／金額／餘額／備註；純函式與 XLSX buffer Unit 已通過。
- 最新驗證：Unit 39 files／178 tests、TypeScript、ESLint、Build 通過；Production audit
  無 high severity。下一步是完成會員／付款 UI 剩餘改版、Owner 真人登入後上傳該 Excel 預覽，
  再重跑 Preview 驗收與 Production deploy；目前 Production 未部署本批變更。

## 2026-08-02 改版驗收更新

- 會員資料頁已改為新版暖白／服務色版面，保留姓／名分欄、生日選填、成功後返回流程，
  並補上 `aria-live`、`min-h-dvh` 與 44px 控制項。
- 付款回報頁已改為新版服務色表面與按鈕；仍可複選多張付款請求，且只在付款回報時
  選擇會員匯款帳戶與 Astera 收款帳戶。
- ProductWorkspace 的父層改為較寬的 responsive breakpoint，Campaign 三欄改為在寬螢幕
  才啟用，雙語 label 加入換行約束，修正 Default Price／Original Cost／Sale Type／
  Campaign Status 等欄位黏連。
- 舊 Next.js server process 曾造成 `/brand` 500 與 `/checkout` 404 假象；已停止舊程序，
  以最新程式重跑公開驗收：桌機／Pixel 7 14 passed／2 skipped。
- 本回合完成驗證：TypeScript、ESLint、Unit 39 files／178 tests、Firestore／Storage Rules
  31 tests、Build 通過；公開 Playwright 14 passed／2 skipped，Firebase Emulator Playwright
  31 passed／3 skipped（含桌機／Pixel 7 會員、Owner、商品圖片、付款與取消流程）。尚未完成：
  Owner Workspace 全面 Token 遷移、Production smoke、Preview 真人上傳／對帳與正式部署。

## 2026-08-03 Preview／Production deployment handoff

- Preview 已部署：`https://astera-isf54e52l-astera-oms.vercel.app`。
- Production 已部署：`https://astera-icaqtdzea-astera-oms.vercel.app`，正式 alias 為
  `https://astera-oms.vercel.app`。
- Production smoke 使用 `--product-id prod_002` 通過 5/5；公開 Playwright 桌機／Pixel 7
  通過 14 passed／2 skipped；主要 Production 路由人工 DOM 檢查通過。
- 部署建置仍顯示 Vercel Node `24.15.0` 與 repository engine `>=24.18.0 <25` 的警告，
  尚未阻擋本次部署，但正式長期運行前應在 Vercel 設定 Node 24.18+。
- 已用 `vercel project inspect astera-oms` 確認 Vercel Project Node.js Version 為 `24.x`；
  CLI／Project Settings 只能選 major 版本，無法直接指定 `24.18.0`。目前保留 repository
  的 `>=24.18.0 <25` 約束，等待 Vercel 24.x build image 更新至 24.18+ 後重新部署。
- 待外部驗收：Google 真人登入、會員帳戶新增／封存、付款回報、Owner 圖片／台新檔案預覽、
  Resend 實際寄達；勿將目前的匿名 smoke 通過視為完整金流驗收。

## 2026-08-03 銀行帳號 HMAC／退款計畫執行狀態

- Task 1 完成：帳號正規化、Cloud KMS HMAC 介面與版本驗證；focused Unit 9/9、TypeScript 通過；commits `db51c0f`、`87f18e8`、`b93e447`。
- Task 2 完成：會員帳戶不再由新 API 保存完整帳號，保存 bankCode／last5／HMAC／keyVersion；末五碼碰撞非阻擋並通知 Owner；封存 API 納入版本；focused Unit 10/10、完整 Unit 188、TypeScript、ESLint 通過；commits `cd2660c`、`20a7b9e`。
- Task 3 程式已完成於工作樹：付款保存 Server 權威指紋快照、拒絕跨會員／inactive 帳戶、忽略 client identity、舊付款回傳 `manualFingerprintReviewRequired`。驗證：Unit 7/7、TypeScript、ESLint、Firebase Emulator Playwright desktop/mobile 2/2 通過。
- Task 3 尚未 commit：相關修改與先前未提交的 multi-allocation、receiving-account、timestamp、shipping 與測試基線交錯；兩次獨立整合均判定無法在不猜測重寫的情況下安全分離。`git diff --cached` 為空，所有工作樹修改完整保留。
- 精確下一步：由使用者決定是否授權把直接相關的既有付款基線建立一個 baseline commit；若不授權，改為繼續在工作樹完成 Task 4–8，最後再對整組付款基線做一次人工審核與合併提交。

## 2026-08-04 銀行帳號退款安全流程執行交接

- 使用者已選擇分任務執行，並授權方案 A；付款相關基線已安全提交於 `96dbc7e`，未 stage 其他既有工作樹修改。
- Task 3 已完成並通過獨立複審：`96dbc7e..39d19b2`。付款回報改用 Server 權威會員帳戶快照；前端提供的末五碼不再作為身份來源；缺少舊指紋時標記人工覆核；Owner 介面優先顯示快照末五碼並保留歷史 fallback。Unit 8/8、Rules 31/31、TypeScript、focused lint 通過。
- Task 4 第一版 `9433a77` 曾被獨立審查指出 2 Critical／5 Important／2 Minor；修正已提交 `8dce514`。修正涵蓋 Firestore transaction 讀寫順序、delete sentinel、密文生命週期競態、一般會員訂單 API 私密欄位清除、既有 collection 約束、付款來源隔離、14 天邊界與 immutable mismatch audit。修正證據：focused 28/28、TypeScript、targeted ESLint、production build 通過；完整 Unit 為 217/218，唯一為既有舊名稱 source-text assertion。
- Task 4 尚未完成正式 gate：`review-package` 產生 `9433a77..8dce514` 差異包時遭執行環境使用上限拒絕，未能完成修正後獨立複審。這不是程式測試失敗；在複審前不得宣稱退款流程完成，也不得開始 Task 5。
- 精確接續步驟：待執行環境允許後，執行 SDD review-package（plan `docs/superpowers/plans/2026-08-03-member-bank-account-refund-implementation.md`，base `9433a77`，head `8dce514`），再以 `task-4-review.md` 和差異包派送 scoped re-review。若複審仍有 Critical／Important，依 Task 4 fix loop 繼續；若通過，更新 ledger／plan 並開始 Task 5。
- 既有未提交的 `AGENTS.md` 與其他使用者檔案仍保留，未納入上述 commit。暫不執行 Production 退款真人驗收，直到 Task 4 gate 通過。

### 2026-08-04 Task 4 最終複審通過

- 舊付款帳戶 source-contract 測試已於 `dd2d8e5` 對齊 `buildMemberPaymentAccountIdentitySnapshot`；完整 Unit 42 files／218 tests 通過，production 未變。
- Task 4 round 2 `fcbd9f6` 新增同一 OrderItem 依不同付款來源建立多張退款申請：每張金額由 Server 依來源 allocation 與 item 剩餘退款額推導，禁止同來源重複／超額；Adjustment 綁定正確 `targetPaymentId`，累積核准滿 item 金額後才 cancelled／refunded。
- Task 4 round 3 `3e09b8c` 修正多來源密文清理：最後來源使訂單 refunded 時，同一 Firestore transaction 刪除當前與所有相關來源申請的 `refundAccountCiphertext`、`refundEncryptionKeyVersion`、`refundAccountExpiresAt`；無 vault 文件不寫入，所有 reads 先於 writes，reverse 不恢復欄位。
- 最終 scoped re-review：APPROVED，Critical 0、Important 0。最新驗證證據：focused 3 files／29 tests、完整 Unit 42 files／219 tests、TypeScript、targeted ESLint、diff check 通過。
- Task 4 正式完成。Deferred Minor 仍保留：超限 mismatch 請求目前會先做 KMS 驗證／scope hash，再回 429；Task 5／後續 rate-limit 批次需加入 KMS 前置限流，以避免不必要的 KMS 成本。
- 精確下一步：從計畫 Task 5 開始實作 Owner 到期提醒、排程清理／監控與退款帳號重新驗證營運流程；繼續沿用不新增 Collection、完整帳號不落盤與 custom claim 權限約束。

### 2026-08-04 Task 5 Rules／通知／限流安全完成

- Task 5 commits：`22db1c5`、`7433ec3`；最終 scoped re-review APPROVED（Critical 0、Important 0）。
- Firestore Rules 現在拒絕所有 Client SDK 直接存取 `cancellationRequests`、`memberPaymentAccounts`、`notificationEvents`、`auditLogs`；Owner／Member 顯示改用受保護 Server API。Rules 驗證為 2 files／32 tests，並保留 `productsPublic` 公開讀。
- Owner `AuditLogBoard` 改走 `/api/workspace/audit-logs` strict allowlist；不回傳 scope hash、expiry、provider raw error、ciphertext、fingerprint、key/version。通知 retry 回應也只回安全 outcome，不回 provider message ID／raw error。
- 退款驗證新增 KMS 前 transaction reservation：並行超限請求不會執行 HMAC／KMS／加密；成功同交易刪 reservation，mismatch 寫安全 limiter／immutable audit，60 秒 pending 殘留可機會式清除。
- 驗證：focused Unit 4 files／43 tests、完整 Unit 43 files／242 tests、TypeScript、zero-warning ESLint 通過。
- Production 必要外部設定：新增穩定 `REFUND_RATE_LIMIT_HASH_SECRET`，至少 32 字元、以 Vercel secret／等效 Secret Manager 保存。更換會使目前 15 分鐘的 rate-limit scope hash 無法對照，應在無 active 退款驗證窗口時才輪替。
- 精確下一步：Task 6 將此 secret 加入 production env check／Deployment SOP，同時完成 Cloud KMS IAM、key version／月度治理報告、測試與獨立複審。

### 2026-08-04 Task 6 baseline 決策已解除

- 已提交 `81cb342`：`scripts/migrate-member-account-fingerprints.mjs`、`scripts/cleanup-refund-account-temp.mjs`、`scripts/report-fingerprint-key-usage.mjs`、`tests/unit/fingerprintMigration.test.ts`。
- 腳本安全契約：migration 預設 dry-run；mutation 必須 `--apply`、`--project` 與相同 `--confirm-project`、先完成 ignored local backup；payment snapshots 不重寫、缺指紋只列 manual review；cleanup 僅刪 vault 三欄並標記 `needsReverification`；monthly key report 不自動停用 key。所有 CLI stdout 僅輸出 ID／status／key version／統計，不輸出完整帳號、末五碼、HMAC fingerprint 或 canonical input。
- 已完成的本地驗證：focused Unit 2 files／26 tests、完整 Unit 44 files／252 tests、TypeScript、ESLint。
- 使用者已選方案 A；`cbf9648` 已正式提交 `scripts/check-production-env.mjs` 與 `tests/unit/productionScripts.test.ts` 的完整 baseline，舊版本控制阻塞不再成立。
- Task 6 現正處理 independent review findings；docs 14／16／17 保留未 stage，等待文件整合批次。Task 7 尚未開始。

### 2026-08-04 Task 6 migration／cleanup／key governance 交接

- 新增 `scripts/migrate-member-account-fingerprints.mjs`。預設 dry-run；project 必須 exact repeat。
  Mutation 另需 `--apply`，且先寫 `.local-backups/` ignored backup，再更新
  `memberPaymentAccounts`。歷史 `payments` 永不改寫。
- 有舊完整帳號的會員帳戶才可產生最新 HMAC 並在 apply 移除舊明文字段；last-five-only 舊資料標
  `needsReverification`。不得從舊 fingerprint 重算新版；只有 authenticated member re-entry
  可重新產生永久 fingerprint。
- Migration stdout 白名單只含 ID、status／operation、keyVersion 與統計；不含完整帳號、
  last five、HMAC 或 canonical input。備份路徑也不含帳號資料。
- 新增 `scripts/cleanup-refund-account-temp.mjs`：exact project confirmation 後清除已到期的三個
  ciphertext fields，pending request 改 `needsReverification`，不觸碰 unrelated plaintext。
  Task 4 reveal／review 的 request-time expiry guard 繼續作 defense in depth。
- 新增 `scripts/report-fingerprint-key-usage.mjs`：每個 key version 的會員／付款引用數、
  earliest/latest、unreferenced evaluation status 與 unclassified document IDs；永不自動停用 key。
- 清理與報告失敗會嘗試在既有 `notificationEvents` 寫入 `owner.jobFailed`，不新增 Collection；
  外部部署仍須 Cloud Monitoring 補上 job 非 2xx／逾時告警。
- Production env check 已加入 `GCP_KMS_HMAC_KEY_NAME`、正整數
  `GCP_KMS_HMAC_KEY_VERSION`、`GCP_KMS_REFUND_KEY_NAME` 與至少 32 字元的
  `REFUND_RATE_LIMIT_HASH_SECRET`；WIF identity settings 持續為 required。
- 外部尚待執行：以 Scheduler 專用 OIDC service account 部署 private Cloud Run／2nd-gen
  endpoint（每日 cleanup、每月 key report），設定 exact audience／`roles/run.invoker`／最小 KMS
  與 Firestore IAM，再在 Owner 核准維護窗口先跑 Production dry-run。此 Task 未存取或修改
  Production data，也未執行任何外部部署。
- Rollback：停止 job、保留安全報告、依 ignored backup 的 document IDs 只回復本次 migration
  欄位，重跑 dry-run／Rules／API／退款稽核；不可回寫 immutable payment snapshots。舊 key
  version 在零引用盤點及人工核准前必須保留。

### 2026-08-04 Task 6 結案／Task 7 起點

- Task 6 已以 commits `81cb342..135a42e` 結案，三輪 scoped re-review 最終 APPROVED（Critical 0、
  Important 0、Minor 0）。本機驗證為完整 Unit 45 files／291 tests、TypeScript、完整 ESLint。
- 防呆定案：合法 legacy identity 才補 `verified`，不覆寫 lifecycle；KMS-derived identity 與
  stored expected fingerprint 皆採嚴格 canonical HMAC-SHA-256 Base64 驗證，未知／畸形資料 fail-closed。
- 下一個精確步驟：執行 Task 7，使用 Emulator seed 的 owner／helper／member A／member B 完成
  銀行帳戶綁定、重複事件、付款快照、退款 HMAC、14 天 vault 刪除與角色權限 E2E。

### 2026-08-06／09 Task 7／8 最終交接

Task 1–7 已完成並通過逐批 scoped review：

| Task | Commit range | 結果 |
| --- | --- | --- |
| 1 | `db51c0f..b93e447` | 正規化與 KMS HMAC identity。 |
| 2 | `cd2660c..20a7b9e` | 會員永久資料只留 bank code、last five、fingerprint、key version；碰撞通知但不阻擋。 |
| 3 | `96dbc7e..39d19b2`（另含 `dd2d8e5` contract test） | Server 權威付款 snapshot；legacy 缺指紋走人工覆核。 |
| 4 | `9433a77..3e09b8c` | 14 天退款 vault、多來源退款、immutable adjustment／audit、完成退款刪除相關 vault。 |
| 5 | `22db1c5..7433ec3` | 私密資料 Server API、Client Rules deny、KMS 前限流 reservation、安全 Owner alert。 |
| 6 | `81cb342..135a42e` | migration／cleanup／key report、KMS env gate、canonical fingerprint fail-closed。 |
| 7 | `572e53f..fc9ecdd` | 受保護 API Emulator E2E 與角色拒絕；複審 APPROVED。 |

Task 7 exact Emulator E2E 證據為 36 passed／8 expected skipped／0 failed。
Emulator KMS 必須同時具有 Playwright Emulator flag 及
`demo-astera-oms` project；任一條件不符就拒絕啟用，Production 保持 Cloud KMS。

Task 7 後的最終安全修正：`4999e4c` 關閉 final broad review I1–I4、`6bf9f9d` 保留
mixed cancellation replay identity、`a276aa0` 將 legacy cancellation replay fail-closed。
最終 focused re-review APPROVED（Critical 0、Important 0、Minor 0）。

Task 8 在 2026-08-09 的 final fresh verification：

- `npm run typecheck`：exit 0。
- `npm run lint`：exit 0。
- `npm run test:unit`：exit 0，46 files／310 tests。
- `npm run build`：sandbox-external fresh rerun exit 0。
- `npm run firebase:rules:test`：exit 0，32 tests。
- `npm run test:e2e:emulated`：exit 0，36 passed／8 expected skipped／0 failed。
- `npm run check:secrets`：exit 0，未發現明顯 secrets。
- `npm run audit:production`：exit 0，無 high／critical vulnerabilities。NanoID 已 override 至
  `3.3.17`；ExcelJS transitive UUID 尚有 2 項 moderate advisories，強制修正將造成
  ExcelJS breaking／downgrade，列為非阻擋 dependency follow-up。
- 本次 stdout 未輸出完整帳號、HMAC fingerprint 或 canonical input。

因此 Task 8 本機驗證 release gate 已完成。尚未代表 Production 已發布；下一個精確步驟：

1. Production KMS／WIF IAM 與 stable `REFUND_RATE_LIMIT_HASH_SECRET` 檢查。
2. Migration dry-run、ignored local backup、人工核對與 exact-project apply。
3. 部署每日 cleanup、每月 key report、Scheduler OIDC 與 Monitoring failure alerts。
4. Preview 真人會員綁定／付款／退款驗收，最後才允許 Production rollout。

文件狀態：`docs/10_TestPlan.md`、`docs/11_Changelog.md`、
`docs/16_MVPCompletionPlan.md`、`docs/17_ProjectHandoff.md` 在 Task 8 前已包含大量既有未提交
使用者修改。本批只追加此交接段落，未覆寫既有內容；如無法安全隔離 staging，不建立混合
documentation commit。
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

## 2026-08-11 Payment Report submit-action contrast repair

- A subsequent signed-in Preview screenshot established that the submit action was
  present but visually invisible: its white text appeared on the white form area.
  Investigation confirmed that `PaymentRequestsBoard` used an undefined
  `bg-astera-brand` theme utility. This is a presentation defect; no payment record
  was created and no account or order data was changed.
- The button now uses the approved Astera brand color with explicit hover and
  disabled states. A red/green source-contract regression test prevents returning
  to an unresolved token for this financial action.
- Local verification is green: Unit 44 files / 381 tests, TypeScript, ESLint,
  Build, and diff check. Exact handoff: deploy this commit to the stable Preview,
  refresh `/payments`, and verify the purple button is visible. Do not submit the
  already-prepared test-only Payment without a current explicit confirmation,
  because that creates a `pendingReview` financial record.

## 2026-08-11 Preview member Payment Report handoff

- The member manually submitted one expressly approved test-only Payment Report.
  The stable Preview returned a visible success message for one report and cleared
  the form. Read-only inspection confirmed that no second submit was triggered.
- The related member-facing request remains unpaid pending Owner review; this does
  not indicate submission failure. The next verification target is the separate
  Payment record in the Owner workspace with status `pendingReview`.
- No sensitive values or internal identifiers are included in this handoff. Resume
  by signing in as the Owner test account, opening the Preview payment workspace,
  and reading the newest test-only report. Obtain a fresh explicit confirmation
  immediately before confirming, reversing, or otherwise mutating financial state.

## 2026-08-11 Member account payer-name linkage handoff

- Confirmed requirement implemented: every new member payment account records its
  payer name; Payment Reports choose the verified account rather than accepting a
  separately typed last-five value or payer name. Selecting an account controls both
  read-only display values together.
- Compatibility path: a verified legacy account that lacks a payer name is returned
  with `needsPayerName`, excluded from usable Payment choices, and can receive its
  name exactly once through the member-owned protected API. No full account re-entry
  is required and existing identity fields remain unchanged.
- Server trust boundary: new Payments persist the payer name from the selected
  `memberPaymentAccounts` record in the immutable source snapshot. Client-supplied
  payer or account fragments are not authoritative. Firestore Client SDK access to
  the collection remains denied, including direct writes containing `payerName`.
- Commits completed before this handoff: `7301e90`, `8648fae`, `6a40bbd`,
  `cccb346`, and `dc6e6f4`. Task 6 test/docs changes are the current uncommitted
  batch pending its final review commit.
- Verification evidence: 27/27 focused; 45 Unit files / 395 tests; 2 Rules files /
  32 tests; 35 emulated Playwright passed with 9 intentional project skips; 16
  regular Playwright passed with 28 Emulator-only skips; TypeScript, ESLint, Next
  build (39 routes), secret scan, production audit (0 vulnerabilities), and diff
  check passed.
- Deployment status: not pushed and not deployed in this batch; Production unchanged.
  Next exact step is final branch-diff review, Task 6 commit, then obtain authorization
  to push for a Preview-only deployment. Manual Preview acceptance must cover legacy
  completion and two-account switching; creating or confirming another Payment still
  requires separate action-time authorization.

## 2026-08-11 `codex/mvp-completion` local merge checkpoint

- Base branch: `codex/mvp-completion`.
- Integrated branch: `codex/production-security-worker` through a local merge.
- Conflict resolution retained the Production Security Worker, WIF/KMS environment
  contracts, member payment-account payer-name linkage, current storefront/cart UI,
  authoritative product projection sync, and both branches' operational records.
- One stale E2E contract was corrected after the merged run: Pixel 7 workspace tests
  now assert `Owner 營運工作區` and the current Chinese-first bilingual navigation.
  The failure was limited to obsolete test copy; authentication and page rendering
  were healthy in the trace.
- Final pre-commit evidence on the merged tree:
  - Unit: 50 files / 417 tests passed.
  - Firestore + Storage Rules: 2 files / 32 tests passed.
  - TypeScript and ESLint passed.
  - Next production build passed with 42 routes.
  - Regular Playwright: 18 passed / 28 Emulator-only skipped.
  - Emulator Playwright: 37 passed / 9 intentional skips.
  - Secret scan passed; production dependency audit found 0 vulnerabilities.
- External state: no push, Preview deployment, Production deployment, Firebase
  mutation, Vercel mutation, or financial-data mutation occurred during this merge.
- Next exact external step, only after separate authorization: push
  `codex/mvp-completion` and let the Git-integrated Preview run before any Production
  release decision.

## 2026-08-11 Git push and merged Preview acceptance handoff

- The unsafe-merge condition is closed. `codex/mvp-completion` is clean and was
  pushed to `astera-blip/Astera-OMS`; local and remote both resolved to `b79bd98`.
  The integrated `codex/production-security-worker` worktree and local branch were
  removed only after ancestor and clean-worktree checks.
- Vercel Git integration built a Ready Preview for the merged commit. The existing
  Firebase/OAuth-authorized stable Preview alias was moved from the earlier feature
  deployment to this merged Ready deployment. No Production deployment occurred.
- CLI anonymous smoke receives Vercel SSO `302` by design because Preview Protection
  is enabled. Verification therefore used the already-authorized in-app browser
  session. The six public routes loaded without a Next.js error page, and the empty
  cart showed disabled checkout controls.
- The signed-in member session persisted across navigation. The account page showed
  two incomplete legacy re-verification records and one masked bank-code `000`
  account requiring one-time payer-name completion. The payment page correctly
  exposed no usable member-account selector until that completion occurs; account
  fragments and payer name remain read-only there.
- Current handoff point: obtain the exact payer name and explicit approval to save it
  once on the clearly test-only bank-code `000` account. After saving, revisit
  `/payments` and verify account selection, masked last-five linkage, and payer-name
  linkage without submitting a financial report. A Payment submission still needs
  its own action-time authorization.

## 2026-08-11 Preview payer-name completion result

- The user explicitly approved a one-time payer-name write for the existing clearly
  test-only bank-code `000` account. `測試專用匯款人` was saved successfully; the
  account page confirmed it is now available for Payment Reports.
- Read-only follow-up on `/payments` confirmed the account appears in the member
  selector. Selecting it supplies the masked last five digits and payer name from
  the account record. Both rendered fields have the DOM `readOnly` property set.
- No Payment Report was submitted and no Order, PaymentRequest, Payment,
  Cancellation, refund, Owner action, Vercel Production deployment, or Firebase
  configuration was changed in this acceptance step.
- Remaining optional acceptance for this feature: add a separately authorised
  second synthetic account and verify switching the selector updates both fields.
  Any account creation or Payment submission requires its own action-time approval.

## 2026-08-11 Second synthetic account blocked by required profile

- Explicit approval was received to add a second synthetic payment account. Before
  the account form became available, the existing profile-completion gate rendered
  because this test member has no social ID or phone. No second account was created
  and no direct API bypass was used.
- The already verified first account remains visible on `/payments`; no Payment was
  submitted. This checkpoint changed no financial record.
- To resume, obtain explicit approval to preserve the existing first/last name and
  save `測試專用會員` as the social ID plus `0900000000` as the synthetic phone,
  leaving birthday blank. After that profile write, create the previously approved
  bank-code `001` synthetic account and verify two-account switching without
  submitting a Payment Report.

## 2026-08-11 Second account and selector-switching result

- The profile values were approved but were not written because a fresh signed-in
  account-page load succeeded without the completion form. No unnecessary member
  profile mutation was performed.
- The separately approved bank-code `001` synthetic account was created. The UI
  cleared the full-account field after the protected API returned success and now
  reports two usable accounts. No full account number is recorded in this handoff.
- Payment Report selector acceptance passed for both accounts. Each selection
  updated the masked last-five and payer-name fields to that account's values, and
  both fields were verified as DOM `readOnly`. No Payment was submitted.
- A test-first two-line guard repair prevents a profile read error from being treated
  as a confirmed missing profile. The regression failed before the repair and passed
  afterward. Full Unit 418/418, Rules 32/32, TypeScript, and ESLint passed.
- Local Next compilation completed, then the managed sandbox blocked a child process
  with `spawn EPERM`; two approved-mode attempts could not start because the approval
  review timed out. Push the code and require a Ready Git-integrated Preview before
  marking Build/Preview verification complete.

## 2026-08-11 Profile guard repair completed

- Commit `1c10bee` was pushed and its Git-integrated Vercel Preview reached Ready.
  The authorized stable Preview alias now targets that deployment; Production was
  not deployed.
- Deployed route acceptance confirmed `/account/bank-accounts` no longer diverted
  during the verified session and loaded both usable test accounts. Deployed payment
  account switching again produced the correct account-specific masked last-five and
  payer-name values, both read-only. No Payment was submitted.
- Final verification: 418 Unit tests, 32 Rules tests, TypeScript, ESLint, Vercel
  Preview Build, 18 regular Playwright tests, 37 Emulator Playwright tests, secret
  scan, and production dependency audit all passed. The remaining 28 regular and 9
  emulated cases were intentional environment/project skips.

## 2026-08-11 Production read-only inventory and next external gate

- Firebase project readback confirms Development and Production are active with
  default Storage buckets; Production Storage is Regional `ASIA-EAST1`.
- Production product projection is healthy: 2 internal / 2 public / no audit issue,
  with one published and one archived public record. Explicit-product Production
  smoke passes 5/5 against `https://astera-oms.vercel.app`.
- The no-ID smoke path was a test-tool false negative, not missing Production data.
  Because the catalog hydrates on the Client, the CLI now rejects a missing
  `--product-id` with `product_id_required`; current runbooks include the required
  published Product ID argument. Focused regression is green.
- Vercel inspection: Production is Ready on its 2026-08-03 deployment; the stable
  Preview alias resolves to the Ready 2026-08-11 merged Preview. No deployment,
  promotion, alias, environment, Firebase, payment, or refund mutation occurred.
- DNS remains unresolved for the root, `www`, and Resend sender subdomain. Direct
  Firebase Rules release-metadata read returned 403 for the current gcloud account;
  do not reinterpret this as a Rules failure or redeploy blindly. Prior successful
  combined Firestore/Storage deployment is still the latest release evidence.
- Next exact action: sign in as Owner on stable Preview and only read the newest
  clearly test-only Payment to confirm `pendingReview`. A fresh, action-time approval
  is mandatory before confirm/reverse/refund or vault mutations. After Preview
  financial acceptance, complete DNS/Resend, real receiving account, Product image,
  Production promotion, strict runtime checks, and desktop/Pixel 7/physical-phone
  acceptance.
- Current smoke-tool batch verification: focused 26/26; full Unit 50 files / 419
  tests; TypeScript; ESLint; Next Build with 42 routes; diff check; secret scan;
  production audit with 0 vulnerabilities; explicit-product Production smoke 5/5.

## 2026-08-11 Latest Preview Ready; Owner session required

- `694257b` was pushed with the verified smoke-tool/runbook repair. Vercel did not
  create a deployment because that commit author is outside the Project team; the
  existing documented workaround was used without changing files. Empty
  team-authored commit `44cc5b1` triggered a new Git-integrated Preview.
- The resulting deployment is Ready and the existing stable, authorized Preview
  alias points to it. Production remains unchanged.
- Browser acceptance retained the signed-in Member session, showed the public
  published Product/Campaign, and correctly denied `/workspace` with
  `需要後台權限`. The current session is not an Owner session.
- Next exact step: the user signs into the stable Preview with the Owner custom-claim
  account. Then perform only a read-only lookup of the newest clearly test-only
  `pendingReview` Payment. Obtain a fresh action-time authorization immediately
  before any confirm, reverse, cancellation-review, refund, reveal, or vault write.

## 2026-08-11 Preview test payment confirmation

- The Owner custom-claim session was verified on the stable Preview. A read-only
  lookup identified the explicitly test-only Payment for `NT$ 520`, masked account
  suffix `24856`, and payer label `測試專用 Task7` in `pendingReview`.
- After fresh action-time approval, only that Payment was selected and confirmed
  with a test-only reconciliation note. The Payment now renders `confirmed`; the
  linked Order and OrderItem both render `paid`, and the reported/receivable amount
  remains `NT$ 520`.
- The post-transaction notification attempt failed and the UI retained a sanitized
  delivery-failure status. The financial transaction was not rolled back, which
  matches the required notification semantics. Resend domain/API-key delivery is
  still an external launch gate.
- A direct full-page navigation to `/workspace/orders` briefly rendered the role
  gate once. Returning to `/workspace/payments` retained the Owner session, and a
  normal in-app navigation to Orders then loaded successfully. This is not currently
  reproducible as a route-specific authorization defect; keep it in the next browser
  regression pass as a transient auth/profile-loading observation.
- No reverse, cancellation review, refund comparison, refund-account reveal, vault
  deletion, Production deployment, or unrelated Payment action was performed.
- Exact continuation: obtain a new action-time approval before reversing this test
  Payment or creating/approving a paid cancellation. Separately configure and verify
  Resend before treating notification delivery as launch-ready.

## 2026-08-11 Preview test payment reversal

- Fresh action-time approval was received to reverse only the previously confirmed
  `測試專用 Task7` Payment for `NT$ 520` and masked suffix `24856`.
- The Owner selected that exact Payment and submitted the test-only reversal reason
  `測試專用：Preview 付款撤銷驗收`. The Payment now renders `reversed`; both confirm
  and reverse controls are disabled for that terminal Payment state.
- The UI confirms that the reversal created a negative adjustment and an Audit Log.
  The dedicated Audit Log page contains action `payment.reversed` and the approved
  test-only reason. No account number or other sensitive value was written to the
  reason or this handoff.
- The linked Order and OrderItem were recalculated from `paid` back to
  `awaitingPayment`, while the original Payment history remained present. This
  validates the required non-destructive reversal semantics on the stable Preview.
- Resend notification delivery still failed with only a sanitized UI message; the
  failure did not roll back the reversal. Email remains an external launch blocker.
- No cancellation request, refund match/mismatch, refund-account reveal, refund
  approval, vault deletion, or Production deployment was performed.
- Exact continuation: create or identify a separately labelled paid-cancellation
  test case, then obtain fresh approval immediately before its refund-related write.
  Do not reuse or mutate unrelated historical records.

## 2026-08-11 Paid-cancellation UI root cause and repair

- A separate safe case was identified: `AST-20260811-0001`, recipient
  `測試專用會員`, total `NT$ 520`. A new Payment Report was submitted from the
  account selector and confirmed by Owner; its Payment reached `confirmed` and the
  Order reached `paid`. Notification delivery again failed without rolling back the
  financial transaction.
- Browser acceptance then exposed a real frontend defect: the Order detail UI only
  allowed `awaitingPayment` items to be selected and filtered `paid` items out again
  before POST. The Server already supports paid cancellation with refund-account
  verification, so this was a client integration gap rather than a data-state issue.
- Test-first repair now allows `awaitingPayment` and `paid` items, returns only a
  sanitized list of the member's confirmed Payments from the protected Order-detail
  API, and supplies `targetPaymentId`, bank code, and the one-time full refund account
  only to the protected cancellation POST. Fingerprints and full account numbers are
  never returned by the Order-detail API.
- The paid-item form explains the 14-day maximum encrypted retention, masks the
  account field, handles mismatch/rate-limit/reverification errors in Chinese, and
  clears the full account state after a successful request.
- Red evidence: the new API/UI regressions failed because `confirmedPayments` and
  paid-item controls were absent. Green evidence: focused 12/12, full Unit 420/420,
  TypeScript, ESLint, and Next Build with 42 routes passed.
- The code is not yet on the stable Preview at this checkpoint. After push and a
  Ready Vercel Preview, return to `AST-20260811-0001`. The member must personally
  enter the exact original full account for the selected confirmed Payment; do not
  place that value in chat, logs, documentation, screenshots, or test fixtures.

## 2026-08-11 Paid-cancellation Preview deployment checkpoint

- Commit `d543094` was pushed, its Vercel Preview reached Ready, and the existing
  Firebase-authorized stable Preview alias was moved to that deployment. Production
  was not deployed.
- Deployed browser verification on `AST-20260811-0001` confirms the paid item is
  checked and enabled, the cancel button is enabled, and the protected Order API
  supplies exactly one masked confirmed-Payment option for the new test Payment.
- The UI shows the expected bank code, masked last five, payer label, 14-day
  retention notice, and an empty `type=password` / `autocomplete=off` full-account
  field. No full account was entered and no cancellation request was submitted.
- Exact continuation: the user personally enters the original full account directly
  in the Preview password field and reports readiness without copying the value into
  chat. Obtain/confirm action-time approval immediately before submitting the paid
  cancellation request.

## 2026-08-11 Payment-report duplicate root cause and repair

- Read-only Owner inspection confirmed that the member report did persist, but two
  `pendingReview` Payment documents existed for the same test intent. Neither record
  was confirmed, rejected, deleted, or otherwise changed in this repair batch.
- Root cause: `POST /api/payments` allocated random document IDs and accepted no
  idempotency key; the member page also lacked a persistent submitted-report list,
  so a successful write could still look like an unpaid request.
- Commits `4f2f9a4`, `3efde34`, `29186ee`, `0899c03`, and `0fe4cff` implement opaque
  deterministic IDs, replay/conflict semantics, safe member history, synchronous UI
  double-submit protection, and audited Owner rejection.
- Fresh verification: TypeScript pass; ESLint pass; Unit 55 files／444 tests; Rules
  2 files／32 tests; Next Build 42 routes; regular Playwright 18 passed／30 expected
  emulator-only skips; Emulator Playwright 38 passed／10 expected project skips;
  secret scan pass; production dependency audit 0 vulnerabilities.
- The new Emulator UI case fires two synchronous clicks, observes exactly one POST,
  sees `已回報／待確認`, reloads, and sees the same persistent status. The API flow
  also rejects a separate test report and verifies the immutable Audit Log.
- Exact continuation: commit and push the final test/document changes, deploy only
  Preview, then perform authenticated member and Owner acceptance. Before rejecting
  either existing duplicate Preview Payment, obtain fresh action-time approval and
  name the exact Payment ID to keep and the exact Payment ID to reject.

### Preview Ready and read-only Owner acceptance

- GitHub branch `codex/mvp-completion` was pushed through `e844505`. Vercel Preview
  `dpl_7Y3oLMmmBExgZ1Y9AwpLYUoTaif1` reached Ready; the existing Firebase-authorized
  stable alias now points to that deployment. Production was not deployed.
- The retained Owner custom-claim session opened the deployed payment workspace.
  The selected pending report shows `處理理由`, `確認匯款`, and the new
  `拒絕回報`; `撤銷確認` is disabled as expected. No button was pressed.
- With explicit action-time approval, the earlier report
  `lA8Fje6lU2vAqLvdp0VN` was retained as `pendingReview`; only the later duplicate
  `pdfwANGEnxaldM6iM3Q7` was rejected with reason
  `測試專用：重複付款回報`. Neither report was confirmed or deleted.
- The deployed Preview displayed the rejection success status. A separate read-only
  production Firestore verification confirmed the retained/rejected states and the
  immutable `audit_reject_pdfwANGEnxaldM6iM3Q7` record with action
  `payment.rejected`, the exact target ID, and the exact safe reason.

## 2026-08-11 Existing `/` guest storefront redesign

- The real `src/app/page.tsx` was rebuilt as the public Astera curated storefront;
  no guest-home, new-home, static mockup, or fake product page was created.
- `FeaturedProductsBoard` still reads published `productsPublic` through
  `listPublicProducts` and reuses `rankFeaturedProducts`, `featuredCampaign`,
  `getDefaultVariant`, `getEffectiveCatalogPriceTwd`, and `ProductCoverImage`.
- The shared Header now displays `ASTERA`, buyer navigation, cart, and the reused
  `AccountActions`; Root metadata is buyer-facing. Shared Footer behavior is unchanged.
- Guest add-to-cart stores only product／Variant／Campaign IDs and quantity in session
  storage, starts the existing Firebase redirect login, respects first-profile completion,
  then revalidates current catalog state and writes via `/api/cart`.
- Responsive Emulator acceptance passed at 390px (2 columns), 768px (2 columns), and
  1365px (4 columns) without horizontal overflow; signed-in continuation also passed.
- Verification: TypeScript pass; ESLint pass; Unit 56 files／450 tests; Build 42 routes;
  regular public Playwright 16 passed／10 expected Emulator-only skips; focused Emulator
  Playwright 10 passed; Rules 2 files／32 tests. No Collection, Rules, Checkout, Order,
  or pricing logic changed. Implementation commit: `54a8b03`.
- Deployment state at the time of this historical entry: local branch only. The
  later 2026-08-12 Production deployment is recorded immediately below.

## 2026-08-12 Production storefront deployment

- The completed public storefront redesign was merged locally into `main`
  (`189b3c8`). Commit `cbb8dc1` makes the payer-name API test use the same
  mock-before-static-import pattern as related route tests, eliminating the
  full-suite parallel import timeout without changing production behavior.
- Vercel Production deployment `dpl_8FPCjc99CzRMXrfFo6GEhTLpsmek` reached
  Ready at `https://astera-llgfemo41-astera-oms.vercel.app` and was aliased to
  `https://astera-oms.vercel.app`.
- Release verification: Unit 56 files／450 tests; Firestore／Storage Rules 2
  files／32 tests; TypeScript; ESLint; Next Build 42 routes; public Playwright
  16 passed／10 expected Emulator-only skips. Anonymous production smoke returned
  200 for `/`, `/products`, `/terms`, `/privacy`, and `/products/prod_002`.
- Production subsequently received the missing public Firebase auth configuration:
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=astera-oms-prod.firebaseapp.com`. Deployment
  `dpl_79zMNBTmdKrsNq58pcx6tK3fMJeH` reached Ready at
  `https://astera-1nmgtq5nv-astera-oms.vercel.app` and now owns the production
  alias. A fresh anonymous smoke returned 200 for the same five public routes.
- This fixes Firebase client initialization, but does not itself prove an interactive
  Google OAuth session. The next manual test must use the production alias and a
  real member account; do not enter passwords or OAuth codes into chat.
- Exact next step: manually test the production alias as a visitor, then repeat
  the Member and Owner flows with explicitly labelled test data. Do not treat
  custom-domain, Resend, or authenticated-flow acceptance as complete yet.

### 2026-08-12 Follow-up release-gate inventory

- Production projection audit is clean: 2 internal products and 2 public products,
  with no count, SKU, price, or private-field issue. Production secret scan found
  no obvious repository secret; `npm audit --omit=dev --audit-level=high` returned
  zero vulnerabilities.
- `asteratw.com`, `www.asteratw.com`, and `updates.asteratw.com` all remain
  unresolved. Vercel Production has `RESEND_FROM_EMAIL` and
  `RESEND_REPLY_TO_EMAIL`, but no `RESEND_API_KEY`; actual mail delivery is
  blocked until DNS and the API key are configured.
- The precise user-driven continuation is: open `https://astera-oms.vercel.app`,
  complete Google login, verify profile/cart/bank account/payment report as a
  Member, then separately sign in as Owner to verify workspace read access. Do
  not perform Payment confirmation, reversal, cancellation review, or refund
  unless a clearly-labelled test target and fresh action-time approval are given.

### 2026-08-12 Production Google-login diagnosis

- Reported symptom: a visitor selects Google while adding a recommended product,
  returns to the Production site, and is still signed out. This is not a cart or
  pending-intent failure: the user session must exist before that continuation runs.
- Root cause is the previously documented Firebase redirect-storage constraint. The
  Production Vercel variable was set to the Firebase-hosted default
  `astera-oms-prod.firebaseapp.com`, whereas the application is served from
  `astera-oms.vercel.app`. The repository already has a transparent Vercel rewrite
  for `/__/auth/:path*`, so the supported fix is a same-origin `authDomain`.
- Exact next external changes, requiring explicit authorization: append only
  `astera-oms.vercel.app` to Firebase Authentication Authorized Domains; append only
  `https://astera-oms.vercel.app/__/auth/handler` to the existing Google OAuth
  Client's Authorized redirect URIs; replace only the Production Vercel
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` with `astera-oms.vercel.app`; redeploy
  Production and manually verify session persistence. No Firebase Rules, provider,
  data, DNS, payment, order, or refund change is needed.

### 2026-08-12 Production same-origin Auth repair

- Firebase Console readback found `astera-oms.vercel.app` was already a Production
  Authorized Domain, so no Firebase-domain mutation was needed.
- Under explicit authorization, exactly one Google OAuth redirect URI was appended
  to the existing auto-created Web client:
  `https://astera-oms.vercel.app/__/auth/handler`. Existing redirect URIs, client
  identity, consent settings, and client secrets were not altered.
- Vercel Production `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` was replaced with
  `astera-oms.vercel.app` and deployment `dpl_A8uq9wwsdtzZLRWR85VzBh9wgE6a`
  reached Ready and owns `https://astera-oms.vercel.app`.
- Read-only verification: both same-origin Auth proxy paths return HTTP 200;
  clicking Google login without selecting an account reached Google account choice
  using the exact same-origin handler URI, without `redirect_uri_mismatch`.
- Exact user action: open the Production alias, select a Google account yourself,
  then reload and open `/account/profile`. Report whether the header displays the
  signed-in user. Only after session persistence passes should the guest-cart
  continuation, profile write, or other business-flow testing resume.

### 2026-08-12 Signed-in cart prevention defect

- Manual Production read-only inspection confirmed Google login now persists and a
  signed-in cart with one item loads normally.
- The inspection also found that `建立訂單` was enabled before recipient details and
  the two mandatory consent checkboxes were completed. No Order was created.
- Root cause: the client CTA condition only considered loading, cart emptiness, and
  sign-in state. The existing server API correctly validates shipping details and
  consents, but the UI did not use that validation to gate the button.
- Local fix awaiting deployment: `src/lib/order/checkout.ts` adds the tested
  `isCheckoutSubmissionReady` helper; `src/components/storefront/CartBoard.tsx`
  uses it to disable the CTA and explain the missing requirements. The change does
  not alter Collections, Firestore Rules, prices, Checkout server behavior, or
  Order creation semantics.
- Fresh evidence: focused Unit 11/11; full Unit 56 files／451 tests; TypeScript;
  ESLint; Build 42 routes; Playwright 20 passed／38 expected Emulator-only skips.
- Exact next step: obtain deployment authority, deploy this client-side fix, then
  verify in Production with an existing cart that the CTA remains disabled until
  recipient name, valid phone, terms/privacy consent, and supplement consent are
  all completed. Do not press the enabled CTA or create an Order in that check.

### 2026-08-12 Cart prevention Production verification

- Under explicit deployment authorization, Vercel Production deployment
  `https://astera-20qm8k0i8-astera-oms.vercel.app` completed and was aliased to
  `https://astera-oms.vercel.app`.
- Browser inspection after a production reload: the authenticated cart reloaded its
  existing one-item Cloud cart; blank recipient fields and both unchecked consents
  displayed `建立訂單` as disabled and showed the prerequisite message. No form was
  completed and no Order was created.
- Production anonymous smoke is green for `/`, `/products`, `/terms`, `/privacy`,
  and `/products/prod_002` (HTTP 200 each).
- Deployment warning retained for release follow-up: Vercel built using Node
  `24.15.0` while `package.json` requests `>=24.18.0 <25`; it emitted an engine
  warning but the deployment build completed. Update the Vercel Node version before
  the next production release.

### 2026-08-12 Checkout self-link Production correction

- Reported UI: `/checkout` presented `結帳步驟` and `前往結帳` despite already being
  the checkout route.
- Root cause: both routes render `CartBoard`; its checkout-navigation card was
  unconditional.
- Local commit `d5d29a9` adds a default-on `showCheckoutStep` prop and passes
  `false` only from `src/app/checkout/page.tsx`. `/cart` behavior and all business
  logic are unchanged.
- Under explicit authorization, Production deployment
  `https://astera-czlg1up5n-astera-oms.vercel.app` completed and owns
  `https://astera-oms.vercel.app`. Fresh browser inspection confirms the duplicate
  card is gone and receipt fields remain. Public production smoke: 5/5 HTTP 200.

### 2026-08-14 Role assignment implementation and deployment handoff

- `codex/role-assignment` was fast-forwarded into local `main` at `0e488c7`.
  The clean feature worktree and merged local branch were removed after merged-tree
  verification.
- Commits: `28a86c1`, `cbc3465`, `12d1da5`, `f3d3736`, `22d2817`, `2f33117`,
  `be6c94c`, `b8c70fa`, and `7b84ab6`.
- Owner can assign a completed member as Partner, Helper, or Member from the
  existing member workspace. Owner accounts remain non-editable on the website.
  Changes preserve claims, revoke refresh tokens, write `auth.role.updated` audit
  data, and create a member-only one-time notification.
- A real Emulator Timestamp regression was fixed by invoking
  `timestamp.toDate()` with its receiver intact. Client SDK access to role notices
  and role audit data is denied for anonymous, Member, Helper, Partner, and Owner.
- Evidence: TypeScript pass; ESLint pass; Unit 60 files／481 tests; Rules 2 files／33
  tests; Build 43 routes; regular Playwright 20 passed／40 expected Emulator-only
  skips; targeted desktop member/role E2E 3/3; secret scan pass; production audit
  0 vulnerabilities after nanoid 3.3.18.
- Full `npm run test:e2e:emulated` now completes: 49 passed／11 intentional
  project skips／0 failed. The initial rerun found obsolete Helper/Member mobile
  expectations; the next complete run exposed a real Pixel 7 payment-page overflow
  only after long deterministic payment IDs existed. Commit `7b84ab6` updates the
  role assertions and makes Payment／PaymentRequest identifiers wrap inside their
  cards. A focused full-data reproduction also passed 5 tests／5 expected skips.
- Final local release gates after that fix: TypeScript pass; ESLint pass; Unit
  60 files／481 tests; Rules 2 files／33 tests; Build 43 routes; secret scan pass;
  production audit 0 vulnerabilities; full Emulator Playwright 49 passed／11
  expected skips.
- GitHub `main` was pushed from `d0d9302` to `0e488c7`.
- Protected Preview `https://astera-helt9y17m-astera-oms.vercel.app` completed its
  43-route build. Vercel-bypass checks for `/`, `/products`, `/terms`, `/privacy`,
  and `/products/prod_002` all exited successfully.
- Git integration Production deployment `dpl_AF8HKGiBwk7feed6Dby33J8xA839`
  (`https://astera-7yzyqpecr-astera-oms.vercel.app`) is Ready and owns
  `https://astera-oms.vercel.app`. Explicit Production smoke passed all five
  public routes with HTTP 200.
- No Firebase Rules, Firebase data, Vercel environment variable, domain, or
  financial-data mutation was performed in this deployment batch.
- Remaining release warning: Vercel selected Node 24.15.0 although the repository
  engine range begins at 24.18.0. Build and TypeScript passed, but align the Vercel
  patch version when the platform exposes that control. Next functional batch:
  Partner catalog drafts.

### 2026-08-12 Storefront navigation／product／order refinement (local branch)

- Branch/worktree: `codex/storefront-product-order` at
  `C:\\Users\\ting1\\Documents\\代購網頁製作\\.worktrees\\codex-storefront-product-order`.
- Implemented approved UI behavior: compact mobile Header and expanding vertical
  member menu; Header cart summary drawer; public 2-column mobile／4-column desktop
  Product grid; simplified Product detail with image gallery controls; `/cart` as
  review then `/checkout` as the only recipient／consent confirmation step; and
  status-first Order cards with direct Payment Report entry when applicable.
- Server trust boundaries and financial behavior were not changed. The cart drawer
  only reads public catalog/cart information and safely keeps navigation available
  when its catalog read cannot initialize.
- Build correction: `/payments` uses `useSearchParams()` for a preselected payment
  request, so `src/app/payments/page.tsx` now supplies the required local Suspense
  boundary. This removes the Next.js 16 production prerender failure.
- Test runner correction: `playwright.config.ts` supports explicit
  `PLAYWRIGHT_PORT`, `PLAYWRIGHT_TURBOPACK_ROOT`, and `PLAYWRIGHT_WORKERS` values
  to isolate a Windows Git worktree from an unrelated active local server. Do not
  use the root `localhost:3000` server as proof of this branch.
- Verified locally: TypeScript pass; ESLint pass; Unit 57 files／457 tests; Rules
  2 files／32 tests; Build 42 routes; secret scan pass; production dependency audit
  0 vulnerabilities; focused navigation E2E 4/4; public smoke 14 passed／2 expected
  skips; Emulator homepage E2E 10/10.
- Complete regular Playwright was repeated on a fresh isolated port after verifying
  no stale listener remained: 24 passed／38 expected Emulator-only skips. The prior
  404 sequence came from reusing a timed-out development server, not an application
  route defect. Emulator homepage acceptance remains 10/10.
- GitHub push completed for `codex/storefront-product-order` through `44138b4`.
  Vercel Preview `dpl_7BsLuhmHK8zFZteMHKHPY3dk4FK3` reached Ready at
  `https://astera-5x6239vce-astera-oms.vercel.app`; stable branch alias:
  `https://astera-oms-git-codex-storefront-product-order-astera-oms.vercel.app`.
  Deployment Protection redirects anonymous traffic to Vercel SSO. Authenticated
  Vercel checks returned 200 for the homepage, product list, terms, privacy, and
  `prod_002` detail. No Production deployment or alias change was performed.

### 2026-08-12 Real homepage state correction

- Root cause of the reported Preview mismatch: the approved document
  `docs/superpowers/specs/2026-08-12-home-states-design.md` existed, but the actual
  branch still used the older `src/app/page.tsx`. This was a delivery-scope error,
  not a Vercel cache problem.
- `src/app/page.tsx` now renders `HomeExperience`. The new client boundary uses the
  existing `AuthProvider` to select the guest or member hierarchy without creating
  a second homepage.
- Guest order: login card → three purchasing steps → `正在販售` with independent
  `即將結單` and `最新商品` cards → existing Footer. The old hero service summary,
  supplement card, FAQ card, and forced bottom whitespace are absent.
- Member order: `需要你處理` → `最新商品` → `即將結單`. Member actions are real
  own-member open／partially-paid PaymentRequests only, maximum three, ordered by
  due time; no action data is fabricated. The empty state remains visible.
- Homepage products continue to read only `productsPublic`. Latest products rank by
  public update time; closing-soon products require an open future Campaign and
  rank by deadline. Images remain fixed 4:5 with the existing fallback. Guest
  product clicks preserve the existing Google-login cart intent and revalidate it
  after profile completion.
- Header behavior now matches the approved state contract: guest navigation uses
  plain `會員登入` and no cart; signed-in users retain cart, orders, account, and
  custom-claim Owner workspace access. No Email-based role check was introduced.
- Final local evidence: TypeScript pass; ESLint pass; Unit 57 files／459 tests;
  Firestore＋Storage Rules 2 files／32 tests; Build 42 routes; regular Playwright
  22 passed／42 expected skips; full Emulator Playwright 54 passed／10 expected
  skips; secret scan pass; production audit 0 vulnerabilities.
- Exact next step: commit and push the branch, wait for the Vercel Preview to reach
  Ready, then inspect the authenticated Preview `/` at desktop and mobile widths.
  Do not deploy Production without a new explicit authorization.

### 2026-08-14 Homepage integration handoff

- Root cause confirmed: Production was current for `main` `5890948`, but the
  approved auth-aware homepage commit `c9dfc49` and its seven storefront prerequisite
  commits were only on `codex/storefront-product-order`.
- Integration branch/worktree: `codex/homepage-main-integration` at
  `C:\\Users\\ting1\\Documents\\代購網頁製作\\.worktrees\\homepage-main-integration`.
- A dependency-aware merge was used instead of cherry-picking only `c9dfc49`.
  Conflicts were limited to Playwright configuration and the two project logs;
  the resolution retains current role-assignment changes plus the storefront
  worktree isolation settings and both historical records.
- Independent review identified two release blockers. The final tree serializes
  homepage GET／modify／PUT cart writes and calculates partially paid homepage
  actions from `amountTwd - allocatedAmountTwd`; focused tests first failed, then
  passed 2 files／6 tests after the fixes.
- Fresh integrated verification: TypeScript pass; ESLint pass; Unit 62 files／492
  tests; Rules 2 files／33 tests; Build 43 routes; regular Playwright 22 passed／44
  expected skips; Emulator Playwright 55 passed／11 intentional skips; secret scan
  pass; production audit 0 vulnerabilities.
- Exact next step: commit the reviewed fixes, merge the branch into `main`, push
  GitHub, deploy and verify Preview, then deploy Production
  and execute production smoke against `https://astera-oms.vercel.app`.

### 2026-08-14 Homepage integration release result

- `codex/homepage-main-integration` was fast-forwarded into `main`; GitHub `main`
  now contains merge `5f88727` and review fix `0b81cd1`.
- Preview `dpl_2vVMrLwHr1HqRncWp8rgLAJaW1jE` is Ready at
  `https://astera-6gd2psiv9-astera-oms.vercel.app`. Browser hydration confirmed the
  approved guest Header, login card, purchase steps, closing-soon and latest-product
  sections using the live public product projection.
- Git-integrated Production `dpl_Gfx2vDL85fqkNXQECT6LUxrVSQNR` is Ready and is the
  deployment behind `https://astera-oms.vercel.app`. Browser hydration confirmed
  the signed-in member hierarchy: outstanding actions first, latest products
  second, closing-soon products third.
- Read-only Production smoke passed five routes with HTTP 200: `/`, `/products`,
  `/terms`, `/privacy`, and `/products/prod_002`.
- No Firebase Rules, Collection model, Checkout logic, environment variable,
  domain, or Production data mutation was included in this homepage release.

### 2026-08-14 Partner catalog draft batch

- Branch/worktree: `codex/partner-catalog-drafts` at `C:\\Users\\ting1\\Documents\\代購網頁製作\\.worktrees\\partner-catalog-drafts`, based on `main` `9314449`.
- Commits: `20b50b7` role/domain contract; `e3589bc` repository; `13bf933` protected APIs; `697141f` Workspace UI／E2E; `7b50524` initial release gate. Final hardening／documentation commit follows this entry.
- Partner can read the formal catalog and classifications through protected GET APIs, then submit Product／Variant／Campaign changes with a title and reason. The formal Product POST, classification mutations, images, and direct publication remain Owner-only.
- Owner can reject with a reason or approve once. Rejected drafts can only be revised by their creator. Formal catalog writes, public projection, request state, and Audit Log are committed in one Firestore transaction; exact decision replay is idempotent and altered replay is rejected.
- Every request stores its loaded Product base version and immutable revision history. Submission, resubmission, and approval reject stale formal data. Partner input is strictly validated; images remain Owner-only; Product／Variant／Campaign IDs and SKU allocation stay server-controlled.
- Approval verifies child ownership／archived-ID non-reuse and active classification master ID＋label authority. Omitted active Variant／Campaign records are archived, archived Variant cost history is retained, and the Owner UI lists the exact records that approval will archive.
- Partner can only render the Workspace home, Products, and Catalog Reviews routes. Direct URLs to members, orders, payments, content, or Audit Log are denied even when navigation links are hidden.
- A real async race was found by Playwright: the formal catalog request could overwrite a rejected draft after session restoration, leaving a blank Campaign title. `editingDraftIdRef` now gives the draft priority until resubmission; desktop and Pixel 7 flows pass.
- The new E2E originally polluted the shared `prod_e2e_flow` fixture after approval. It now snapshots and restores the internal product, public projection, variants, and campaigns in `finally`. Set `PLAYWRIGHT_TURBOPACK_ROOT` to the worktree path when running Next.js from nested Windows worktrees, otherwise stale／outer routes can produce false 404 results.
- Independent final review: Critical 0／Important 0. Fresh evidence: TypeScript pass; zero-warning ESLint pass; Unit 66 files／541 tests; Firestore＋Storage Rules 2 files／34 tests; Build 45 routes; regular Playwright 22 passed／46 intentional Emulator-only skips; full Emulator Playwright 57 passed／11 intentional project skips; secret scan pass; production audit 0 vulnerabilities.
- Deployment state: local only. GitHub, Vercel Preview／Production, and Production Firestore Rules were not changed in this batch.
- Exact next executable batch: extend the same immutable request pattern to Partner classification／brand-content drafts, or begin Rush Purchase contribution and Helper bonus records from the confirmed role design. Do not expose Partner payment／refund, member private notes, role assignment, or unrestricted Audit Log access.

### 2026-08-15 Taishin Excel reconciliation integration

- Integration branch/worktree: `codex/excel-partner-release` at `C:\\Users\\ting1\\Documents\\代購網頁製作\\.worktrees\\excel-partner-release`, based on local `main` `ba8d293`.
- The old `codex/storefront-product-order` branch was not merged wholesale. Only the reconciliation design, parser, matching, preview API, batch-confirm API, Owner UI, focused tests, merged-footer fix, and distinct manual-review totals were selected. Current Partner catalog drafts, role management, and auth-aware homepage remain untouched by the integration diff.
- Owner workflow: upload a Taishin `.xlsx`; inspect unique／ambiguous／unmatched／insufficient／duplicate results; use select-all, clear-all, or individual checkboxes; then confirm only the retained safe matches. The confirm API reparses the same file and recomputes matches, so client selections cannot promote an unsafe result.
- Payment confirmation is shared through `src/lib/payment/confirmPendingPayment.ts`. Both single confirmation and Excel batch recognition use the same authoritative Firestore transaction and keep Payment／PaymentRequest／Order／OrderItem／allocation／Audit／notification behavior aligned. A deterministic reconciliation claim prevents one bank transaction from being accepted twice.
- Data minimization: the workbook, balance, and full bank remark are never stored. Only the approved safe transaction identity is attached to the Payment／Audit claim. No real bank row or Production Payment was recognized during this batch.
- Fresh integrated evidence: focused reconciliation 7 files／27 tests; full Unit 71 files／561 tests; Firestore＋Storage Rules 2 files／34 tests; TypeScript pass; ESLint pass; Build 46 routes; regular Playwright 22 passed／48 expected Emulator-only skips; full Emulator Playwright 58 passed／12 intentional project skips; secret scan pass; Production audit 0 vulnerabilities.
- Worktree note: set `PLAYWRIGHT_TURBOPACK_ROOT` to this nested Windows worktree and use a fresh `PLAYWRIGHT_PORT`. Without it, Next may resolve the outer checkout and produce false failures against an older homepage.
- Deployment state: local integration only. GitHub, Vercel Preview／Production, Firebase Rules, environment variables, and Production data were not changed. Exact next step: commit the documentation gate, fast-forward local `main`, re-run the merged-tree smoke gate, then request separate authorization for GitHub push and Preview deployment.

### 2026-08-15 GitHub push／Preview release gate

- `main` is on GitHub at `a955bb5`. Vercel Git integration automatically created a Ready Production deployment during that push. No manual Production deploy, alias, Firebase Rule, environment-variable, or data mutation was performed in this gate.
- Production log inspection found a real server-side failure when an authenticated Owner page loaded `/api/member/role-notifications`: Turbopack emitted an external dynamic import for `firebase-admin/auth`; its dependency chain reached a CommonJS `jwks-rsa` require of ESM-only `jose` and failed before the Admin API executed.
- The local hotfix changes only `src/lib/firebase/adminAuth.ts`: Node `createRequire(import.meta.url)` loads `firebase-admin/auth` through the native external require path. `tests/unit/nextRuntimeConfig.test.ts` asserts this deployment compatibility boundary. A Vercel Preview build was created from the uncommitted fix at `https://astera-c05lh0at0-astera-oms.vercel.app`; no Production deploy was manually requested for the fix.
- Fresh verification after the hotfix: TypeScript pass; zero-warning ESLint pass; Unit 71 files／562 tests; Firestore＋Storage Rules 2 files／34 tests; Production Build 46 routes; regular Playwright 22 passed／48 non-Emulator skips; Emulator Playwright 58 passed／12 intentional skips; secret scan pass; production dependency audit 0 vulnerabilities.
- The first ordinary Playwright run reused an existing local port-3000 dev server and saw an obsolete homepage. The first Emulator run correctly refused that same occupied port. Both were re-run on fresh ports 3101／3102 and passed; this is a local test-harness isolation issue, not a deployed application failure.
- Authenticated Preview smoke confirmed `/`, `/products`, `/brand`, `/terms`, `/privacy`, and `/products/prod_002`; `/e2e-auth` is a 404 in normal production mode and exposes no test login form. Vercel does not permit safely retrieving all sensitive Preview environment values for local inspection, so the final environment/OIDC proof is an Owner session reading the real workspace data.
- This `createRequire` Preview verification step is superseded by the pinned
  Firebase Admin correction below; the trial deployment did not resolve the
  runtime failure.

### 2026-08-15 Firebase Admin runtime compatibility correction

- Correction to the preceding hotfix record: commit `78f8f63` used Node
  `createRequire`, but deployed Preview logs still failed at the `jwks-rsa`
  CommonJS → `jose` ESM boundary. That intermediate trial must not be treated as
  a verified runtime fix.
- The replacement keeps the existing Admin/Auth API boundary but pins
  `firebase-admin` to exact `13.10.0`. Its resolved JWKS chain is
  `jwks-rsa` `3.2.2` and `jose` `4.15.9`, which avoids the v14 external-module
  incompatibility observed in Vercel. `src/lib/firebase/adminAuth.ts` therefore
  returns to its direct `firebase-admin/auth` import. The test suite asserts both
  the fixed dependency version and import contract.
- Local verification after the change: TypeScript pass; zero-warning ESLint pass;
  Unit 71 files／563 tests; Firestore＋Storage Rules 2 files／34 tests; Build 46
  routes; regular Playwright 22 passed／48 expected skips; Emulator Playwright 58
  passed／12 intentional skips; secret scan pass; production dependency audit 0
  vulnerabilities.
- The initial Emulator Playwright process hit only the 120-second local Next
  cold-start wait before tests began. Its orphaned local Emulator was identified
  by listener/PID and stopped. A clean isolated rerun on port 3115 passed all
  active cases, including Auth, Firestore, Storage, Member／Owner／Partner
  permissions, payment, catalog approval, images, and Taishin reconciliation.
- Files awaiting commit: `package.json`, `package-lock.json`,
  `src/lib/firebase/adminAuth.ts`, `tests/unit/nextRuntimeConfig.test.ts`, and
  these two project records. No production Firebase data, Rules, environment
  variable, or domain mutation has occurred. Next: deploy a fresh Preview from
  the pinned dependency, validate a signed-in Owner workspace API and Vercel
  runtime logs, then push `main` so the existing Git integration can deploy
  Production.

### 2026-08-15 Pinned Firebase Admin Preview acceptance

- Local commit `930ada6` was deployed to Preview only as
  `dpl_NwPpw9reGmo1rRS3cx51cPjRwtMK` at
  `https://astera-omxqnkzyp-astera-oms.vercel.app`.
- The existing Firebase-authorized stable Preview alias
  `https://astera-oms-astera-blip-astera-oms.vercel.app` was moved to that
  deployment. Production aliases, Firebase configuration, Rules, environment
  variables, and data were unchanged.
- The current signed-in Owner session loaded `/workspace/products` and rendered
  actual product, classification, Variant, and Campaign data. A bounded
  error-level Vercel log read for this deployment returned no errors; the previous
  `firebase-admin/auth` module-resolution failure was absent.
- Next exact step: commit this record, push `main`, wait for the existing
  Git-integrated Production deployment, then run public route and signed-in Owner
  Workspace smoke checks before declaring the runtime correction released.
