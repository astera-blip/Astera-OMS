# Astera OMS MVP Local Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all approved locally executable Astera OMS MVP gaps while preserving Firebase/Next.js architecture and leaving only external production gates.

**Architecture:** Establish CI and production/test isolation first, then remove production local fallbacks and harden transaction boundaries. Complete ProductWorkspace/Classifications before extending Product/PublicCatalog with images, then finish storefront, member, legal, notification, mobile, and deployment-preparation batches. Business writes stay behind authenticated Route Handlers; `productsPublic` remains the sole storefront source.

**Tech Stack:** Next.js 16.2.11 App Router, React 19, TypeScript, Firebase Auth/Firestore/Storage/Admin SDK, Vitest, Firebase Emulator Suite, Playwright, GitHub Actions.

## Global Constraints

- MVP only; do not add Helper, Warehouse, CRM, Finance, Analytics, Wallet, or ERP modules.
- Keep `productsInternal` as private Product authority and `productsPublic` as the only storefront source.
- Do not merge Product and Variant or change the established Collection architecture.
- Owner authorization comes only from Firebase custom claim `role: owner`.
- Product ID, Product SKU, and Variant SKU remain server-assigned and immutable in normal operations.
- Variant Name remains a free-text input until the owner approves another behavior.
- Client input is never authoritative for price, Campaign, permissions, Orders, Payments, or Product image metadata.
- Preserve the user-owned `AGENTS.md` modification and do not stage it.
- Read the relevant Next.js 16 docs under `node_modules/next/dist/docs/` before implementation.

---

## Batch Order and Overlap Control

1. Task 1 establishes CI/environment guards used by every later task.
2. Tasks 2–3 combine production fallback cleanup with checkout/payment/cancellation boundary fixes.
3. Tasks 4–5 combine ProductWorkspace UI and Classification API/UI because they share the same component and E2E flow.
4. Tasks 6–7 combine Product image domain/API/UI with storefront/homepage rendering because the public Product shape changes once.
5. Tasks 8–10 are independent member, legal, and Email batches.
6. Task 11 performs cross-cutting mobile/UI acceptance after layouts stabilize.
7. Task 12 adds read-only production preparation after the data contracts are final.
8. Task 13 performs full verification, documentation, and branch handoff.

### Task 1: CI and production/test isolation foundation

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `playwright.config.ts`
- Modify: `src/app/e2e-auth/page.tsx`
- Create: `src/lib/environment/runtimeMode.ts`
- Create: `tests/unit/runtimeMode.test.ts`
- Modify: `docs/10_TestPlan.md`

**Interfaces:**
- Produces: `assertSafeRuntimeMode(env: NodeJS.ProcessEnv): void`
- Produces: CI jobs `verify`, `firebase-rules`, `playwright`, and `playwright-emulated`
- Consumes: existing `scripts/run-firebase.mjs` and `scripts/run-playwright-emulated.mjs`

- [ ] Write failing unit tests proving production rejects `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` or `NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH=true`, while development/test permits explicit emulator flags.

```ts
expect(() => assertSafeRuntimeMode({
  NODE_ENV: "production",
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
} as NodeJS.ProcessEnv)).toThrow("unsafe_production_runtime");

expect(() => assertSafeRuntimeMode({
  NODE_ENV: "test",
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
} as NodeJS.ProcessEnv)).not.toThrow();
```

- [ ] Run `npx.cmd vitest run tests/unit/runtimeMode.test.ts` and verify RED because `assertSafeRuntimeMode` does not exist.
- [ ] Implement `runtimeMode.ts` without logging environment values or secrets.

```ts
export function assertSafeRuntimeMode(env: NodeJS.ProcessEnv) {
  const unsafe = env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
    || env.NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH === "true";
  if (env.NODE_ENV === "production" && unsafe) {
    throw new Error("unsafe_production_runtime");
  }
}
```

- [ ] Call the guard from the Firebase client/bootstrap path and make `/e2e-auth` return `notFound()` unless the explicit E2E flag is enabled.
- [ ] Update CI to use Node from `.node-version`, Java 21, `npm ci`, `npx playwright install --with-deps chromium`, Firebase Rules tests, regular Playwright, authenticated Emulator Playwright, and `actions/upload-artifact` for `test-results/**` on failure.
- [ ] Keep secret scan, audit, lint, typecheck, Unit, and build checks.
- [ ] Run unit, typecheck, lint, and production build.
- [ ] Commit only Task 1 files with `ci: add emulator and browser verification`.

### Task 2: Production data-source cleanup

**Files:**
- Modify: `src/components/workspace/ProductWorkspace.tsx`
- Modify: `src/components/storefront/PublicProductsBoard.tsx`
- Modify: `src/components/storefront/CartBoard.tsx`
- Modify: `src/components/storefront/OrderHistoryBoard.tsx`
- Modify: `src/components/storefront/OrderDetailBoard.tsx`
- Modify: `src/components/storefront/PaymentRequestsBoard.tsx`
- Modify: `src/components/workspace/OrderOperationsBoard.tsx`
- Modify: `src/components/workspace/PaymentOperationsBoard.tsx`
- Modify: `src/lib/order/checkout.ts` and `src/lib/payment/manualBankTransfer.ts` only if shared persisted types must be moved out of `localStore.ts`
- Delete only after usage reaches zero: `src/lib/order/localStore.ts`
- Modify: `tests/e2e/public-smoke.spec.ts`
- Create: `tests/unit/productionDataSource.test.ts`

**Interfaces:**
- Produces: production UI states `loading | ready | empty | error` that never report local persistence as success
- Consumes: existing protected Profile/Cart/Product APIs and Firestore read repositories

- [ ] Inventory every `localStore`, `localStorage`, Demo, `Phase`, `snapshot`, `qty`, and stale mixed-sale-type user-facing reference with `rg`.
- [ ] Write a static regression test that fails while production components import business persistence from `src/lib/order/localStore.ts` or contain the known stale copy.

```ts
const productionSources = [
  "src/components/storefront/OrderHistoryBoard.tsx",
  "src/components/storefront/PaymentRequestsBoard.tsx",
  "src/components/workspace/OrderOperationsBoard.tsx",
].map((file) => readFileSync(file, "utf8")).join("\n");

expect(productionSources).not.toContain("@/lib/order/localStore");
expect(productionSources).not.toMatch(/Phase [0-9]|不同商品類型不可混合|Firestore projection/);
```

- [ ] Remove ProductWorkspace local persistence fallback; API failures retain unsaved form state but show a failure and never claim storage success.
- [ ] Remove order/payment/cancellation local persistence fallbacks from production components.
- [ ] Move any still-valid shared Order/Payment type imports out of `localStore.ts` into their owning domain modules before deleting the persistence helper.
- [ ] Keep `localStorage` only for a transient unauthenticated cart if required; after authentication, merge once and persist through `/api/cart`, then treat the API response as authority.
- [ ] Replace `Phase 2`, `Phase 4`, `snapshot`, `qty`, Firestore/projection, and stale cart restrictions with operator/customer Traditional Chinese copy.
- [ ] Remove `src/lib/order/localStore.ts` only when `rg` proves no production import remains; otherwise split a cart-only transient helper into `src/lib/cart/anonymousCart.ts`.
- [ ] Add Playwright assertions that server failure displays an error and does not show a false success.
- [ ] Run targeted Unit/E2E, typecheck, lint, and build.
- [ ] Commit with `refactor: remove production local data fallbacks`.

### Task 3: Checkout, payment, and cancellation boundary audit

**Files:**
- Modify: `src/app/api/checkout/route.ts`
- Modify: `src/lib/order/checkout.ts`
- Modify: `src/app/api/workspace/payments/[id]/confirm/route.ts`
- Modify: `src/app/api/workspace/payments/[id]/reverse/route.ts`
- Modify: `src/app/api/cancellations/route.ts`
- Modify: `src/app/api/workspace/cancellations/[id]/review/route.ts`
- Modify: `src/lib/payment/manualBankTransfer.ts`
- Modify: `src/lib/order/cancellation.ts`
- Modify: `tests/unit/checkoutFlow.test.ts`
- Modify: `tests/unit/paymentFlow.test.ts`
- Modify: `tests/unit/cancellationFlow.test.ts`
- Modify: `tests/e2e/member-payment-cancellation-flow.spec.ts`
- Modify: `tests/firebase/firestore-deny.test.ts`

**Interfaces:**
- Produces: idempotent checkout response containing every split Order on first and repeated requests
- Produces: stable public API errors without raw exception text
- Preserves: immutable `paymentAllocations` and `auditLogs`

- [ ] Add a failing checkout regression test showing repeated idempotency currently loses split Orders and incorrectly substitutes `checkoutGroupId` for `orderNumber`.

```ts
expect(secondResponse.orders).toEqual(firstResponse.orders);
expect(secondResponse.orders).toHaveLength(2);
expect(secondResponse.orders.map((order) => order.orderNumber)).toEqual([
  "AST-20260729-0001",
  "AST-20260729-0002",
]);
```

- [ ] Persist a checkout result manifest under the idempotency authority document or reconstruct all Orders by `checkoutGroupId`; return identical `orders[]` for first and repeated calls.
- [ ] Verify every cart line is re-priced from authoritative Product/Variant/Campaign data and submitted prices/statuses are ignored.
- [ ] Require the current legal version IDs rather than accepting an arbitrary or missing set.
- [ ] Add cumulative partial/full/overpayment and repeated-confirm tests.
- [ ] Add reversal tests for negative adjustment, reopened totals/statuses, immutable history, and repeated reversal rejection.
- [ ] Add unpaid/paid/mixed cancellation tests, duplicate pending-request rejection, refund metadata, negative adjustment, and Audit Log behavior.
- [ ] Replace raw 500 exception messages with stable `internal_error`; preserve explicit 400/401/403/404/409 codes.
- [ ] Extend authenticated Emulator Playwright to exercise repeat checkout and verify identical order numbers.
- [ ] Run Unit, Rules, emulated E2E, typecheck, lint, and build.
- [ ] Commit with `fix: harden order payment and cancellation boundaries`.

### Task 4: ProductWorkspace bilingual presentation and immutable identifier controls

**Files:**
- Create: `src/lib/product/workspaceLabels.ts`
- Create: `src/components/workspace/CopyValueButton.tsx`
- Modify: `src/components/workspace/ProductWorkspace.tsx`
- Create: `tests/unit/workspaceLabels.test.ts`
- Modify: `tests/e2e/workspace-product-ui.spec.ts`

**Interfaces:**
- Produces: label maps for Publish State, Sale Type, Campaign Status, Classification Status, and Currency
- Produces: `CopyValueButton({ value, label })`
- Preserves: English enum values sent to APIs

- [ ] Write failing tests for every approved bilingual label and currency option.

```ts
expect(publishStateLabels.published).toBe("Published（已刊登）");
expect(saleTypeLabels.rushPurchase).toBe("Rush Purchase（代搶）");
expect(campaignStatusLabels.archived).toBe("Archived（已封存）");
expect(currencyOptions[0]).toEqual({ value: "THB", label: "THB（泰銖）" });
```

- [ ] Implement pure constant label maps without changing domain enum values.
- [ ] Add copy buttons for Product ID, Product SKU, and each Variant SKU using `navigator.clipboard.writeText`; disable when no allocated value exists.
- [ ] Add the confirmed immutable/non-reuse SKU help text.
- [ ] Add the exact Internal Note private-use helper text.
- [ ] Convert Product, Variant, and Campaign labels to `English（中文）`.
- [ ] Render the approved bilingual Publish State, Sale Type, Campaign Status, and Currency choices while keeping option `value` unchanged.
- [ ] Keep Variant Name as an ordinary text input.
- [ ] Remove development-stage headings and copy.
- [ ] Add desktop/Pixel 7 Playwright assertions for labels, copy controls, and submitted enum values.
- [ ] Run targeted Unit/E2E, typecheck, lint, and build.
- [ ] Commit with `feat: clarify product workspace labels`.

### Task 5: Classification Server API and separate management tab

**Files:**
- Modify: `src/app/api/workspace/classifications/route.ts`
- Modify: `src/lib/product/classifications.ts`
- Create: `src/components/workspace/ProductClassificationManager.tsx`
- Modify: `src/components/workspace/ProductWorkspace.tsx`
- Create: `tests/unit/productClassifications.test.ts`
- Create: `tests/e2e/workspace-classification-flow.spec.ts`
- Modify: `tests/firebase/firestore-deny.test.ts`

**Interfaces:**
- `POST /api/workspace/classifications` consumes `{ key, label }`
- `PATCH /api/workspace/classifications` consumes `{ key, id, label, status }`
- Both produce `{ classification }`
- Produces: `normalizeClassificationLabelKey(label: string): string`

- [ ] Write failing tests for trimming, blank labels, case/space-normalized duplicates, immutable IDs, rename, Active/Archived, and unsupported classification keys.

```ts
expect(normalizeClassificationLabelKey("  Freen   Sarocha ")).toBe("freen sarocha");
expect(normalizeClassificationLabelKey("FREEN SAROCHA")).toBe("freen sarocha");
expect(validateClassificationLabel("   ")).toEqual({
  ok: false,
  error: "classification_label_required",
});
```

- [ ] Change create flow to allocate `collection.doc()` on the Server and persist `id`, `label`, normalized comparison key, `status: active`, timestamps, and actor.
- [ ] Add owner-only PATCH rename/archive; never add DELETE.
- [ ] Map expected errors to 400/403/404/409 and hide internal exceptions.
- [ ] Extract classification UI from ProductWorkspace into `ProductClassificationManager`.
- [ ] Add top-level `Products（商品管理）` and `Classifications（分類管理）` tabs.
- [ ] Add `管理分類` shortcuts beside Product classification selectors that activate the Classification tab and focus the relevant group.
- [ ] Present Company, Artist, CP, Brand, and Series as separate groups with create, rename, and archive controls.
- [ ] Refresh Product selector options after changes without page reload.
- [ ] Add owner/member API/Rules coverage and desktop/Pixel 7 Playwright CRUD/archive coverage.
- [ ] Run Unit, Rules, E2E, typecheck, lint, and build.
- [ ] Commit with `feat: add classification master management`.

### Task 6: Product image domain, Storage validation, and ProductWorkspace upload UI

**Files:**
- Modify: `src/lib/firebase/admin.ts`
- Modify: `src/lib/product/catalog.ts`
- Modify: `src/lib/product/serverCatalog.ts`
- Modify: `src/lib/catalog/publicCatalog.ts`
- Modify: `src/domain/product.ts`
- Create: `src/lib/product/images.ts`
- Create: `src/app/api/workspace/products/[id]/images/register/route.ts`
- Create: `src/app/api/workspace/products/[id]/images/route.ts`
- Create: `src/components/workspace/ProductImageManager.tsx`
- Modify: `src/components/workspace/ProductWorkspace.tsx`
- Modify: `storage.rules`
- Modify: `tests/firebase/storage-deny.test.ts`
- Create: `tests/unit/productImages.test.ts`
- Modify: `tests/unit/productCatalog.test.ts`

**Interfaces:**
- Produces: `ProductImage` with `id`, `objectPath`, `url`, `altText`, `width`, `height`, `sortOrder`
- `POST .../images/register` consumes `{ objectPath, url, altText, width, height }`
- `PATCH .../images` consumes `{ images: ProductImage[] }`
- Product public projection includes sorted `images`

- [ ] Write failing image-domain tests for supported MIME/extensions, 5 MB limit, path ownership, positive dimensions, alt-text bounds, ordering, cover-first rule, duplicate path rejection, and maximum eight references.

```ts
expect(validateProductImageCandidate({
  productId: "prod_1",
  objectPath: "product-images/prod_1/image.webp",
  contentType: "image/webp",
  size: 5 * 1024 * 1024,
  width: 1200,
  height: 1200,
  altText: "Freen 寫真封面",
}).ok).toBe(true);

expect(validateProductImageCandidate({
  productId: "prod_1",
  objectPath: "product-images/prod_2/image.webp",
  contentType: "image/webp",
  size: 1,
  width: 1,
  height: 1,
  altText: "錯誤路徑",
}).ok).toBe(false);
```

- [ ] Add Admin Storage accessor and emulator-compatible bucket selection without long-lived key assumptions.
- [ ] Extend Product/PublicCatalog types once with `images`.
- [ ] Implement path/URL/metadata validation helpers that never trust client MIME, size, bucket, or Product path.
- [ ] Implement owner-only registration and reorder/alt/reference-removal APIs; do not implement object deletion.
- [ ] Extend Product save transaction to regenerate `productsPublic.images` with only public fields.
- [ ] Implement direct owner Firebase Storage Client SDK upload to random `product-images/{productId}/{randomId}.{ext}` paths, then register through the Server API.
- [ ] Require a new Product to be saved once to receive its server Product ID before enabling image upload; show a clear save-first instruction instead of inventing a client Product ID.
- [ ] Add cover selection by first sort position, drag-free up/down ordering controls, alt text, progress/error states, and maximum-eight UI.
- [ ] Keep Storage Rules public-read/owner-write and tighten filename/path/content checks consistently with the Server.
- [ ] Add Storage Rules and Unit coverage for anonymous/member denial, owner upload, type, size, path, and public read.
- [ ] Run Unit, Rules, typecheck, lint, and build.
- [ ] Commit with `feat: add product image management`.

### Task 7: Image-aware storefront and homepage featured carousel

**Files:**
- Modify: `next.config.ts`
- Create: `src/components/storefront/ProductImage.tsx`
- Modify: `src/components/storefront/PublicProductsBoard.tsx`
- Modify: `src/components/storefront/PublicProductDetailBoard.tsx`
- Modify: `src/components/storefront/FeaturedProductsBoard.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/lib/catalog/featuredProducts.ts`
- Create: `tests/unit/featuredProducts.test.ts`
- Modify: `tests/e2e/public-smoke.spec.ts`

**Interfaces:**
- Produces: `rankFeaturedProducts(items, now): PublicCatalogItem[]`
- Consumes: public `images`, effective Campaign price, status, closing time, and public update timestamp

- [ ] Write failing ranking tests for published/non-archived filtering, rush priority, nearest closing time, newest fallback, and 10-item cap.

```ts
const result = rankFeaturedProducts([latest, nearestClosing, rush, archived], now);
expect(result.map((item) => item.product.id)).toEqual([
  rush.product.id,
  nearestClosing.product.id,
  latest.product.id,
]);
expect(result).not.toContain(archived);
```

- [ ] Add narrow Firebase Storage remote image patterns and safe localhost/emulator behavior per Next.js 16 Image docs.
- [ ] Implement reusable responsive image component with explicit dimensions, correct alt text, lazy loading, and code-native fallback.
- [ ] Add cover images to list/detail cards and all-image detail gallery.
- [ ] Replace homepage grid with a 6–10 item featured carousel: desktop controls and mobile horizontal snapping.
- [ ] Display effective Campaign price and closing time; never expose SKU/internal status/unknown values.
- [ ] Link every featured image/card to Product detail.
- [ ] Add desktop and Pixel 7 Playwright coverage for image load/fallback, navigation, scroll/controls, status filtering, and visible price/closing time.
- [ ] Run Unit/E2E, typecheck, lint, and build.
- [ ] Commit with `feat: add image-aware featured storefront`.

### Task 8: Member operations MVP hardening

**Files:**
- Create: `src/app/api/workspace/members/route.ts`
- Modify: `src/app/api/workspace/member-private-notes/route.ts`
- Modify: `src/lib/member/operationsRepository.ts`
- Create: `src/lib/member/duplicatePhones.ts`
- Modify: `src/components/workspace/MemberOperationsBoard.tsx`
- Create: `tests/unit/duplicatePhones.test.ts`
- Modify: `tests/firebase/firestore-deny.test.ts`
- Create: `tests/e2e/workspace-member-flow.spec.ts`

**Interfaces:**
- `GET /api/workspace/members` produces `{ members, privateNotes, duplicatePhoneGroups }`
- `PUT /api/workspace/member-private-notes` updates `{ uid, riskState, internalNote }` and appends Audit Log
- Produces: `groupDuplicatePhones(members)`

- [ ] Write failing tests for normalized duplicate grouping, unique phones, two-or-more warnings, and no registration blocking.

```ts
expect(groupDuplicatePhones([
  member("a", "0912345678"),
  member("b", "0912345678"),
  member("c", "0987654321"),
])).toEqual([{ mobilePhone: "0912345678", memberUids: ["a", "b"] }]);
```

- [ ] Implement owner-only Admin read API so MemberOperations does not directly compose private collections in the client.
- [ ] Transactionally update risk/note and append immutable Audit Log with previous/new state and actor.
- [ ] Add editable private-note textarea and explicit save behavior.
- [ ] Add bilingual Normal/Watch/Blacklisted labels and duplicate-account warning panels listing matching members.
- [ ] Ensure blacklist removal keeps prior audit history.
- [ ] Extend Rules tests proving Member/cross-member cannot read private notes and clients cannot write notes/audits.
- [ ] Add owner/member E2E coverage.
- [ ] Run Unit, Rules, E2E, typecheck, lint, and build.
- [ ] Commit with `feat: harden member risk operations`.

### Task 9: Public Terms and Privacy pages

**Files:**
- Modify: `src/lib/legal/documents.ts`
- Create: `src/app/terms/page.tsx`
- Create: `src/app/privacy/page.tsx`
- Modify: `src/components/storefront/StorefrontFooter.tsx`
- Modify: `src/app/brand/page.tsx`
- Modify: `src/components/storefront/CartBoard.tsx`
- Modify: `tests/unit/legalDocuments.test.ts`
- Modify: `tests/e2e/public-smoke.spec.ts`

**Interfaces:**
- Produces: `getCurrentLegalDocument(type: "terms" | "privacy")`
- Preserves: `currentLegalVersionIds()` used by Checkout/ConsentRecord

- [ ] Add failing tests for one current document per type, version/effective date rendering data, and stable current version IDs.

```ts
expect(getCurrentLegalDocument("terms").id).toBe("terms-v2026-07-26");
expect(getCurrentLegalDocument("privacy").effectiveAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
expect(currentLegalVersionIds()).toEqual([
  "terms-v2026-07-26",
  "privacy-v2026-07-26",
]);
```

- [ ] Add `effectiveAt` and current-document selection without changing existing IDs.
- [ ] Build public `/terms` and `/privacy` pages with title, version, effective date, and full body.
- [ ] Link Footer, Brand, and Checkout labels to the pages while retaining required consent checkboxes.
- [ ] Add anonymous desktop/Pixel 7 Playwright access and link coverage.
- [ ] Run Unit/E2E, typecheck, lint, and build.
- [ ] Commit with `feat: publish legal information pages`.

### Task 10: Idempotent post-transaction Resend delivery

**Files:**
- Modify: `src/lib/notification/events.ts`
- Modify: `src/lib/notification/resend.ts`
- Create: `src/lib/notification/delivery.ts`
- Modify: `src/app/api/checkout/route.ts`
- Modify: `src/app/api/workspace/payments/[id]/confirm/route.ts`
- Modify: `src/app/api/workspace/notifications/[id]/retry/route.ts`
- Modify: `src/components/workspace/PaymentOperationsBoard.tsx`
- Modify: `tests/unit/notificationEvents.test.ts`
- Modify: `tests/unit/resendNotificationDelivery.test.ts`
- Create: `tests/unit/notificationDelivery.test.ts`

**Interfaces:**
- Produces: `attemptNotificationDelivery(db, eventId, now): Promise<NotificationEvent>`
- Extends events with optional `deliveryLockId` and `deliveryLockUntil`
- Preserves statuses `pending | sent | failed`

- [ ] Write failing tests for missing config, provider success/failure, sanitized error, lock acquisition, active-lock no-op, expired-lock retry, sent no-op, and attempt count.

```ts
const first = await attemptNotificationDelivery(db, "notif_1", now);
const second = await attemptNotificationDelivery(db, "notif_1", now);

expect(first.status).toBe("sent");
expect(first.attemptCount).toBe(1);
expect(second.providerMessageId).toBe(first.providerMessageId);
expect(send).toHaveBeenCalledTimes(1);
```

- [ ] Implement transactional delivery lock acquisition and conditional finalization.
- [ ] Make owner retry call the shared orchestrator and return success without re-sending sent events.
- [ ] After Checkout transaction commits, attempt each created notification; never change successful Checkout response if Email fails.
- [ ] After payment confirmation commits, attempt its notification; never roll back payment.
- [ ] Translate notification status/error/retry UI into operator Chinese.
- [ ] Add route-level tests with mocked Resend transport and no network access.
- [ ] Run Unit, typecheck, lint, build, and authenticated Emulator E2E.
- [ ] Commit with `feat: deliver transactional email notifications`.

### Task 11: Cross-feature desktop and Pixel 7 acceptance

**Files:**
- Modify: `src/components/workspace/WorkspaceShell.tsx`
- Modify as findings require: Product, Classification, Member, Order, Payment, Content components
- Modify: `tests/e2e/workspace-product-ui.spec.ts`
- Modify: `tests/e2e/workspace-classification-flow.spec.ts`
- Modify: `tests/e2e/workspace-member-flow.spec.ts`
- Modify: `tests/e2e/member-payment-cancellation-flow.spec.ts`
- Modify: `tests/e2e/public-smoke.spec.ts`

**Interfaces:**
- Produces: consistent loading/empty/error/status presentation across workspace and storefront

- [ ] Add explicit mobile assertions for no horizontal document overflow on Product, Classification, Member, Order, Payment, and Content pages.

```ts
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
);
expect(overflow).toBe(false);
```

- [ ] Test buttons, tabs, datetime inputs, selects, and textareas at Pixel 7 viewport.
- [ ] Verify workspace navigation is reachable and no fixed element obscures controls.
- [ ] Translate remaining user-facing enum/status labels and remove internal technical terms found by `rg`.
- [ ] Normalize loading, empty, validation, and server error surfaces.
- [ ] Run regular and authenticated Emulator Playwright on desktop and Pixel 7.
- [ ] Run typecheck, lint, Unit, Rules, and build after layout fixes.
- [ ] Commit with `fix: complete desktop and mobile acceptance`.

### Task 12: Read-only production migration and deployment preparation

**Files:**
- Create: `scripts/check-production-env.mjs`
- Create: `scripts/audit-product-projection.mjs`
- Create: `scripts/smoke-production.mjs`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `docs/14_Deployment.md`
- Modify: `docs/10_TestPlan.md`
- Create: `docs/SOP/正式資料備份與商品同步SOP.md`
- Create: `tests/unit/productionScripts.test.ts`

**Interfaces:**
- `npm run production:env:check`
- `npm run production:products:audit -- --project <id> --confirm-project <id>`
- `npm run production:smoke -- --base-url <https-url>`
- All commands are read-only unless a future separately reviewed migration command is added

- [ ] Write tests for argument parsing, mismatched project confirmation, secret-name-only reporting, anonymous smoke behavior, and non-mutating audit mode.

```ts
expect(() => parseProductionArgs([
  "--project", "astera-oms-prod",
  "--confirm-project", "astera-oms-dev-b2b2e",
])).toThrow("project_confirmation_mismatch");

expect(formatEnvironmentReport({
  RESEND_API_KEY: "secret-value",
})).toContain("RESEND_API_KEY=configured");
expect(formatEnvironmentReport({
  RESEND_API_KEY: "secret-value",
})).not.toContain("secret-value");
```
- [ ] Add `.local-backups/` to `.gitignore`; never write backups inside tracked paths.
- [ ] Implement environment checker that prints only variable names and configured/missing status.
- [ ] Implement product projection audit comparing Product count, IDs, Variant/Campaign counts, SKU presence/format, price projection, public private-field absence, and image fields.
- [ ] Require exact `--project` and matching `--confirm-project`; default to no writes.
- [ ] Implement anonymous production smoke for homepage, Products, Terms, Privacy, and public Product access without credentials.
- [ ] Document exact backup, dry-run, deploy order, verification, rollback, and recovery steps.
- [ ] Add checklist proving Emulator/test-auth flags are absent from production.
- [ ] Run script tests, typecheck, lint, Unit, and build.
- [ ] Commit with `chore: add production readiness tooling`.

### Task 13: Final verification, documentation, and handoff

**Files:**
- Modify: `docs/11_Changelog.md`
- Modify: `docs/12_DecisionLog.md` only for decisions made during implementation
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`
- Modify: `docs/18_AIContinuationBrief.md`

**Interfaces:**
- Produces: exact final remaining external-gate list and verification evidence

- [ ] Run `npm.cmd run check:secrets`.
- [ ] Run `npm.cmd run audit:production`.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run test:unit`.
- [ ] Run `npm.cmd run firebase:rules:test`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `npm.cmd run test:e2e`.
- [ ] Run `npm.cmd run test:e2e:emulated`.
- [ ] Record exact file/test counts, skips, environment warnings, and results.
- [ ] Update plan/handoff with completed batches, changed files, known gaps, external credentials, and the next exact production step.
- [ ] Verify `git diff --check`, secret scan, staged file scope, and preservation of `AGENTS.md`.
- [ ] Commit with `docs: complete local MVP handoff`.
- [ ] Push `codex/mvp-completion` and verify local HEAD equals `origin/codex/mvp-completion`.

## Completion Criteria

- No production business flow reports localStorage/Demo persistence as success.
- ProductWorkspace and Classification management match all approved bilingual/immutable-ID decisions.
- Product images work against Storage Emulator with Rules, metadata registration, public projection, and responsive storefront rendering.
- Homepage featured display uses `productsPublic`, correct priority, images, price, and closing time.
- Duplicate-phone warnings, private notes, risk audits, and blacklist history work without adding CRM modules.
- Terms and Privacy have public pages and current Consent IDs.
- Order/payment Email attempts happen after transactions and are safe/idempotent.
- CI runs Unit, Rules, Build, regular Playwright, and authenticated Emulator Playwright.
- Desktop and Pixel 7 suites cover the completed workflows.
- Production readiness scripts are read-only by default.
- Remaining work is limited to external Firebase/Vercel/DNS/Resend/legal/real-device actions.
