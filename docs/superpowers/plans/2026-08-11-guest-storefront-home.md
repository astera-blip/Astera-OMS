# Astera Guest Storefront Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing `/` route as the approved public Astera curated storefront while preserving the current Firebase, `productsPublic`, authentication, cart, and checkout boundaries.

**Architecture:** Keep `src/app/page.tsx` as the real homepage composition and reuse the shared layout Header/Footer. Refactor `FeaturedProductsBoard` as the single client boundary that loads `productsPublic`, renders unique Campaign cards and the responsive product grid, and delegates pending guest-cart intent to a small tested browser-storage helper before using the existing Firebase redirect login.

**Tech Stack:** Next.js 16.2.11 App Router, React 19, TypeScript, Tailwind CSS 4, Firebase Auth／Firestore, Vitest, Playwright.

## Global Constraints

- Modify the existing `/` route; do not create an alternate homepage, mockup route, or fake catalog.
- `productsPublic` remains the only public product source.
- Do not change Collections, Firestore／Storage Rules, Checkout, pricing, splitting, or Order logic.
- Preserve Firebase Google redirect login and the existing profile-completion guard.
- Product grids are 2 columns at 390px and 4 columns at 1365px; all controls are at least 44px.
- Use the approved Astera tokens and no new slate／amber primary styling.

---

### Task 1: Lock the homepage contract with failing tests

**Files:**
- Modify: `tests/unit/storefrontGrid.test.ts`
- Create: `tests/e2e/public-home.spec.ts`

**Interfaces:**
- Consumes: current `/`, `StorefrontHeader`, `FeaturedProductsBoard`.
- Produces: regression assertions for page order, public copy, responsive grid, Campaign details, guest login intent, and overflow.

- [x] Add Unit source-contract assertions that `page.tsx` contains `#featured-products`, `#shopping-guide`, `#supplement`, and `#faq-support` in order and excludes `ASTERA OMS`, `Owner`, `Firestore`, `Audit Log`, and `MVP`.
- [x] Add Unit assertions that `FeaturedProductsBoard` imports the existing catalog repository, cart validation/API flow, and pending intent helper; renders `grid-cols-2 lg:grid-cols-4`, 4:5 image component, `aria-live`, Retry, Sale Type, deadline, and supplement text.
- [x] Add Playwright tests at 390, 768, and 1365 widths. Use `getComputedStyle(grid).gridTemplateColumns` to assert 2, 2, and 4 columns, and assert `document.documentElement.scrollWidth <= window.innerWidth`.
- [x] Run focused Unit tests and confirm all eight new assertions fail for the expected missing homepage behavior／module.

### Task 2: Add the minimal pending guest-cart intent helper

**Files:**
- Create: `src/lib/cart/pendingCartIntent.ts`
- Create: `tests/unit/pendingCartIntent.test.ts`

**Interfaces:**
- Produces:
  - `type PendingCartIntent = Pick<CartLineItem, "productId" | "variantId" | "saleCampaignId" | "quantity">`
  - `savePendingCartIntent(intent: PendingCartIntent): void`
  - `loadPendingCartIntent(): PendingCartIntent | null`
  - `clearPendingCartIntent(): void`

- [x] Write tests for round-trip storage, unavailable browser storage, malformed JSON, unexpected fields, non-positive quantity, and clear-after-success behavior.
- [x] Run the focused test and observe the missing-module failure.
- [x] Implement a fixed session-storage key and strict runtime parsing. Do not store name, price, email, role, Campaign status, or profile data.
- [x] Run the focused test and confirm all cases pass.

### Task 3: Refactor the real shared Header and authentication presentation

**Files:**
- Modify: `src/components/storefront/StorefrontHeader.tsx`
- Modify: `src/components/auth/AccountActions.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `tests/unit/uiAccessibility.test.ts`

**Interfaces:**
- Consumes: `useAuth().status`, `user`, `error`, `signInWithGoogle`, `signOut`.
- Produces: buyer-facing `ASTERA` header and reusable accessible account action rendering.

- [x] Add failing assertions for `ASTERA`, public navigation, cart, exact `使用 Google 登入`, loading semantics, and absence of `OMS`／`Operations Workspace` metadata.
- [x] Run the focused Unit test and confirm it fails on old copy/styles.
- [x] Rebuild `StorefrontHeader` with white surface, fine border, serif logo, public navigation, cart, and reused `AccountActions`; retain the workspace exclusion.
- [x] Restyle `AccountActions` with Astera tokens, 44px controls, `aria-live` error, and existing auth methods unchanged.
- [x] Replace Root metadata with buyer-facing Astera title/description.
- [x] Re-run the focused test.

### Task 4: Rebuild `/` and its real product/Campaign board

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/storefront/FeaturedProductsBoard.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/storefrontGrid.test.ts`

**Interfaces:**
- Consumes: `listPublicProducts`, `rankFeaturedProducts`, `featuredCampaign`, `getDefaultVariant`, `getEffectiveCatalogPriceTwd`, `validateCartAddition`, `/api/cart`, `useAuth`, and Task 2 intent helpers.
- Produces: the fixed homepage sections and working homepage add-to-cart flow.

- [x] Implement the Hero and lower sections in the approved order with anchors `featured-products`, `shopping-guide`, `supplement`, and `faq-support`.
- [x] Refactor Campaign cards to show title, public classification summary, Chinese Sale Type, Taipei deadline, remaining-time copy, and supplement state.
- [x] Refactor product cards to prioritize 4:5 images and show title, authoritative effective price, Sale Type, Campaign, deadline, supplement Badge, detail link, and 44px add button.
- [x] For a guest click, derive the current default Variant／Campaign from loaded catalog, save only their IDs and quantity, announce the login requirement, and call the existing `signInWithGoogle`.
- [x] After authentication and profile availability, reload/validate the IDs against the current catalog, merge with the protected member cart via `/api/cart`, clear the pending intent only after success, and announce the result.
- [x] Add stable product-grid hooks/classes and Skeleton cards with 4:5 reserved space. Keep Empty, Error, Retry, `aria-live`, and `role="alert"` states.
- [x] Add only small global utilities needed for serif branding, tabular numbers, touch manipulation, and non-layout-shifting hover/press states; keep `prefers-reduced-motion`.
- [x] Run the focused Unit tests: 4 files／29 tests passed.

### Task 5: Responsive and public behavior acceptance

**Files:**
- Modify: `tests/e2e/public-home.spec.ts`
- Modify: `tests/e2e/public-smoke.spec.ts` only if old buyer-facing expectations conflict.

**Interfaces:**
- Consumes: completed `/` and emulator-seeded `productsPublic`.
- Produces: automated evidence for public rendering and responsive behavior.

- [x] Run the focused Playwright file against desktop and mobile projects.
- [x] Verify 390／768／1365px column counts and no horizontal overflow.
- [x] Verify the page contains no public OMS／Owner／Firestore／Audit Log／MVP copy.
- [x] Verify Campaign and product cards use real seeded projection data and no hard-coded fake products.
- [x] Verify the existing Firebase login path remains and Emulator auth resumes the validated pending intent.

### Task 6: Full verification and handoff

**Files:**
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`
- Modify: `docs/10_TestPlan.md`
- Modify: this plan checklist.

**Interfaces:**
- Produces: reproducible verification and continuation record.

- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run `npm run test:unit`: 56 files／450 tests.
- [x] Run `npm run build`: 42 routes.
- [x] Run focused public-home Playwright: regular 16 passed／10 expected Emulator-only skips; Emulator 10 passed.
- [x] Inspect the final diff: no Collection, Rules, Checkout, Order, pricing, or API schema changes.
- [x] Update plan and handoff with exact changed files, test counts, failures/fixes, and deployment state.
- [x] Commit completed implementation as `54a8b03`. Preview and Production remain undeployed.
