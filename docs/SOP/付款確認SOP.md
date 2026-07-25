# 付款確認 SOP

## Purpose

Confirm bank-transfer payment manually while keeping clear payment allocation and audit records.

## Draft Steps

1. Open pending payment confirmation queue.
2. Compare customer submitted information with bank transfer record.
3. Confirm payer clues such as amount, date, account last digits, and member information.
4. Create or update Payment record.
5. Allocate Payment to Payment Request, Order, Receivable, or Wallet.
6. For overpayment, create Wallet Transaction.
7. For underpayment, create Receivable.
8. Record admin actor, time, and reason.
9. Send payment confirmation email when email service is ready.

## Checks

- Do not directly set only `paid = true`.
- Keep original payment evidence private.
- Do not expose bank records to customers.
