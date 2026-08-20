# Astera OMS Codex Agent Orchestration Design

> **Status: Non-normative architecture rationale.** This document explains
> why the orchestration system is structured this way. It does not define the
> effective runtime policy.

## Authoritative Sources

The authoritative sources are deliberately separated by responsibility:

- `AGENTS.md` is the normative orchestration, capability, ownership, lifecycle,
  and verification policy.
- `.codex/config.toml` controls runtime agent enablement, concurrency, and
  default subagent settings.
- `.codex/agents/*.toml` defines role-specific model, reasoning effort,
  sandbox, scope, stop, and reporting behavior.
- This document records architectural rationale only. If it conflicts with
  any of the sources above, the authoritative runtime or policy file wins.

This separation keeps explanations useful to maintainers without creating a
second operational source of truth.

## Design Goals

Astera OMS uses project-scoped agents to reduce total execution cost while
preserving clear ownership of material decisions. Delegation is optional: it
is useful only when a bounded subtask can be completed reliably, verified
objectively, and returned to Primary without transferring architecture or
trust-boundary ownership.

The design therefore favors:

- capability-first routing instead of cheapest-model-first routing;
- short-lived, bounded delegated tasks;
- explicit ownership of high-risk decisions;
- focused subagent verification and Primary-owned integration;
- limited concurrency around a shared repository and shared runtime resources.

## Primary Ownership

The Primary model is not pinned by repository configuration. The active model
is selected in the Codex session or UI. For complex Astera OMS work, the
intended highest-capability Primary tier is GPT-5.6 Sol.

Primary owns material decisions involving:

- architecture and domain modeling;
- authentication and authorization architecture;
- payment correctness and financial integrity;
- Firestore Security Rules and trust boundaries;
- transaction design and concurrency or race-condition semantics;
- destructive migrations;
- cross-module material behavior;
- final integration and applicable repository-level verification.

Lower-capability delegation is intended to reduce the cost of bounded
execution. It must not transfer ownership of decisions whose failure could
compromise authorization, customer data, payment integrity, or system-wide
behavior.

## Capability-First Delegation

Routing happens only after Primary assesses whether delegation is appropriate.
The design optimizes expected total work, not merely a reduction in Primary
tokens.

Relevant factors include:

- task clarity and boundedness;
- capability fit;
- architecture, security, and data-integrity risk;
- objective verifiability;
- startup and context-loading cost;
- retry and rework probability;
- coordination overhead;
- contention for repository and runtime resources.

When capability fit is uncertain, verification is weak, or delegation is
likely to increase total work, Primary retains the task.

## Capability Hierarchy

The intended capability hierarchy is:

`Primary / Sol → Terra → Luna`

This is not an instruction to always choose the cheapest model. The selected
tier must be capable of completing the delegated task correctly without
repeated correction or unbounded exploration.

### Luna: Bounded Read-Only Mapping

The current Luna role is:

- `code_mapper`
- GPT-5.6 Luna
- medium reasoning
- read-only sandbox

It exists for deterministic, low-risk work such as exact symbol and reference
lookup, small targeted execution-path discovery, and bounded read-only code
mapping.

It is not intended for broad ambiguous root-cause analysis, architecture,
authentication, payment, Firestore decisions, or open-ended repository scans.
Keeping this role narrow makes Luna inexpensive without inviting speculative
or indefinite exploration.

### Terra: Scoped Implementation and Independent Review

The current Terra roles are:

- `implementer`: GPT-5.6 Terra, medium reasoning, workspace-write sandbox.
- `reviewer`: GPT-5.6 Terra, high reasoning, read-only sandbox.

The implementer is used only after expected behavior, architecture, scope, and
verification are sufficiently settled. This lets Terra perform real engineering
work without silently redefining Primary-owned decisions.

The reviewer is independent so it can challenge correctness, security,
authorization, payment, Firestore, and data-integrity assumptions. Independence
does not transfer remediation ownership: material correction decisions remain
with Primary.

## Capability Promotion

When actual task complexity exceeds the selected tier, capability promotion is:

`Luna → Terra → Primary`

Capability failure must not cause repeated same-tier respawns. A Luna task may
be promoted once to Terra or returned to Primary. A Terra capability failure
returns to Primary. Useful evidence should be preserved across that handoff so
the next tier does not repeat the same exploration.

Transient environment, permission, quota, or tool failures are different from
capability failure. They may justify a bounded operational retry, but they do
not justify repeatedly spawning equivalent agents for an unchanged task.

## Concurrency Rationale

The current runtime maximum is:

`max_concurrent_threads_per_session = 2`

Two concurrent subagents is a maximum, not a target. One active subagent is
normally preferable when tasks depend on one another. Two should run together
only when their objectives, files, and runtime resources are genuinely
independent.

The limit reduces risk from:

- shared repository state and overlapping writes;
- Next.js build and runtime processes;
- Firebase emulator resources;
- Playwright and browser resources;
- port collisions;
- worker and process contention;
- duplicate context loading;
- coordination and integration overhead.

Resource-heavy repository verification remains coordinated by Primary.
Limiting concurrency is therefore a correctness and environment-stability
decision, not merely a cost control.

## Agent Lifecycle Rationale

Delegated work is designed to be bounded and short-lived. A useful task contract
identifies an exact objective, bounded scope, prohibited decisions, expected
output, focused verification, and an explicit stop condition.

Subagents return control to Primary when the objective is complete, ambiguity
exceeds the delegated scope, a capability boundary is reached, or meaningful
progress stalls. They are not persistent background workers, and the design
does not rely on indefinite waiting.

The anti-loop intent is to prevent:

- repeated identical searches without new evidence;
- speculative fix-and-retry cycles;
- endless repository exploration;
- opportunistic unrelated refactoring;
- continued work after the requested result has already been returned.

This lifecycle keeps ownership visible and allows Primary to integrate evidence,
promote a task when necessary, or finish a small remainder directly.

## Verification Rationale

Subagents normally perform only the focused verification needed for their
assigned scope. Primary coordinates final applicable repository-level
verification and avoids duplicating full builds, full E2E suites, emulator
stacks, long-running servers, or other resource-heavy suites across concurrent
agents unless explicit isolation exists.

Orchestration-only configuration changes do not inherently require an
application build or application test suite. Appropriate verification can
instead include:

- TOML parsing and configuration consistency checks;
- runtime role discovery;
- a bounded read-only `code_mapper` smoke test;
- a bounded temporary-file `implementer` smoke test;
- a bounded read-only `reviewer` smoke test;
- repository-state comparison before and after temporary smoke tests.

This verifies the configuration behavior directly while avoiding unrelated
application and shared-runtime cost.

## Completed Runtime Validation

The project-scoped orchestration was validated through completed runtime smoke
paths. These are historical results, not activation tasks:

1. Primary retained a trivial file-existence check because delegation startup
   cost exceeded the work itself.
2. Primary delegated a bounded `PaymentRequestsBoard` mapping to `code_mapper`
   using Luna, medium reasoning, and read-only access. The agent used targeted
   search, avoided a broad scan, returned its result, and stopped.
3. Primary retained a payment, authorization, Firestore, and trust-boundary
   decision instead of transferring the material architecture decision.
4. Primary delegated a one-file temporary write to `implementer` using Terra,
   medium reasoning, and workspace-write access. The agent performed focused
   verification and returned normally; Primary removed the file and restored
   the exact repository baseline.
5. Primary delegated one bounded synthetic-file review to `reviewer` using
   Terra, high reasoning, and read-only access. The reviewer correctly treated
   synthetic token data as synthetic, produced no speculative material finding,
   made no modification, and returned normally; Primary cleanup restored the
   baseline.

No temporary smoke-test file is a permanent project artifact.

## Maintenance Principle

Future changes should update the authoritative policy or runtime file first.
This rationale should change only when the architectural reasons change. It
should not duplicate the full operational rules from `AGENTS.md`, nor should it
be used to override effective `.codex` configuration.
