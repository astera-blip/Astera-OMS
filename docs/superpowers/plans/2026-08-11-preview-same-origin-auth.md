# Preview Same-Origin Firebase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Firebase Google redirect sign-in retain its session on the stable Vercel Preview hostname.

**Architecture:** A Next.js `beforeFiles` external rewrite transparently serves Firebase's `/__/auth/` helper under the Vercel Preview origin. The Preview Firebase `authDomain` is then set to the stable, already-authorized Preview hostname; Firebase project identity values remain unchanged.

**Tech Stack:** Next.js 16.2.11, TypeScript, Vitest, Firebase Auth, Vercel Preview.

## Global Constraints

- Modify Preview only; do not deploy or mutate Production.
- Do not add Firebase Authorized Domains or one-off Vercel deployment domains.
- Use a rewrite, not a redirect, for `/__/auth/`.
- Keep Google redirect sign-in; do not introduce test auth, custom tokens, or browser-storage inspection.
- Do not create banking, payment, order, cancellation, or refund test records before session persistence is proved.

---

### Task 1: Add the transparent Auth-helper rewrite

**Files:**
- Modify: `next.config.ts`
- Modify: `tests/unit/nextRuntimeConfig.test.ts`

**Interfaces:**
- Consumes: Firebase helper origin `https://astera-oms-prod.firebaseapp.com`.
- Produces: `NextConfig.rewrites()` with `beforeFiles[0]` forwarding
  `/__/auth/:path*` to `https://astera-oms-prod.firebaseapp.com/__/auth/:path*`.

- [x] **Step 1: Write the failing regression test**

```ts
test("proxies Firebase Auth helpers before application routes", () => {
  const configSource = readFileSync("next.config.ts", "utf8");

  expect(configSource).toContain("async rewrites()");
  expect(configSource).toContain("beforeFiles");
  expect(configSource).toContain('source: "/__/auth/:path*"');
  expect(configSource).toContain(
    'destination: "https://astera-oms-prod.firebaseapp.com/__/auth/:path*"',
  );
});
```

- [x] **Step 2: Run the focused test and confirm it fails because the rewrite is absent**

Run: `npx vitest run tests/unit/nextRuntimeConfig.test.ts`

Expected: FAIL because `next.config.ts` does not contain `async rewrites()`.

- [x] **Step 3: Add the minimal Next.js `beforeFiles` external rewrite**

```ts
async rewrites() {
  return {
    beforeFiles: [
      {
        source: "/__/auth/:path*",
        destination: "https://astera-oms-prod.firebaseapp.com/__/auth/:path*",
      },
    ],
  };
},
```

- [x] **Step 4: Run the focused test and confirm it passes**

Run: `npx vitest run tests/unit/nextRuntimeConfig.test.ts`

Expected: PASS with every test in the file green.

- [x] **Step 5: Run local release checks and commit the source change**

Run: `npm run typecheck; npm run lint; npm run build; npm run check:secrets; git diff --check`

Expected: all commands exit 0. Commit only `next.config.ts` and
`tests/unit/nextRuntimeConfig.test.ts` with message
`fix: proxy Firebase auth helper on preview`.

### Task 2: Apply Preview-only Firebase configuration and deploy

**Files:**
- No repository file changes.

**Interfaces:**
- Consumes: stable Preview hostname already present in Firebase Authorized Domains.
- Produces: only the Preview Vercel value
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<stable-preview-hostname>` and a Ready Preview
  deployment assigned to that same stable alias.

- [x] **Step 1: Read Vercel Preview environment metadata without showing values**

Run the existing Vercel environment inventory/check tooling and confirm exactly one
Preview `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` record is present before mutation.

- [x] **Step 2: Replace only the Preview `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` value**

Use Vercel CLI in the existing project/team scope. Remove the Preview record only,
then add the stable authorized Preview hostname via stdin. Do not list, print, or
change any Production variable.

> 2026-08-11 checkpoint: the old Preview record was removed. The first add command
> was rejected before it ran because its hostname spelling differed in letter case
> from the approved hostname. After fresh explicit authorization, the exact
> lowercase hostname below was added as Preview-only non-sensitive configuration.

- [x] **Step 3: Push the source commit and wait for the Git-integrated Preview**

Run: `git push origin codex/production-security-worker`

Expected: Vercel creates a new Preview deployment. Wait for status `Ready`; do not
promote it to Production.

- [x] **Step 4: Assign the stable alias only after Vercel reports Ready**

Use Vercel aliasing to point the existing stable Preview hostname to the Ready
deployment. Do not create a new alias or modify the Production hostname.

### Task 3: Verify same-origin helper and redirect session

**Files:**
- Modify: `docs/16_MVPCompletionPlan.md`
- Modify: `docs/17_ProjectHandoff.md`

**Interfaces:**
- Consumes: the Ready stable Preview alias and an explicitly user-authorized Google
  login interaction.
- Produces: a documented pass/fail result for Auth helper availability and retained
  Firebase user state.

- [x] **Step 1: Check the public same-origin helper route**

Open `https://<stable-preview>/__/auth/iframe` in the controlled browser and
confirm it serves Firebase helper content without changing the visible hostname.

- [ ] **Step 2: Run the Google redirect flow**

From `/account/bank-accounts`, select Google login. After account selection,
confirm the application displays authenticated state and retains it after a normal
navigation back to `/account/bank-accounts`. Do not inspect cookies, storage,
tokens, account values, or create test records.

> 2026-08-11 checkpoint: the Ready Preview was assigned to the stable alias and
> `/__/auth/iframe` loaded with same-origin helper scripts. Clicking Google sign-in
> did not navigate to Google and did not expose an error. This is a new client
> initialization/error-observability blocker; stop this plan before any data test.

- [ ] **Step 3: Record the result and commit the handoff**

Append only non-sensitive deployment status, route result, authentication result,
and the next exact step to `docs/16_MVPCompletionPlan.md` and
`docs/17_ProjectHandoff.md`. If sign-in remains signed out, record that failure and
stop before any payment/refund testing. Run `git diff --check`, commit the docs,
and push the current branch.

## Plan Self-Review

- Scope coverage: Task 1 creates the transparent proxy; Task 2 changes only the
  Preview build-time `authDomain` and releases only Preview; Task 3 proves both
  helper serving and retained session state.
- Placeholder scan: no TBD/TODO items or unbounded follow-ups remain.
- Consistency: all tasks use the same stable Preview hostname and exact Firebase
  helper path; no task introduces an alternate auth mechanism.
