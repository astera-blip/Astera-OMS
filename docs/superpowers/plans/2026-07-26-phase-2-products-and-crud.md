# Phase 2 Products and CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the product master data model for `products`, `productVariants`, and `saleCampaigns`, then expose a staff-only CRUD workspace for managing them.

**Architecture:** Keep product data access on the server side and return only safe DTOs to the UI. Model `products` as the canonical master record, `productVariants` as required sellable units, and `saleCampaigns` as sale-window metadata that can be attached later by order flows.

**Tech Stack:** Next.js 16 app router, React 19, TypeScript, Firestore emulator-backed tests, Tailwind CSS, existing Firebase auth/rules stack.

## Global Constraints

- Keep public product rendering separate from internal cost and notes fields.
- Do not expose internal `productsInternal` data to staff pages that are not explicitly meant to show it.
- Every product must have at least one Variant; if none is provided, create a `Default` Variant.
- Server-side authorization is mandatory before any product write.
- Follow the repo's existing `server-only` and `use client` boundaries.

---

### Task 1: Product Domain Tests and Types

**Files:**
- Create: `tests/unit/productModel.test.ts`
- Create: `src/lib/product/model.ts`
- Create: `src/lib/product/variant.ts`

**Interfaces:**
- Consumes: `taiwanMobile`-style validation patterns and existing domain typing conventions.
- Produces: `ProductDraft`, `ProductVariantDraft`, and normalization helpers used by the workspace forms.

- [ ] Write failing tests for product name trimming, default variant creation, and rejecting a product with no sellable variant data.
- [ ] Run `npm.cmd run test:unit -- tests/unit/productModel.test.ts` and confirm the failures are about missing behavior, not broken test syntax.
- [ ] Implement the minimal product and variant normalization helpers to pass the tests.
- [ ] Re-run the targeted unit test until it passes.

### Task 2: Firestore Product Data Access Layer

**Files:**
- Create: `src/lib/product/repository.ts`
- Modify: `firestore.rules`
- Create: `tests/firebase/product-rules.test.ts`

**Interfaces:**
- Consumes: auth role helpers and Firestore client/server patterns already used by member profile code.
- Produces: `loadProducts`, `saveProduct`, `loadProductVariants`, and `saveProductWithVariants`.

- [ ] Write failing Firestore rules tests for owner create/update/read and non-owner deny cases.
- [ ] Run the targeted rules tests against the emulator and verify the deny-by-default gap first.
- [ ] Implement the Firestore data access helpers with server-only validation and product/variant writes.
- [ ] Extend `firestore.rules` so only `owner` can manage product master data.
- [ ] Re-run the targeted rules tests until they pass.

### Task 3: Workspace Product CRUD Pages

**Files:**
- Create: `src/app/workspace/products/page.tsx`
- Create: `src/app/workspace/products/new/page.tsx`
- Create: `src/app/workspace/products/[id]/page.tsx`
- Create: `src/app/workspace/products/actions.ts`
- Create: `src/components/workspace/product-form.tsx`

**Interfaces:**
- Consumes: product repository functions from Task 2.
- Produces: staff-only product list, create form, edit form, and save actions.

- [ ] Write failing component or action tests for creating and editing a product with a default variant.
- [ ] Run the relevant unit or integration test and confirm the current workspace shell has no CRUD behavior yet.
- [ ] Implement the server actions and forms as thin wrappers over the product repository.
- [ ] Add a focused workspace product list page that links to create/edit routes.
- [ ] Re-run the tests and smoke-check the route rendering in the browser.

### Task 4: Verification and Commit

**Files:**
- Read: all files changed by Tasks 1-3.

**Interfaces:**
- Consumes: completed product model, rules, and workspace CRUD pages.
- Produces: a verified commit on `codex/mvp-phase-2`.

- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Run `npm.cmd run test:unit`.
- [ ] Run `npm.cmd run firebase:rules:test`.
- [ ] Run `npm.cmd run check:secrets`.
- [ ] Run `npm.cmd run build`.
- [ ] Commit the completed phase with a message describing product CRUD.
