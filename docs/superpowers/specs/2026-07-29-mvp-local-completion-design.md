# Astera OMS MVP Local Completion Design

Date: 2026-07-29 Asia/Taipei

## Goal

Complete all currently approved, locally executable Astera OMS MVP work without changing the established Collection architecture or adding ERP modules. The result must use Server APIs and Firebase as the production authority, retain Emulator-only test support, and leave only genuinely external deployment gates.

## Scope

This design covers:

1. ProductWorkspace bilingual labels, immutable identifier copy controls, and help text.
2. Separate Product and Classification management with server-generated classification IDs.
3. Removal of production localStorage/Demo fallbacks and internal development copy.
4. Product image upload/registration through Firebase Storage Emulator-compatible flows.
5. Image-aware public catalog and homepage featured-product carousel.
6. Duplicate-phone warnings, editable private member notes, risk-state audit logs, and private-data enforcement.
7. Public Terms and Privacy pages linked from checkout, brand pages, and footer.
8. Immediate post-transaction Resend delivery attempts with idempotent retry state.
9. Firestore/Storage Rules and Playwright execution in GitHub Actions.
10. Checkout/payment/cancellation boundary audit and regression coverage.
11. Desktop and Pixel 7 UI acceptance.
12. Read-only production migration, environment, backup, smoke, and rollback tooling.

The following remain outside this design:

- Variant Name suggestion/dropdown behavior, pending owner decision.
- Wallet, VIP, CRM timelines, delayed payment, Warehouse, Finance, automatic reconciliation, automatic supplement billing, and other ERP work.
- Actual Firebase Blaze upgrade, bucket creation, production Rules deployment, DNS, OIDC, real Resend delivery, and real-phone acceptance.
- Direct Product ID editing. A future relationship-aware migration tool is separate from normal ProductWorkspace.

## Dependency Strategy

### Foundation first

CI and environment guards are established first. Production data-source cleanup and transaction-boundary audits follow before new UI work. This prevents new features from depending on localStorage behavior or incomplete idempotency responses.

### Product work together

ProductWorkspace labels, tabs, classification management, and identifier copy controls share the same page, API authentication, and E2E fixtures. They are implemented as one reviewed batch.

### Images before featured presentation

The Product/PublicCatalog image type, metadata registration, public projection, and image rendering are completed before homepage carousel work. This avoids changing product card and projection shapes twice.

### Independent operational batches

Member operations, legal pages, and notification delivery have separate domain boundaries and commits. Each receives its own unit/API/rules coverage.

### Cross-cutting finish

Mobile acceptance runs after feature layouts stabilize. Deployment tools are last and default to read-only/dry-run.

## Architecture

### Production authority

- `productsInternal` remains the private Product authority.
- `productsPublic` remains the only public catalog source.
- Business writes use authenticated Route Handlers and Firebase Admin SDK.
- Client Firebase SDK may be used for authenticated Storage binary transfer under Storage Rules, but Product image references are not trusted until an owner-only Server API validates object path, bucket, MIME type, size, and ownership namespace.
- Production UI never treats localStorage as successful persistence.
- Emulator-only data is enabled only through explicit test environment variables.

### ProductWorkspace

- Add `Products（商品管理）` and `Classifications（分類管理）` tabs.
- Keep the existing product form and move classification management into a focused child component.
- Centralize bilingual Product/Campaign/Classification/Currency display labels in a pure UI-label module.
- Product ID and SKU remain read-only and gain Clipboard API copy actions.
- Variant Name remains a text input.

### Classification API

- `GET /api/workspace/classifications` remains owner-only.
- `POST /api/workspace/classifications` accepts `{ key, label }`; the Server creates the Firestore document ID.
- `PATCH /api/workspace/classifications` accepts `{ key, id, label, status }`.
- IDs never change.
- Rename and archive are supported; hard delete is not.
- Empty labels and case/space-normalized duplicate active labels return stable 400/409 error codes.

### Product images

Public image shape:

```ts
export type ProductImage = {
  id: string;
  objectPath: string;
  url: string;
  altText: string;
  width: number;
  height: number;
  sortOrder: number;
};
```

- Binary upload uses Firebase Storage Client SDK so Emulator and owner Storage Rules exercise the same path.
- Path is `product-images/{productId}/{randomId}.{ext}`.
- Client accepts JPEG, PNG, or WebP up to 5 MB and reads intrinsic dimensions.
- `POST /api/workspace/products/{id}/images/register` validates the authenticated owner, Product existence, path namespace, Storage metadata, URL bucket/path, MIME type, size, dimensions, alt text, and maximum eight references.
- `PATCH /api/workspace/products/{id}/images` updates alt text/order/cover ordering after revalidation.
- Removing a reference does not delete the Storage object.
- Product save regenerates `productsPublic` with sorted public image fields and no SKU/cost/internal note.

### Storefront

- Public list, detail, and featured components read image data only from `productsPublic`.
- `next/image` uses explicit dimensions or `fill` with configured Firebase Storage remote patterns.
- Missing images use a code-native fallback card.
- Featured order is rush purchase first, then nearest valid closing time, then newest public update.
- Featured display contains 6–10 products, desktop carousel controls, and touch horizontal scroll on mobile.

### Member operations

- Add an owner-only member operations API returning member profiles, private notes, and duplicate normalized-phone groups.
- Private notes remain invisible to Members through Rules and APIs.
- Risk/note updates run in a transaction and append Audit Log records.
- Removing blacklist state preserves the prior Audit Log.
- Duplicate phone is a warning only and never blocks profile completion.

### Legal

- `/terms` and `/privacy` are public Server pages backed by the current legal version definitions.
- Footer, Brand, and Checkout link to these pages.
- ConsentRecord continues to record the current version IDs.
- Final legal approval remains external.

### Notifications

- Order creation and payment confirmation commit business state first.
- After commit, the Route Handler calls a delivery orchestrator for the created event IDs.
- A Firestore transaction acquires a short delivery lock only when the event is not sent and no valid lock exists.
- Resend success writes `sent`, provider ID, attempt count, and timestamp.
- Missing configuration or provider failure writes `failed` and a sanitized error.
- Delivery failure never changes the HTTP success semantics of checkout or payment confirmation.
- Owner retry uses the same orchestrator and cannot resend an already-sent event.

### CI and environment safety

- GitHub Actions installs Java and Chromium dependencies.
- Separate jobs run static/unit/build checks, Firebase Rules tests, regular Playwright, and authenticated Emulator Playwright.
- Failure artifacts retain Playwright traces.
- Production build and runtime reject Emulator/test-auth flags.
- `/e2e-auth` continues returning not found unless its explicit test flag is enabled.

### Production preparation

- Environment checker reports missing variables without printing secrets.
- Product projection audit is read-only by default and requires explicit project confirmation.
- Backup/migration SOP names exact output locations under a Git-ignored local backup directory.
- Production smoke checks are anonymous/read-only.
- No script deploys Rules, migrates data, or deletes records without a separate explicit confirmation argument.

## Error Handling

- UI shows stable Traditional Chinese messages for loading, empty, validation, authorization, conflict, and server failure states.
- APIs map expected validation/conflict/not-found/auth failures to 400/401/403/404/409 and hide internal exception details behind `internal_error`.
- Storage upload failure never adds an image reference.
- Image registration failure leaves an unreferenced object for later cleanup; it does not delete automatically.
- Notification failure updates only `notificationEvents`.
- Production audit tools exit non-zero on mismatches and never auto-correct them.

## Testing

Each batch follows red/green unit or route-domain testing, then:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- relevant Unit/API/Rules tests
- `npm.cmd run build`
- relevant desktop and Pixel 7 Playwright

Final local completion requires:

- secret scan
- production dependency audit
- all Unit tests
- Firestore and Storage Rules tests
- production build
- regular Playwright
- authenticated Emulator Playwright
- documentation and handoff update

## Approved Outcome

After these batches, remaining MVP work must be limited to external service activation, production data/rules deployment, final legal/brand assets, real email delivery, and real-device production acceptance.
