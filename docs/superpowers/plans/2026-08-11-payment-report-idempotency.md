# Payment Report Idempotency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate payment reports, make member-visible review status persistent, and let Owners reject invalid pending reports without mutating financial allocations.

**Architecture:** Keep the existing `payments` collection and protected Next.js route handlers. The client sends a stable idempotency key; the server derives opaque deterministic Payment IDs and verifies an immutable payload digest inside the Firestore transaction. Member reads are served through a sanitized Admin SDK API. Owner rejection appends an audit record and changes only an unallocated `pendingReview` Payment.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Firebase Admin SDK, Firestore, Vitest, Playwright.

## Global Constraints

- Do not change collection architecture or allow Client SDK business writes.
- Owner authorization remains Firebase custom claims only.
- Never expose account fingerprints, KMS key versions, complete account numbers, internal review data, or other members' payments.
- Existing duplicated production/Preview test records are preserved until an Owner explicitly rejects one after deployment.
- Follow red-green-refactor: add a failing focused test, observe failure, implement the smallest change, then rerun.
- Read relevant Next.js 16 route-handler documentation before changing route handlers.

---

## Task 1: Deterministic payment-report idempotency

**Files:**
- Create: `src/lib/payment/reportIdempotency.ts`
- Create: `tests/unit/paymentReportIdempotency.test.ts`
- Modify: `src/app/api/payments/route.ts`
- Modify: `tests/unit/paymentReport.test.ts`

- [x] Add tests for idempotency-key validation, canonical immutable payload hashing, opaque deterministic Payment IDs, and stable allocation IDs.
- [x] Run `npm run test:unit -- tests/unit/paymentReportIdempotency.test.ts` and confirm the tests fail because the helper does not exist.
- [x] Implement SHA-256 helpers using Node crypto. IDs must not contain the member UID or raw idempotency key.
- [x] Add API tests for first creation, identical sequential replay, concurrent replay, same-key/different-payload `409 idempotency_conflict`, and different-key legitimate reports.
- [x] Require `idempotencyKey` in `POST /api/payments`, store a payload digest, use deterministic Payment refs, and return `alreadyExists` without duplicate writes when all existing records match.
- [x] Reject partial/corrupt existing groups and key reuse with different immutable input as `409`.
- [x] Run both focused test files and commit the task.

## Task 2: Sanitized member payment history API

**Files:**
- Modify: `src/app/api/payments/route.ts`
- Create: `tests/unit/memberPaymentsApi.test.ts`
- Modify: `src/lib/payment/manualBankTransfer.ts`

- [x] Add failing tests proving `GET /api/payments` requires authentication, scopes by `memberUid`, orders newest first, and returns only the approved safe fields.
- [x] Explicitly assert the response omits full account data, fingerprints, algorithms, key versions, internal reasons, creator metadata, and other members' records.
- [x] Implement the Admin SDK query and a dedicated public/member-safe payment shape.
- [x] Run focused tests and commit the task.

## Task 3: Member UI retry safety and persistent status

**Files:**
- Modify: `src/components/storefront/PaymentRequestsBoard.tsx`
- Create or modify: `tests/unit/paymentRequestsBoard.test.tsx`
- Modify: `tests/e2e/member-payment-cancellation-flow.spec.ts`

- [ ] Add failing component/source tests for a synchronous submission lock, stable idempotency-key reuse across ambiguous failures, clearing the key only after explicit success, and disabled `送出中…` feedback.
- [ ] Add failing tests for the persistent `我的付款回報` list and Chinese labels for `pendingReview`, `confirmed`, `rejected`, and `reversed`.
- [ ] Implement a `useRef` synchronous guard and a per-draft idempotency key lifecycle; do not rely only on asynchronous React state.
- [ ] Load `/api/payments` alongside payment requests/accounts and refresh history after success.
- [ ] Render safe masked account information, amount, date, and review state with accessible loading/empty/error/retry states.
- [ ] Add Playwright coverage for rapid double click/retry and persistence after reload.
- [ ] Run focused Unit and Playwright tests and commit the task.

## Task 4: Owner rejection API with immutable audit trail

**Files:**
- Create: `src/app/api/workspace/payments/[id]/reject/route.ts`
- Create: `tests/unit/paymentRejectApi.test.ts`
- Reuse patterns from: `src/app/api/workspace/payments/[id]/confirm/route.ts`

- [ ] Add failing tests for missing token, Member/Helper denial, required reason, missing Payment, pending rejection, repeated rejection idempotency, and confirmed/reversed conflict.
- [ ] Implement Owner custom-claim authorization and a Firestore transaction.
- [ ] Change only `pendingReview` to `rejected`, save a safe Owner reason, and append immutable `payment.rejected` Audit Log metadata without account secrets.
- [ ] Ensure rejection does not create allocations or change PaymentRequest, Order, or OrderItem financial state.
- [ ] Run focused tests and commit the task.

## Task 5: Owner rejection UI

**Files:**
- Modify: `src/components/workspace/PaymentOperationsBoard.tsx`
- Modify: `tests/e2e/member-payment-cancellation-flow.spec.ts`
- Create or modify: `tests/unit/paymentOperationsBoard.test.tsx`

- [ ] Add failing tests for the `拒絕回報` action only on `pendingReview`, mandatory reason, disabled in-flight controls, and accessible success/error feedback.
- [ ] Implement the protected reject call and refresh the Owner list after success.
- [ ] Confirm confirmed/reversed/rejected records cannot be rejected from the UI.
- [ ] Add Owner Playwright coverage and commit the task.

## Task 6: Regression verification, Preview, and controlled duplicate cleanup

**Files:**
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`
- Modify relevant Test Plan, Deployment SOP, and Changelog documents discovered with `rg`.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run test:unit`.
- [ ] Run complete Firestore and Storage Rules tests.
- [ ] Run `npm run build`.
- [ ] Run regular and Emulator Playwright suites.
- [ ] Run secret scan and production audit scripts defined in `package.json`.
- [ ] Update execution/handoff documents with exact files, commits, counts, verification output, deployment state, and next action.
- [ ] Push `codex/mvp-completion`, deploy Preview only, and run the member report plus Owner rejection acceptance flow.
- [ ] Before changing either existing duplicate test Payment, present the exact safe action and obtain fresh action-time approval; then keep one valid record and reject the other through the new audited API.
