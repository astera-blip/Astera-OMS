# Reversible Checkout Preview Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify a complete Preview-only Checkout and unpaid direct-cancellation lifecycle using isolated test data and leave no payable, fulfilment, or refund work behind.

**Architecture:** The existing protected Owner Product API creates a clearly labelled Product, Variant, and Campaign. The existing member Checkout API creates the authoritative Order, OrderItem, PaymentRequest, ConsentRecord, and notification event; the existing cancellation API resolves the unpaid OrderItem directly. No database schema, rules, SKU generator, payment logic, or production deployment is changed.

**Tech Stack:** Next.js 16 Preview deployment, Firebase Authentication, Firestore Admin SDK over Vercel OIDC, existing Product Workspace and storefront UI, Firestore-backed API routes, Git documentation.

## Global Constraints

- Use only the `codex/mvp-completion` Vercel Preview, never Production.
- Use `astera.0920@gmail.com`; it has an Owner claim, so record that non-Owner authorization is out of scope.
- Product, Variant, and Campaign IDs/SKUs are Server-managed and must never be supplied manually.
- Use NT$1; do not submit a payment report, confirm a payment, reverse a payment, or process a refund.
- Do not hard-delete Order, OrderItem, PaymentRequest, ConsentRecord, Audit Log, or notification event records.
- Archive the test Product/Campaign after verification; do not delete it.
- Preserve the user-owned `AGENTS.md` working-tree modification.
- Stop after the first failing mutation, record the safe identifiers and error evidence, and repair before attempting a new Checkout.

---

## File structure

- Create: `docs/superpowers/plans/2026-07-30-reversible-checkout-preview-test.md` — reproducible execution sequence and acceptance checklist.
- Modify: `docs/16_MVPCompletionPlan.md` — append Preview test data identifiers, observed states, defects, test results, and the next exact step.
- Modify: `docs/17_ProjectHandoff.md` — append the same operations handoff evidence and any unresolved limitation.
- Use without source edits: `src/app/api/checkout/route.ts` — authoritative Checkout behavior under test.
- Use without source edits: `src/app/api/cancellations/route.ts` — unpaid direct-cancellation behavior under test.

## Task 1: Establish an isolated Preview baseline

**Live status (2026-07-30):** Completed. The branch-stable Preview, signed-in account and empty cart baseline are recorded in both handoff documents. Production was not opened.

**Files:**
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

**Interfaces:**
- Consumes: stable branch Preview URL and an authenticated `astera.0920@gmail.com` browser session.
- Produces: a timestamped baseline entry with the selected Preview URL and pre-existing cart state.

- [x] **Step 1: Open the branch-stable Preview, not `astera-oms.vercel.app`**

Run in the browser: open `https://astera-oms-git-codex-mvp-completion-astera-oms.vercel.app/` and verify the signed-in account is `astera.0920@gmail.com`.

- [x] **Step 2: Capture only visible baseline state**

Run in the browser: visit `/cart`, record whether the cart contains existing items, and do not clear any item that is not named `【測試專用】Preview Checkout — 請勿付款`.

- [x] **Step 3: Record the baseline**

Append a dated entry to both handoff documents containing the Preview URL, account role, existing cart summary, and the statement that Production was not opened.

- [x] **Step 4: Verify the baseline entry is present**

Run: `rg -n "Reversible Checkout Preview" docs/16_MVPCompletionPlan.md docs/17_ProjectHandoff.md`

Expected: one current timestamped baseline entry appears in each document.

## Task 2: Create and expose dedicated test catalog data

**Live status (2026-07-30):** Completed after the ProductWorkspace loading guard was deployed and verified. The original pre-load form/save race was repaired before the dedicated test Product was created.

**Files:**
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

**Interfaces:**
- Consumes: Owner Workspace Product API; automatic Product/Variant SKU allocation.
- Produces: one published Preview Product, one open Campaign, and a visible `productsPublic` listing with price NT$1.

- [x] **Step 1: Create the Product through Owner Workspace**

Run in the browser at `/workspace/products`: create a new Product named `【測試專用】Preview Checkout — 請勿付款`, use one default Variant named `Test Variant（測試規格）`, set currency to `TWD`, default price to `1`, and leave internal-only fields empty unless required by the form.

- [x] **Step 2: Create its Campaign through Owner Workspace**

Run in the browser on the same Product: create `TEST-ONLY Preview Checkout — 請勿付款`, set sale type to `preorder`, sale price to `1`, and choose a start time already passed plus an end time at least one hour in the future. Publish the Product and leave the Campaign open.

- [x] **Step 3: Verify public projection and SKU ownership**

Run in the browser at `/products`: confirm exactly the test Product's public name, Test Variant, Campaign, and NT$1 price appear; confirm no SKU, cost, or internal note is shown.

- [x] **Step 4: Record generated identifiers**

Append the browser-visible Product ID/SKU, Variant ID/SKU, Campaign ID, published time, and public listing result to both handoff documents. Do not infer identifiers from a list position.

- [ ] **Step 5: Stop on a projection mismatch**

If the product is absent, price is not NT$1, Campaign is not open, or an internal value is visible: do not continue to cart or Checkout. Record the exact mismatch and repair it in a separate red-green source change before retrying with a newly named test product.

## Task 3: Verify cart persistence and create one unpaid Checkout

**Files:**
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

**Interfaces:**
- Consumes: publicly listed test Product and `/api/cart` hydration guard.
- Produces: exactly one Checkout result containing `orderId`, formal `orderNumber`, and `paymentRequestId`.

- [x] **Step 1: Add only the test item and verify cart hydration**

Run in the browser at the test Product detail page: add quantity one of `Test Variant（測試規格）` to cart. Visit `/cart`, reload once, and verify the line name, Variant name, Campaign, and total are all visible and the total is NT$1.

- [x] **Step 2: Submit the Checkout once**

Run in the browser at `/cart`: use recipient `Preview Test — 請勿出貨`, phone `0900000000`, address shipping with `Preview only — 不出貨、不付款`, select the required shipping option, accept the legal and supplementary rules, then click `建立訂單` once. Do not retry the button while it is processing.

- [ ] **Step 3: Capture authoritative result**

Run in the browser: open the resulting member order detail page and record its order number, item status, total, and payment-request state. The expected initial states are `awaitingPayment` for Order and OrderItem and `open` for PaymentRequest.

- [x] **Step 4: Verify idempotency by observation, not a second order**

Verify the UI shows only one newly created test Order and the cart has been cleared. Do not create a second Checkout to probe idempotency; the existing API and automated tests cover identical-request behavior without creating extra Preview business data.

- [ ] **Step 5: Record Checkout evidence**

Append order number, order ID if safely visible, payment request ID if safely visible, creation time, displayed statuses, and notification status (if visible) to both handoff documents. State explicitly that no payment report or payment confirmation was created.

## Task 4: Directly cancel the unpaid test item and archive catalog data

**Files:**
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

**Interfaces:**
- Consumes: the Task 3 Order in `awaitingPayment` with its single unpaid OrderItem.
- Produces: a cancelled Order, OrderItem, and PaymentRequest, with the test catalog data archived.

- [ ] **Step 1: Cancel the sole unpaid OrderItem from the member order page**

Run in the browser: select only the test OrderItem, enter `Preview Checkout reversible test — no payment, do not fulfil`, and submit the cancellation once.

- [ ] **Step 2: Verify direct-cancellation terminal state**

Run in the browser: reload the order detail and confirm Order, selected OrderItem, and PaymentRequest each show `cancelled`; confirm total and payment request amount show NT$0; confirm there is no cancellation request awaiting Owner review.

- [ ] **Step 3: Verify forbidden payment paths were not used**

Run in the browser: confirm no payment report is listed and no payment confirmation, reversal, adjustment, or refund action was performed. Do not manufacture a payment to test these unrelated paths.

- [ ] **Step 4: Archive, never delete, the test Product and Campaign**

Run in Owner Workspace: set the test Campaign and Product to Archived. Then reload `/products` and confirm the exact test Product is no longer publicly listed.

- [ ] **Step 5: Record retained audit evidence**

Append cancellation timestamp, terminal statuses, archived catalog IDs, and the explicitly retained ConsentRecord / Audit Log / notification-event policy to both handoff documents.

## Task 5: Close the execution record and verify documentation

**Files:**
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

**Interfaces:**
- Consumes: browser evidence from Tasks 1–4.
- Produces: an exact pass/fail handoff record and a list of any code defect with reproduction steps.

- [ ] **Step 1: Compare observed outcomes to acceptance criteria**

Run: `Get-Content 'docs/superpowers/specs/2026-07-30-reversible-checkout-test-design.md'`

Expected: each acceptance criterion has a corresponding documented observation or a documented failure.

- [ ] **Step 2: Run documentation integrity checks**

Run: `git diff --check`

Expected: exit code `0` and no whitespace errors.

- [ ] **Step 3: Preserve unrelated worktree state**

Run: `git status --short`

Expected: `AGENTS.md` remains unstaged; only deliberately modified documentation is staged for a follow-up commit.

- [ ] **Step 4: Commit the completed evidence only after all observations are recorded**

Run:

```powershell
git add -- docs/16_MVPCompletionPlan.md docs/17_ProjectHandoff.md docs/superpowers/plans/2026-07-30-reversible-checkout-preview-test.md
git commit -m "docs: record reversible checkout preview test"
```

Expected: the commit excludes `AGENTS.md` and includes the execution evidence.

## Plan self-review

- Spec coverage: Tasks 1–5 cover Preview-only isolation, dedicated catalog data, one checkout, no-money cancellation, archival, retained audit records, notification risk, and the documented acceptance criteria.
- Scope: the plan does not alter data models, Firestore rules, payment behavior, production resources, or non-Owner authorization.
- Interfaces: every browser mutation uses existing Owner Workspace, Checkout, or Cancellation APIs; no direct Firestore write is introduced.
- Failure policy: every mutation task contains a stop condition that prevents duplicate Checkout or accidental financial-state testing.
