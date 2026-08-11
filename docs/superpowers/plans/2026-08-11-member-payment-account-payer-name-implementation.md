# Member Payment Account Payer Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind a payer name to each member bank account so payment reports select a verified account and derive an immutable last-five/payer-name snapshot from Server data.

**Architecture:** Extend the existing `memberPaymentAccounts` document and public snapshot with normalized `payerName`, without persisting a full account number. Add a one-time authenticated-member payer-name completion route for legacy accounts, then make the Payment API resolve and snapshot the selected account exclusively on the Server. The account and payment UIs consume the same public account snapshot so multi-account selection updates both read-only fields consistently.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Firebase Admin SDK, Firestore, Vitest, Firebase Rules Test SDK, Playwright.

## Global Constraints

- Do not change Collection architecture or add Finance, Wallet, CRM, ERP, or Member Preorder features.
- `memberPaymentAccounts` remains inaccessible to Client SDK; all reads and writes use protected Server APIs.
- The permanent record must not contain `accountNumberFull`; full account input is discarded after normalization and HMAC derivation.
- `payerName` is normalized once, contains 1–80 Unicode code points, and rejects control characters and line breaks.
- New permanent fingerprints always use the current KMS key version; callers cannot select a key version.
- Payment reports send `memberPaymentAccountId`; last five and payer name come from the Server-resolved account.
- Legacy accounts without `payerName` remain visible but cannot be used for new payments until the owner-member supplies it once.
- Completing a legacy payer name must not change bank code, last five, fingerprint, key version, ownership, status, or historical Payment snapshots.
- Read the relevant route-handler guide under `node_modules/next/dist/docs/` before modifying App Router APIs.
- Every implementation task follows red → green TDD and ends with a focused commit.

---

### Task 1: Payer-name domain contract

**Files:**
- Modify: `src/lib/payment/memberBankAccounts.ts`
- Modify: `tests/unit/memberPaymentAccounts.test.ts`
- Modify: `tests/unit/memberPaymentAccountsUi.test.ts`

**Interfaces:**
- Consumes: existing `MemberPaymentAccountInput`, `MemberPaymentAccount`, `PublicMemberPaymentAccount` and account fingerprint validation.
- Produces: `normalizeMemberPaymentAccountPayerName(input: unknown): string`; `MemberPaymentAccountInput.payerName`; `MemberPaymentAccount.payerName?`; `PublicMemberPaymentAccount.payerName?`; `needsPayerName: boolean` on the public snapshot.

- [x] **Step 1: Write failing payer-name normalization and usability tests**

Add focused cases equivalent to:

```ts
expect(normalizeMemberPaymentAccountPayerName("  王 小明  ")).toBe("王 小明");
expect(() => normalizeMemberPaymentAccountPayerName("\n王小明")).toThrow("invalid_payer_name");
expect(() => normalizeMemberPaymentAccountPayerName(" ")).toThrow("invalid_payer_name");
expect(Array.from(normalizeMemberPaymentAccountPayerName("𠮷".repeat(80)))).toHaveLength(80);
expect(() => normalizeMemberPaymentAccountPayerName("𠮷".repeat(81))).toThrow("invalid_payer_name");
```

Add snapshot tests proving a verified active account without `payerName` returns `needsPayerName: true` and is not usable, while the same account with a valid name is usable.

- [x] **Step 2: Run focused tests and observe the missing contract failure**

Run:

```powershell
npx vitest run tests/unit/memberPaymentAccounts.test.ts tests/unit/memberPaymentAccountsUi.test.ts
```

Expected: FAIL because payer-name normalization and `needsPayerName` do not exist.

- [x] **Step 3: Implement the minimal domain extension**

Add the interface fields and a single shared normalizer:

```ts
export function normalizeMemberPaymentAccountPayerName(input: unknown): string {
  if (typeof input !== "string") throw new Error("invalid_payer_name");
  const normalized = input.trim();
  if (!normalized || Array.from(normalized).length > 80 || /[\u0000-\u001F\u007F]/u.test(normalized)) {
    throw new Error("invalid_payer_name");
  }
  return normalized;
}
```

Have `validateMemberPaymentAccountInput` normalize `payerName`. When building a public snapshot, retain legacy records with `payerName: undefined` and `needsPayerName: true`; require `!account.needsPayerName` in both public and stored payment-usability helpers. Add `member_payment_account_payer_name_invalid` and `member_payment_account_payer_name_required` Chinese error messages.

- [x] **Step 4: Run focused tests and verify green**

Run the Task 1 command again. Expected: all selected tests PASS.

- [x] **Step 5: Commit Task 1**

```powershell
git add src/lib/payment/memberBankAccounts.ts tests/unit/memberPaymentAccounts.test.ts tests/unit/memberPaymentAccountsUi.test.ts
git commit -m "feat: add member account payer name contract"
```

---

### Task 2: New-account registration and masked account responses

**Files:**
- Modify: `src/app/api/member/payment-accounts/route.ts`
- Modify: `tests/unit/memberPaymentAccountApi.test.ts`

**Interfaces:**
- Consumes: `validateMemberPaymentAccountInput`, `buildMemberPaymentAccountSnapshot`, current KMS identity derivation.
- Produces: POST accepts `{ bankCode, accountNumberFull, payerName }`; Firestore stores normalized `payerName`; GET and POST responses expose normalized payer name plus masked account fields, never full account or fingerprint.

- [ ] **Step 1: Read the Next.js 16 route-handler documentation**

Use the installed guide under `node_modules/next/dist/docs/` that covers App Router route handlers, Request parsing and dynamic route parameters. Record any applicable deprecation in the task notes before changing the route.

- [ ] **Step 2: Update registration tests first**

Change successful POST bodies to include `payerName: "  王小明  "` and assert:

```ts
expect(accountWrite).toMatchObject({ payerName: "王小明" });
expect(payload.account).toMatchObject({ payerName: "王小明", needsPayerName: false });
expect(JSON.stringify(accountWrite)).not.toContain("accountNumberFull");
```

Add invalid/missing payer-name cases that expect HTTP 400 and `member_payment_account_payer_name_invalid`. Update GET tests so modern accounts return `payerName`, while a verified legacy account without it returns `needsPayerName: true` and remains non-payable.

- [ ] **Step 3: Run the API test and observe failure**

```powershell
npx vitest run tests/unit/memberPaymentAccountApi.test.ts
```

Expected: FAIL because the route does not persist or return payer name.

- [ ] **Step 4: Implement registration persistence**

Pass normalized `payerName` through the existing transaction write:

```ts
transaction.set(accountRef, {
  ...identity,
  memberUid: user.uid,
  payerName: normalized.payerName,
  status: "active",
  verificationStatus: "verified",
  createdAt: now,
  createdBy: user.uid,
  updatedAt: now,
  updatedBy: user.uid,
});
```

Continue generating responses only through `buildMemberPaymentAccountSnapshot`. Do not include payer name in duplicate-account notification payloads because it is not required for collision review.

- [ ] **Step 5: Run the API test and verify green**

Run the Task 2 test command. Expected: PASS and no full account/fingerprint in JSON assertions.

- [ ] **Step 6: Commit Task 2**

```powershell
git add src/app/api/member/payment-accounts/route.ts tests/unit/memberPaymentAccountApi.test.ts
git commit -m "feat: persist payer names on member accounts"
```

---

### Task 3: One-time legacy payer-name completion API

**Files:**
- Create: `src/app/api/member/payment-accounts/[id]/payer-name/route.ts`
- Create: `tests/unit/memberPaymentAccountPayerNameApi.test.ts`

**Interfaces:**
- Consumes: `requireFirebaseUser`, `getAdminFirestore`, `normalizeMemberPaymentAccountPayerName`, `buildMemberPaymentAccountSnapshot`.
- Produces: `POST /api/member/payment-accounts/[id]/payer-name` with body `{ payerName: string }`, returning `{ account: PublicMemberPaymentAccount }`.

- [ ] **Step 1: Write failing route tests**

Cover all transaction outcomes:

```ts
// Success: owning member + existing account + missing payerName.
expect(update).toHaveBeenCalledWith(accountRef, {
  payerName: "王小明",
  updatedAt: expect.anything(),
  updatedBy: "member-a",
});

// Reject: account belongs to member-b.
expect(response.status).toBe(404);

// Reject: payerName already exists, preserving the original value.
expect(response.status).toBe(409);

// Reject: invalid name.
expect(response.status).toBe(400);
```

Assert the write object has no bank code, account number, fingerprint, key version, status or owner field.

- [ ] **Step 2: Run the new test and observe the missing-module failure**

```powershell
npx vitest run tests/unit/memberPaymentAccountPayerNameApi.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the protected one-time route**

Inside one Firestore transaction:

1. Authenticate the Firebase member.
2. Resolve `params.id` using the Next.js 16 async params convention.
3. Read the account document.
4. Return the same not-found response for missing and cross-member accounts.
5. Reject if a valid stored payer name already exists.
6. Update only normalized `payerName`, `updatedAt`, and `updatedBy`.
7. Return the masked public snapshot assembled from the original record plus the new name.

Use error keys `member_payment_account_payer_name_already_set` and the Task 1 invalid-name key; never echo rejected input.

- [ ] **Step 4: Run the route test and verify green**

Run the Task 3 test command. Expected: all cases PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add src/app/api/member/payment-accounts/[id]/payer-name/route.ts tests/unit/memberPaymentAccountPayerNameApi.test.ts
git commit -m "feat: complete legacy account payer names"
```

---

### Task 4: Server-authoritative Payment payer snapshot

**Files:**
- Modify: `src/lib/payment/manualBankTransfer.ts`
- Modify: `src/app/api/payments/route.ts`
- Modify: `tests/unit/paymentAccountSelectionApi.test.ts`
- Modify: `tests/unit/paymentReport.test.ts`

**Interfaces:**
- Consumes: stored `MemberPaymentAccount` with valid identity and `payerName`.
- Produces: `MemberPaymentAccountIdentitySnapshot.payerName`; `buildMemberPaymentAccountIdentitySnapshot(identity: AccountIdentity & { payerName: string })` copies normalized payer name; Payment POST no longer accepts a client-authoritative `payerName` or last five.

- [ ] **Step 1: Write failing snapshot and route tests**

Add a domain assertion:

```ts
expect(buildMemberPaymentAccountIdentitySnapshot(account)).toEqual({
  bankCode: "012",
  accountNumberLast5: "56789",
  accountFingerprint: validFingerprint,
  fingerprintAlgorithm: "HMAC-SHA-256",
  fingerprintKeyVersion: 7,
  payerName: "王小明",
});
```

Update Payment API tests to submit only `memberPaymentAccountId`. Assert the stored Payment has `payerName: "王小明"` and a matching `memberPaymentAccount.payerName`, both resolved from Firestore. Add a malicious request containing conflicting `payerName` and last-five fields and assert neither value reaches the Payment write. Add a legacy missing-name account case expecting `payment_account_member_payer_name_required` and no Payment write.

- [ ] **Step 2: Run focused tests and observe failure**

```powershell
npx vitest run tests/unit/paymentAccountSelectionApi.test.ts tests/unit/paymentReport.test.ts
```

Expected: FAIL because the snapshot lacks payer name and the route still reads client `payerName`.

- [ ] **Step 3: Implement the immutable snapshot**

Extend the snapshot type and builder so payer name is required for new snapshots:

```ts
export type MemberPaymentAccountIdentitySnapshot = Pick<
  AccountIdentity,
  "bankCode" | "accountNumberLast5"
> & {
  payerName: string;
} & Partial<Pick<AccountIdentity,
  "accountFingerprint" | "fingerprintAlgorithm" | "fingerprintKeyVersion"
>>;
```

In the Payment route, parse neither last five nor payer name as authority. Resolve the selected document, enforce stored-account usability including payer name, and set both `payment.memberPaymentAccount` and legacy top-level `payment.payerName` from the resolved snapshot for backward-compatible Owner UI display.

- [ ] **Step 4: Run focused tests and verify green**

Run the Task 4 command. Expected: all selected tests PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
git add src/lib/payment/manualBankTransfer.ts src/app/api/payments/route.ts tests/unit/paymentAccountSelectionApi.test.ts tests/unit/paymentReport.test.ts
git commit -m "feat: snapshot member account payer names"
```

---

### Task 5: Account-management and payment-report UI

**Files:**
- Modify: `src/components/account/MemberPaymentAccountsBoard.tsx`
- Modify: `src/app/account/bank-accounts/page.tsx`
- Modify: `src/components/storefront/PaymentRequestsBoard.tsx`
- Modify: `tests/unit/memberPaymentAccountsUi.test.ts`

**Interfaces:**
- Consumes: public account `{ id, bankCode, accountNumberMasked, accountNumberLast5, payerName?, needsPayerName, status, verificationStatus }` and the Task 3 completion API.
- Produces: registration payload `{ bankCode, accountNumberFull, payerName }`; one-time completion UI; Payment POST payload without `payerName` or account last five.

- [ ] **Step 1: Write failing UI contract tests**

Assert the account form sends:

```ts
JSON.stringify({ bankCode, accountNumberFull, payerName })
```

Assert legacy account markup contains `需要補填匯款人` and calls `/payer-name`. Assert the payment board renders `account.payerName`, uses one member-account `<select>`, displays last five and payer name as `readOnly`, and does not include `payerName` or `last5` in the POST body.

- [ ] **Step 2: Run the UI test and observe failure**

```powershell
npx vitest run tests/unit/memberPaymentAccountsUi.test.ts
```

Expected: FAIL against the old registration and payment form.

- [ ] **Step 3: Implement account-management UI**

- Add a required `payerName` registration input with `name="payerName"` and `autoComplete="name"`.
- Clear the full account and payer-name inputs after a successful registration.
- Show saved payer name beside each masked account.
- For `needsPayerName`, show a focused one-time completion input and button. During submission disable the button and show `保存中…`; update only the returned account in local state.
- Keep re-verification and deletion-request messages distinct from missing-name completion.

- [ ] **Step 4: Implement payment-report account linkage**

- Keep the existing member-account select as the single source selection.
- Render each option as `銀行代碼 {bankCode}・{accountNumberMasked}・{payerName}`.
- Replace the editable last-five and payer-name controls with read-only fields derived from the selected account.
- When selection changes, derive both displayed values from `memberPaymentAccounts`; do not copy them into independently editable state.
- Remove `payerName` and last-five from the Payment POST body; retain date, amount, receiving account, selected payment requests and member note.
- If there are no usable accounts, disable submission and show the existing account-management link.

- [ ] **Step 5: Run the UI test and verify green**

Run the Task 5 test command. Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```powershell
git add src/components/account/MemberPaymentAccountsBoard.tsx src/app/account/bank-accounts/page.tsx src/components/storefront/PaymentRequestsBoard.tsx tests/unit/memberPaymentAccountsUi.test.ts
git commit -m "feat: link payment reports to member accounts"
```

---

### Task 6: Rules regression, end-to-end acceptance and handoff

**Files:**
- Modify: `tests/firebase/firestore-deny.test.ts`
- Modify: `tests/e2e/member-payment-cancellation-flow.spec.ts`
- Modify: `tests/e2e/member-account-fingerprint-refund.spec.ts`
- Modify: `tests/e2e/global-setup.ts`
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

**Interfaces:**
- Consumes: completed protected APIs and UI from Tasks 1–5.
- Produces: automated evidence for account completion, multi-account linkage, server-authoritative Payment snapshots and unchanged Client SDK denial.

- [ ] **Step 1: Add Rules regression assertions**

Keep `memberPaymentAccounts` Client SDK reads and writes denied for Member A, Member B, Helper and Owner. Include a direct write containing `payerName` and assert it fails; no Rules allow-list expansion is permitted.

- [ ] **Step 2: Update emulator fixtures**

Give normal E2E member accounts distinct test-only payer names. Add one verified legacy fixture without payer name, and a second usable account with a different last five and payer name. Do not use real bank details or real names.

- [ ] **Step 3: Extend Playwright acceptance**

Verify in one deterministic test-only flow:

1. The legacy account is excluded from payment selection.
2. The member completes its payer name once; a second overwrite attempt is rejected through the API test layer.
3. Selecting each usable account changes the read-only last five and payer name together.
4. One Payment Report creates `pendingReview` with the selected Server account snapshot.
5. A forged client payer name does not enter Firestore.
6. Existing confirm, reverse and refund verification still use immutable snapshots.

- [ ] **Step 4: Run the complete verification suite**

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run test:rules
npm run build
npm run test:e2e
git diff --check
```

Expected: every command exits 0. If Firebase emulator startup is blocked by managed Windows process permissions, rerun the same Rules/E2E command with the previously approved elevated execution path and record that fact.

- [ ] **Step 5: Update live execution records**

Record in both project documents:

- exact modified files and commits;
- Unit, Rules, Build and Playwright counts/results;
- whether Preview deployment occurred;
- whether legacy completion and multi-account selection were manually verified;
- the next exact action if Owner financial confirmation remains pending.

Do not include account values, fingerprints, member identifiers or internal Payment IDs.

- [ ] **Step 6: Commit Task 6**

```powershell
git add tests/firebase/firestore-deny.test.ts tests/e2e/member-payment-cancellation-flow.spec.ts tests/e2e/member-account-fingerprint-refund.spec.ts tests/e2e/global-setup.ts docs/16_MVPCompletionPlan.md docs/17_ProjectHandoff.md
git commit -m "test: verify payer-linked payment accounts"
```

---

## Final Review Gate

Before Preview deployment, review the full branch diff against `docs/superpowers/specs/2026-08-11-member-payment-account-payer-name-design.md` and verify:

- no permanent full account field or sensitive log was introduced;
- existing HMAC, KMS, duplicate notification, deletion request and refund behavior remains intact;
- Payment source data is resolved exclusively on the Server;
- legacy accounts can complete payer name without changing identity fields;
- all user-visible states are Chinese, keyboard accessible and usable at 390 px;
- the execution plan and handoff identify any remaining external or action-time approval.
