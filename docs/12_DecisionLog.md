# Decision Log

## 2026-07-26: Use Next.js and TypeScript for the web app

**Decision:** Use Next.js, React, and TypeScript as the application foundation.

**Reason:** This matches the existing project handoff and supports storefront, member area, admin workspace, and future server-side routes.

**Alternatives Considered:** Plain React, Vue, or a no-code storefront.

**Impact:** The project can grow into a full OMS while still supporting fast MVP development.

## 2026-07-26: Use Firebase as the planned backend platform

**Decision:** Plan around Firebase Authentication, Firestore, Storage, and Emulator Suite.

**Reason:** Firebase covers Google login, database, file storage, security rules, and local emulator testing without adding many third-party services.

**Alternatives Considered:** Supabase, custom backend, Clerk plus separate database.

**Impact:** Security rules and data modeling must be designed carefully before real customer data is stored.

## 2026-07-26: Start with deny-by-default Firebase rules

**Decision:** Initial Firestore and Storage rules deny all reads and writes.

**Reason:** No production data model or role system exists yet. Deny-by-default prevents accidental exposure.

**Alternatives Considered:** Add permissive development rules.

**Impact:** Future feature work must intentionally open the minimum required access and add emulator tests.

## 2026-07-26: Remove default Google Fonts dependency

**Decision:** Use system fonts instead of the default `next/font/google` setup.

**Reason:** Builds should not fail when Google Fonts cannot be fetched.

**Alternatives Considered:** Keep Google Fonts and rely on network access.

**Impact:** The app is more reliable in local and CI builds. Brand typography can be revisited during visual design.

## 2026-07-26: Defer custom domain purchase during development

**Decision:** Use the Vercel hostname for development and testing, and delay buying a custom domain until the brand and public launch timing are confirmed.

**Reason:** The project is still in foundation and workflow discovery. Keeping the domain decision open avoids unnecessary cost and avoids committing to a public-facing brand URL too early.

**Alternatives Considered:** Buy `astera-oms.com` immediately, buy `astera-oms.shop` immediately, or wait until launch.

**Impact:** Hosting and functional testing can continue without domain setup. Domain purchase remains a pending owner decision for later.

## 2026-07-26: Model product management as a local workspace first

**Decision:** Implement the Phase 2 product backend as a local workspace with durable client-side state for now, while keeping the data model aligned to the future Firestore `products`, `productVariants`, and `saleCampaigns` collections.

**Reason:** The catalog workflow is the next blocking dependency for later cart and order work, and this approach delivers a usable CRUD surface before Firestore wiring is finalized.

**Alternatives Considered:** Delay the feature until Firestore persistence is ready, or wire Firestore immediately.

**Impact:** Product operations can proceed immediately in the workspace UI, and the repository layer can later swap local storage for Firestore without changing the field shape.

## 2026-07-26: Validate checkout and payment workflows locally before Firestore wiring

**Decision:** Build the cart, order, payment request, manual payment confirmation, audit log, legal version, and consent-record workflow with local browser storage first.

**Reason:** The MVP needs workflow shape and operator screens before committing security rules and Firestore indexes. Local storage keeps the UI usable while preserving the planned collection boundaries.

**Alternatives Considered:** Wire Firestore immediately, or postpone checkout/payment until all security rules are finalized.

**Impact:** Storefront and workspace users can exercise the full small-circle MVP flow locally. Before real customer testing, these local helpers must be replaced or backed by Firestore repositories with rules tests for carts, orders, payments, audit logs, and consent records.

## 2026-07-26: Start Firestore wiring with public products and member carts

**Decision:** Add Firestore repositories for `productsPublic`, `productsInternal`, and `carts` before moving orders and payments to Firestore.

**Reason:** Product browsing and carts are the first customer-facing persistent surfaces. They also define the minimum security boundary: public product projections are readable, internal product data is owner-only, and carts are member-owned.

**Alternatives Considered:** Move all localStorage flows to Firestore at once, or keep all flows local until final security rules.

**Impact:** Storefront and workspace product data can start syncing to Firestore, and signed-in members can persist carts under `carts/{uid}`. Orders, payments, audit logs, and consent records still need Firestore repositories and rules before real small-circle testing.

## 2026-07-26: Use owner-only writes for operational records during MVP

**Decision:** Restrict payment confirmation, payment allocations, audit logs, member private notes, and legal version publishing to owner accounts for the MVP.

**Reason:** These actions affect money, customer risk state, or legal/audit history. Helper permissions need a more explicit matrix before they should mutate high-risk data.

**Alternatives Considered:** Allow helpers to manage all workspace records immediately, or keep every operational flow local until a full role matrix exists.

**Impact:** The system can proceed safely with small-circle testing using owner-led operations. Helper access remains limited to lower-risk workspace views until a scoped permission model is added.

## 2026-07-26: Keep MVP email as recorded notification events

**Decision:** Record order-created and payment-confirmed notification events without sending real email in the MVP.

**Reason:** Resend requires API keys, domain decisions, deliverability checks, and cost review. The system still needs an auditable notification intent before real email is enabled.

**Alternatives Considered:** Connect Resend immediately, or remove email from MVP entirely.

**Impact:** Checkout and payment flows can record notification intent now. A future email provider can consume `notificationEvents` without changing the order or payment workflow shape.

## 2026-07-26: Keep helper permissions unchanged for small-circle testing

**Decision:** Keep high-risk Firestore writes owner-only and avoid adding helper write permissions in this phase.

**Reason:** Payment confirmation, member risk flags, private notes, audit logs, and legal content need an explicit role matrix before helpers should mutate them.

**Alternatives Considered:** Allow helpers to manage products and orders, or define a full permission matrix now.

**Impact:** Small-circle testing uses owner-led operations. Helper expansion remains a later product decision.

## 2026-07-29: Keep Product IDs and SKUs server-managed and immutable

**Decision:** Product ID, Product SKU, and Variant SKU remain server-assigned and read-only in normal ProductWorkspace operations. The UI will provide copy buttons, not edit controls. Product IDs may only be changed in the future through a separate owner-only migration tool that validates and migrates every related record.

**SKU Rules:** Product SKU remains `AST-P000001`; Variant SKU remains `AST-P000001-V001`. Archived SKU numbers are never reused or backfilled. If `V002` is archived after `V001` through `V003` exist, the next Variant is `V004`.

**Reason:** These identifiers connect private/public products, Variants, Campaigns, order snapshots, and future image paths. Direct editing can break referential integrity and historical traceability.

**Impact:** The normal product editor will never unlock identifiers. A future migration tool is a separate, explicitly scoped operation and is not part of the current UI clarity batch.

## 2026-07-29: Use bilingual ProductWorkspace labels without changing stored enum values

**Decision:** ProductWorkspace displays technical names as `English（中文）` and enum options as bilingual labels while preserving the existing English values in Firestore and APIs.

**Confirmed Labels:** Publish status uses `Draft（草稿）`, `Published（已刊登）`, and `Archived（已封存）`. Campaign status uses `Upcoming（即將開始）`, `Open（開放中）`, `Closed（已結束）`, and `Archived（已封存）`. Classification status uses `Active（啟用）` and `Archived（已封存）`.

**Reason:** Operators need understandable Chinese UI while developers, APIs, existing documents, and historical data continue using stable enum values.

**Impact:** This is a presentation-only change; no Collection, API, or data migration is required.

## 2026-07-29: Separate classification management from product editing

**Decision:** ProductWorkspace will expose `Products（商品管理）` and `Classifications（分類管理）` as separate top-level tabs. Product classification selectors will include a `管理分類` shortcut. Classification IDs will be server-generated; operators enter only the display name. Existing classifications can be renamed or archived, but not hard-deleted.

**Reason:** Company, Artist, CP, Brand, and Series are reusable master data. Keeping them normalized prevents duplicate spelling variants and preserves historical references.

**Impact:** Existing classification Collections remain unchanged. The UI and protected classification API need extensions for generated IDs, rename, and archive operations.

## 2026-07-29: Clarify private notes and original currency in ProductWorkspace

**Decision:** `Internal Note（內部備註）` will display: `僅供後台作業使用，不會顯示於商品頁。可記錄採購來源、限購、成本或交接事項。`

**Currency Labels:** New Variants continue to default to THB and allow `THB（泰銖）`, `TWD（新台幣）`, `JPY（日圓）`, `KRW（韓元）`, and `USD（美元）`.

**Impact:** Internal notes remain private and excluded from `productsPublic`. Currency storage remains unchanged.
