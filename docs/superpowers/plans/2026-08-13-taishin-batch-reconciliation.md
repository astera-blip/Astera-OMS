# Taishin Batch Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Owner-only Taishin `.xlsx` workflow that compares every pending payment-report group, safely selects only unique matches, and confirms the Owner-selected matches in a partially successful batch.

**Architecture:** Keep Excel parsing and matching as pure server-side modules. Preview requests parse the workbook and read authoritative `pendingReview` Payments through Admin SDK; recognition requests re-upload and re-parse the same workbook, re-read all selected Payments, and reuse the existing payment confirmation transaction logic. A deterministic SHA-256 bank-transaction fingerprint is claimed through an immutable `auditLogs` document so the same transaction cannot be recognized twice.

**Tech Stack:** Next.js 16 Route Handlers, React, TypeScript, Firebase Admin SDK/Firestore transactions, ExcelJS, Vitest, Firebase Emulator, Playwright.

## Global Constraints

- Only Firebase custom claim `role: owner` may preview or recognize reconciliation data.
- Do not save the original Excel file, bank balance, original remark, or full account number.
- Do not change Collections, Checkout semantics, or Firestore Rules architecture.
- A payment report can contain several Payment documents linked by `paymentGroupId`; compare its aggregate amount to one bank transaction and recognize the entire selected group.
- “Select all” may select only unique, currently safe matches.
- The client never decides amounts, statuses, or whether a match is valid.
- Recognition must re-parse the uploaded workbook and revalidate Firestore state.
- One failed selected group must not roll back other successful groups.
- Use existing payment confirmation, allocation, order update, notification, and Audit Log semantics.

---

### Task 1: Safe Taishin parsing and transaction identity

**Files:**
- Modify: `src/lib/reconciliation/taishin.ts`
- Modify: `tests/unit/taishinReconciliation.test.ts`

**Interfaces:**
- Produces: `TaishinTransaction` with `transactionFingerprint`, `transactionAt`, `accountingDate`, `method`, `amountTwd`, and `accountLast5` only.
- Produces: `buildTaishinTransactionFingerprint(input): string`.
- Removes from API-facing parsed objects: `balanceTwd`, `remark`, and legacy `matchKey`.

- [ ] **Step 1: Write failing parser and fingerprint tests**

```ts
expect(transaction).not.toHaveProperty("remark");
expect(transaction).not.toHaveProperty("balanceTwd");
expect(transaction.transactionFingerprint).toMatch(/^[a-f0-9]{64}$/);
expect(buildTaishinTransactionFingerprint(sameNormalizedInput)).toBe(firstFingerprint);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm run test:unit -- tests/unit/taishinReconciliation.test.ts`

- [ ] **Step 3: Implement canonical parsing and SHA-256 fingerprinting**

Use `node:crypto`, normalize date/method/amount/last-five fields, and discard balance and original remark after extraction. Identical normalized rows intentionally produce the same fingerprint so the matcher classifies them as duplicate instead of guessing that they are independent transactions.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm run test:unit -- tests/unit/taishinReconciliation.test.ts`

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- src/lib/reconciliation/taishin.ts tests/unit/taishinReconciliation.test.ts
git commit -m "feat: secure Taishin transaction parsing"
```

### Task 2: Pure payment-report group matching

**Files:**
- Create: `src/lib/reconciliation/paymentMatching.ts`
- Create: `tests/unit/paymentReconciliationMatching.test.ts`

**Interfaces:**
- Consumes: `TaishinTransaction[]`, `LocalPayment[]`, and already claimed fingerprints.
- Produces: `buildPendingPaymentGroups(payments)`.
- Produces: `matchTaishinTransactions({ transactions, payments, claimedFingerprints })`.
- Produces result categories: `unique_match | ambiguous | unmatched | insufficient_data | duplicate`.
- A unique result includes `reconciliationItemId`, `transactionFingerprint`, `paymentGroupId`, `paymentIds`, `amountTwd`, safe account/payer/order identifiers, `selectable: true`, and `selectedByDefault: true`.

- [ ] **Step 1: Write failing classification tests**

Cover one-to-one matches, aggregated multi-Payment groups, two Payments matching one transaction, two identical transactions matching one group, missing last-five, claimed fingerprint, and non-pending Payments.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm run test:unit -- tests/unit/paymentReconciliationMatching.test.ts`

- [ ] **Step 3: Implement grouping and matching**

Group by `paymentGroupId ?? payment.id`, require one common member-account last-five in the group, sum `receivedAmountTwd`, and make a result selectable only when both sides have exactly one candidate and the fingerprint is unclaimed.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm run test:unit -- tests/unit/paymentReconciliationMatching.test.ts`

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- src/lib/reconciliation/paymentMatching.ts tests/unit/paymentReconciliationMatching.test.ts
git commit -m "feat: classify payment reconciliation matches"
```

### Task 3: Authoritative reconciliation preview API

**Files:**
- Modify: `src/app/api/workspace/reconciliation/taishin/route.ts`
- Modify: `tests/unit/taishinReconciliationApi.test.ts`
- Create: `tests/unit/taishinReconciliationRoute.test.ts`

**Interfaces:**
- `POST /api/workspace/reconciliation/taishin` accepts only multipart `file`.
- Returns `{ summary, results }`; never returns bank balance or original remark.
- `summary` contains `sourceRowCount`, `pendingPaymentGroupCount`, and counts for every result category.

- [ ] **Step 1: Write failing API behavior tests**

Mock Owner claims, Admin Firestore pending Payments and claimed reconciliation Audit Logs. Assert Member/Helper rejection, safe response shape, aggregated matching, and category counts.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npm run test:unit -- tests/unit/taishinReconciliationApi.test.ts tests/unit/taishinReconciliationRoute.test.ts`

- [ ] **Step 3: Implement authoritative preview**

Read `payments.where("status", "==", "pendingReview")` and the reconciliation claim Audit Logs through Admin SDK, call the pure matcher, and map all errors to Chinese UI messages without leaking internal details.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm run test:unit -- tests/unit/taishinReconciliationApi.test.ts tests/unit/taishinReconciliationRoute.test.ts`

- [ ] **Step 5: Commit Task 3**

```powershell
git add -- src/app/api/workspace/reconciliation/taishin/route.ts tests/unit/taishinReconciliationApi.test.ts tests/unit/taishinReconciliationRoute.test.ts
git commit -m "feat: preview batch payment reconciliation"
```

### Task 4: Reusable payment confirmation and batch recognition API

**Files:**
- Create: `src/lib/payment/confirmPendingPayment.ts`
- Modify: `src/app/api/workspace/payments/[id]/confirm/route.ts`
- Create: `src/app/api/workspace/reconciliation/taishin/confirm/route.ts`
- Create: `tests/unit/confirmPendingPayment.test.ts`
- Create: `tests/unit/taishinBatchConfirmApi.test.ts`

**Interfaces:**
- Produces: `confirmPendingPayment({ db, paymentId, actorUid, reason, reconciliation? })`.
- Batch endpoint accepts multipart `file`, `selections` JSON, and `reason`.
- A selection is `{ transactionFingerprint, paymentGroupId, paymentIds }`.
- Returns `{ summary: { requested, succeeded, failed }, results: Array<{ reconciliationItemId, status, error? }> }`.

- [ ] **Step 1: Write failing extraction and batch tests**

Assert the existing single-confirm route retains behavior. Assert batch confirm re-parses the file, rejects forged IDs/matches, confirms every Payment in a group, writes deterministic reconciliation claim Audit Log, refuses duplicate claims, and returns partial success.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm run test:unit -- tests/unit/confirmPendingPayment.test.ts tests/unit/taishinBatchConfirmApi.test.ts`

- [ ] **Step 3: Extract reusable confirmation transaction**

Move the current `confirmBankTransfer` Firestore transaction into `confirmPendingPayment`. When reconciliation is present, transactionally read and create `auditLogs/reconciliation_<fingerprint>`, attach only safe reconciliation metadata to Payment, and preserve notification delivery after commit.

- [ ] **Step 4: Implement batch confirmation**

Rebuild matching from the re-uploaded workbook and current Firestore data. Process selected groups sequentially; return individual success/error results and continue after individual failures.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run: `npm run test:unit -- tests/unit/confirmPendingPayment.test.ts tests/unit/taishinBatchConfirmApi.test.ts tests/unit/paymentFlow.test.ts`

- [ ] **Step 6: Commit Task 4**

```powershell
git add -- src/lib/payment/confirmPendingPayment.ts src/app/api/workspace/payments/[id]/confirm/route.ts src/app/api/workspace/reconciliation/taishin/confirm/route.ts tests/unit/confirmPendingPayment.test.ts tests/unit/taishinBatchConfirmApi.test.ts
git commit -m "feat: confirm matched payments in batches"
```

### Task 5: Owner selection and batch recognition UI

**Files:**
- Modify: `src/components/workspace/TaishinReconciliationBoard.tsx`
- Modify: `tests/unit/taishinReconciliationApi.test.ts`
- Create: `tests/unit/taishinReconciliationBoard.test.tsx`

**Interfaces:**
- Consumes preview `{ summary, results }` and batch `{ summary, results }`.
- Provides buttons `全選可認列項目`, `全部取消`, and `批次確認認列`.

- [ ] **Step 1: Write failing component tests**

Assert safe matches start selected, unsafe rows have disabled checkboxes, “select all” excludes unsafe rows, Owner can deselect a safe row, zero selections disable confirm, and batch results update each row independently.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm run test:unit -- tests/unit/taishinReconciliationBoard.test.tsx tests/unit/taishinReconciliationApi.test.ts`

- [ ] **Step 3: Implement the summary, toolbar and results list**

Use accessible checkboxes, 44px controls, `aria-live`, explicit text statuses, a confirmation dialog stating the selected count, and re-send the retained in-memory `File` to the confirm endpoint.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm run test:unit -- tests/unit/taishinReconciliationBoard.test.tsx tests/unit/taishinReconciliationApi.test.ts`

- [ ] **Step 5: Commit Task 5**

```powershell
git add -- src/components/workspace/TaishinReconciliationBoard.tsx tests/unit/taishinReconciliationBoard.test.tsx tests/unit/taishinReconciliationApi.test.ts
git commit -m "feat: add batch reconciliation controls"
```

### Task 6: Emulator acceptance, documentation and full verification

**Files:**
- Modify: `tests/e2e/member-payment-cancellation-flow.spec.ts`
- Modify: `docs/10_TestPlan.md`
- Modify: `docs/11_Changelog.md`
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

**Interfaces:**
- Produces a synthetic `.xlsx` fixture at test runtime; no real bank data enters the repository.

- [ ] **Step 1: Add failing Owner reconciliation E2E**

Create two safe matches plus ambiguous/unmatched rows, click `全選可認列項目`, deselect one safe match, confirm the batch, and verify only the remaining selected Payment and Order changed.

- [ ] **Step 2: Run the focused Emulator E2E and confirm RED**

Run the project’s Firebase Emulator Playwright command filtered to the reconciliation test.

- [ ] **Step 3: Complete E2E integration and documentation**

Record the feature, files, security properties, test evidence, remaining Preview/Production manual acceptance, and exact next step.

- [ ] **Step 4: Run full verification**

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run test:rules
npm run build
npm run test:e2e
npm run test:e2e:emulated
npm run security:scan
npm audit --omit=dev --audit-level=high
```

- [ ] **Step 5: Commit Task 6**

```powershell
git add -- tests/e2e/member-payment-cancellation-flow.spec.ts docs/10_TestPlan.md docs/11_Changelog.md docs/16_MVPCompletionPlan.md docs/17_ProjectHandoff.md
git commit -m "test: verify Taishin batch reconciliation"
```
