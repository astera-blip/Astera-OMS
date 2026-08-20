# Payment Account Discoverability Design

## Goal

Make the existing Owner receiving-account and member remitting-account flows discoverable without duplicating payment models, APIs, or settings architecture.

## Investigation and root cause

Both account flows already work end to end. Owner receiving accounts are stored in `paymentAccounts`, managed through `/api/workspace/payment-accounts`, and rendered first on `/workspace/payments`. Member remitting accounts are stored in `memberPaymentAccounts`, scoped to the authenticated member by the server routes, and managed at `/account/bank-accounts`. Firestore denies direct client access to both collections.

The production issue is information architecture:

- The Owner navigation calls the destination only `付款 Payments`, so users looking for settings do not know that receiving-account management is inside it.
- `/account/bank-accounts` is absent from the member dashboard and signed-in account navigation.
- `/payments` links to member-account management only when no usable account exists, so existing members cannot discover where to update accounts.

## Approaches considered

### 1. Reuse the payment architecture and clarify navigation (selected)

Keep `/workspace/payments` and `/account/bank-accounts` canonical. Clarify the Owner navigation label and add links to the existing member route from the normal member surfaces and payment form. This is the smallest change, preserves all trust boundaries, and avoids parallel settings flows.

### 2. Add `/workspace/settings/payment`

Rejected because the workspace has no Settings hierarchy. A new route would either duplicate the working board or become a redirect-only parallel entry that users and maintainers must understand.

### 3. Embed account forms in dashboards and payment reporting

Rejected because duplicated forms would split loading, validation, error, and success behavior across multiple surfaces.

## Architecture

No schema, API, KMS/HMAC, authorization, Firestore Rules, or payment matching changes are needed.

- Owner canonical path remains `/workspace/payments#payment-accounts`.
- Member canonical path remains `/account/bank-accounts`.
- `WorkspaceShell` describes the Owner payment destination as covering both payments and receiving accounts.
- `/members` includes a clear payment-settings card.
- `AccountActions` includes a signed-in payment-settings link in desktop and mobile navigation.
- `PaymentRequestsBoard` always exposes a `管理付款帳戶` link next to the member-account selector, regardless of whether usable accounts exist.
- Internal navigation uses Next.js `Link`; no full document reload is introduced.

## Security and data integrity

Navigation visibility is not an authorization boundary. Existing server routes continue to verify Firebase ID tokens, Owner claims, member ownership, account status, and payment-account usability. Both Firestore collections remain inaccessible directly from clients. Full member account numbers remain transient; responses and UI continue to expose only the bank code, payer name, and masked last five digits. Payment creation continues to re-read both selected accounts in its transaction and persist immutable snapshots.

## UX states

Existing management boards retain their loading, empty, error, success, active/inactive, pending-deletion, and masking behavior. The change adds only discoverable links and clearer copy, so refresh persistence continues through the existing API reads. Links keep the existing minimum 44px touch target convention and visible focus behavior inherited from global styles.

## Testing

- Add failing unit coverage for the signed-in member payment-settings link and clearer Owner payment navigation.
- Add a discoverability contract for the member dashboard and always-visible payment-form management link.
- Run typecheck, lint, all unit tests, Firestore Rules tests, payment/auth-related tests, build, and emulated E2E where supported.
- Verify desktop and mobile navigation and both account flows in a browser. Production write verification remains a manual smoke test unless a safe disposable production account is available.

## Scope boundary

This change does not add admin roles, additional account fields, verification workflows, default accounts, migrations, or new Settings routes. Owner remains the only existing backend role permitted to manage receiving accounts.
