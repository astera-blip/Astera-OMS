# Day 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the Astera OMS repository with project documentation, initial domain/security design, and safe Firebase configuration scaffolding without requiring owner login or production secrets.

**Architecture:** Keep the Next.js app as the root application. Put durable business, security, and decision records under `docs/`; put Firebase local configuration at the repo root using placeholder project IDs only. Avoid implementing customer-facing workflows until the data model and security rules are reviewed.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Firebase planned for Auth/Firestore/Storage/Emulator, GitHub for version control.

## Global Constraints

- Do not add secrets, API keys, service accounts, or real Firebase project IDs.
- Do not require owner login while the owner is away.
- Record every skipped approval/login/legal/brand decision in `docs/99_PendingOwnerReview.md`.
- Keep MVP architecture compatible with later OMS, PIM, CRM, Finance, and Workspace modules.
- Security rules and server-side authorization are mandatory before handling real customer data.

---

### Task 1: Project Documentation Skeleton

**Files:**
- Modify: `README.md`
- Create: `docs/00_ProjectVision.md`
- Create: `docs/01_BusinessRules.md`
- Create: `docs/11_Changelog.md`
- Create: `docs/12_DecisionLog.md`
- Create: `docs/99_PendingOwnerReview.md`

**Interfaces:**
- Consumes: confirmed project handoff requirements.
- Produces: stable documentation entry points for future work.

- [ ] Replace the default Next.js README with Astera OMS setup notes.
- [ ] Add project vision and MVP boundaries.
- [ ] Add confirmed business rules that must not be casually overturned.
- [ ] Add Day 1 changelog entry.
- [ ] Add initial decision records.
- [ ] Add pending owner-review checklist.
- [ ] Verify no placeholders or secrets are introduced.

### Task 2: Domain and Security Drafts

**Files:**
- Create: `docs/02_SystemArchitecture.md`
- Create: `docs/03_DomainModel.md`
- Create: `docs/04_DatabaseDesign.md`
- Create: `docs/08_SecurityDesign.md`
- Create: `docs/10_TestPlan.md`

**Interfaces:**
- Consumes: MVP scope and security principles.
- Produces: draft boundaries for Firestore collections, private/public data separation, and verification strategy.

- [ ] Document the planned Next.js/Firebase architecture.
- [ ] Document core entities and lifecycle ownership.
- [ ] Draft Firestore collection groups and privacy boundaries.
- [ ] Draft security rules principles before implementation.
- [ ] Draft test plan for lint, build, rules emulator, and future workflow tests.

### Task 3: Safe Firebase Skeleton

**Files:**
- Create: `.firebaserc`
- Create: `firebase.json`
- Create: `firestore.rules`
- Create: `storage.rules`
- Create: `firestore.indexes.json`
- Create: `.env.example`

**Interfaces:**
- Consumes: no real Firebase project yet.
- Produces: local scaffolding that can be connected to real dev/prod projects later.

- [ ] Add placeholder Firebase aliases only.
- [ ] Add conservative deny-by-default Firestore rules.
- [ ] Add conservative deny-by-default Storage rules.
- [ ] Add emulator port configuration.
- [ ] Add `.env.example` with variable names only.
- [ ] Do not run `firebase login` or create a Firebase project.

### Task 4: Verification and Publish

**Files:**
- Read: all created and modified files.

**Interfaces:**
- Consumes: Tasks 1-3 outputs.
- Produces: verified commit pushed to GitHub.

- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd audit --audit-level=high`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `git status --short --branch`.
- [ ] Commit with `docs: add Day 1 project foundation`.
- [ ] Push `main` to `origin`.
