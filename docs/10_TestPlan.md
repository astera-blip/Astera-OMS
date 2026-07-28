# Test Plan

## Day 1 Checks

- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd run test:unit`
- `npm.cmd run check:secrets`
- `npm.cmd audit --audit-level=high`
- `npm.cmd run build`
- `npm.cmd run firebase:version`
- `npm.cmd run firebase:rules:test` once Firebase Emulator is ready on the machine.
- Confirm no `.env` or secret files are tracked.
- Confirm Firebase rules are deny-by-default.

## MVP Required Checks

- Firestore rules emulator tests.
- Storage rules emulator tests.
- Google login flow test.
- First-login member profile completion test.
- Member can read own data but not another member's data.
- Public storefront cannot access private cost, CRM, finance, or audit data.
- Admin role checks for product/order/member operations.
- Order item snapshot preservation test.
- Manual payment confirmation audit log test.
- Production tool contract tests: argument confirmation, secret-safe reporting,
  anonymous HTTPS smoke, and mutation-free projection audit.

## Continuous Integration

- `verify`: ESLint, TypeScript, Unit tests, secret scan, production dependency audit, and production build.
- `firebase-rules`: Java 21 plus Firestore and Storage Emulator Rules tests.
- `playwright`: public Chromium desktop and Pixel 7 smoke tests.
- `playwright-emulated`: Auth, Firestore, and Storage Emulator owner/member flows.
- Playwright failures upload `test-results` traces without environment secrets.
- Production runtime rejects Emulator and E2E-auth public flags.

## Later Workflow Tests

- Cart and checkout flow.
- Order item cancellation request and admin review.
- Waitlist ordering and notification deadline.
- Payment allocation across multiple orders.
- Overpayment retained as an unallocated amount for manual bank refund; no Wallet.
- Underpayment to receivable.
- Supplement payment creation.
- Export logging for sensitive data.

## Production Acceptance Commands

The following commands are read-only and must run before a production release:

```powershell
npm run production:env:check
npm run production:products:audit -- --project astera-oms-prod --confirm-project astera-oms-prod
npm run production:smoke -- --base-url https://astera-oms.vercel.app
```

`production:products:audit` compares Product IDs and counts, Variant/Campaign
counts, immutable SKU formats, projected prices, public image fields, and absence
of private Product fields. A non-zero exit blocks migration or release.
