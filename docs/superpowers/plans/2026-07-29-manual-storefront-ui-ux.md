# 手動測試前台 UI/UX 修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正手動測試所見的前台商品、品牌、Footer、購物車與買家文案問題，讓買家可辨識頁面狀態並安全完成下單前流程。

**Architecture:** 保持 `productsPublic` 與既有受保護 Cart／Checkout API 為權威資料來源。以既有 React client components 補足狀態介面與語意，將可重複的展示文案／重試行為抽至各 component 內最小 helper，不更動 Collection、價格或訂單邏輯。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Tailwind CSS 4、Vitest、Playwright。

## Global Constraints

- 不改 Collection、Product／Variant／Campaign、Checkout 或 Order 資料模型。
- 前台商品唯一來源是 `productsPublic`；前端不得決定價格、權限或建立 Order。
- 所有新增互動控制項必須有可見 focus、44px 最小觸控高度、清楚 disabled 狀態與鍵盤可操作性。
- 不顯示 MVP、Firestore、custom claim、Owner、Demo、Phase、snapshot、qty 等內部術語給買家。
- 不 stage `AGENTS.md`。

---

### Task 1: 商品目錄與首頁推薦的明確狀態

**Files:**
- Modify: `src/components/storefront/PublicProductsBoard.tsx`
- Modify: `src/components/storefront/FeaturedProductsBoard.tsx`
- Modify: `tests/e2e/public-smoke.spec.ts`

**Interfaces:**
- Consumes: `listPublicProducts(db): Promise<PublicCatalogItem[]>`
- Produces: 每個讀取錯誤卡片均有 `重新載入` button，`loading`／`empty`／`error` 互斥。

- [ ] **Step 1: Write failing Playwright tests**

Add tests that force public product loading to fail and assert a visible `重新載入` button; assert the ready count is absent while the loading card is visible.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:e2e -- tests/e2e/public-smoke.spec.ts`

Expected: FAIL because the retry controls and loading-state assertions do not yet exist.

- [ ] **Step 3: Implement minimal state rendering**

Keep `catalogState` as the source of truth, extract a `loadCatalog` callback usable from `useEffect` and retry buttons, and render a non-layout-shifting loading card, error card with native button, and customer empty copy.

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npm.cmd run test:e2e -- tests/e2e/public-smoke.spec.ts`

Expected: PASS for both desktop and Pixel 7 projects.

### Task 2: 品牌頁與 Footer 的安全買家文案

**Files:**
- Modify: `src/app/brand/page.tsx`
- Modify: `src/components/storefront/StorefrontFooter.tsx`
- Modify: `tests/e2e/public-smoke.spec.ts`

**Interfaces:**
- Consumes: `loadBrandContentServer()` content with `channels` and optional `siteSettings`.
- Produces: 僅 active／有 URL 的社群連結；無社群時提供客服引導而不顯示未開放社群項。

- [ ] **Step 1: Write failing Playwright tests**

Assert `/brand` renders without `暫不提供` and no disabled social label is rendered as an action; assert footer legal navigation remains available.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:e2e -- tests/e2e/public-smoke.spec.ts`

Expected: FAIL because BrandPage currently renders inactive channel cards.

- [ ] **Step 3: Implement minimal rendering change**

Filter BrandPage channels to active entries with a URL before rendering. When none exist, render a plain customer-help note without Instagram, LINE, owner, or implementation terminology. Increase Footer legal-link hit areas without changing destinations.

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npm.cmd run test:e2e -- tests/e2e/public-smoke.spec.ts`

Expected: PASS for both desktop and Pixel 7 projects.

### Task 3: 購物車表單、CTA 與動態訊息

**Files:**
- Modify: `src/components/storefront/CartBoard.tsx`
- Modify: `tests/e2e/public-smoke.spec.ts`

**Interfaces:**
- Consumes: existing Cart state and `placeOrder()`.
- Produces: 空 cart 的 order button is disabled, all checkout controls expose stable `id`/`name`, and errors use `role="alert"` while ordinary progress uses polite live region.

- [ ] **Step 1: Write failing Playwright tests**

Assert `/cart` has disabled `請先加入商品` CTA and recipient／shipping controls expose `id`, `name`, and appropriate `autocomplete` attributes.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:e2e -- tests/e2e/public-smoke.spec.ts`

Expected: FAIL only for newly added error-state semantics or any missing semantic field attribute discovered by the test.

- [ ] **Step 3: Implement minimal semantic and feedback changes**

Preserve existing cart data flow. Ensure form controls retain ids/names/autocomplete, make disabled CTA visually clear, and use a status element with conditional `role="alert"` for validation/request errors.

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npm.cmd run test:e2e -- tests/e2e/public-smoke.spec.ts`

Expected: PASS for both desktop and Pixel 7 projects.

### Task 4: Buyer-facing copy regression scan and verification

**Files:**
- Modify: `tests/e2e/public-smoke.spec.ts`
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

**Interfaces:**
- Consumes: public routes and existing accessibility infrastructure.
- Produces: test coverage for public-route safety and a dated handoff record with commands/results.

- [ ] **Step 1: Write failing regression assertion**

Add an assertion that public storefront pages do not show `Firestore`, `custom claim`, `Owner`, `Demo`, `Phase`, `snapshot`, or `qty`.

- [ ] **Step 2: Run test to verify it fails or confirms current coverage gap**

Run: `npm.cmd run test:e2e -- tests/e2e/public-smoke.spec.ts`

Expected: either a failing customer-copy assertion identifying the remaining component or an explicit no-coverage baseline that becomes a protected passing regression test.

- [ ] **Step 3: Fix only remaining buyer-visible wording**

Replace the identified wording with customer language while preserving data values and routes. Do not alter internal workspace content.

- [ ] **Step 4: Run project verification and record evidence**

Run: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test:unit`, `npm.cmd run test:e2e -- tests/e2e/public-smoke.spec.ts`, and `npm.cmd run build`.

Expected: every command exits 0; document precise pass/fail results and any external-condition limitation in both project records.
