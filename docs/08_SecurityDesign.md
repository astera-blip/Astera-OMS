# Security Design Draft

## Non-Negotiable Rules

- No secrets in frontend source code.
- No secrets in GitHub.
- Firestore and Storage rules must deny unauthorized access.
- Customer-readable data must not contain internal-only fields.
- Admin pages are not security boundaries.
- Owner-only finance data must not be readable by helpers or customers.
- Public files and private files require different Storage paths and rules.
- Bank files, customer lists, arrival videos, and private reports must not use permanent public links.

## Planned Roles

- `owner`: full operational and financial access.
- `helper`: limited assigned work and own profit-sharing view.
- `member`: own profile, own cart, own orders, own payment requests.
- `guest`: public product and content reads only.

The exact role matrix is pending owner review.

## Day 1 Firebase Rules

Day 1 rules are intentionally deny-by-default. They are not final MVP rules.

Reason:

- No real data model has been implemented.
- No role assignment system exists yet.
- It is safer to open access intentionally later than to accidentally expose data now.

## Future Rules Testing

Before public testing:

- Use Firebase Emulator for Firestore rules tests.
- Test unauthenticated access.
- Test member access to another member's data.
- Test helper access limits.
- Test owner-only finance collections.
- Test Storage public/private separation.
- Test sensitive export logging.

## Sensitive Data Classes

Must not be sent to unauthorized clients:

- Product cost and original currency cost
- Exchange rate details
- Profit sharing
- Customer lists
- Payment and bank records
- Blacklist and hidden risk notes
- Internal member notes
- Audit logs
- Private attachments
- Arrival videos
- Finance exports
