# Astera OMS Role Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 Owner 能從會員管理頁安全地將既有會員指派為 Partner、Helper 或 Member，並以 Firebase Custom Claim、撤銷驗證、不可修改 Audit Log 與一次性通知保護整個流程。

**Architecture:** 角色值與能力集中在純函式模組；Server Auth 使用 Firebase Admin Auth 驗證 ID token 並檢查撤銷狀態。Owner-only Route Handler 呼叫獨立角色指派服務，服務驗證目標會員、更新 Custom Claim、撤銷 Refresh Token，再寫入 Audit Log 與一次性通知；任何 Client SDK 寫入仍由 Rules 拒絕。

**Tech Stack:** Next.js 16.2.11 App Router Route Handlers、React 19、TypeScript、Firebase Admin Auth／Firestore、Vitest、Firebase Emulator Suite、Playwright。

## Global Constraints

- 正式角色固定為 `owner | partner | helper | member`，Firebase Custom Claim 是唯一權限來源。
- 網站只允許 Owner 指派 `partner | helper | member`；不得授予、移除或轉移 Owner。
- 不以 Email 判斷 Owner，不把 Firestore member role 當作權威來源。
- Client SDK 不得寫入角色、角色通知或 Audit Log。
- 角色異動後撤銷目標 Refresh Token；受保護 API 必須拒絕已撤銷 ID token。
- 第一批不開放 Partner／Helper Workspace 業務功能；只有 Owner 可使用目前 Workspace。
- 不修改 Collection、Checkout、Order、Payment、Cancellation 或 `productsPublic` 商業語意。
- 每項 Production 程式變更都必須先建立會因功能缺失而失敗的測試。

---

## File Structure

### New files

- `src/lib/member/rolePolicy.ts`：正式角色集合、標籤、Claim 解析與角色指派輸入驗證。
- `src/lib/firebase/adminAuth.ts`：Firebase Admin Auth 的單一 Server-only 入口。
- `src/lib/member/roleAssignment.ts`：角色指派服務、Auth／Firestore 寫入順序、補償與錯誤代碼。
- `src/app/api/workspace/members/[uid]/role/route.ts`：Owner-only 角色指派 Route Handler。
- `src/app/api/member/role-notifications/route.ts`：目前會員讀取及確認一次性角色通知的 Route Handler。
- `src/components/auth/RoleChangeNotice.tsx`：登入後一次性角色更新提示。
- `tests/unit/rolePolicy.test.ts`：角色純函式與驗證測試。
- `tests/unit/serverAuthRevocation.test.ts`：Server token 撤銷驗證測試。
- `tests/unit/roleAssignmentApi.test.ts`：角色指派 API 與補償測試。
- `tests/unit/roleNotificationApi.test.ts`：通知讀取與確認測試。

### Modified files

- `src/domain/identity.ts`：將 `partner` 加入 `RoleKey`。
- `src/lib/member/role.ts`：改由 `rolePolicy` 解析 Claim，保留既有 import 相容性。
- `src/lib/firebase/serverAuth.ts`：改用 `getAdminAuth().verifyIdToken(token, true)`。
- `src/app/api/workspace/members/route.ts`：會員摘要加入 Firebase Auth 角色，但不把角色寫入 member document。
- `src/components/workspace/MemberOperationsBoard.tsx`：角色欄、選單、二次確認、送出狀態與中文回饋。
- `src/components/workspace/WorkspaceShell.tsx`：第一批只允許 Owner；Partner／Helper 顯示尚未開放的清楚訊息。
- `src/app/layout.tsx`：掛載 `RoleChangeNotice`。
- `firestore.rules`：明確拒絕 Client 讀寫 `roleChangeNotifications`，維持 Audit Log 全拒絕。
- `firestore.indexes.json`：加入未確認角色通知所需的會員、狀態及時間複合索引。
- `scripts/set-user-role.mjs`：CLI 支援 `partner`，網站仍不得設定 Owner。
- `scripts/seed-firebase-emulator.mjs`：新增 Partner、Helper 與專用角色異動目標帳號。
- `tests/e2e/workspace-member-flow.spec.ts`：Owner 指派、Audit Log、通知、重新登入與 Workspace 拒絕流程。
- `tests/firebase/firestore-deny.test.ts`：四種 Client 角色均不能讀寫角色通知或 Audit Log。
- `tests/unit/nextRuntimeConfig.test.ts`：允許專用 `adminAuth.ts` 使用 `firebase-admin/auth`，仍禁止 Client／共享 Admin 模組誤載入。
- `docs/16_MVPCompletionPlan.md`、`docs/17_ProjectHandoff.md`：記錄第一批完成狀態、檔案與驗證結果。

---

### Task 1: Central Role Policy

**Files:**
- Create: `src/lib/member/rolePolicy.ts`
- Modify: `src/domain/identity.ts`
- Modify: `src/lib/member/role.ts`
- Test: `tests/unit/rolePolicy.test.ts`

**Interfaces:**
- Produces: `ROLE_KEYS`, `ASSIGNABLE_ROLE_KEYS`, `roleLabels`, `isRoleKey(value)`, `isAssignableRole(value)`, `getRoleFromClaims(claims)`, `validateRoleAssignment(input)`.
- `validateRoleAssignment(input: { actorUid: string; targetUid: string; actorRole: RoleKey; targetRole: RoleKey; nextRole: unknown; targetHasCompletedProfile: boolean }): { ok: true; value: { nextRole: AssignableRoleKey } } | { ok: false; error: RoleAssignmentError }`.

- [ ] **Step 1: Write failing role policy tests**

```ts
import { describe, expect, it } from "vitest";
import {
  getRoleFromClaims,
  validateRoleAssignment,
} from "@/lib/member/rolePolicy";

describe("role policy", () => {
  it("recognizes partner claims and falls back to member", () => {
    expect(getRoleFromClaims({ role: "partner" })).toBe("partner");
    expect(getRoleFromClaims({ role: "unexpected" })).toBe("member");
  });

  it("allows Owner to assign Partner, Helper, and Member", () => {
    for (const nextRole of ["partner", "helper", "member"] as const) {
      expect(validateRoleAssignment({
        actorUid: "owner-a",
        targetUid: "member-a",
        actorRole: "owner",
        targetRole: "member",
        nextRole,
        targetHasCompletedProfile: true,
      })).toEqual({ ok: true, value: { nextRole } });
    }
  });

  it.each([
    ["forbidden", { actorRole: "partner", nextRole: "helper" }],
    ["owner_assignment_forbidden", { actorRole: "owner", nextRole: "owner" }],
    ["owner_target_forbidden", { actorRole: "owner", targetRole: "owner", nextRole: "member" }],
    ["self_assignment_forbidden", { actorRole: "owner", targetUid: "owner-a", nextRole: "member" }],
    ["member_profile_incomplete", { actorRole: "owner", nextRole: "helper", targetHasCompletedProfile: false }],
  ])("returns %s", (error, overrides) => {
    expect(validateRoleAssignment({
      actorUid: "owner-a",
      targetUid: "member-a",
      actorRole: "owner",
      targetRole: "member",
      nextRole: "helper",
      targetHasCompletedProfile: true,
      ...overrides,
    })).toEqual({ ok: false, error });
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:unit -- tests/unit/rolePolicy.test.ts`

Expected: FAIL because `rolePolicy.ts` does not exist and `RoleKey` does not include `partner`.

- [ ] **Step 3: Implement the minimal role policy**

```ts
export const ROLE_KEYS = ["owner", "partner", "helper", "member"] as const;
export const ASSIGNABLE_ROLE_KEYS = ["partner", "helper", "member"] as const;
export type AssignableRoleKey = typeof ASSIGNABLE_ROLE_KEYS[number];

export const roleLabels = {
  owner: "Owner（最高管理者）",
  partner: "Partner（合作人）",
  helper: "Helper（小幫手）",
  member: "Member（會員）",
} as const;
```

Implement `isRoleKey`, `isAssignableRole`, `getRoleFromClaims`, and `validateRoleAssignment` exactly against the test matrix. Change `RoleKey` to derive from `ROLE_KEYS` or include all four literal values. Re-export `getRoleFromClaims` from `src/lib/member/role.ts` so current imports remain valid.

- [ ] **Step 4: Run the focused test and typecheck**

Run: `npm run test:unit -- tests/unit/rolePolicy.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS or only failures in later planned files that explicitly assume three roles; fix exhaustive role checks without opening Partner／Helper business permissions.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- src/domain/identity.ts src/lib/member/role.ts src/lib/member/rolePolicy.ts tests/unit/rolePolicy.test.ts
git commit -m "feat: define internal role policy"
```

---

### Task 2: Revocation-Aware Server Authentication

**Files:**
- Create: `src/lib/firebase/adminAuth.ts`
- Modify: `src/lib/firebase/serverAuth.ts`
- Modify: `tests/unit/nextRuntimeConfig.test.ts`
- Test: `tests/unit/serverAuthRevocation.test.ts`

**Interfaces:**
- Produces: `getAdminAuth(): Auth` in `adminAuth.ts`.
- Preserves: `requireFirebaseUser(request): Promise<FirebaseUserClaims>` and `isOwnerClaim(claims)`.
- `requireFirebaseUser` maps missing header to `missing_token`, invalid or revoked token to `invalid_token`.

- [ ] **Step 1: Write failing revocation tests with injected Admin Auth mock**

```ts
const auth = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
}));

vi.mock("@/lib/firebase/adminAuth", () => ({
  getAdminAuth: () => auth,
}));

it("checks token revocation and returns normalized claims", async () => {
  auth.verifyIdToken.mockResolvedValue({ uid: "owner-a", role: "owner", email: "owner@example.test" });
  const claims = await requireFirebaseUser(new Request("https://example.test", {
    headers: { authorization: "Bearer token-a" },
  }));
  expect(auth.verifyIdToken).toHaveBeenCalledWith("token-a", true);
  expect(claims).toMatchObject({ uid: "owner-a", role: "owner" });
});

it("normalizes revoked tokens to invalid_token", async () => {
  auth.verifyIdToken.mockRejectedValue(new Error("auth/id-token-revoked"));
  await expect(requireFirebaseUser(new Request("https://example.test", {
    headers: { authorization: "Bearer revoked" },
  }))).rejects.toThrow("invalid_token");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:unit -- tests/unit/serverAuthRevocation.test.ts`

Expected: FAIL because `adminAuth.ts` does not exist and current code calls Identity Toolkit without `checkRevoked`.

- [ ] **Step 3: Add the dedicated Server-only Admin Auth adapter**

```ts
import "server-only";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "@/lib/firebase/admin";

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
```

Replace the Identity Toolkit lookup in `serverAuth.ts` with `getAdminAuth().verifyIdToken(idToken, true)`. Preserve only safe normalized claims and map all verification failures to `invalid_token`. Do not import `firebase-admin/auth` from Client Components or `admin.ts`.

- [ ] **Step 4: Update runtime boundary tests**

Assert that:

```ts
expect(readFileSync("src/lib/firebase/adminAuth.ts", "utf8")).toContain("firebase-admin/auth");
expect(readFileSync("src/lib/firebase/admin.ts", "utf8")).not.toContain("firebase-admin/auth");
```

Remove the obsolete assertion that `serverAuth.ts` must not use Admin Auth indirectly; retain the requirement that only `adminAuth.ts` contains the package import.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm run test:unit -- tests/unit/serverAuthRevocation.test.ts tests/unit/nextRuntimeConfig.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- src/lib/firebase/adminAuth.ts src/lib/firebase/serverAuth.ts tests/unit/serverAuthRevocation.test.ts tests/unit/nextRuntimeConfig.test.ts
git commit -m "feat: reject revoked Firebase tokens"
```

---

### Task 3: Owner Role Assignment Service and API

**Files:**
- Create: `src/lib/member/roleAssignment.ts`
- Create: `src/app/api/workspace/members/[uid]/role/route.ts`
- Modify: `src/app/api/workspace/members/route.ts`
- Test: `tests/unit/roleAssignmentApi.test.ts`

**Interfaces:**
- `assignMemberRole(input: { actorClaims: FirebaseUserClaims; targetUid: string; nextRole: unknown; auth: Pick<Auth, "getUser" | "getUsers" | "setCustomUserClaims" | "revokeRefreshTokens">; db: Firestore }): Promise<RoleAssignmentResult>`.
- `RoleAssignmentResult = { uid: string; previousRole: RoleKey; nextRole: AssignableRoleKey; changedAt: string }`.
- `PUT /api/workspace/members/:uid/role` consumes `{ role: "partner" | "helper" | "member" }`.
- `GET /api/workspace/members` returns each member with `role: RoleKey` from Firebase Auth, not Firestore.

- [ ] **Step 1: Write failing service/API tests**

Test these behaviors separately:

```ts
it("Owner assigns Partner, preserves unrelated claims, revokes tokens, and writes audit plus notice", async () => {
  const response = await PUT(ownerRequest({ role: "partner" }), routeContext("member-a"));
  expect(response.status).toBe(200);
  expect(auth.setCustomUserClaims).toHaveBeenCalledWith("member-a", {
    existingClaim: true,
    role: "partner",
  });
  expect(auth.revokeRefreshTokens).toHaveBeenCalledWith("member-a");
  expect(writes.audit).toMatchObject({
    action: "auth.role.updated",
    actorUid: "owner-a",
    targetId: "member-a",
    reason: "role_assignment",
    previousRole: "member",
    nextRole: "partner",
  });
  expect(writes.notice).toMatchObject({
    memberUid: "member-a",
    type: "role_changed",
    previousRole: "member",
    nextRole: "partner",
    acknowledgedAt: null,
  });
});
```

Also assert 403 for Partner／Helper／Member callers; 400 for Owner role, self-change, incomplete profile and same-role request; 404 for missing Auth user/member; and no Auth writes for every rejected request.

Add a compensation test: when Firestore audit／notice transaction fails after the claim update, the service restores the original claims, revokes tokens again, returns `role_assignment_persistence_failed`, and does not claim success.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:unit -- tests/unit/roleAssignmentApi.test.ts`

Expected: FAIL because the service and Route Handler do not exist.

- [ ] **Step 3: Implement role assignment service**

Service order:

1. Verify actor role is Owner through `validateRoleAssignment`.
2. Read target member document and Auth user.
3. Derive previous role from `customClaims`.
4. Reject Owner target, self-target, incomplete member and same-role request.
5. Preserve unrelated Custom Claims and call `setCustomUserClaims`.
6. Call `revokeRefreshTokens`.
7. In one Firestore transaction create an immutable `auditLogs` document and `roleChangeNotifications` document.
8. If step 7 fails, restore original claims, revoke tokens again, and throw `role_assignment_persistence_failed`.

Use stable document IDs based on an operation UUID generated server-side and return no target private profile fields.

- [ ] **Step 4: Implement Route Handler and member role DTO**

```ts
export async function PUT(
  request: Request,
  context: RouteContext<"/api/workspace/members/[uid]/role">,
) {
  const { uid } = await context.params;
  const claims = await requireFirebaseUser(request);
  if (!isOwnerClaim(claims)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { role } = await request.json() as { role?: unknown };
  const assignment = await assignMemberRole({
    actorClaims: claims,
    targetUid: uid,
    nextRole: role,
    auth: getAdminAuth(),
    db: getAdminFirestore(),
  });
  return NextResponse.json({ assignment });
}
```

Map known errors to 400／403／404／409／503 and unknown errors to sanitized 500 responses. In the member GET API, batch Auth lookups in chunks of 100 and return `member` when a user has no valid role claim; never copy roles into member documents.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm run test:unit -- tests/unit/rolePolicy.test.ts tests/unit/serverAuthRevocation.test.ts tests/unit/roleAssignmentApi.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```powershell
git add -- src/lib/member/roleAssignment.ts src/app/api/workspace/members/[uid]/role/route.ts src/app/api/workspace/members/route.ts tests/unit/roleAssignmentApi.test.ts
git commit -m "feat: add Owner role assignment API"
```

---

### Task 4: One-Time Role Change Notification

**Files:**
- Create: `src/app/api/member/role-notifications/route.ts`
- Create: `src/components/auth/RoleChangeNotice.tsx`
- Modify: `src/app/layout.tsx`
- Test: `tests/unit/roleNotificationApi.test.ts`
- Test: `tests/unit/uiAccessibility.test.ts`

**Interfaces:**
- `GET /api/member/role-notifications` returns `{ notification: null | { id; previousRole; nextRole; changedAt } }` for the current UID only.
- `POST /api/member/role-notifications` consumes `{ id: string }` and atomically sets `acknowledgedAt` only when `memberUid === claims.uid`.
- `RoleChangeNotice` displays `你的帳號角色已更新為 Partner（合作人），新的權限已生效。` and an acknowledgment button.

- [ ] **Step 1: Write failing notification API tests**

```ts
it("returns only the signed-in member's newest unacknowledged notice", async () => {
  const response = await GET(memberRequest("member-a"));
  expect(await response.json()).toEqual({
    notification: {
      id: "role-notice-a",
      previousRole: "member",
      nextRole: "partner",
      changedAt: "2026-08-14T09:00:00.000Z",
    },
  });
});

it("does not let one member acknowledge another member's notice", async () => {
  const response = await POST(memberRequest("member-b", { id: "role-notice-a" }));
  expect(response.status).toBe(404);
});
```

Assert already acknowledged returns `notification: null`; POST replay is idempotent; neither response exposes actor UID or audit metadata.

- [ ] **Step 2: Run notification tests and verify RED**

Run: `npm run test:unit -- tests/unit/roleNotificationApi.test.ts`

Expected: FAIL because the API does not exist.

- [ ] **Step 3: Implement protected notification API**

Query `roleChangeNotifications` with `memberUid == claims.uid` and `acknowledgedAt == null`, order by `changedAt desc`, limit 1. The POST transaction reads the exact document and returns 404 unless it belongs to the caller. Use `FieldValue.serverTimestamp()` for acknowledgment.

- [ ] **Step 4: Write failing UI accessibility assertions**

Assert `RoleChangeNotice.tsx` includes `role="status"`, `aria-live="polite"`, a minimum 44px action, and calls only the protected role-notifications API after a signed-in user exists.

- [ ] **Step 5: Implement and mount the notice**

Use `useAuth()` to obtain user and role. Fetch with a fresh ID token; display the translated role label; after acknowledgment succeeds, remove the notice. Mount inside the existing AuthProvider in `src/app/layout.tsx` so it appears on storefront and Workspace routes.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm run test:unit -- tests/unit/roleNotificationApi.test.ts tests/unit/uiAccessibility.test.ts`

Expected: PASS.

```powershell
git add -- src/app/api/member/role-notifications/route.ts src/components/auth/RoleChangeNotice.tsx src/app/layout.tsx tests/unit/roleNotificationApi.test.ts tests/unit/uiAccessibility.test.ts
git commit -m "feat: notify members of role changes"
```

---

### Task 5: Owner Member Management UI and Workspace Boundary

**Files:**
- Modify: `src/components/workspace/MemberOperationsBoard.tsx`
- Modify: `src/components/workspace/WorkspaceShell.tsx`
- Test: `tests/unit/uiAccessibility.test.ts`
- Test: `tests/e2e/workspace-member-flow.spec.ts`

**Interfaces:**
- `MemberSummary` adds `role: RoleKey`.
- UI sends `PUT /api/workspace/members/${uid}/role` with `{ role: nextRole }` only after second confirmation.
- Workspace remains Owner-only in Batch 1.

- [ ] **Step 1: Add failing UI/E2E expectations**

The Owner member card must show current role, an assignable role select for non-Owner members, and a `確認變更角色` dialog containing current role, new role, target member, and forced re-login warning. Owner cards have no editable role control.

Add unit source assertions for `role="alertdialog"`, `aria-modal="true"`, disabled submitting state and 44px actions. Add E2E steps that cancel once and verify no request, then confirm and verify success.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run test:unit -- tests/unit/uiAccessibility.test.ts`

Expected: FAIL because no role controls exist.

- [ ] **Step 3: Implement role assignment UI**

Keep risk note editing independent from role state. Store pending confirmation as:

```ts
type PendingRoleChange = {
  uid: string;
  displayName: string;
  currentRole: RoleKey;
  nextRole: AssignableRoleKey;
};
```

During the request disable both confirmation actions and display `角色變更中…`. On success reload `/api/workspace/members`, clear the dialog, and announce `已將 {name} 設為 {label}；對方重新登入後生效。` with `aria-live="polite"`. On failure keep the dialog and show a sanitized Chinese error with `role="alert"`.

- [ ] **Step 4: Close unimplemented Workspace permissions**

Change `WorkspaceShell` so `canUseWorkspace` is `role === "owner"`. Signed-in Partner／Helper sees `目前角色為 Partner（合作人）／Helper（小幫手）；此角色的工作區功能將在對應批次開放。` Current Owner navigation remains unchanged.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm run test:unit -- tests/unit/uiAccessibility.test.ts tests/unit/rolePolicy.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```powershell
git add -- src/components/workspace/MemberOperationsBoard.tsx src/components/workspace/WorkspaceShell.tsx tests/unit/uiAccessibility.test.ts tests/e2e/workspace-member-flow.spec.ts
git commit -m "feat: add role controls to member workspace"
```

---

### Task 6: Emulator Rules and End-to-End Role Lifecycle

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Modify: `tests/firebase/firestore-deny.test.ts`
- Modify: `scripts/seed-firebase-emulator.mjs`
- Modify: `tests/e2e/workspace-member-flow.spec.ts`

**Interfaces:**
- Seed accounts: `partner-e2e`, `helper-e2e`, `role-target-e2e` with completed member documents.
- End-to-end target moves `member → helper → member` so tests leave the seed in a deterministic final role.

- [ ] **Step 1: Add Rules regression tests for the existing default-deny boundary**

For anonymous, Member, Helper, Partner, and Owner Client SDK contexts, assert reads and writes to `roleChangeNotifications/notice-a` fail. Assert Client writes to `auditLogs/role-a` continue to fail. Seed both documents only through `withSecurityRulesDisabled`.

- [ ] **Step 2: Run Rules tests and verify the catch-all already denies access**

Run: `npm run firebase:rules:test`

Expected: PASS because the existing final catch-all already denies the new Collection. This is a regression test for an existing security boundary, not a new behavior test.

- [ ] **Step 3: Add explicit Rules denial, required index, and emulator identities**

```rules
match /roleChangeNotifications/{notificationId} {
  allow read, write: if false;
}
```

Add this composite index for the protected API query:

```json
{
  "collectionGroup": "roleChangeNotifications",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "memberUid", "order": "ASCENDING" },
    { "fieldPath": "acknowledgedAt", "order": "ASCENDING" },
    { "fieldPath": "changedAt", "order": "DESCENDING" }
  ]
}
```

Seed Partner／Helper／role target accounts via Auth Emulator Custom Claims and completed `members` documents. Do not seed role fields into Firestore member documents.

- [ ] **Step 4: Complete serial Playwright lifecycle**

Flow:

1. Owner signs in and opens `/workspace/members`.
2. Owner changes `Role Target E2E` from Member to Helper after the second confirmation.
3. Verify Admin Auth Custom Claim is `helper`, Refresh Token revocation timestamp changed, Audit Log exists, and one unacknowledged notice exists.
4. Target signs in again, sees the one-time Helper notice, acknowledges it, and is denied current Workspace business pages.
5. Owner signs back in and restores target to Member.
6. Verify the second Audit Log and notification without exposing role controls to non-Owner users.

- [ ] **Step 5: Run Emulator Rules and Playwright**

Run: `npm run firebase:rules:test`

Expected: PASS.

Run: `npm run test:e2e:emulated -- tests/e2e/workspace-member-flow.spec.ts`

Expected: PASS with the full Owner／target lifecycle.

- [ ] **Step 6: Commit Task 6**

```powershell
git add -- firestore.rules firestore.indexes.json tests/firebase/firestore-deny.test.ts scripts/seed-firebase-emulator.mjs tests/e2e/workspace-member-flow.spec.ts
git commit -m "test: verify role assignment lifecycle"
```

---

### Task 7: Full Verification and Handoff

**Files:**
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

**Interfaces:**
- Documents record commit IDs, exact files, test totals, external deployment status, and the next precise task: Partner catalog drafts.

- [ ] **Step 1: Run all required verification**

Run in this order:

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run firebase:rules:test
npm run build
npm run test:e2e
npm run test:e2e:emulated
npm run check:secrets
npm run audit:production
```

Expected: every command exits 0. Record exact file／test counts from command output. A partial pass is not project completion.

- [ ] **Step 2: Update execution plan and handoff**

Record:

- role policy and four-role matrix completed;
- Owner-only assignment API completed;
- revoked ID token enforcement completed;
- member role UI and second confirmation completed;
- one-time notification completed;
- Partner／Helper Workspace functionality remains intentionally closed until their respective batches;
- Preview／Production deployment not performed unless separately authorized;
- exact verification results and any environment limitations.

- [ ] **Step 3: Verify docs and working tree**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only the two intended documentation files are modified before the final commit.

- [ ] **Step 4: Commit handoff**

```powershell
git add -- docs/16_MVPCompletionPlan.md docs/17_ProjectHandoff.md
git commit -m "docs: record role assignment completion"
```

- [ ] **Step 5: Final evidence check**

Run: `git log --oneline -8`

Run: `git status --short`

Expected: role assignment commits are visible and the working tree is clean. Do not claim Preview／Production deployment or GitHub push unless those actions are separately executed and verified.
