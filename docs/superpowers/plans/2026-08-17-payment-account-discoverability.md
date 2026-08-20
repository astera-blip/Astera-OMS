# Payment Account Discoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make existing Owner receiving-account and member remitting-account settings discoverable through normal navigation and the payment flow.

**Architecture:** Preserve `/workspace/payments` and `/account/bank-accounts` as the only canonical management routes. Change only navigation copy and links; keep the current server APIs, Firestore collections, authorization checks, masking, KMS identity, and payment transaction unchanged.

**Tech Stack:** Next.js 16.2.11 App Router, React 19.2.4, TypeScript 5, Tailwind CSS 4, Vitest 4, Playwright 1.62, Firebase 12/Admin 13.

## Global Constraints

- Reuse the existing payment/account architecture and do not create a duplicate data model or Settings flow.
- Owner receiving-account mutations remain Owner-only on the server.
- Members can access only their own payment accounts.
- Full bank account numbers remain transient and must not be rendered, logged, or returned by APIs.
- Use `next/link` for internal navigation.
- Follow existing Astera tokens, bilingual Owner navigation copy, focus styles, and `min-h-11` touch targets.
- Do not modify schema, Firestore Rules, KMS/HMAC, payment matching, or transaction logic unless a failing security test proves it necessary.

---

### Task 1: Lock the navigation behavior with failing tests

**Files:**
- Modify: `tests/unit/accountActions.test.ts`
- Modify: `tests/unit/memberPaymentAccountsUi.test.ts`

**Interfaces:**
- Consumes: existing `AccountActions`, `WorkspaceShell`, `/members`, and `PaymentRequestsBoard` UI.
- Produces: regression coverage requiring `/account/bank-accounts`, `付款設定`, `付款與收款`, and an always-visible `管理付款帳戶` link.

- [x] **Step 1: Add the failing signed-in navigation assertions**

Add a member `AccountActions` render assertion for `href="/account/bank-accounts"` and `付款設定`. Add an Owner `WorkspaceShell` render assertion for `href="/workspace/payments"` and `付款與收款`.

- [x] **Step 2: Add the failing member-flow discoverability assertions**

Read `/members` and `PaymentRequestsBoard`; assert the member card points to `/account/bank-accounts`, and assert the member-account field contains a `管理付款帳戶` link outside the empty-account-only branch.

- [x] **Step 3: Run the focused tests and verify RED**

Run: `npm run test:unit -- tests/unit/accountActions.test.ts tests/unit/memberPaymentAccountsUi.test.ts`

Expected: FAIL because the clearer Owner label, member navigation entries, and always-visible management action are absent.

### Task 2: Implement the minimal discoverability changes

**Files:**
- Modify: `src/components/workspace/WorkspaceShell.tsx`
- Modify: `src/app/members/page.tsx`
- Modify: `src/components/auth/AccountActions.tsx`
- Modify: `src/components/storefront/PaymentRequestsBoard.tsx`

**Interfaces:**
- Consumes: existing canonical routes `/workspace/payments#payment-accounts` and `/account/bank-accounts`.
- Produces: navigation links only; no new persistence or server interface.

- [x] **Step 1: Clarify Owner navigation**

Change the existing `/workspace/payments` label to `付款與收款 Payments`. Do not add a second workspace navigation item or route.

- [x] **Step 2: Add member dashboard and global account links**

Add this existing-route card to `memberLinks`:

```ts
{
  href: "/account/bank-accounts",
  label: "付款設定",
  detail: "管理付款回報使用的匯款帳戶",
}
```

Add a signed-in `AccountActions` `Link` to `/account/bank-accounts` labeled `付款設定` for both desktop and mobile variants.

- [x] **Step 3: Keep account management visible during payment reporting**

Import `Link` from `next/link`. Render a `管理付款帳戶` link beside the `匯出匯款的會員帳戶` label before the existing account/no-account conditional. Change the empty state to explanatory text so the action is present exactly once and remains available when accounts exist.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npm run test:unit -- tests/unit/accountActions.test.ts tests/unit/memberPaymentAccountsUi.test.ts`

Expected: PASS.

### Task 3: Verify security and integration invariants

**Files:**
- Test only; production files change only if a current-task regression is found.

**Interfaces:**
- Consumes: current APIs, Firestore Rules, payment transaction, and UI routes.
- Produces: verification evidence that navigation changes did not alter trust boundaries.

- [x] **Step 1: Run payment and authorization unit coverage**

Run: `npm run test:unit -- tests/unit/memberPaymentAccountApi.test.ts tests/unit/memberPaymentAccountPayerNameApi.test.ts tests/unit/memberPaymentsApi.test.ts tests/unit/paymentAccountSelectionApi.test.ts tests/unit/paymentFlow.test.ts tests/unit/paymentReconciliationMatching.test.ts tests/unit/accountActions.test.ts tests/unit/memberPaymentAccountsUi.test.ts`

Expected: PASS.

- [x] **Step 2: Run Firestore Rules tests**

Run: `npm run firebase:rules:test`

Expected: PASS, including direct-client denials for protected payment collections.

- [x] **Step 3: Run repository-wide verification**

Run: `npm run typecheck`, `npm run lint`, `npm run test:unit`, and `npm run build`.

Expected: all commands exit 0.

- [x] **Step 4: Run emulated browser verification**

Run: `npm run test:e2e:emulated` when Firebase emulators can start. Verify Owner navigation to receiving accounts and member navigation/payment-page access at desktop and mobile viewports.

Expected: PASS, or record an environment-only blocker with the exact manual production smoke steps.

### Task 4: Independent payment-security review and remediation

**Files:**
- Review all files modified by Tasks 1-2 plus the existing payment-account routes, `firestore.rules`, and `/api/payments` transaction.

**Interfaces:**
- Consumes: final diff and verification results.
- Produces: severity-ranked findings covering authentication, authorization, IDOR, client trust, Rules, ownership, sensitive data, validation, payment integrity, race conditions, regressions, and missing tests.

- [x] **Step 1: Dispatch the required read-only reviewer**

The Primary Agent asks a `reviewer` to independently inspect the material payment change.

- [x] **Step 2: Resolve every material finding**

For each P0-P2 finding, add a failing regression test, verify RED, implement the smallest root-cause fix, and verify GREEN. Keep architecture/security decisions with the Primary Agent.

- [x] **Step 3: Re-run affected verification**

Re-run focused tests, typecheck, lint, unit suite, Rules tests, and build after any material remediation.

- [x] **Step 4: Complete Primary integration review**

Confirm every acceptance criterion, inspect the final diff against the design, and list only genuinely manual production checks in the handoff.
