# Payment Account Review and Workspace Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair legacy member payment-account re-verification, compact Owner rejected-payment history, and remove the duplicate Owner workspace overview.

**Architecture:** Keep the existing Firestore payment schema and server trust boundary. Add a member-scoped PATCH route that re-derives identity and updates the existing account document, render payment statuses into pending/history groups without changing payment APIs, and redirect only Owner `/workspace` visits to the existing Products page while preserving Partner/Helper landing behavior.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Firebase Admin transactions, Vitest, Playwright.

## Global Constraints

- Never return or log full bank account numbers, HMAC fingerprints, or canonical account input.
- All member payment-account writes remain server-authenticated and owner-scoped by `memberUid`.
- Re-verification must preserve the existing account document ID and immutable payment snapshots.
- Re-verification may only reactivate an active legacy record without deletion or archive markers; pending or archived records remain Owner-controlled.
- Rejection grouping is UI-only; payment status transitions and audit APIs stay unchanged.
- Use existing Astera tokens and minimum 44px controls for new UI actions.

---

### Task 1: Add the member re-verification API contract

**Files:**
- Create: `src/app/api/member/payment-accounts/[id]/route.ts`
- Modify: `src/app/api/member/payment-accounts/route.ts` only if a shared identity-update helper is extracted
- Test: `tests/unit/memberPaymentAccountApi.test.ts`

**Interfaces:**
- Consumes: `PATCH /api/member/payment-accounts/:id` JSON `{ bankCode, accountNumberFull, payerName }` and Firebase bearer token.
- Produces: `{ account: PublicMemberPaymentAccount, warning?: "member_payment_account_duplicate_review_pending" }` with the original account ID.

- [x] **Step 1: Write the failing API test**

Add a mocked Admin transaction fixture and a test that sends `PATCH` for a legacy account owned by `member-a`, expects status 200, preserves `account-a`, returns masked verified data, and asserts the update contains a fresh identity without `accountNumberFull`. Add a second test asserting another member receives 404 and no transaction update.

- [x] **Step 2: Run the focused test to verify RED**

Run: `npx vitest run tests/unit/memberPaymentAccountApi.test.ts`

Expected: FAIL because `src/app/api/member/payment-accounts/[id]/route.ts` and its PATCH handler do not exist.

- [x] **Step 3: Implement the minimal transaction-safe PATCH route**

Authenticate with `requireFirebaseUser`, validate input with `validateMemberPaymentAccountInput`, derive identity with `CloudKmsMac`, load the document inside `runTransaction`, reject missing or foreign documents, and `transaction.update` the original document with the identity, payer name, `status: "active"`, `verificationStatus: "verified"`, and updated actor/timestamp fields. Reuse the existing duplicate notification contract while excluding the current document from candidate review IDs.

- [x] **Step 4: Run the focused API tests to verify GREEN**

Run: `npx vitest run tests/unit/memberPaymentAccountApi.test.ts`

Expected: all member payment-account API tests pass, including masked output and ownership failures.

### Task 2: Add the re-verification form to the member account card

**Files:**
- Modify: `src/components/account/MemberPaymentAccountsBoard.tsx`
- Test: `tests/unit/memberPaymentAccountsUi.test.ts`
- Test: `tests/e2e/member-account-fingerprint-refund.spec.ts` only if the existing authenticated flow needs a browser assertion

**Interfaces:**
- Consumes: the Task 1 PATCH endpoint and existing `PublicMemberPaymentAccount` snapshot.
- Produces: an accessible inline re-verification form, loading state, masked success message, and no full-account persistence in React state after submission.

- [x] **Step 1: Write the failing UI contract tests**

Assert the legacy branch contains bank-code, full-account, and payer-name inputs, calls `PATCH /api/member/payment-accounts/`, labels the action `重新驗證`, and no longer tells the member only to add a new account.

- [x] **Step 2: Run the focused UI tests to verify RED**

Run: `npx vitest run tests/unit/memberPaymentAccountsUi.test.ts`

Expected: FAIL because the current legacy branch has no form and only renders the “請重新新增帳戶” copy.

- [x] **Step 3: Implement the inline form**

Add per-account draft state and a pending ID. Submit the three fields to PATCH with the Firebase token, replace the returned snapshot by ID, clear drafts, and announce success/error through the existing `role="status"` message. Keep full account data only in the transient input state and clear it after success.

- [x] **Step 4: Run focused UI tests to verify GREEN**

Run: `npx vitest run tests/unit/memberPaymentAccountsUi.test.ts`

Expected: all existing and new account UI assertions pass.

### Task 3: Group Owner payment records by operational status

**Files:**
- Modify: `src/components/workspace/PaymentOperationsBoard.tsx`
- Modify: `tests/unit/paymentOperationsBoard.test.ts`
- Modify: `tests/e2e/member-payment-cancellation-flow.spec.ts` only if a stable authenticated UI assertion is needed

**Interfaces:**
- Consumes: existing `payments` state and `paymentReviewStatusLabel`.
- Produces: pending cards in the actionable list; rejected cards under a collapsed `已拒絕（N）` disclosure; confirmed/reversed cards in a separate history disclosure; selected details remain read-only when status is no longer actionable.

- [x] **Step 1: Write the failing presentation tests**

Assert the board source derives a `pendingReview` group and a `rejected` group, renders `已拒絕`, uses a native `details`/`summary` disclosure, and does not map every payment directly into the main list.

- [x] **Step 2: Run the focused board tests to verify RED**

Run: `npx vitest run tests/unit/paymentOperationsBoard.test.ts`

Expected: FAIL because the current board maps the entire `payments` array directly and has no rejected disclosure.

- [x] **Step 3: Implement the grouped rendering**

Derive pending, rejected, and history arrays with `useMemo`; render pending items first, render rejected items inside a closed-by-default `<details>` block with count, and render confirmed/reversed records inside a separate history block. After a rejection, select the next pending payment or clear selection so the side panel never offers an action for the moved record.

- [x] **Step 4: Run focused board tests to verify GREEN**

Run: `npx vitest run tests/unit/paymentOperationsBoard.test.ts`

Expected: all board tests pass and payment API tests remain unchanged.

### Task 4: Remove the duplicate Owner workspace overview

**Files:**
- Modify: `src/app/workspace/page.tsx`
- Modify: `src/components/workspace/WorkspaceShell.tsx`
- Modify: `tests/unit/accountActions.test.ts`
- Modify: `tests/unit/uiAccessibility.test.ts`
- Modify: `tests/e2e/workspace-member-flow.spec.ts` if the Owner landing redirect needs browser coverage

**Interfaces:**
- Consumes: existing role claims and workspace navigation.
- Produces: Owner `/workspace` redirect to `/workspace/products`; no Owner overview cards or Owner sidebar workspace item; Partner/Helper landing and route guards unchanged.

- [x] **Step 1: Write the failing navigation tests**

Assert Owner `/workspace` calls or renders a redirect to `/workspace/products`, the Owner shell does not contain a `/workspace` navigation link, and the home source no longer contains Owner overview card labels. Keep assertions that Partner and Helper still have `/workspace` access.

- [x] **Step 2: Run the focused navigation tests to verify RED**

Run: `npx vitest run tests/unit/accountActions.test.ts tests/unit/uiAccessibility.test.ts`

Expected: FAIL because the current Owner page renders the duplicate cards and the shell includes the active Workspace link.

- [x] **Step 3: Implement the role-specific landing behavior**

Use the client App Router `router.replace` for Owner only (the page reads the client auth role), remove the Owner `/workspace` navigation entry while retaining it for Partner/Helper, and keep existing Owner/Partner/Helper route guards. Do not remove `/workspace` itself for Helper.

- [x] **Step 4: Run focused navigation tests to verify GREEN**

Run: `npx vitest run tests/unit/accountActions.test.ts tests/unit/uiAccessibility.test.ts`

Expected: Owner no longer sees duplicate overview content; Partner/Helper tests continue to pass.

### Task 5: Full regression verification and handoff

**Files:**
- Modify: none unless a test or documentation assertion requires the final copy
- Test: `tests/unit/memberPaymentAccountApi.test.ts`, `tests/unit/memberPaymentAccountsUi.test.ts`, `tests/unit/paymentOperationsBoard.test.ts`, `tests/unit/accountActions.test.ts`, `tests/unit/uiAccessibility.test.ts`, full test suites

- [x] **Step 1: Run focused combined tests**

Run: `npx vitest run tests/unit/memberPaymentAccountApi.test.ts tests/unit/memberPaymentAccountsUi.test.ts tests/unit/paymentOperationsBoard.test.ts tests/unit/accountActions.test.ts tests/unit/uiAccessibility.test.ts`

- [x] **Step 2: Run project verification**

Run: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`.

- [x] **Step 3: Run payment and workspace emulator acceptance**

Run: `$env:PLAYWRIGHT_PORT='3113'; npm run test:e2e:emulated` and confirm the payment-account, payment-rejection, and workspace navigation specs pass.

- [x] **Step 4: Review the final diff and commit**

Run: `git diff --check`, inspect only owned feature files, then commit with `git add` limited to the spec/plan and implementation/test files and message `fix: streamline payment review and workspace navigation`.
