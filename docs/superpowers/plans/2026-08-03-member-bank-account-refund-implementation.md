# Member Bank Account Fingerprint and Refund Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓會員以完整銀行帳號完成綁定，但永久資料只保存銀行代碼、末五碼與 HMAC-SHA-256 指紋；退款時重新輸入完整帳號並依原付款指紋精確比對，完整退款帳號最多加密暫存 14 天。

**Architecture:** 新增單一 Server-only account identity service，統一正規化、末五碼與 Cloud KMS HMAC MAC 操作。會員帳戶與付款快照保存指紋及金鑰版本；退款申請沿用 `cancellationRequests`，只在既有文件加入 Cloud KMS 加密的限時欄位，Owner 透過受保護 API 讀取，Client SDK 永不讀取敏感取消文件。

**Tech Stack:** Next.js 16 Server API、TypeScript、Firebase Admin SDK、Firestore、Cloud KMS HMAC／對稱加密、Firebase Emulator、Vitest、Firestore Rules Tests、Playwright。

## Global Constraints

- 銀行代碼固定為 3 位數字並保留前導零。
- 會員綁定輸入完整銀行帳號；永久資料不保存完整明文，只保存末五碼、HMAC 指紋、演算法與金鑰版本。
- 正規化只允許全形數字轉半形、移除空格與連字號；其他非數字字元拒絕；保留前導零。
- 新帳戶／新付款快照一律使用最新 `fingerprintKeyVersion`；退款比對使用目標付款紀錄自己的版本且不寫回。
- 相同銀行代碼＋末五碼可重複綁定；Owner 收到可能重複通知，不自動封鎖。
- 完整退款帳號只可在取消申請中以 Cloud KMS 加密暫存最多 14 天；訂單成為 `refunded` 時立即刪除。
- 不新增業務 Collection；沿用 `memberPaymentAccounts`、`paymentRequests`、`cancellationRequests`、`notificationEvents`、`auditLogs`。
- Client SDK 不得直接讀寫帳戶、付款、取消、退款、ciphertext 或 Audit Log。
- 禁止背景任務從舊 HMAC 反推出新 HMAC；禁止寫入路徑使用舊金鑰版本建立永久指紋。

---

### Task 1: 建立帳號正規化與 HMAC 身分服務

**Files:**
- Create: `src/lib/payment/accountIdentity.ts`
- Create: `src/lib/security/cloudKmsMac.ts`
- Modify: `package.json`, `package-lock.json`
- Test: `tests/unit/accountIdentity.test.ts`

**Interfaces:**
- `normalizeBankCode(input: unknown): string`
- `normalizeAccountNumber(input: unknown): string`
- `deriveAccountIdentity(input, macClient): Promise<{ bankCode: string; accountNumberLast5: string; accountFingerprint: string; fingerprintAlgorithm: "HMAC-SHA-256"; fingerprintKeyVersion: number }>`
- `verifyAccountIdentity(input, expected, macClient): Promise<boolean>`
- `CloudKmsMacClient.signCanonicalAccount(canonical: string, keyVersion?: number): Promise<{ mac: string; keyVersion: number }>`

- [ ] **Step 1: Write failing normalization and key-version tests.**

```ts
it("preserves leading zeros and removes only spaces and hyphens", () => {
  expect(normalizeAccountNumber("００１２-３４ ５６７８９")).toBe("00123456789");
});

it("rejects letters and unsupported punctuation", () => {
  expect(() => normalizeAccountNumber("00123/456789")).toThrow("invalid_account_number");
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `npx vitest run tests/unit/accountIdentity.test.ts`

Expected: FAIL because the identity module and functions do not exist.

- [ ] **Step 3: Implement the pure normalizer and canonical input.**

Use the exact canonical string `astera:bank-account:v1|${bankCode}|${normalizedAccountNumber}`. Reject non-3-digit bank codes, non-digit account values, and account lengths outside the existing 8–20 digit business range.

- [ ] **Step 4: Implement the Cloud KMS MAC adapter.**

Read only server-side configuration (`GCP_PROJECT_ID`, `GCP_KMS_HMAC_KEY_NAME`, `GCP_KMS_HMAC_KEY_VERSION`, WIF ADC). The adapter must never expose the key material and must return the actual KMS key version used. Unit tests use an injected fake MAC client; no network call is made by Vitest.

- [ ] **Step 5: Implement constant-time verification and version selection.**

`deriveAccountIdentity` may use only the configured latest version. `verifyAccountIdentity` must use the expected payment snapshot version, compute one MAC, and compare bytes with `timingSafeEqual`; it must not mutate the expected record.

- [ ] **Step 6: Run focused tests and commit.**

Run: `npx vitest run tests/unit/accountIdentity.test.ts`

Expected: all normalization, HMAC, leading-zero, version-selection, and constant-time comparison tests pass.

Commit: `git add src/lib/payment/accountIdentity.ts src/lib/security/cloudKmsMac.ts tests/unit/accountIdentity.test.ts package.json package-lock.json && git commit -m "feat: add bank account identity fingerprint service"`

### Task 2: Replace plaintext member-account persistence

**Files:**
- Modify: `src/lib/payment/memberBankAccounts.ts`
- Modify: `src/app/api/member/payment-accounts/route.ts`
- Modify: `src/app/account/bank-accounts/page.tsx`
- Modify: `src/components/account/MemberBankAccountsBoard.tsx`
- Test: `tests/unit/memberPaymentAccounts.test.ts`, `tests/unit/memberPaymentAccountApi.test.ts`, `tests/unit/memberPaymentAccountsUi.test.ts`

**Interfaces:**
- `MemberPaymentAccount` exposes `bankCode`, `accountNumberLast5`, `accountFingerprint`, `fingerprintKeyVersion`, and status; it does not expose `accountNumberFull`.
- POST accepts `{ bankCode: string; accountNumberFull: string }` and writes only the derived identity plus audit timestamps.
- GET returns masked display data and never returns full account, HMAC input, or ciphertext.

- [ ] **Step 1: Add failing tests for the new request and persistence contract.**

Assert that a valid full account creates `bankCode`, `accountNumberLast5`, `accountFingerprint`, and `fingerprintKeyVersion`, while the Firestore write and JSON response do not contain `accountNumberFull`.

- [ ] **Step 2: Run the focused tests and verify the old contract fails.**

Run: `npx vitest run tests/unit/memberPaymentAccounts.test.ts tests/unit/memberPaymentAccountApi.test.ts tests/unit/memberPaymentAccountsUi.test.ts`

Expected: existing tests fail on the plaintext-field and bank-name assumptions.

- [ ] **Step 3: Refactor validation and snapshots.**

Replace bank-name/account-name/full-number persistence with `bankCode` plus the identity service output. Preserve the five active/pending-deletion account limit and account status workflow. Keep duplicate registration allowed; do not reject based on bank code or last five digits.

- [ ] **Step 4: Add exact duplicate notification creation.**

Within the Admin transaction, query candidate records by bank code and last five digits. For records on older retained key versions, recompute the new input under each referenced version before comparison; never compare fingerprints from different versions directly. Create an Owner notification event with status `pendingReview`, `confirmedDifferent`, or `confirmedDuplicate`; notification payload contains account IDs and masked last five only, never the full number or HMAC input.

- [ ] **Step 5: Update the member UI.**

Collect bank code and full account, explain that only masked identity data is retained, and show duplicate warnings without blocking submission. Remove inputs and labels for bank name, branch, account name, and any full-account display after save.

- [ ] **Step 6: Run focused tests and commit.**

Run: `npx vitest run tests/unit/memberPaymentAccounts.test.ts tests/unit/memberPaymentAccountApi.test.ts tests/unit/memberPaymentAccountsUi.test.ts`

Expected: persistence has no plaintext account field, duplicate binding succeeds, notification is created, and the UI never renders the full account after submission.

Commit: `git add src/lib/payment/memberBankAccounts.ts src/app/api/member/payment-accounts/route.ts src/app/account/bank-accounts/page.tsx src/components/account/MemberBankAccountsBoard.tsx tests/unit/memberPaymentAccounts.test.ts tests/unit/memberPaymentAccountApi.test.ts tests/unit/memberPaymentAccountsUi.test.ts && git commit -m "feat: persist member bank account fingerprints"`

### Task 3: Add fingerprint snapshots to payments

**Files:**
- Modify: `src/app/api/payments/route.ts`
- Modify: `src/lib/payment/manualBankTransfer.ts`
- Modify: `src/lib/payment/repository.ts`
- Modify: `src/components/storefront/PaymentRequestsBoard.tsx`
- Test: `tests/unit/paymentReport.test.ts`, `tests/unit/paymentRepository.test.ts`, `tests/e2e/member-payment-cancellation-flow.spec.ts`

**Interfaces:**
- Payment report payload remains selected `memberPaymentAccountId` plus transfer details; Server resolves the account and snapshots `bankCode`, `accountNumberLast5`, `accountFingerprint`, and `fingerprintKeyVersion`.
- Existing pendingReview, partial, paid, and unallocated amount semantics remain unchanged.

- [ ] **Step 1: Add failing tests for immutable fingerprint snapshots.**

Cover account selection from the authenticated member, rejection of another member’s account, and persistence of fingerprint/version in the payment report snapshot.

- [ ] **Step 2: Implement Server-side snapshotting.**

Change `src/app/api/payments/route.ts` to read the Admin account document, reject inactive or cross-member IDs, and copy only the identity fields into the payment record. Ignore any client-supplied bank code, last five, fingerprint, or version.

- [ ] **Step 3: Preserve historical data.**

Do not mutate existing payment snapshots in confirm/reverse flows. If a historical payment lacks a fingerprint, return an explicit `manualFingerprintReviewRequired` capability to the Owner flow rather than treating last-five equality as exact verification.

- [ ] **Step 4: Run unit and emulator E2E tests and commit.**

Run: `npx vitest run tests/unit/paymentReport.test.ts tests/unit/paymentRepository.test.ts`

Run: `npx playwright test tests/e2e/member-payment-cancellation-flow.spec.ts --workers=1`

Expected: payment reports contain immutable identity snapshots and no client-provided identity can override them.

Commit: `git add src/app/api/payments/route.ts src/lib/payment/manualBankTransfer.ts src/lib/payment/repository.ts src/components/storefront/PaymentRequestsBoard.tsx tests/unit/paymentReport.test.ts tests/unit/paymentRepository.test.ts tests/e2e/member-payment-cancellation-flow.spec.ts && git commit -m "feat: snapshot bank account fingerprints on payment reports"`

### Task 4: Implement 14-day encrypted refund-account vault

**Files:**
- Create: `src/lib/payment/refundAccountVault.ts`
- Modify: `src/lib/order/cancellation.ts`
- Modify: `src/lib/order/repository.ts`
- Modify: `src/app/api/cancellations/route.ts`
- Create: `src/app/api/cancellations/[id]/refund-account/route.ts`
- Modify: `src/app/api/workspace/cancellations/[id]/review/route.ts`
- Create: `src/app/api/workspace/cancellations/[id]/refund-account/route.ts`
- Test: `tests/unit/cancellationFlow.test.ts`, `tests/unit/refundAccountVault.test.ts`, `tests/unit/refundAccountApi.test.ts`

**Interfaces:**
- `storeRefundAccount(requestId, accountNumberFull, expiresAt): Promise<{ encryptionKeyVersion: number; expiresAt: string }>`
- `readRefundAccountForOwner(requestId): Promise<{ bankCode: string; accountNumberFull: string; expiresAt: string }>`
- `deleteRefundAccount(requestId): Promise<void>`
- `expireRefundAccounts(now): Promise<number>`

- [ ] **Step 1: Add failing vault tests.**

Verify KMS ciphertext is stored only in the cancellation request, expired records cannot be read, Owner-only reads return the full account through the API, and deletion removes ciphertext immediately.

- [ ] **Step 2: Add HMAC verification to the member paid-cancellation request.**

Require the authenticated member to submit `targetPaymentId`, `refundBankCode`, and `refundAccountNumberFull` when creating a paid cancellation request. Load that member’s specific payment snapshot, verify bank code, last five, and HMAC using the snapshot’s `fingerprintKeyVersion`. Reject mismatch before creating the cancellation request or adjustment; append a mismatch Audit Log without account data and enforce member/request/IP rate limits. Different payment sources must create separate requests.

- [ ] **Step 3: Encrypt the accepted full account with Cloud KMS.**

Use a separate symmetric Cloud KMS encryption key for the short-lived refund vault. Store only `refundAccountCiphertext`, `refundEncryptionKeyVersion`, `refundAccountExpiresAt`, and permanent `refundBankCode`／`refundAccountLast5` metadata. Do not store an application key or raw input.

- [ ] **Step 4: Add member resubmission, Owner reveal, and deletion behavior.**

The member resubmission route accepts a new full account only for the member’s own expired `needsReverification` request and repeats the original-payment HMAC check. The Owner reveal route checks Owner custom claim and expiry, then decrypts only in the Server response. Owner review continues to accept refund date, amount, and reference rather than asking Owner to re-enter the account. When the order transitions to `refunded`, transactionally delete the ciphertext fields; a refund reverse must not restore them.

- [ ] **Step 5: Run focused tests and commit.**

Run: `npx vitest run tests/unit/refundAccountVault.test.ts tests/unit/refundAccountApi.test.ts tests/unit/cancellationFlow.test.ts`

Expected: valid historical-version matches succeed, mismatches create no adjustment, ciphertext is not returned by normal order/cancellation reads, and `refunded` deletes it.

Commit: `git add src/lib/payment/refundAccountVault.ts src/lib/order/cancellation.ts src/lib/order/repository.ts src/app/api/cancellations/route.ts src/app/api/cancellations/[id]/refund-account/route.ts src/app/api/workspace/cancellations/[id]/review/route.ts src/app/api/workspace/cancellations/[id]/refund-account/route.ts tests/unit/refundAccountVault.test.ts tests/unit/refundAccountApi.test.ts tests/unit/cancellationFlow.test.ts && git commit -m "feat: verify and temporarily encrypt refund accounts"`

### Task 5: Tighten Firestore Rules and notification/audit handling

**Files:**
- Modify: `firestore.rules`
- Modify: `src/lib/notification/events.ts`
- Modify: `src/app/api/workspace/notifications/[id]/retry/route.ts`
- Modify: `src/components/workspace/NotificationBoard.tsx` (or the existing Owner notification board)
- Test: `tests/firebase/firestore-deny.test.ts`, `tests/unit/notificationEvents.test.ts`, `tests/unit/refundSecurityAudit.test.ts`

**Interfaces:**
- Client reads of `cancellationRequests` are denied when the document can contain refund ciphertext; all member and Owner displays use sanitized Server APIs.
- Duplicate-account events expose only IDs, bank code, last five, status, timestamps, and outcome.
- Mismatch events expose request ID, actor, time, attempt count, and result; never account input, HMAC canonical input, or ciphertext.

- [ ] **Step 1: Add failing Rules tests.**

Assert anonymous, member, helper, and Owner Client SDK reads/writes cannot access encrypted cancellation fields or write account/payment/audit data directly. Admin SDK behavior remains covered separately.

- [ ] **Step 2: Deny direct client access and preserve public reads.**

Change cancellation rules to reject direct reads and writes; update affected client pages to use existing protected APIs. Keep `memberPaymentAccounts` fully denied to Client SDK.

- [ ] **Step 3: Add notification outcome transitions.**

Allow Owner API to mark duplicate events `confirmedDifferent` or `confirmedDuplicate`, preserving immutable event history and writing an audit entry for the action. Neither outcome automatically blocks the member account.

- [ ] **Step 4: Add rate-limit and audit tests.**

Cover five failed attempts per request within 15 minutes, member/IP limits, cooldown behavior, and mismatch audit records with no sensitive payload.

- [ ] **Step 5: Run Rules and unit tests and commit.**

Run: `npm run firebase:rules:test`

Run: `npx vitest run tests/unit/notificationEvents.test.ts tests/unit/refundSecurityAudit.test.ts`

Expected: all direct client business reads/writes are denied and safe notification/audit metadata is available to Owner APIs only.

Commit: `git add firestore.rules src/lib/notification/events.ts src/app/api/workspace/notifications/[id]/retry/route.ts src/components/workspace tests/firebase/firestore-deny.test.ts tests/unit/notificationEvents.test.ts tests/unit/refundSecurityAudit.test.ts && git commit -m "feat: isolate refund data and audit account mismatches"`

### Task 6: Migration, expiry cleanup, and key-governance tools

**Files:**
- Create: `scripts/migrate-member-account-fingerprints.mjs`
- Create: `scripts/cleanup-refund-account-temp.mjs`
- Create: `scripts/report-fingerprint-key-usage.mjs`
- Modify: `scripts/check-production-env.mjs`
- Modify: `docs/14_Deployment.md`, `docs/16_MVPCompletionPlan.md`, `docs/17_ProjectHandoff.md`
- Test: `tests/unit/fingerprintMigration.test.ts`, `tests/unit/productionScripts.test.ts`

**Interfaces:**
- `node scripts/migrate-member-account-fingerprints.mjs --project <id> --confirm-project <id> --dry-run`
- `node scripts/cleanup-refund-account-temp.mjs --project <id> --confirm-project <id>`
- `node scripts/report-fingerprint-key-usage.mjs --project <id> --confirm-project <id>`

- [ ] **Step 1: Add dry-run migration tests.**

Cover full-account legacy records deriving a new fingerprint, last-five-only records becoming `needsReverification`, and reports that never print full account input.

- [ ] **Step 2: Implement migration with backup and project confirmation.**

Require explicit production project confirmation, write a local ignored backup before mutation, derive identities only from records that still contain a full account, and remove plaintext fields in the mutation mode. Never rewrite immutable payment snapshots; mark snapshots without fingerprints for manual review.

- [ ] **Step 3: Implement expiry cleanup and defense in depth.**

Delete expired ciphertext fields and mark requests `needsReverification`. Run cleanup through a protected Cloud Scheduler → Cloud Run／2nd-gen Function endpoint and also enforce expiry on every reveal/review request. Emit an Owner alert on job failure.

- [ ] **Step 4: Implement monthly key-usage reporting.**

Count references by `fingerprintKeyVersion` in member accounts and payment snapshots, record earliest/latest references and unreferenced versions, and never auto-disable a key. The report is monthly and failure is alertable.

- [ ] **Step 5: Extend environment checks and docs.**

Require KMS project/key names, latest HMAC version, refund encryption key name, and WIF identity configuration in `production:env:check`. Document old-key long-term retention, re-fingerprint only on authenticated re-entry, cleanup schedule, and rollback.

- [ ] **Step 6: Run script tests and commit.**

Run: `npx vitest run tests/unit/fingerprintMigration.test.ts tests/unit/productionScripts.test.ts`

Expected: dry-run is read-only, project mismatch is rejected, no script output contains full accounts, and key reports include all required statistics.

Commit: `git add scripts/migrate-member-account-fingerprints.mjs scripts/cleanup-refund-account-temp.mjs scripts/report-fingerprint-key-usage.mjs scripts/check-production-env.mjs docs/14_Deployment.md docs/16_MVPCompletionPlan.md docs/17_ProjectHandoff.md tests/unit/fingerprintMigration.test.ts tests/unit/productionScripts.test.ts && git commit -m "ops: add account fingerprint migration and key governance"`

### Task 7: End-to-end member, Owner, duplicate, and refund verification

**Files:**
- Modify: `tests/e2e/global-setup.ts`
- Create: `tests/e2e/member-account-fingerprint-refund.spec.ts`
- Modify: `tests/e2e/member-payment-cancellation-flow.spec.ts`
- Modify: `tests/e2e/workspace-mobile-acceptance.spec.ts`

- [ ] **Step 1: Seed emulator-only owner, helper, member A, and member B data.**

Use clearly labeled test accounts and distinct full account numbers sharing one bank code and last five. Seed one exact duplicate fingerprint and one collision with a different fingerprint.

- [ ] **Step 2: Add member binding coverage.**

Verify full account input creates only bank code, last five, fingerprint, and version; duplicate registrations succeed and create Owner notifications; no UI/API response contains full account.

- [ ] **Step 3: Add payment and refund coverage.**

Verify payment reports snapshot the fingerprint, refund with the matching full account succeeds, a mismatch is throttled and audited without adjustment, Owner reveal is available for 14 days, and changing the order to `refunded` deletes ciphertext.

- [ ] **Step 4: Add key-version and historical-data coverage.**

Use a fake KMS client with two versions to verify new writes use latest, refund validation uses the payment snapshot version, and cross-version stored fingerprints are not directly compared.

- [ ] **Step 5: Run the emulator E2E suite and commit.**

Run: `npm run test:e2e:emulated`

Expected: member, Owner, helper, duplicate notification, mismatch audit, and 14-day deletion flows pass without exposing full account data.

Commit: `git add tests/e2e/global-setup.ts tests/e2e/member-account-fingerprint-refund.spec.ts tests/e2e/member-payment-cancellation-flow.spec.ts tests/e2e/workspace-mobile-acceptance.spec.ts && git commit -m "test: cover account fingerprint and refund verification flows"`

### Task 8: Full verification and handoff

**Files:**
- Modify: `docs/10_TestPlan.md`, `docs/11_Changelog.md`, `docs/16_MVPCompletionPlan.md`, `docs/17_ProjectHandoff.md`

- [ ] **Step 1: Run static and unit verification.**

Run: `npm run typecheck; npm run lint; npm run test:unit; npm run build`

Expected: all commands exit 0.

- [ ] **Step 2: Run Rules, emulator E2E, secret scan, and production audit.**

Run: `npm run firebase:rules:test; npm run test:e2e:emulated; npm run check:secrets; npm run audit:production`

Expected: all commands exit 0; reports contain no full account values or HMAC canonical inputs.

- [ ] **Step 3: Update handoff records.**

Record each changed file, migration mode, KMS configuration status, key-version policy, cleanup schedule, test output, deployment status, and any external IAM／KMS blocker. Keep secrets and full accounts out of the repository.

- [ ] **Step 4: Commit documentation only after verification.**

Commit: `git add docs/10_TestPlan.md docs/11_Changelog.md docs/16_MVPCompletionPlan.md docs/17_ProjectHandoff.md && git commit -m "docs: record bank account fingerprint rollout verification"`

## Execution Order and External Gates

Execute Tasks 1–5 locally and in the Emulator first. Task 6 production migration and Cloud Scheduler deployment require explicit project confirmation and KMS／IAM access. Task 7 must pass in Emulator before Preview. Production rollout is allowed only after the migration dry-run report, KMS access check, Rules deployment, and full test suite are green.
