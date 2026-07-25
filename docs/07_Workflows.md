# Workflow Drafts

## General Preorder

1. Admin creates product, variants, and sale campaign.
2. Customer logs in with Google.
3. Customer completes required member profile.
4. Customer adds campaign variant to cart.
5. Customer places order.
6. System stores order item snapshots.
7. Customer receives payment request.
8. Customer pays by bank transfer.
9. Admin confirms payment.
10. Admin purchases from official source.
11. Items arrive and are checked.
12. Supplement payment is created if needed.
13. Customer pays supplement.
14. Admin ships order item.
15. Order item completes.

## Rush Purchase

1. Customer registers purchase intent.
2. Admin attempts official purchase.
3. Admin records actual acquired items.
4. System recalculates payable items.
5. Customer is notified of successful items and amount.
6. Payment and later arrival flow continues.

## Cancellation Request

1. Customer submits cancellation request.
2. System records reason and affected order items.
3. Admin reviews request.
4. Admin approves or rejects.
5. Approved cancellation creates proper status changes and audit log.
6. Paid amount is handled through refund or wallet according to final policy.

## Duplicate Phone Warning

1. Customer submits or updates phone number.
2. System normalizes phone number.
3. System searches for other members using the same normalized number.
4. If found, admin workspace shows warning.
5. Admin may add notes or tags.
6. Registration is not automatically blocked.

## Overpayment

1. Admin records actual received amount.
2. System allocates required amount to payment request.
3. Remaining amount creates wallet transaction.
4. Wallet balance summary updates from ledger.

## Underpayment

1. Admin records actual received amount.
2. System allocates received amount.
3. Remaining amount creates receivable.
4. Admin decides whether to ask for immediate payment or collect with later supplement.

## Deferred Workflow Decisions

- Supplement deadline and reminders.
- Lost-contact handling.
- Refund priority.
- Wallet withdrawal.
- Mixed cart rules.
