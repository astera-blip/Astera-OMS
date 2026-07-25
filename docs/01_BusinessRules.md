# Business Rules

This file records confirmed business rules. Changes to these rules should be discussed with the owner and recorded in `docs/12_DecisionLog.md`.

## Identity and Members

- MVP login method is Google only.
- Firebase Authentication UID is the primary member identifier.
- Email, phone, name, and social ID are member attributes, not primary keys.
- First Google login requires member profile completion.
- Required member profile fields: name, community ID, mobile phone.
- Birthday is optional.
- Address can be collected during checkout instead of registration.

## Phone Numbers

- MVP does not perform SMS or voice verification.
- Taiwan mobile numbers must be normalized before storage and comparison.
- Acceptable user input includes `0912-345-678`, `0912 345 678`, and `+886912345678`.
- Duplicate phone numbers are allowed but must produce admin warnings.
- Member phone and recipient phone are separate concepts.

## Products and Campaigns

- Product and Sale Campaign are separate concepts.
- Every product uses variants.
- Products without visible options still have a Default Variant.
- Product relationships to company, artist, CP group, brand, and series must be editable from the admin side.
- Artist/company/CP changes must not break historical orders.
- Order items must store product snapshots: name, variant, price, and required sales notes at purchase time.

## Orders

- OrderItem is the lifecycle core.
- Different items in one order may arrive, supplement, cancel, refund, or complete at different times.
- Customers cannot freely replace one ordered product with another.
- Product changes after order creation must not overwrite historical order content.
- Cancellation requires a request, admin review, reason, and audit trail.

## Payments

- MVP payment method is bank transfer only.
- Payment should not be modeled as only `order.paid = true`.
- Planned payment objects include Payment Request, Payment, and Payment Allocation.
- One payment may cover multiple orders.
- One order may have multiple payments.
- Overpayment can become member wallet balance.
- Underpayment can create receivables.

## Security and Audit

- Frontend hiding is not authorization.
- Unauthorized users must not receive protected data from Firestore, Storage, APIs, or server functions.
- Public product data and private operational data should be separated.
- Cost, profit sharing, blacklist, internal notes, bank files, and private attachments must not be available to customers.
- Important operations require audit logs with actor, time, before/after values, reason, and related records.
- Financial history should be corrected with adjustments, not overwritten.
