# Astera 商品、訂單與購物車介面實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將既有 Astera 公開商品、購物車、訂單與付款入口改為已核定的收藏選物店介面，並保留既有 Firebase、購物車、Checkout 與 Server 商業邏輯。

**Architecture:** 以共用 `StorefrontHeader`／`AccountActions` 和新的純顯示購物車抽屜建立一致導覽；產品與訂單 Board 只調整資料已讀取後的展示階層與既有連結。所有寫入繼續沿用現有 `/api/cart`、`/api/checkout`、`/api/payments` 與取消 API，前台商品仍只讀 `productsPublic`。

**Tech Stack:** Next.js 16.2.11 App Router、React 19、TypeScript、Tailwind CSS 4、Firebase Auth／Firestore、Vitest、Playwright。

## Global Constraints

- 使用既有 `productsPublic`、Firebase Authentication、Server API 與 custom claim；不可讀取 `productsInternal` 或以 Email 判斷 Owner。
- 不改 Collection、Firestore Rules、價格／Campaign 判斷、Checkout 拆單、付款、取消或退款資料模型。
- 手機 390px 商品固定 2 欄；768px 維持 2 欄；1365px 4 欄；所有主要操作目標至少 44×44px 且沒有水平溢出。
- 採既定 Astera Token：`#F7F3F2`、`#FFFFFF`、`#20242B`、`#DED7D6`、`#6C6B70`、`#6E4E64`、`#E7DDDF`、`#466060`、`#F8C7CC`、`#81A684`。
- 沿用全站 `:focus-visible`、`aria-live`／`role="alert"`、`prefers-reduced-motion`、固定 4:5 圖片比例與不顯示技術／內部文案的契約。
- 先讀 `node_modules/next/dist/docs/01-app/02-guides/authentication.md` 與 App Router linking/navigation 文件，再改 Next.js 用戶端導覽／登入控制程式。

---

## File Structure

- `src/components/storefront/StorefrontHeader.tsx` — 響應式桌面／手機導覽、購物車抽屜觸發器、公開導覽及選單開關。
- `src/components/auth/AccountActions.tsx` — 登入狀態的桌面與手機帳號選單內容、custom-claim Owner 入口。
- `src/components/storefront/HeaderCartDrawer.tsx`（新增）— 唯讀購物車摘要 dialog；可關閉並連至既有 `/cart`、`/checkout`。
- `src/components/storefront/PublicProductsBoard.tsx` — 公開商品 2／4 欄卡片與簡化資訊層級，繼續使用現有加入購物車流程。
- `src/components/storefront/PublicProductDetailBoard.tsx` — 4:5 商品相簿、首屏採購資訊與下方漸進揭露的商品／活動內容。
- `src/components/storefront/CartBoard.tsx` — 將既有完整購物車／結帳頁改為一致視覺，保留唯一 7-ELEVEN、條款和既有提交守衛。
- `src/components/storefront/OrderHistoryBoard.tsx`、`OrderDetailBoard.tsx` — 訂單卡與詳情首屏狀態卡、付款回報的預選連結。
- `src/components/storefront/PaymentRequestsBoard.tsx` — 接收受限 query string 預選付款請求；保留多選與 Server 所屬驗證。
- `tests/unit/storefrontGrid.test.ts`、`tests/unit/uiAccessibility.test.ts`、`tests/unit/paymentRequestsBoard.test.ts`（及新增 focused tests）— 靜態契約與可及性回歸。
- `tests/e2e/storefront-navigation.spec.ts`（新增，若目前 Playwright 目錄慣例不同則放至現有 `tests/` E2E 目錄）— 公開 Header、手機選單、購物車抽屜與訂單付款入口 smoke coverage。

## Task 1: 建立共用 Header、帳號選單與迷你購物車抽屜

**Files:**
- Create: `src/components/storefront/HeaderCartDrawer.tsx`
- Modify: `src/components/storefront/StorefrontHeader.tsx:1-30`
- Modify: `src/components/auth/AccountActions.tsx:1-42`
- Modify: `tests/unit/storefrontGrid.test.ts:37-45`
- Modify: `tests/unit/uiAccessibility.test.ts:156-174`

**Interfaces:**
- Consumes: `useAuth(): { status, user, error, signInWithGoogle, signOut, role? }` and existing anonymous/member cart helpers.
- Produces: `HeaderCartDrawer({ open: boolean; onClose: () => void }): JSX.Element`; `AccountActions({ variant: "desktop" | "mobile"; onNavigate?: () => void }): JSX.Element`.
- The header owns dialog open state and passes `onClose`; the drawer never writes cart state.

- [ ] **Step 1: Write focused failing Header contract tests**

Add assertions that require the source to contain the mobile menu button, `aria-expanded`, `Escape` close behaviour, `HeaderCartDrawer`, desktop ASTERA navigation, and owner-only `/workspace` guard. Add the expected cart links:

```ts
expect(header).toContain("HeaderCartDrawer");
expect(header).toContain('aria-expanded={isMobileMenuOpen}');
expect(header).toContain("keydown");
expect(header).toContain("Escape");
expect(header).toContain("/checkout");
expect(accountActions).toContain('variant: "desktop" | "mobile"');
expect(accountActions).toContain('role === "owner"');
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:unit -- tests/unit/storefrontGrid.test.ts tests/unit/uiAccessibility.test.ts`  
Expected: FAIL because no mobile menu / drawer contract exists yet.

- [ ] **Step 3: Add the minimal read-only drawer and responsive Header implementation**

Create `HeaderCartDrawer.tsx` with a labelled `role="dialog"` component which reads the same cart summary helpers currently used by `CartBoard`, renders item image/name/variant/quantity/total, and only links to `/cart` and `/checkout`. In `StorefrontHeader`, implement this state boundary:

```tsx
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

<button aria-expanded={isMobileMenuOpen} aria-controls="storefront-mobile-menu" />
<nav id="storefront-mobile-menu" hidden={!isMobileMenuOpen} />
<HeaderCartDrawer open={isCartDrawerOpen} onClose={() => setIsCartDrawerOpen(false)} />
```

Keep desktop navigation text-only. On mobile, retain ASTERA + cart trigger + menu trigger; put public/member/Owner destinations in the vertical menu. Use `useEffect` to register Escape only while either overlay is open, and close after navigation. Keep actual authorization in existing protected routes.

- [ ] **Step 4: Make `AccountActions` presentation-aware without changing authentication**

Render a text-style Google login action for Header desktop/mobile variants, and signed-in member links (`/orders`, `/account/profile`) plus sign out. Derive the Owner entry only from existing auth role/custom claim data. Preserve existing `signInWithGoogle()` invocation and its error `role="alert"`; do not implement any email check.

- [ ] **Step 5: Run focused tests to verify the contract passes**

Run: `npm run test:unit -- tests/unit/storefrontGrid.test.ts tests/unit/uiAccessibility.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/components/storefront/HeaderCartDrawer.tsx src/components/storefront/StorefrontHeader.tsx src/components/auth/AccountActions.tsx tests/unit/storefrontGrid.test.ts tests/unit/uiAccessibility.test.ts
git commit -m "feat: add responsive storefront navigation"
```

## Task 2: 收斂公開商品列表與商品詳情的採購資訊

**Files:**
- Modify: `src/components/storefront/PublicProductsBoard.tsx:30-374`
- Modify: `src/components/storefront/PublicProductDetailBoard.tsx:26-305`
- Modify: `src/components/storefront/ProductCoverImage.tsx` only if it needs an explicit `sizes` prop without changing storage source
- Modify: `tests/unit/storefrontGrid.test.ts:17-58`
- Modify: `tests/unit/guestCheckoutGate.test.ts:4-10`

**Interfaces:**
- Consumes: `PublicCatalogItem`, `getDefaultVariant`, `getDefaultCampaign`, `getEffectiveCatalogPriceTwd`, `formatCampaignDateTime`, `ProductCoverImage`, and existing `signInWithGoogle` / pending-cart intent flow.
- Produces: public 2-column mobile / 4-column desktop card markup; a detail image-gallery UI that retains the existing selected variant/campaign and `addToCart()` behaviour.

- [ ] **Step 1: Write failing public product UI contract tests**

Add checks that cards use `grid-cols-2` and `lg:grid-cols-4`, include image/name/price/sale type/deadline/supplement indicators, and do not render public description, SKU, costs, or internal fields on list cards. Require the detail source to contain a gallery index and accessible previous/next controls:

```ts
expect(list).toContain("grid-cols-2");
expect(list).toContain("lg:grid-cols-4");
expect(list).toContain("formatCampaignDateTime");
expect(list).toContain("可能二補");
expect(list).not.toContain("publicDescription}</p>");
expect(detail).toContain("activeImageIndex");
expect(detail).toContain('aria-label="上一張商品圖片"');
expect(detail).toContain('aria-label="下一張商品圖片"');
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm run test:unit -- tests/unit/storefrontGrid.test.ts tests/unit/guestCheckoutGate.test.ts`  
Expected: FAIL because the current list contains long descriptions/side summary and detail has no gallery controls.

- [ ] **Step 3: Refactor `PublicProductsBoard` visual hierarchy without changing product/cart reads**

Keep `listPublicProducts(db)` and existing cart API flow. Remove the desktop cart aside from this page because Header drawer owns quick cart access. Render a card whose information order is classifications (artist/series selected from existing public classifications), product name, effective price, sale type, deadline, conditional `可能二補`, then the 44px add button. Preserve Loading, Empty, Error/Retry, `role="alert"`, category filter semantics, and the existing logged-out Google sign-in path.

- [ ] **Step 4: Implement 4:5 detail gallery and progressive disclosure**

In `PublicProductDetailBoard`, derive `const images = catalogItem.product.images ?? []` and store `activeImageIndex`. Mobile uses scroll-snap or controlled previous/next buttons with a text position indicator; desktop retains the selected image at left. Keep only acquisition information above the fold. Move public description, notices, supplement content and purchasing notes below the primary add-to-cart area. Maintain variant/campaign selects and Server-authoritative `addToCart()` exactly as now.

- [ ] **Step 5: Run focused tests to verify pass**

Run: `npm run test:unit -- tests/unit/storefrontGrid.test.ts tests/unit/guestCheckoutGate.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
git add src/components/storefront/PublicProductsBoard.tsx src/components/storefront/PublicProductDetailBoard.tsx src/components/storefront/ProductCoverImage.tsx tests/unit/storefrontGrid.test.ts tests/unit/guestCheckoutGate.test.ts
git commit -m "feat: refine public product browsing"
```

## Task 3: 整理完整購物車與結帳視覺，不改提交流程

**Files:**
- Modify: `src/components/storefront/CartBoard.tsx:26-414`
- Modify: `tests/unit/guestCheckoutGate.test.ts:18-23`
- Modify: `tests/unit/uiAccessibility.test.ts:41-83`

**Interfaces:**
- Consumes: existing `CartBoard({ showCheckoutStep?: boolean })`, `buildCartSummary`, `isCheckoutSubmissionReady`, existing product cart API and `placeOrder()`.
- Produces: consistent cart item cards, a clear `/cart` to `/checkout` handoff, and the existing `/checkout` final form with only 7-ELEVEN selection.

- [ ] **Step 1: Write a failing checkout hierarchy test**

Require separate `showCheckoutStep` copy, a visible `前往結帳` link only for cart mode, and existing submission safety requirements:

```ts
expect(cart).toContain('showCheckoutStep ? "前往結帳" : "確認訂單"');
expect(cart).toContain('href="/checkout"');
expect(cart).toContain('const shippingMethod = "seven_eleven" as const;');
expect(cart).toContain("isOrderDisabled");
expect(cart).toContain('aria-live="polite"');
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm run test:unit -- tests/unit/guestCheckoutGate.test.ts tests/unit/uiAccessibility.test.ts`  
Expected: FAIL on the new distinct cart/checkout hierarchy assertion.

- [ ] **Step 3: Rework layout classes and copy only**

Use Astera surface/border/brand/service tokens for item cards and summaries. In cart mode, show a concise summary and `前往結帳`; leave recipient/contact, shipping and consents to the checkout step. In checkout mode, render the existing populated line items, recipient form, fixed 7-ELEVEN display, terms and supplement content, and `placeOrder()` CTA. Preserve all form `id` / `name` / autocomplete attributes, empty-cart prevention, disabled state, `placingOrder`, and post-order redirect/message behaviour.

- [ ] **Step 4: Run focused tests to verify pass**

Run: `npm run test:unit -- tests/unit/guestCheckoutGate.test.ts tests/unit/uiAccessibility.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add src/components/storefront/CartBoard.tsx tests/unit/guestCheckoutGate.test.ts tests/unit/uiAccessibility.test.ts
git commit -m "feat: clarify cart and checkout flow"
```

## Task 4: 加入一致的訂單狀態卡與付款請求預選入口

**Files:**
- Modify: `src/components/storefront/OrderHistoryBoard.tsx:9-114`
- Modify: `src/components/storefront/OrderDetailBoard.tsx:37-425`
- Modify: `src/components/storefront/PaymentRequestsBoard.tsx:13-390`
- Modify: `tests/unit/paymentRequestsBoard.test.ts:5-30`
- Create: `tests/unit/orderStatusCard.test.ts`

**Interfaces:**
- Consumes: `OrderBundle`, `LocalPaymentRequest`, `orderStatusLabel`, `paymentRequestStatusLabel`, `listMemberPaymentRequests`, and current `/payments` member request list.
- Produces: `getOrderAction(order, paymentRequest): { title: string; description: string; href?: string }` in a focused helper module or local pure function, and URL query key `paymentRequestId` which is accepted only if it is present in the loaded member-owned request list and actionable.

- [ ] **Step 1: Write failing pure status/action and payment preselection tests**

Create tests for: actionable awaiting-payment order returns `/payments?paymentRequestId=<id>`; confirmed/fulfilled order returns `目前無需處理` with no action URL; non-owned, paid, cancelled or unknown query IDs never alter selected request IDs.

```ts
expect(getOrderAction(awaitingPaymentOrder, request)).toMatchObject({
  title: "待付款",
  href: `/payments?paymentRequestId=${request.id}`,
});
expect(getOrderAction(confirmedOrder, null).title).toBe("目前無需處理");
expect(resolvePreselectedRequestIds([ownedPending], "foreign")).toEqual([]);
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm run test:unit -- tests/unit/orderStatusCard.test.ts tests/unit/paymentRequestsBoard.test.ts`  
Expected: FAIL because the status helper/preselection resolver does not exist.

- [ ] **Step 3: Implement the pure action and preselection boundaries**

Add a focused helper (for example `src/lib/storefront/orderActions.ts`) containing typed, deterministic `getOrderAction` and `resolvePreselectedRequestIds`. It must only receive already loaded member-owned payment requests; it must not call Firestore or accept front-end amounts. In `PaymentRequestsBoard`, read `paymentRequestId` with `useSearchParams`, apply the resolver after `loadRequests()` returns, and retain current multi-checkbox selection / automatic amount calculation.

- [ ] **Step 4: Render status card first in history/detail**

Use `getOrderAction` at the top of each order detail and appropriately in history card summaries. Pending work gets clear primary `前往付款回報`; all no-action statuses get the subdued `目前無需處理` card. Keep item cancellation/refund forms below the status and product sections; no cancellation API behaviour changes.

- [ ] **Step 5: Run focused tests to verify pass**

Run: `npm run test:unit -- tests/unit/orderStatusCard.test.ts tests/unit/paymentRequestsBoard.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```powershell
git add src/lib/storefront/orderActions.ts src/components/storefront/OrderHistoryBoard.tsx src/components/storefront/OrderDetailBoard.tsx src/components/storefront/PaymentRequestsBoard.tsx tests/unit/orderStatusCard.test.ts tests/unit/paymentRequestsBoard.test.ts
git commit -m "feat: clarify order actions and payment entry"
```

## Task 5: E2E 響應式驗收、完整驗證與交接更新

**Files:**
- Create: `tests/e2e/storefront-navigation.spec.ts` or the matching existing Playwright test location
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

**Interfaces:**
- Consumes: deployed/local existing Auth test fixtures and the Header/cart/order UI from Tasks 1–4.
- Produces: repeatable desktop/mobile smoke coverage that never writes real production orders, payments, or cancellations.

- [ ] **Step 1: Add failing Playwright coverage for public navigation and mobile layout**

Use existing fixture conventions. Assert public Header shows ASTERA, mobile viewport exposes cart and menu, menu expands below Header, close works with Escape, public product grid has two computed columns at 390px and four at 1365px, and product card controls are visible. Use no Google account credentials in public smoke.

```ts
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: /選單/ }).click();
await expect(page.getByRole("navigation", { name: /公開導覽|會員導覽/ })).toBeVisible();
await page.keyboard.press("Escape");
await expect(page.getByRole("navigation", { name: /公開導覽|會員導覽/ })).toBeHidden();
```

- [ ] **Step 2: Run the new Playwright file to verify failure**

Run: `npm run test:e2e -- tests/e2e/storefront-navigation.spec.ts`  
Expected: FAIL until the Header and responsive product changes exist.

- [ ] **Step 3: Complete selector/accessibility adjustments required by the test**

Use stable accessible roles/names and `data-testid` only where user-visible semantics are insufficient. Do not add test-only routes, fake products or authentication bypasses. Ensure drawer focus, menu close and no-horizontal-overflow assertions are satisfied at 390px, 768px and 1365px.

- [ ] **Step 4: Run focused E2E and full verification**

Run in order:

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run firebase:rules:test
npm run build
npm run test:e2e
npm run test:e2e:emulated
npm run check:secrets
npm run audit:production
```

Expected: every command exits 0. If an emulator test is blocked by managed sandbox process restrictions, record the exact command, OS error and next safe local run in the handoff; do not call it passing.

- [ ] **Step 5: Update execution plan and handoff with evidence**

In `docs/16_MVPCompletionPlan.md` and `docs/17_ProjectHandoff.md`, record changed files, commits, full command outcomes, tested viewport sizes, retained no-change business boundaries, deployment status, and next external action (Preview deployment/manual verification) if not deployed.

- [ ] **Step 6: Commit Task 5**

```powershell
git add tests/e2e/storefront-navigation.spec.ts docs/16_MVPCompletionPlan.md docs/17_ProjectHandoff.md
git commit -m "test: verify storefront navigation experience"
```

## Plan Self-Review

- **Spec coverage:** Task 1 covers the chosen mobile Header A layout, account content, Owner discoverability and drawer shell. Task 2 covers the 2/4 grid, six card fields, image gallery, and protected addition. Task 3 covers cart-to-checkout separation and 7-ELEVEN constraints. Task 4 covers permanent status cards and safe payment preselection. Task 5 covers required viewport, accessibility and regression validation plus handoff.
- **Deliberate scope boundaries:** Owner workspace visual redesign, bank account form redesign, payment report form redesign, and home-state implementation remain separate approved scopes; this plan only links existing routes and preserves their APIs.
- **Placeholder scan:** No unresolved markers or deferred implementation steps are present. The one E2E path alternative is explicitly constrained to the repository’s actual Playwright location because this workspace does not currently expose a standalone `e2e/` root.
- **Type consistency:** `HeaderCartDrawer`, `AccountActions` variants, `paymentRequestId`, `getOrderAction`, and `resolvePreselectedRequestIds` have a single named contract and are used consistently across their dependent tasks.
