# API Design Draft

Astera OMS will prefer server-side or protected Firebase operations for high-risk actions. Public pages may read approved public data only. Admin and finance writes should not be performed only from client-side code.

## API Principles

- Validate authorization on the server or through Firebase rules.
- Never trust hidden frontend controls.
- Write audit logs for high-risk actions.
- Keep request payloads explicit and small.
- Use immutable records for money movement and historical corrections.
- Return user-safe error messages that do not reveal private data structure.

## Planned Server Operations

These can become Next.js Route Handlers, Firebase Cloud Functions, or another protected server API after the hosting decision is finalized.

### Member

- Create or complete member profile after Google login.
- Normalize and validate Taiwan mobile phone numbers.
- Detect duplicate phone numbers for admin warnings.

### Product and Campaign

- Create product and default variant.
- Create sale campaign.
- Publish, unpublish, archive, or update product relations.
- Update public product projection after private product changes.

### Order

- Create order from cart.
- Store order item snapshots.
- Submit cancellation request.
- Admin approve or reject cancellation request.

### Payment

- Create payment request.
- Admin confirm bank transfer.
- Allocate payment to orders, receivables, or wallet.
- Create wallet transaction for overpayment or refund.

### Audit and Export

- Record sensitive admin operations.
- Record customer data export actions.
- Generate future shipping or bank reconciliation files.

## Deferred Until Owner Review

- Final API hosting surface.
- Role matrix.
- Bank reconciliation input format.
- Shipping export format.
- Email provider and verified sender domain.
