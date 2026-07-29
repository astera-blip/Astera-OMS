# Changelog

## 2026-07-29

- Corrected the homepage brand heading to `ASTERA OMS` only, omitted blank `birthday` from member profile save payloads, and mapped missing Admin Firestore credentials to an explicit profile-save error.
- Updated storefront and member profile UX: homepage header now shows `ASTERA OMS` as the main brand heading, member profile splits name input into `姓` and `名`, successful profile save redirects home, and disabled Instagram placeholders are removed from the public footer.
- Removed `firebase-admin/auth` from shared server Admin SDK imports and moved server ID-token verification to Firebase Identity Toolkit REST so Vercel API routes no longer fail while loading Admin Auth.
- Fixed Vercel runtime bundling for `firebase-admin` by explicitly keeping it external in server bundles.
- Added Google sign-in redirect fallback and clearer Firebase Auth error messages for popup-blocked, closed-popup, unsupported-environment, and unauthorized-domain cases.
- Improved buyer-facing storefront UX: Product listing loading/empty states no longer conflict, empty cart disables order creation, checkout fields have stable form attributes, homepage/brand/product/cart labels use consumer Chinese copy, and unset footer/contact values no longer display as low-trust placeholders.
- Fixed ProductWorkspace product creation when optional classifications are unselected.
- Defaulted new products to `published` and new Variant original currency to `THB`.
- Prevented an empty authenticated cloud cart from clearing newly added local cart lines.
- Added visible checkout terms/privacy and supplement-payment rule content and submitted the active legal version IDs.
- Added a repeatable Firebase Emulator seed script for manual owner/member acceptance.
- Added regression tests for product defaults, optional classifications, cart merging, and checkout legal content.

## 2026-07-26

- Installed Node.js LTS `v24.18.0`.
- Created the Next.js, TypeScript, Tailwind, and ESLint app.
- Removed build-time Google Fonts dependency from the default template.
- Set the app language to Traditional Chinese for Taiwan.
- Connected the local Git repository to `https://github.com/astera-blip/Astera-OMS.git`.
- Created and pushed the initial app commit.
- Added Day 1 foundation documentation and Firebase scaffolding.
- Added CI, Dependabot, local test tooling, Firebase rules tests, and local development guide.
- Created Firebase development project `astera-oms-dev-b2b2e`.
- Created Firebase production project `astera-oms-prod`.
- Enabled Google Authentication provider for both Firebase projects.
- Registered Firebase web apps for development and production.
- Connected Firebase project aliases in `.firebaserc`.
- Added production dependency audit script for CI.
- Overrode vulnerable Next.js transitive production dependencies while waiting for an upstream Next.js release.
- Confirmed GitHub Actions CI passes on `main`.
- Created development and production Firestore databases in `asia-east1`.
- Intentionally skipped Firebase Storage bucket creation until the owner is ready for the billing/location decision.
- Created the Vercel project and confirmed the production deployment is live at `https://astera-oms.vercel.app`.
- Deferred domain purchase and will use the Vercel hostname for now.
- Confirmed the Day 1 foundation passes `typecheck`, `build`, and unit tests after generating Next.js route types with `next typegen`.
- Replaced the default Next.js landing page with the Astera OMS operations workspace shell.
- Added first entry pages for products, members, orders, and payments to prepare Day 3 module work.
- Confirmed the Day 2 and Day 3 shell pages pass lint, typecheck, build, and unit tests after environment-specific Windows reruns.
- Added the Phase 2 product workspace shell, product catalog normalization helpers, and local CRUD UI for products, variants, and sale campaigns.
- Added the Phase 3 local storefront checkout flow with cart storage, order snapshots, customer order history, and checkout unit tests.
- Added the Phase 4 manual bank-transfer flow with payment requests, confirmed payments, allocations, audit logs, and workspace order/payment review pages.
- Added the Phase 5 legal/content baseline with terms/privacy versions, order consent records, public about page, and workspace content/audit-log views.
- Added Firestore repositories and rules for public product projections, private product internals, and member-owned carts.
- Wired product browsing, product workspace sync, and member carts to Firestore with local fallback.
- Added Firestore rules and repositories for orders, order items, payment requests, payments, payment allocations, audit logs, legal versions, consent records, and member private notes.
- Wired checkout, order history, payment requests, payment confirmation, audit log, legal content, and member operations screens to Firestore with local fallback where appropriate.
- Added owner/helper workspace route guards and owner-only guards for payment, audit, member, and content operations.
- Added catalog classification masters for companies, artists, CPs, brands, and series, with non-sensitive classification labels in public product projections.
- Added recorded notification events for order creation and manual payment confirmation without connecting an external email provider.
- Tightened Firestore rules for order items, payment requests, consent records, catalog classifications, and notification events.
- Expanded the small-circle smoke test checklist and manual export backup SOP.

## 2026-07-29: Local MVP Tasks 1–13 completed

- Completed protected Server/API trust boundaries and removed production business
  persistence fallbacks.
- Completed idempotent Campaign-split Checkout, immutable order numbers, payment
  report/confirm/reverse, unallocated overpayment, item cancellation/refund
  adjustments, and audit history.
- Completed bilingual ProductWorkspace, Classification Master, immutable/copyable
  IDs and SKUs, multi-Variant/Campaign editing, and server sequence allocation.
- Completed Storage Emulator image upload, metadata registration, max-eight
  references, cover ordering, alt text, public projection, and storefront images.
- Completed featured storefront, member duplicate-phone/risk operations, public
  Terms/Privacy, and idempotent post-transaction notification delivery.
- Completed accessibility/mobile acceptance: global focus-visible, skip link,
  route focus, live async status, duplicate-submit locks, 44px controls,
  reduced-motion support, and Pixel 7 overflow coverage.
- Added read-only production environment, Product projection audit, and anonymous
  HTTPS smoke tools plus backup/sync/rollback SOP.
- Final validation: secret scan passed; production audit found 0 vulnerabilities;
  TypeScript and ESLint passed; Unit 22 files / 104 tests; Rules 2 files / 29
  tests; Build 31 routes; regular Playwright 10 passed / 18 mode skips;
  Emulator Playwright 25 passed / 3 mode skips.
- Final review hardened nested private-field detection, made public Product-detail
  discovery mandatory in production smoke, and added Classification-tab Pixel 7
  overflow acceptance.
