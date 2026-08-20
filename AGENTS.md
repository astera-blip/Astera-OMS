<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Execution Rules

- 完成一個小批次或通過一次驗證，不代表整個任務完成。
- 若目前任務清單仍有可執行項目，應直接繼續，不要等待使用者說「繼續」。
- 測試失敗時，應先自行診斷、修復並重跑。
- 只有需要產品決策、額外權限、外部憑證、不可逆操作或確認無法自行排除的阻塞時，才詢問使用者。
- 最終回覆前必須核對本回合的完成條件。
- 不得用「我接下來會做」取代實際執行。
- 若因執行限制必須中止，必須更新執行計畫與交接紀錄，留下下一個精確可執行步驟。

# Astera OMS Codex Instructions

## Agent orchestration

The primary agent acts as Lead Architect and Orchestrator.

Delegation is optional, not mandatory.

The Primary Agent should delegate only when delegation is expected to reduce
total work or provide meaningful independent review.

Reducing Primary Agent work alone is not sufficient justification for
delegation.

If the lower-capability agent is likely to fail, require extensive
correction, repeat investigation, or create coordination overhead, the
Primary Agent should perform the task directly.

When uncertain whether a subagent can reliably complete the task, prefer
keeping the task with the Primary Agent.

Use the following agents:

- `code_mapper`
  Use for codebase exploration, locating files, tracing execution paths,
  references, dependencies, and initial investigation.

- `implementer`
  Use for scoped implementation, bug fixes, refactoring and tests after
  the problem and expected behavior are sufficiently understood.

- `reviewer`
  Use for independent review of material changes, especially changes
  involving authentication, authorization, orders, payments, customers,
  Firestore, or business-critical logic.

## Mandatory delegation capability gate

Before spawning any subagent, the Primary Agent must assess:

### Task clarity

- Is the requested behavior understood?
- Is the scope bounded?
- Is the root cause known, or is the delegated task specifically read-only investigation?
- Are expected outputs clearly defined?

### Capability fit

- Does the intended subagent have enough capability for this exact task?
- Does the task require broad architectural reasoning or ambiguous debugging?
- Is success likely without repeated clarification from Primary?

### Risk

Check whether the task involves or can materially affect:

- architecture
- domain model
- authentication
- authorization
- payments
- financial integrity
- Firestore Security Rules
- account ownership
- transactions
- race conditions / concurrency
- destructive migrations
- cross-module behavior
- security boundaries

If the delegated work requires making decisions in these areas, keep those
decisions with the Primary Agent.

A subagent may implement a narrowly specified change in these areas only
after the Primary Agent has already determined the architecture, security
boundary, expected behavior, and exact implementation scope.

### Verifiability

Before delegation, determine whether completion can be verified using clear
evidence such as:

- focused tests
- exact files / execution paths
- explicit acceptance criteria
- deterministic read-only findings
- a bounded diff

If success cannot be objectively verified, do not delegate yet.

### Expected total cost

Estimate whether delegation is likely to reduce total effort. Consider:

- agent startup/context cost
- probability of failure
- expected correction work
- duplicate repository exploration
- review overhead
- possibility of stall or retry

Do not delegate when expected total effort is likely to be greater than
Primary completing the task directly.

## Delegation outcome

After capability assessment, choose exactly one:

- `KEEP WITH PRIMARY`
  Use when the task is high-risk, ambiguous, architectural, cross-module,
  difficult to verify, or beyond the intended subagent capability.

- `DELEGATE READ-ONLY`
  Use when exploration or independent review is bounded and can be safely
  performed without modifying code.

- `DELEGATE SCOPED IMPLEMENTATION`
  Use only when architecture and behavior are sufficiently settled, the
  file/task boundary is clear, and focused verification exists.

The Primary Agent does not need to expose this internal assessment to the
user unless it materially affects execution or explains why delegation was
avoided.

## Model capability routing

The Primary Agent is the highest-capability reasoning and integration tier.

Model routing occurs only after the Mandatory delegation capability gate has
determined that delegation is appropriate.

Do not choose a cheaper model first and then reshape an unsuitable task to fit
that model.

Choose the lowest-capability tier that is still highly likely to complete the
exact delegated task correctly without repeated correction.

When capability fit is uncertain, choose the stronger tier or keep the task
with Primary.

### Tier 1 — Primary / Sol

Keep work with Primary when any of the following applies:

- architecture or domain decisions are still unresolved;
- root cause is unclear and debugging is broad or ambiguous;
- the change crosses multiple modules with unclear interactions;
- authentication or authorization boundaries must be designed;
- payment correctness or financial integrity must be reasoned about;
- Firestore Security Rules architecture must be designed;
- transaction or concurrency semantics must be determined;
- destructive migrations or schema strategy must be decided;
- security impact is difficult to bound;
- acceptance criteria are incomplete or contradictory;
- implementation requires significant judgment rather than execution;
- failure by a lower-capability model would likely cause expensive rework;
- the task cannot be objectively verified with bounded evidence.

Primary may still delegate bounded read-only investigation or narrowly
specified implementation after Primary has made the material decisions.

### Tier 2 — Terra

Prefer Terra for delegated work that requires real software-engineering
reasoning but has bounded scope and settled architecture.

Typical Terra tasks include:

- tracing a bounded multi-file execution path;
- investigating an unfamiliar but scoped module;
- implementing a clearly specified bug fix across a small number of files;
- adding or updating tests where expected behavior is already defined;
- scoped refactoring that preserves existing architecture;
- integrating with an existing API or service pattern;
- accessibility fixes that require component-level reasoning;
- reviewing non-trivial diffs;
- independent security / authorization / payment review after Primary has
  already defined the intended boundaries;
- diagnosing focused test failures when the failure domain is bounded.

Terra must not independently redefine architecture, authorization, payment
semantics, Firestore Rules architecture, transaction design, or other
Primary-owned decisions.

If a Terra task becomes ambiguous, cross-module, or architectural, Terra must
stop and return the uncertainty to Primary rather than expand its scope.

### Tier 3 — Luna

Use Luna only for low-risk, highly bounded, mechanically verifiable work.

Suitable Luna tasks include:

- locating an exact symbol, file, route, component, test, or reference;
- enumerating references to a known identifier;
- confirming whether a specific file or configuration exists;
- comparing a small number of known files;
- extracting deterministic facts from code;
- simple repetitive edits with exact instructions;
- updating obvious labels, hrefs, imports, snapshots, or boilerplate when
  the exact desired result is already specified;
- adding repetitive test cases by copying an established pattern when the
  assertions and expected behavior are explicitly defined;
- narrow formatting or mechanical refactors with bounded files and focused
  verification.

Do not delegate to Luna when the task requires:

- discovering an unknown root cause;
- deciding product behavior;
- choosing architecture;
- reasoning about auth or authorization correctness;
- reasoning about payment or financial correctness;
- designing Firestore Rules;
- diagnosing complex race conditions;
- making schema decisions;
- interpreting ambiguous requirements;
- broad repository exploration;
- open-ended code review;
- coordinating changes across several interacting modules;
- deciding what tests should exist when behavior itself is unclear.

If Luna encounters unexpected architecture, unclear behavior, test failures
outside its assigned scope, or evidence that the task is more complex than
expected, Luna must stop and escalate to Primary. It must not continue
exploring indefinitely.

### Routing preference

After capability assessment:

1. `KEEP WITH PRIMARY` if Primary-level reasoning is required.
2. Otherwise choose Terra when meaningful engineering reasoning is required.
3. Choose Luna only when the task is narrow, low-risk, explicit, and
   mechanically verifiable.

Cost savings must never override capability fit. A cheaper model that is
likely to require retry, correction, or re-investigation is considered more
expensive for routing purposes.

### Promotion rule

A delegated task must be promoted upward when its actual complexity exceeds
the initial estimate.

Promotion order:

`Luna → Terra → Primary`

Do not repeatedly retry the same task at the same capability tier.

If Luna fails because the task exceeds Luna's capability:

- do not spawn another Luna;
- preserve useful findings;
- either promote once to Terra or return to Primary.

If Terra fails because the task exceeds Terra's capability:

- do not spawn another Terra for the unchanged task;
- return to Primary.

Failures caused solely by transient tool or environment problems may be
retried under the existing stall/failure policy, but must not be confused
with capability failure.

### Model routing and review

Independent review does not transfer decision ownership.

A Terra reviewer may identify security findings, authorization issues,
payment-integrity concerns, Firestore Rules issues, regressions, or race
conditions, but material remediation decisions remain with Primary.

Do not use Luna as the final independent reviewer for material changes
involving authentication, authorization, payments, financial integrity,
Firestore Rules, customer data, or business-critical behavior.

### Anti-overdelegation

Do not split one coherent task into many tiny Luna tasks merely to reduce
Primary or Terra usage.

Delegation granularity must minimize repeated context loading, duplicate file
reads, coordination overhead, fragmented ownership, and unnecessary agent
startup cost.

If several tiny operations require the same context, assign them together to
one capable agent or keep them with Primary.

## Default workflow

For non-trivial engineering tasks:

1. Understand the requested outcome.
2. Determine whether existing code must first be investigated.
3. Delegate exploration to `code_mapper` when useful.
4. Make architectural decisions in the primary agent.
5. Delegate implementation to `implementer` when appropriate.
6. Run relevant validation and tests.
7. Delegate independent review to `reviewer` for material changes.
8. Resolve review findings.
9. Primary agent performs integration, final code review, and final verification.

Do not spawn agents when the task is trivial enough that delegation would
cost more than completing it directly.

## Spawn ownership

Only the Primary Agent may spawn subagents.

Subagents must not spawn additional subagents.

Subagents must not redefine their own scope or expand into unrelated work.

## Completion behavior

Each delegated task must have:

- exact objective
- bounded scope
- prohibited decisions
- expected output
- focused verification where applicable
- explicit stop condition

When the assigned objective is complete, the subagent must:

1. return its result to Primary;
2. report relevant files/tests/findings;
3. stop working.

It must not continue opportunistic refactoring, unrelated investigation, or
additional improvements.

## Stall / failure recovery

Treat a subagent as stalled when it:

- repeatedly checks status without producing new evidence;
- repeats the same command or investigation without progress;
- has completed the requested change but fails to return;
- enters an unproductive retry loop;
- stops producing meaningful tool output.

When this happens:

1. Stop the stalled subagent.
2. Preserve useful findings, diffs and test output.
3. Primary inspects the partial work directly.
4. If the remaining work is small, Primary completes it.
5. Otherwise allow at most ONE replacement subagent for the same task.
6. The replacement must receive a narrower and more explicit scope.
7. If the replacement also fails or stalls, Primary takes over.
8. Do not repeatedly respawn agents for the same unchanged task.

A failed subagent must not automatically trigger another subagent.

## Escalation

Keep these decisions with the primary agent:

- architecture
- domain model
- authentication architecture
- authorization architecture
- payment correctness
- financial data integrity
- Firestore Security Rules architecture
- concurrency / race conditions
- transaction design
- destructive migrations
- cross-module architectural changes

## Parallel work

Parallelize only genuinely independent tasks.

Do not allow multiple write agents to modify overlapping files at the same time.

Default maximum parallel subagents: 2.

Two concurrent subagents is a maximum, not a target.

Prefer one active subagent when tasks depend on each other.

Use two concurrent subagents only when the delegated tasks are genuinely independent.

Do not run two write agents concurrently when they may touch overlapping files,
shared runtime state, Firebase emulators, development servers, builds, or E2E/browser resources.

Resource-heavy verification remains coordinated by Primary.

Primary should prefer sequential delegation when parallel execution would increase coordination or environment risk.

## Context efficiency

Do not ask multiple agents to independently scan the entire repository.

Reuse findings already returned by another agent.

Delegate only the minimum context necessary for a task.

Avoid returning large terminal logs to the parent agent.

## Verification

Do not declare work complete solely because code was written.

Subagents should normally run only focused verification needed for their
assigned scope.

Primary Agent owns final integration and final applicable verification,
including the repository-level validation required by the task.

Do not start duplicate full builds, full E2E suites, or overlapping
resource-heavy test processes in multiple agents unless isolation and
parallel safety are explicitly established.

Run relevant:
- typecheck
- lint
- unit tests
- integration tests
- build
- Firestore rules tests when applicable

Fix failures related to the current task before completion.
