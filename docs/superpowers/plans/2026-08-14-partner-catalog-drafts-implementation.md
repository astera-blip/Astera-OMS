# Partner Catalog Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Partner users to propose Product／Variant／Campaign changes without changing formal catalog data until an Owner approves the immutable request.

**Architecture:** Add a protected `catalogChangeRequests` workflow beside the existing catalog repositories. Partner writes create or revise only their own draft request; Owner review applies the saved Product payload through the existing authoritative `saveWorkspaceProductServer` transaction, then records the review and Audit Log in the same server-controlled flow. Public storefront data continues to come only from `productsPublic`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Firebase Admin SDK, Firestore, React, Vitest, Firebase Rules Emulator, Playwright.

## Global Constraints

- Firebase Custom Claim is the only role authority; never infer role from Email.
- Partner draft writes must never update `productsInternal`, `productVariants`, `saleCampaigns`, or `productsPublic` before Owner approval.
- Owner remains able to edit the formal catalog directly through the existing API.
- Client SDK cannot read or write `catalogChangeRequests`; all access uses protected Server APIs.
- This batch covers Product／Variant／Campaign drafts only. Classification, content, supplement, rush-purchase, bonus, and settlement workflows remain later independent batches.
- Reuse existing Product validation, SKU allocation, projection, and save transaction logic.

---

### Task 1: Role capability and draft-domain contract

**Files:**
- Create: `src/lib/catalog-change/catalogChangeRequest.ts`
- Modify: `src/lib/member/rolePolicy.ts`
- Test: `tests/unit/catalogChangeRequest.test.ts`
- Test: `tests/unit/rolePolicy.test.ts`

**Interfaces:**
- Produces: `CatalogChangeRequest`, `CatalogChangeRequestStatus`, `validateCatalogDraftInput`, `canAccessCatalogWorkspace`, `canReviewCatalogDraft`.
- Consumes: `RoleKey`, `ProductDraft`, existing `normalizeProductDraft` validation.

- [x] **Step 1: Write failing role and draft validation tests**

  Assert Owner／Partner catalog access, Owner-only review, rejection of Helper／Member, rejection of empty reason/title, and acceptance of a normalized Product draft payload.

- [x] **Step 2: Run focused tests and verify RED**

  Run: `npm run test:unit -- tests/unit/catalogChangeRequest.test.ts tests/unit/rolePolicy.test.ts`

- [x] **Step 3: Implement the minimal capability and domain functions**

  Use explicit discriminated results; store integer revision, actor UID, status, payload digest, timestamps, and review reason. Do not add framework abstractions.

- [x] **Step 4: Run focused tests and verify GREEN**

  Run the same focused command and require zero failures.

### Task 2: Server repository and immutable review transition

**Files:**
- Create: `src/lib/catalog-change/serverCatalogChangeRequests.ts`
- Test: `tests/unit/catalogChangeRequestRepository.test.ts`

**Interfaces:**
- Produces: `listCatalogChangeRequestsServer`, `createCatalogChangeRequestServer`, `updateOwnCatalogChangeRequestServer`, `reviewCatalogChangeRequestServer`.
- Consumes: `saveWorkspaceProductServer`, Firestore transaction/batch interfaces, catalog domain validators.

- [ ] **Step 1: Write failing repository tests**

  Cover Partner creation, all-Partner listing, own-draft update, cross-Partner denial, submitted／approved immutability, Owner rejection with reason, Owner approval applying the formal product exactly once, and replay safety.

- [ ] **Step 2: Run focused repository tests and verify RED**

  Run: `npm run test:unit -- tests/unit/catalogChangeRequestRepository.test.ts`

- [ ] **Step 3: Implement the minimal repository**

  Use generated request IDs, server timestamps, SHA-256 payload digests, transactions for request state, and append-only `auditLogs`. Approval invokes the existing server catalog save path only after claiming the submitted request for review; a failed apply restores a reviewable state without publishing partial draft data.

- [ ] **Step 4: Run focused tests and verify GREEN**

  Run the same focused command and require zero failures.

### Task 3: Protected draft and review APIs

**Files:**
- Create: `src/app/api/workspace/catalog-change-requests/route.ts`
- Create: `src/app/api/workspace/catalog-change-requests/[id]/route.ts`
- Create: `src/app/api/workspace/catalog-change-requests/[id]/review/route.ts`
- Modify: `src/app/api/workspace/products/route.ts`
- Test: `tests/unit/catalogChangeRequestApi.test.ts`

**Interfaces:**
- `GET /api/workspace/catalog-change-requests`: Owner／Partner filtered list.
- `POST /api/workspace/catalog-change-requests`: Partner draft creation.
- `PATCH /api/workspace/catalog-change-requests/:id`: creator edits rejected／draft request and resubmits.
- `POST /api/workspace/catalog-change-requests/:id/review`: Owner `approve | reject` with reason.
- Existing formal Product POST remains Owner-only.

- [ ] **Step 1: Write failing API authorization and response tests**

  Assert missing token 401, Helper／Member 403, Partner formal Product POST 403, Partner draft creation 201, cross-Partner edit 403, Owner approve/reject success, and safe 4xx error mapping.

- [ ] **Step 2: Run focused API tests and verify RED**

  Run: `npm run test:unit -- tests/unit/catalogChangeRequestApi.test.ts`

- [ ] **Step 3: Implement the route handlers**

  Read role only from verified claims, accept only intent fields, return sanitized request view models, and never return internal stack/error details.

- [ ] **Step 4: Run focused API tests and verify GREEN**

  Run the same focused command and require zero failures.

### Task 4: Partner／Owner Workspace UI

**Files:**
- Modify: `src/components/workspace/WorkspaceShell.tsx`
- Modify: `src/components/workspace/ProductWorkspace.tsx`
- Create: `src/components/workspace/CatalogReviewBoard.tsx`
- Create: `src/app/workspace/catalog-reviews/page.tsx`
- Test: `tests/e2e/workspace-catalog-draft-flow.spec.ts`

**Interfaces:**
- Partner sees Products and Catalog Reviews only; formal save becomes `送出草稿審核`.
- Owner keeps direct Product save and gains Catalog Reviews.
- Helper still has no catalog Workspace access.

- [ ] **Step 1: Add failing Emulator Playwright role-flow coverage**

  Cover Partner navigation, draft submission without public change, Owner rejection, Partner revision/resubmission, Owner approval, and public projection update after approval.

- [ ] **Step 2: Run the focused E2E and verify RED**

  Run with Auth／Firestore Emulator using the existing project Playwright command and only `workspace-catalog-draft-flow.spec.ts`.

- [ ] **Step 3: Implement the smallest accessible UI changes**

  Reuse ProductWorkspace fields; change only the submission destination by role. Add clear status, creator, revision, review reason, loading/error/retry states, 44px controls, focus-visible behavior, and mobile-safe wrapping.

- [ ] **Step 4: Run focused E2E and verify GREEN**

  Require desktop and Pixel 7 paths to pass.

### Task 5: Rules, full verification, documentation, and release checkpoint

**Files:**
- Modify: `firestore.rules`
- Modify: `tests/firebase/firestore.rules.test.ts`
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`
- Modify: `docs/22_Astera_OMS_Complete_Product_Requirements.md`

**Interfaces:**
- Client SDK reads/writes to `catalogChangeRequests` are denied for every role.
- Server Admin SDK remains the only data path.

- [ ] **Step 1: Add failing Rules tests for the new Collection**

  Assert anonymous, Member, Helper, Partner, and Owner Client SDK read/write denial.

- [ ] **Step 2: Add the explicit deny rule and verify GREEN**

  Run: `npm run firebase:rules:test`.

- [ ] **Step 3: Run the complete local release gate**

  Run TypeScript, ESLint, Unit, Firestore／Storage Rules, Build, regular Playwright, Emulator Playwright, secret scan, and production dependency audit.

- [ ] **Step 4: Update execution and handoff documents**

  Record exact files, red／green evidence, test counts, commit IDs, deployment state, and the next precise batch: classification／content drafts or rush-purchase contributions.

- [ ] **Step 5: Commit the reviewed batch**

  Keep the branch isolated until all gates are green and a deployment decision is made.

## Self-review

- Spec coverage: this plan implements confirmed rollout batch 2 for Product／Variant／Campaign. Classification, brand content, supplement, rush-purchase, bonus, and settlement are explicitly retained as later independent batches so unfinished interfaces are not deployed.
- Placeholder scan: no implementation placeholder or unspecified error handling remains.
- Type consistency: every API consumes the same `CatalogChangeRequest` domain payload and the review repository is the only formal apply boundary.
