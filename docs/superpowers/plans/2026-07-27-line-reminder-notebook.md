# LINE Reminder Notebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent, Traditional-Chinese LINE Bot that creates, searches, schedules, completes, snoozes, escalates, and safely recovers group and private reminders.

**Architecture:** Create a standalone Cloudflare Worker under `line-reminder-bot/`, backed by D1 and invoked every minute by a Cron Trigger. Keep command parsing, reminder state transitions, authorization, scheduling, LINE delivery, and retention as separate modules; expose only a signed LINE webhook and a protected owner endpoint, leaving Astera integration disabled behind an explicit interface.

**Tech Stack:** Cloudflare Workers, TypeScript strict mode, D1 SQLite, native Web Crypto, LINE Messaging API, Vitest with Cloudflare Workers test pool, Wrangler.

## Global Constraints

- First release supports 1–3 allowlisted test groups and at most approximately 20 people.
- UI copy and commands are Traditional Chinese only.
- Business timezone is fixed to `Asia/Taipei`.
- Scheduling resolution is one minute.
- Reminder text is required; location is optional text only.
- No AI parsing, web admin, attachments, geofencing, multilingual support, or Astera data access.
- Original reminders and explicitly configured previews bypass quiet hours; automated chasers default to quiet hours `01:00–06:00`.
- Completed and cancelled records are permanently deleted after 90 days.
- A removed group is suspended for 30 days before active reminders are cancelled.
- Every webhook is signature-verified and every state-changing action is authorized server-side.
- Delivery, webhook ingestion, and scheduled-event handling must be idempotent.
- Proactive LINE messages must be quota-aware; original reminders have highest priority.
- Read `docs/superpowers/specs/2026-07-27-line-reminder-notebook-design.md` before executing any task.
- Before implementation, re-check current LINE Taiwan messaging quotas and current Cloudflare free-plan limits; configuration values must remain environment-driven.

## Planned File Structure

```text
line-reminder-bot/
  package.json                         scripts and isolated dependencies
  tsconfig.json                        strict Worker TypeScript settings
  wrangler.jsonc                       Worker, D1, Cron, vars and migrations config
  vitest.config.ts                     Workers pool test configuration
  migrations/
    0001_initial.sql                   core tables, constraints and indexes
  src/
    index.ts                           fetch/scheduled entry points only
    env.ts                             bindings and configuration parsing
    domain/types.ts                    shared domain types
    domain/errors.ts                   typed public/internal errors
    line/signature.ts                  LINE webhook signature verification
    line/client.ts                     reply/push/profile/usage API client
    line/messages.ts                   Traditional-Chinese LINE payload builders
    webhook/schema.ts                  narrow runtime webhook validation
    webhook/handler.ts                 event routing and deduplication
    commands/parser.ts                 fixed command grammar
    commands/time.ts                   Taiwan date/time and recurrence parser
    commands/handler.ts                command-to-service orchestration
    reminders/repository.ts            D1 persistence and transactions
    reminders/service.ts               create/edit/cancel/list/search
    reminders/completion.ts            completion state machine
    reminders/snooze.ts                group and personal snooze rules
    reminders/recurrence.ts            next-occurrence calculation
    auth/policy.ts                     creator/target/admin/owner policies
    groups/service.ts                  allowlist, activation, membership, settings
    takeover/service.ts                request/reject/approve/transfer flow
    scheduler/service.ts               claim and process due events
    delivery/service.ts                quota, retry, fallback and idempotency
    cleanup/service.ts                 30-day and 90-day lifecycle cleanup
    astera/port.ts                     disabled future integration contract
  test/
    fixtures.ts                        deterministic events and clocks
    signature.test.ts                  signature validation
    parser.test.ts                     fixed commands and time parsing
    groups.test.ts                     allowlist, activation, roles
    reminders.test.ts                  create/edit/cancel/query
    completion.test.ts                 completion and recurrence
    snooze.test.ts                     group/personal snooze
    takeover.test.ts                   takeover lifecycle
    scheduler.test.ts                  due selection and quiet hours
    delivery.test.ts                   retry, quota and fallback
    lifecycle.test.ts                  leave/rejoin and retention
    webhook.test.ts                    end-to-end webhook behavior
  README.md                            setup, commands, deploy and runbook
```

---

### Task 1: Standalone Worker and Signed Webhook Boundary

**Files:**
- Create: `line-reminder-bot/package.json`
- Create: `line-reminder-bot/tsconfig.json`
- Create: `line-reminder-bot/wrangler.jsonc`
- Create: `line-reminder-bot/vitest.config.ts`
- Create: `line-reminder-bot/src/env.ts`
- Create: `line-reminder-bot/src/domain/errors.ts`
- Create: `line-reminder-bot/src/line/signature.ts`
- Create: `line-reminder-bot/src/index.ts`
- Test: `line-reminder-bot/test/signature.test.ts`

**Interfaces:**
- Produces: `Env`, `loadConfig(env): AppConfig`, `verifyLineSignature(rawBody, signature, secret): Promise<boolean>`.
- Produces: Worker routes `POST /webhooks/line`, `GET /health`, and a `scheduled()` entry point.

- [ ] **Step 1: Create the isolated package and failing signature tests**

```json
{
  "name": "astera-line-reminder-bot",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "npm run typecheck && npm run test",
    "cf-types": "wrangler types",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:migrate:local": "wrangler d1 migrations apply LINE_REMINDERS --local",
    "db:migrate:remote": "wrangler d1 migrations apply LINE_REMINDERS --remote"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.16.19",
    "typescript": "^5.9.0",
    "vitest": "^4.1.10",
    "wrangler": "^4.113.0"
  }
}
```

```ts
// test/signature.test.ts
import { describe, expect, it } from "vitest";
import { verifyLineSignature } from "../src/line/signature";

describe("verifyLineSignature", () => {
  it("accepts the exact raw body and secret", async () => {
    expect(await verifyLineSignature('{"events":[]}', "/tUbPtkqUr+kz+vFaomDW1mLe8KZXe0Pu7m+RTZIIVs=", "secret")).toBe(true);
  });
  it("rejects a modified body", async () => {
    expect(await verifyLineSignature('{"events":[1]}', "/tUbPtkqUr+kz+vFaomDW1mLe8KZXe0Pu7m+RTZIIVs=", "secret")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `cd line-reminder-bot; npm install; npm test -- test/signature.test.ts`

Expected: FAIL because `src/line/signature.ts` does not exist.

- [ ] **Step 3: Implement configuration, signature verification, and entry-point routing**

```ts
// src/line/signature.ts
export async function verifyLineSignature(rawBody: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return mismatch === 0;
}
```

Define `Env` with `DB`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `OWNER_USER_ID`, `OWNER_API_TOKEN`, `BUSINESS_TIME_ZONE`, `QUIET_START`, `QUIET_END`, `MONTHLY_MESSAGE_LIMIT`, and `QUOTA_WARNING_PERCENT`. Reject missing or malformed configuration in `loadConfig`. In `src/index.ts`, return `200 {"ok":true}` from `/health`, `401` for missing/invalid LINE signatures, and delegate valid webhook bodies to a temporary `handleWebhook` stub that returns `200`.

- [ ] **Step 4: Configure Workers tests and run all Task 1 checks**

Run: `cd line-reminder-bot; npm run typecheck; npm test`

Expected: both commands PASS; tampered webhook requests return `401`.

- [ ] **Step 5: Commit Task 1**

```powershell
git add line-reminder-bot
git commit -m "feat(line-bot): add signed worker boundary"
```

---

### Task 2: D1 Schema, Domain Types, and Idempotent Repositories

**Files:**
- Create: `line-reminder-bot/migrations/0001_initial.sql`
- Create: `line-reminder-bot/src/domain/types.ts`
- Create: `line-reminder-bot/src/reminders/repository.ts`
- Create: `line-reminder-bot/test/fixtures.ts`
- Test: `line-reminder-bot/test/reminders.test.ts`
- Modify: `line-reminder-bot/wrangler.jsonc`

**Interfaces:**
- Produces: branded IDs, `Reminder`, `ReminderTarget`, `ScheduledEvent`, `GroupSettings`, `DeliveryAttempt`.
- Produces: `ReminderRepository.createDraft`, `findById`, `updateVersioned`, `claimDueEvents`, `markEventDelivered`, `recordWebhookOnce`.

- [ ] **Step 1: Write failing repository tests for uniqueness and optimistic updates**

```ts
it("deduplicates a webhook event", async () => {
  expect(await repository.recordWebhookOnce("01JTEST")).toBe(true);
  expect(await repository.recordWebhookOnce("01JTEST")).toBe(false);
});

it("rejects a stale reminder update", async () => {
  const reminder = await repository.createDraft(fixtureReminder());
  await repository.updateVersioned(reminder.id, 1, { text: "新版" });
  await expect(repository.updateVersioned(reminder.id, 1, { text: "過期版本" }))
    .rejects.toMatchObject({ code: "VERSION_CONFLICT" });
});
```

- [ ] **Step 2: Run migrations and verify the tests fail**

Run: `cd line-reminder-bot; npm run db:migrate:local; npm test -- test/reminders.test.ts`

Expected: FAIL because repository methods are missing.

- [ ] **Step 3: Create the complete normalized schema**

Create tables for `users`, `groups`, `group_members`, `group_admins`, `group_settings`, `reminders`, `reminder_targets`, `recurrence_rules`, `scheduled_events`, `takeover_requests`, `takeover_votes`, `audit_events`, `delivery_attempts`, `webhook_events`, and `monthly_usage`. Add:

```sql
CREATE UNIQUE INDEX scheduled_event_key
  ON scheduled_events(reminder_id, event_kind, occurrence_key, target_user_id);
CREATE INDEX scheduled_events_due
  ON scheduled_events(status, due_at);
CREATE UNIQUE INDEX webhook_event_once
  ON webhook_events(webhook_event_id);
CREATE INDEX reminders_group_status
  ON reminders(group_id, status, remind_at);
```

Use ISO-8601 UTC strings for stored instants, explicit `CHECK` constraints for finite states, foreign keys, and `ON DELETE CASCADE` only for true child records.

- [ ] **Step 4: Implement repository transactions and rerun**

Implement parameter-bound D1 queries only. `updateVersioned` must execute `UPDATE ... WHERE id = ? AND version = ?`, increment `version`, and throw `VERSION_CONFLICT` when `meta.changes !== 1`. `claimDueEvents` changes `pending` rows to `processing` with a lease timestamp in one batch before returning them.

Run: `cd line-reminder-bot; npm run typecheck; npm test -- test/reminders.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
git add line-reminder-bot
git commit -m "feat(line-bot): add reminder data model"
```

---

### Task 3: Fixed Command and Taiwan Time Parser

**Files:**
- Create: `line-reminder-bot/src/commands/parser.ts`
- Create: `line-reminder-bot/src/commands/time.ts`
- Create: `line-reminder-bot/src/reminders/recurrence.ts`
- Test: `line-reminder-bot/test/parser.test.ts`

**Interfaces:**
- Produces: `parseCommand(text, context): ParsedCommand`.
- Produces: `parseTaiwanSchedule(tokens, now, defaultTime): ParsedSchedule`.
- Produces: `nextOccurrence(rule, after): Date | null`.

- [ ] **Step 1: Write table-driven failing parser tests**

```ts
it.each([
  ["/提醒 2026/07/30 15:00 收單", "2026-07-30T07:00:00.000Z", "收單"],
  ["/提醒 明天 09:00 繳費", "2026-07-28T01:00:00.000Z", "繳費"],
  ["/提醒 30分鐘後 關烤箱", "2026-07-27T14:30:00.000Z", "關烤箱"],
])("parses %s", (input, dueAt, text) => {
  expect(parseReminder(input, fixedNow("2026-07-27T14:00:00Z"))).toMatchObject({ dueAt, text });
});

it("asks for a time when no default exists", () => {
  expect(parseReminder("/提醒 明天 收單", fixedNow(), null)).toMatchObject({ kind: "needs_time" });
});
```

Also test `/列表`, `/今天`, `/本週`, `/已完成`, `/搜尋 關鍵字`, `/設定`, `/說明`, invalid dates, past dates, leap years, month boundaries, and recurrence end by date/count.

- [ ] **Step 2: Run parser tests and confirm failure**

Run: `cd line-reminder-bot; npm test -- test/parser.test.ts`

Expected: FAIL because parser modules are missing.

- [ ] **Step 3: Implement a deterministic grammar**

Define the parsed union:

```ts
export type ParsedCommand =
  | { kind: "create"; draft: ReminderDraft; requiresConfirmation: boolean }
  | { kind: "list"; filter: "open" | "today" | "week" | "completed"; query?: string }
  | { kind: "settings" }
  | { kind: "help" }
  | { kind: "needs_time"; draft: Partial<ReminderDraft> }
  | { kind: "invalid"; message: string };
```

Parse only anchored commands beginning with `/`. Convert Taiwan local parts to UTC without relying on the Worker host timezone. Represent recurrence structurally (`weekly` with weekday/time, end mode `never|date|count`) rather than storing raw command text.

- [ ] **Step 4: Run parser and type checks**

Run: `cd line-reminder-bot; npm run typecheck; npm test -- test/parser.test.ts`

Expected: PASS with exact UTC expectations.

- [ ] **Step 5: Commit Task 3**

```powershell
git add line-reminder-bot
git commit -m "feat(line-bot): parse reminder commands"
```

---

### Task 4: Allowlisted Group Activation, Membership, and Admins

**Files:**
- Create: `line-reminder-bot/src/auth/policy.ts`
- Create: `line-reminder-bot/src/groups/service.ts`
- Test: `line-reminder-bot/test/groups.test.ts`
- Modify: `line-reminder-bot/src/reminders/repository.ts`

**Interfaces:**
- Produces: `GroupService.observeMember`, `claimActivation`, `approveActivation`, `addAdmin`, `removeAdmin`, `updateSettings`.
- Produces: `Policy.canModify`, `canCancel`, `canComplete`, `canManageGroup`, `canTakeOver`.

- [ ] **Step 1: Write failing allowlist and activation tests**

```ts
it("does not activate an unknown group", async () => {
  await expect(groups.claimActivation("G-unknown", "U1")).rejects.toMatchObject({ code: "GROUP_NOT_ALLOWED" });
});

it("requires owner approval for the first admin claim", async () => {
  await groups.allow("G1");
  await groups.claimActivation("G1", "U1");
  expect(await groups.isAdmin("G1", "U1")).toBe(false);
  await groups.approveActivation("G1", ownerId);
  expect(await groups.isAdmin("G1", "U1")).toBe(true);
});
```

Test that LINE join alone cannot identify an inviter, only current admins can add/remove peers, an admin cannot remove the last admin without owner replacement, and settings validate `HH:mm` quiet hours and positive takeover days.

- [ ] **Step 2: Run and verify failure**

Run: `cd line-reminder-bot; npm test -- test/groups.test.ts`

Expected: FAIL because group service is missing.

- [ ] **Step 3: Implement group policies and activation**

Use `/啟用` to create a pending claim only for allowlisted groups. Owner approval uses `Authorization: Bearer ${OWNER_API_TOKEN}` on `POST /owner/groups/:groupId/approve`; compare the token without logging it. Store member display names as mutable presentation data and LINE user IDs as identity.

- [ ] **Step 4: Run Task 4 tests**

Run: `cd line-reminder-bot; npm run typecheck; npm test -- test/groups.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
git add line-reminder-bot
git commit -m "feat(line-bot): govern allowlisted groups"
```

---

### Task 5: Reminder Creation, Confirmation, Edit, Cancel, and Query

**Files:**
- Create: `line-reminder-bot/src/reminders/service.ts`
- Create: `line-reminder-bot/src/commands/handler.ts`
- Test: `line-reminder-bot/test/reminders.test.ts`
- Modify: `line-reminder-bot/src/reminders/repository.ts`

**Interfaces:**
- Produces: `ReminderService.create`, `confirmDraft`, `edit`, `cancel`, `list`, `search`.
- Consumes: `ParsedCommand`, `Policy`, `ReminderRepository`, `GroupService`.

- [ ] **Step 1: Add failing behavior tests**

```ts
it("creates a simple one-time reminder immediately", async () => {
  const result = await service.create(groupContext("U1"), simpleDraft());
  expect(result).toMatchObject({ status: "active", creatorUserId: "U1" });
});

it("keeps a recurring reminder pending until confirmation", async () => {
  const result = await service.create(groupContext("U1"), recurringDraft());
  expect(result).toMatchObject({ status: "draft", requiresConfirmation: true });
});

it("allows only the creator to edit and cancel", async () => {
  const reminder = await service.create(groupContext("U1"), simpleDraft());
  await expect(service.cancel(reminder.id, actor("U2"))).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(service.edit(reminder.id, actor("U2"), { text: "改寫" })).rejects.toMatchObject({ code: "FORBIDDEN" });
});
```

Test group-wide visibility, private isolation, today/week boundaries in Taiwan time, completed filtering, keyword escaping, default time, optional location, and audit rows for changes.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `cd line-reminder-bot; npm test -- test/reminders.test.ts`

Expected: FAIL on missing service methods.

- [ ] **Step 3: Implement service state transitions**

`create` must write the reminder and its first scheduled events in one logical transaction. Complex drafts stay `draft` until `confirmDraft`; confirmation tokens expire after 15 minutes and bind to reminder ID, creator ID, and version. `edit` cancels obsolete pending events and generates replacements. `cancel` records `cancelledAt` and audit data but does not delete immediately.

- [ ] **Step 4: Run reminder tests**

Run: `cd line-reminder-bot; npm run typecheck; npm test -- test/reminders.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```powershell
git add line-reminder-bot
git commit -m "feat(line-bot): manage reminder lifecycle"
```

---

### Task 6: Completion Modes and Recurring Occurrences

**Files:**
- Create: `line-reminder-bot/src/reminders/completion.ts`
- Test: `line-reminder-bot/test/completion.test.ts`
- Modify: `line-reminder-bot/src/reminders/service.ts`
- Modify: `line-reminder-bot/src/reminders/recurrence.ts`

**Interfaces:**
- Produces: `CompletionService.complete(reminderId, actor, scope): Promise<CompletionResult>`.
- Consumes: completion mode `none|any|target|all_targets`; scope `occurrence|series`.

- [ ] **Step 1: Write failing completion state-machine tests**

```ts
it("completes all-target mode only after every target responds", async () => {
  const reminder = await seededReminder({ completionMode: "all_targets", targets: ["U1", "U2"] });
  expect((await completion.complete(reminder.id, actor("U1"), "occurrence")).completed).toBe(false);
  expect((await completion.complete(reminder.id, actor("U2"), "occurrence")).completed).toBe(true);
});

it("completing one occurrence preserves the series", async () => {
  const reminder = await seededWeeklyReminder();
  await completion.complete(reminder.id, actor("U1"), "occurrence");
  expect(await repository.nextPendingOccurrence(reminder.id)).not.toBeNull();
});
```

Also test `any`, `target`, unauthorized actors, duplicate completion, no-confirmation auto-completion after successful original delivery, and `series` termination.

- [ ] **Step 2: Run and verify failure**

Run: `cd line-reminder-bot; npm test -- test/completion.test.ts`

Expected: FAIL because completion service is missing.

- [ ] **Step 3: Implement atomic completion transitions**

Record individual target completion with a unique `(reminder_id, occurrence_key, user_id)` constraint. Decide aggregate completion from persisted target rows inside the same transaction. For `occurrence`, schedule the next occurrence unless end date/count is reached. For `series`, cancel all future events and mark the series completed.

- [ ] **Step 4: Run completion tests**

Run: `cd line-reminder-bot; npm run typecheck; npm test -- test/completion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```powershell
git add line-reminder-bot
git commit -m "feat(line-bot): complete recurring reminders"
```

---

### Task 7: Group and Personal Snooze

**Files:**
- Create: `line-reminder-bot/src/reminders/snooze.ts`
- Test: `line-reminder-bot/test/snooze.test.ts`
- Modify: `line-reminder-bot/src/reminders/repository.ts`

**Interfaces:**
- Produces: `SnoozeService.snoozeGroup`, `snoozeSelf`.
- Produces scheduled event targets `group|user|group_mention`.

- [ ] **Step 1: Write failing snooze authorization and fallback tests**

```ts
it("only the creator can snooze the whole group", async () => {
  await expect(snooze.snoozeGroup(reminderId, actor("U2"), minutes(10)))
    .rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("uses a group mention when personal push is unavailable", async () => {
  const event = await snooze.snoozeSelf(reminderId, actor("U2", { canReceivePush: false }), minutes(10));
  expect(event).toMatchObject({ destinationKind: "group_mention", targetUserId: "U2" });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd line-reminder-bot; npm test -- test/snooze.test.ts`

Expected: FAIL because snooze service is missing.

- [ ] **Step 3: Implement bounded snooze creation**

Allow only configured button intervals and a validated custom timestamp later than now. Creator group snooze replaces the next group event; personal snooze creates a target-specific event without changing other recipients. Use unique occurrence and target keys to prevent duplicate button taps.

- [ ] **Step 4: Run snooze tests**

Run: `cd line-reminder-bot; npm run typecheck; npm test -- test/snooze.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```powershell
git add line-reminder-bot
git commit -m "feat(line-bot): add safe reminder snooze"
```

---

### Task 8: LINE Client, Message Builders, and Quota-Aware Delivery

**Files:**
- Create: `line-reminder-bot/src/line/client.ts`
- Create: `line-reminder-bot/src/line/messages.ts`
- Create: `line-reminder-bot/src/delivery/service.ts`
- Test: `line-reminder-bot/test/delivery.test.ts`

**Interfaces:**
- Produces: `LineClient.reply`, `push`, `getGroupMemberProfile`, `getMonthlyUsage`.
- Produces: `DeliveryService.deliver(event): DeliveryResult`.
- Consumes: destination kinds and stable scheduled-event IDs.

- [ ] **Step 1: Write failing HTTP and priority tests**

```ts
it("does not send the same scheduled event twice", async () => {
  await delivery.deliver(event("E1"));
  await delivery.deliver(event("E1"));
  expect(lineRequests()).toHaveLength(1);
});

it("preserves original reminders when quota is critical", async () => {
  usageAt(99);
  expect((await delivery.deliver(chaserEvent())).status).toBe("deferred_quota");
  expect((await delivery.deliver(originalEvent())).status).toBe("delivered");
});
```

Test reply versus push endpoints, group mentions, unavailable private push falling back to group mention, 429/5xx retry classification, permanent 4xx failure, owner warning once per threshold, and escaped LINE message text.

- [ ] **Step 2: Run and verify failure**

Run: `cd line-reminder-bot; npm test -- test/delivery.test.ts`

Expected: FAIL because delivery modules are missing.

- [ ] **Step 3: Implement the LINE client and delivery policy**

Use `https://api.line.me/v2/bot/message/reply` for immediate command replies and `/v2/bot/message/push` for scheduled delivery. Send `Authorization: Bearer ...`, never log request headers, and cap each request at five message objects. Build Traditional-Chinese Flex or template actions with signed, short-lived postback data. Priority order is `original`, `personal_snooze`, `preview`, `chaser`.

- [ ] **Step 4: Run delivery tests**

Run: `cd line-reminder-bot; npm run typecheck; npm test -- test/delivery.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 8**

```powershell
git add line-reminder-bot
git commit -m "feat(line-bot): deliver quota-aware LINE messages"
```

---

### Task 9: Scheduler, Quiet Hours, Chasers, and Recovery

**Files:**
- Create: `line-reminder-bot/src/scheduler/service.ts`
- Test: `line-reminder-bot/test/scheduler.test.ts`
- Modify: `line-reminder-bot/src/index.ts`
- Modify: `line-reminder-bot/src/reminders/repository.ts`

**Interfaces:**
- Produces: `SchedulerService.run(now): SchedulerSummary`.
- Consumes: `claimDueEvents(now, limit, leaseSeconds)` and `DeliveryService.deliver`.

- [ ] **Step 1: Write failing scheduler tests**

```ts
it("defers chasers but not originals during quiet hours", async () => {
  await seedDue([originalAt("2026-07-27T18:00:00Z"), chaserAt("2026-07-27T18:00:00Z")]);
  const result = await scheduler.run(new Date("2026-07-27T18:00:00Z")); // 02:00 Taiwan
  expect(result).toMatchObject({ delivered: 1, quietDeferred: 1 });
});

it("marks overdue originals as delayed delivery", async () => {
  await seedDue([originalAt("2026-07-27T01:00:00Z")]);
  await scheduler.run(new Date("2026-07-27T03:00:00Z"));
  expect(lastMessageText()).toContain("延遲送達");
});
```

Test lease expiry, concurrent runs, maximum chaser count, chaser deadline, specific chaser times, gradual post-quiet recovery, retry backoff, and admin notification beyond the delayed threshold.

- [ ] **Step 2: Run and verify failure**

Run: `cd line-reminder-bot; npm test -- test/scheduler.test.ts`

Expected: FAIL because scheduler service is missing.

- [ ] **Step 3: Implement the bounded scheduler**

Claim at most 50 due events per run with a 5-minute lease. Requeue transient failures using bounded exponential delays. When quiet hours end, cap deferred chasers per group per run so the Bot never dumps the entire backlog. Wire `scheduled(controller, env, ctx)` to `ctx.waitUntil(scheduler.run(new Date(controller.scheduledTime)))`.

- [ ] **Step 4: Run scheduler tests**

Run: `cd line-reminder-bot; npm run typecheck; npm test -- test/scheduler.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 9**

```powershell
git add line-reminder-bot
git commit -m "feat(line-bot): schedule and recover reminders"
```

---

### Task 10: Takeover Requests and Two-Person Approval

**Files:**
- Create: `line-reminder-bot/src/takeover/service.ts`
- Test: `line-reminder-bot/test/takeover.test.ts`
- Modify: `line-reminder-bot/src/auth/policy.ts`
- Modify: `line-reminder-bot/src/reminders/repository.ts`

**Interfaces:**
- Produces: `TakeoverService.request`, `reject`, `approve`, `expireAndTransfer`.
- Consumes: group setting `takeoverWaitDays`, creator membership state, two unique approvers.

- [ ] **Step 1: Write failing takeover tests**

```ts
it("does not allow takeover while the creator is active before timeout", async () => {
  await expect(takeover.request(reminderId, actor("U2")))
    .rejects.toMatchObject({ code: "TAKEOVER_NOT_AVAILABLE" });
});

it("transfers after timeout and two distinct approvals", async () => {
  const request = await timedOutRequest(reminderId, "U2");
  await takeover.approve(request.id, actor("U3"));
  await takeover.approve(request.id, actor("U4"));
  expect((await takeover.expireAndTransfer(request.id)).newManagerUserId).toBe("U2");
});
```

Test creator-left immediate eligibility, duplicate votes, requester self-vote rejection, creator rejection, admin initiation, audit records, and group summary messages.

- [ ] **Step 2: Run and verify failure**

Run: `cd line-reminder-bot; npm test -- test/takeover.test.ts`

Expected: FAIL because takeover service is missing.

- [ ] **Step 3: Implement takeover transitions**

Persist a single open request per reminder. Notify the creator privately when possible, otherwise via group mention. Votes must come from two distinct current group members other than requester and creator. Transfer `manager_user_id` only after timeout eligibility and votes both hold; never rewrite original `creator_user_id`.

- [ ] **Step 4: Run takeover tests**

Run: `cd line-reminder-bot; npm run typecheck; npm test -- test/takeover.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 10**

```powershell
git add line-reminder-bot
git commit -m "feat(line-bot): govern reminder takeover"
```

---

### Task 11: Webhook Routing and Interactive LINE Actions

**Files:**
- Create: `line-reminder-bot/src/webhook/schema.ts`
- Create: `line-reminder-bot/src/webhook/handler.ts`
- Test: `line-reminder-bot/test/webhook.test.ts`
- Modify: `line-reminder-bot/src/index.ts`
- Modify: `line-reminder-bot/src/commands/handler.ts`
- Modify: `line-reminder-bot/src/line/messages.ts`

**Interfaces:**
- Produces: `handleWebhook(payload, services): Promise<void>`.
- Routes LINE `message`, `postback`, `join`, `leave`, `memberJoined`, and `memberLeft`.

- [ ] **Step 1: Write failing end-to-end webhook tests**

```ts
it("creates and replies to a valid group command exactly once", async () => {
  const event = messageEvent({ webhookEventId: "W1", text: "/提醒 明天 09:00 收單" });
  await postSignedWebhook(event);
  await postSignedWebhook({ ...event, deliveryContext: { isRedelivery: true } });
  expect(await reminderCount()).toBe(1);
  expect(replyRequests()).toHaveLength(1);
});

it("rejects a forged completion postback", async () => {
  await postSignedWebhook(postbackEvent("action=complete&reminder=R1&sig=bad", "U2"));
  expect(lastReplyText()).toContain("操作已失效");
});
```

Test `/啟用`, member observation, simple creation, complex confirmation, list/search, edit/cancel, complete, snooze, settings, takeover actions, leave/rejoin, malformed payloads, standby mode, and empty verification payloads.

- [ ] **Step 2: Run and verify failure**

Run: `cd line-reminder-bot; npm test -- test/webhook.test.ts`

Expected: FAIL because routing is incomplete.

- [ ] **Step 3: Implement narrow validation and routing**

Validate only fields used by the application; safely ignore unsupported events. Record `webhookEventId` before side effects. Observe the source user before command handling. Use reply tokens only once and within the webhook path; all delayed work uses scheduled push delivery. Verify every postback signature, expiry, actor, group, reminder version, and current status.

- [ ] **Step 4: Run webhook and full tests**

Run: `cd line-reminder-bot; npm run typecheck; npm test`

Expected: PASS.

- [ ] **Step 5: Commit Task 11**

```powershell
git add line-reminder-bot
git commit -m "feat(line-bot): route LINE reminder interactions"
```

---

### Task 12: Group Leave/Rejoin and Retention Cleanup

**Files:**
- Create: `line-reminder-bot/src/cleanup/service.ts`
- Test: `line-reminder-bot/test/lifecycle.test.ts`
- Modify: `line-reminder-bot/src/groups/service.ts`
- Modify: `line-reminder-bot/src/scheduler/service.ts`
- Modify: `line-reminder-bot/src/index.ts`

**Interfaces:**
- Produces: `CleanupService.run(now): CleanupSummary`.
- Produces: `GroupService.suspendOnLeave`, `resumeOnJoin`.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it("resumes the same group within 30 days and queues missed originals", async () => {
  await groups.suspendOnLeave("G1", day(0));
  await groups.resumeOnJoin("G1", day(10));
  expect(await dueDelayedOriginals("G1")).toHaveLength(1);
});

it("deletes completed data after 90 days", async () => {
  await seedCompletedReminder(day(0));
  await cleanup.run(day(91));
  expect(await repository.findById("R1")).toBeNull();
});
```

Test day 30 boundaries, automatic cancellation after 30 days, no delivery while suspended, cascaded child deletion, preservation of active reminders, and private/group isolation.

- [ ] **Step 2: Run and verify failure**

Run: `cd line-reminder-bot; npm test -- test/lifecycle.test.ts`

Expected: FAIL because cleanup service is missing.

- [ ] **Step 3: Implement lifecycle cleanup**

On leave, mark the group suspended and cancel processing leases without deleting records. On rejoin within 30 days, reactivate and enqueue missed original events with delayed labels. Cleanup cancels active reminders for groups absent more than 30 days, then permanently deletes reminders whose completed/cancelled timestamp is older than 90 days.

- [ ] **Step 4: Run lifecycle and full tests**

Run: `cd line-reminder-bot; npm run typecheck; npm test`

Expected: PASS.

- [ ] **Step 5: Commit Task 12**

```powershell
git add line-reminder-bot
git commit -m "feat(line-bot): enforce reminder retention"
```

---

### Task 13: Disabled Astera Port, Deployment Runbook, and Production Verification

**Files:**
- Create: `line-reminder-bot/src/astera/port.ts`
- Create: `line-reminder-bot/README.md`
- Modify: `line-reminder-bot/wrangler.jsonc`
- Modify: `.gitignore`
- Modify: `docs/15_LocalDevelopment.md`
- Modify: `docs/14_Deployment.md`

**Interfaces:**
- Produces: disabled `AsteraReminderPort` contract with no public route.
- Documents exact local, staging, production, rollback, quota, and secret procedures.

- [ ] **Step 1: Add a compile-time disabled integration contract**

```ts
export interface AsteraReminderPort {
  createReminder(input: {
    externalEventId: string;
    text: string;
    remindAt: string;
    groupId: string;
  }): Promise<{ reminderId: string }>;
}

export const asteraIntegrationEnabled = false as const;
```

Assert in a test that no `/astera` route exists and unauthenticated owner routes return `401`.

- [ ] **Step 2: Write the complete runbook**

Document:

- LINE Official Account and Messaging API channel creation
- enabling group participation and disabling conflicting greeting/auto-reply behavior
- setting `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `OWNER_USER_ID`, and `OWNER_API_TOKEN` with Wrangler secrets
- creating D1, replacing the binding ID, applying local/remote migrations
- configuring the one-minute Cron Trigger
- adding a group to the allowlist, `/啟用`, and owner approval
- local signed-webhook testing
- staging-group acceptance steps
- monthly usage checks and quota threshold adjustment
- log inspection without exposing reminder text or tokens
- rollback to the prior Worker version
- token rotation and incident response
- explicit statement that Astera integration is disabled

- [ ] **Step 3: Run the complete local verification suite**

Run:

```powershell
cd line-reminder-bot
npm ci
npm run db:migrate:local
npm run typecheck
npm test
npx wrangler deploy --dry-run
```

Expected: every command exits `0`; dry run lists the D1 binding and one-minute Cron Trigger without publishing.

- [ ] **Step 4: Perform staging LINE acceptance**

Using only the allowlisted staging group:

1. Verify forged webhook rejection.
2. Claim `/啟用` and approve through the protected owner endpoint.
3. Complete each of the ten acceptance scenarios from design section 11.2.
4. Confirm no duplicate sends after webhook redelivery and scheduler retry.
5. Confirm original delivery during 01:00–06:00 and deferred chaser behavior.
6. Confirm LINE monthly usage changes match expected recipient counts.
7. Record results and any platform-specific adjustments in `line-reminder-bot/README.md`.

Expected: all acceptance scenarios pass. Any failure is diagnosed, fixed with a regression test, and the entire affected suite rerun.

- [ ] **Step 5: Run repository-level regression checks**

Run from repository root:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run check:secrets
cd line-reminder-bot
npm run check
```

Expected: all existing Astera checks and all Bot checks PASS; the secret scanner finds no LINE credentials.

- [ ] **Step 6: Commit the runbook and verified release candidate**

```powershell
git add .gitignore docs/14_Deployment.md docs/15_LocalDevelopment.md line-reminder-bot
git commit -m "docs(line-bot): add deployment and operations runbook"
```

## Final Completion Checklist

- [ ] Every Task 1–13 checkbox is complete.
- [ ] Every task has its own passing test evidence and commit.
- [ ] `npm run check` passes in `line-reminder-bot/`.
- [ ] Existing Astera lint, typecheck, unit tests, and secret scan pass.
- [ ] D1 migrations apply cleanly to a fresh local database.
- [ ] Wrangler dry-run succeeds with the expected bindings and Cron Trigger.
- [ ] All ten staging LINE acceptance scenarios pass.
- [ ] LINE secrets exist only in encrypted platform configuration.
- [ ] Current LINE Taiwan quota and Cloudflare limits are recorded in deployment configuration, not hardcoded business logic.
- [ ] Astera integration remains disabled and has no public endpoint.
