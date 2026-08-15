# Catalog Review Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unreadable Firebase UIDs and raw catalog-version tokens in catalog review cards with safe, operator-friendly presentation values.

**Architecture:** Keep `CatalogChangeRequest.createdBy` and `baseProductVersion` unchanged in Firestore and in authorization/stale guards. The protected catalog-change-request read path resolves each request creator from the existing `members` collection, exposes a response-only `creatorDisplayName`, and the client renders that value together with explanatory version copy.

**Tech Stack:** Next.js 16 route handlers, Firebase Admin Firestore, React, TypeScript, Vitest.

## Global Constraints

- Reuse `members.displayName` and `members.communityId`; do not create or migrate Collections.
- The UI must never fall back to displaying a Firebase UID.
- The persisted `createdBy` UID and `baseProductVersion` remain untouched for authorization and stale-version checks.
- Do not modify Product, Campaign, Checkout, Firebase Rules, or approval semantics.

---

### Task 1: Enrich protected catalog-review responses and render safe operator copy

**Files:**

- Modify: `src/lib/catalog-change/catalogChangeRequest.ts`
- Modify: `src/lib/catalog-change/serverCatalogChangeRequests.ts`
- Modify: `src/components/workspace/CatalogReviewBoard.tsx`
- Modify: `tests/unit/catalogChangeRequestRepository.test.ts`
- Modify: `tests/unit/catalogReviewBoard.test.tsx` (or the existing component test file)

**Interfaces:**

- Consumes: `CatalogChangeRequest.createdBy`, `members/{uid}.displayName`, and `members/{uid}.communityId`.
- Produces: `CatalogChangeRequest.creatorDisplayName?: string`, which is response-only and must not be persisted by create/update/review write paths.

- [ ] **Step 1: Write the failing repository/API-facing test**

```ts
it("adds the completed member name to a listed request without replacing createdBy", async () => {
  state.memberProfiles.set("partner-a", {
    displayName: "合作人小葉",
    communityId: "葉葉",
  });

  const [request] = await listCatalogChangeRequestsServer(state.db as never);

  expect(request.createdBy).toBe("partner-a");
  expect(request.creatorDisplayName).toBe("合作人小葉（葉葉）");
});

it("uses the safe incomplete-profile fallback and never exposes a UID", async () => {
  const [request] = await listCatalogChangeRequestsServer(state.db as never);

  expect(request.creatorDisplayName).toBe("未完成會員資料");
  expect(request.creatorDisplayName).not.toContain(request.createdBy);
});
```

- [ ] **Step 2: Run the focused repository test and verify RED**

Run: `npm run test:unit -- tests/unit/catalogChangeRequestRepository.test.ts`

Expected: FAIL because `creatorDisplayName` is absent from the returned request.

- [ ] **Step 3: Write the failing review-card behavior test**

```tsx
expect(screen.getByText("合作人小葉（葉葉）")).toBeInTheDocument();
expect(screen.getByText("送審時版本")).toBeInTheDocument();
expect(screen.getByText(/以送審當下的正式商品為準/)).toBeInTheDocument();
expect(screen.queryByText("partner-a")).not.toBeInTheDocument();
expect(screen.queryByText("1785369136279")).not.toBeInTheDocument();
```

- [ ] **Step 4: Run the focused component test and verify RED**

Run: `npm run test:unit -- tests/unit/catalogReviewBoard.test.tsx`

Expected: FAIL because the card currently renders `request.createdBy` and the raw base-version token.

- [ ] **Step 5: Implement the minimal server enrichment**

```ts
export type CatalogChangeRequest = {
  // Existing persisted fields remain unchanged.
  createdBy: string;
  creatorDisplayName?: string;
};

function formatCreator(data: Record<string, unknown> | undefined) {
  const displayName = typeof data?.displayName === "string" ? data.displayName.trim() : "";
  const communityId = typeof data?.communityId === "string" ? data.communityId.trim() : "";
  if (!displayName) return "未完成會員資料";
  return communityId && communityId !== displayName
    ? `${displayName}（${communityId}）`
    : displayName;
}
```

Use Firestore Admin reads in `listCatalogChangeRequestsServer` to resolve distinct creator UIDs. Spread `creatorDisplayName` only into the returned response objects; do not add it to `createCatalogChangeRequestServer`, `updateOwnCatalogChangeRequestServer`, `reviewCatalogChangeRequestServer`, revision history, or audit writes.

- [ ] **Step 6: Implement the review-card wording**

```tsx
<div><dt className="text-astera-secondary">建立者</dt><dd>{request.creatorDisplayName ?? "未完成會員資料"}</dd></div>
<div>
  <dt className="text-astera-secondary">送審時版本</dt>
  <dd>{request.baseProductVersion
    ? "以送審當下的正式商品為準；若之後被更新，系統會阻止核准並要求重新送審。"
    : "新商品草稿，尚無既有正式版本。"}</dd>
</div>
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
npm run test:unit -- tests/unit/catalogChangeRequestRepository.test.ts
npm run test:unit -- tests/unit/catalogReviewBoard.test.tsx
```

Expected: both focused suites pass, creator UIDs and raw base-version values are absent from rendered card content.

- [ ] **Step 8: Run full relevant verification**

Run:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Expected: TypeScript, zero-warning ESLint, all unit tests, and the production build pass.

- [ ] **Step 9: Update project handoff and commit**

Add the implementation result, tests, Preview deployment state, and next manual check to `docs/16_MVPCompletionPlan.md` and `docs/17_ProjectHandoff.md`. Then commit:

```bash
git add src/lib/catalog-change/catalogChangeRequest.ts src/lib/catalog-change/serverCatalogChangeRequests.ts src/components/workspace/CatalogReviewBoard.tsx tests/unit/catalogChangeRequestRepository.test.ts tests/unit/catalogReviewBoard.test.tsx docs/16_MVPCompletionPlan.md docs/17_ProjectHandoff.md
git commit -m "fix: clarify catalog review creator and base version"
```

## Plan Self-Review

- Spec coverage: Task 1 covers response-only member-name resolution, safe fallback, non-disclosure of UIDs, human-readable stale-version wording, and regression tests.
- Placeholder scan: no incomplete markers or deferred implementation steps remain.
- Type consistency: `creatorDisplayName?: string` is introduced only on the API read model and is deliberately excluded from persistence paths.
