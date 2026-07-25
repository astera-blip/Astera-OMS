# Domain Model Draft

This is a first draft for planning. Collection names and exact fields should be reviewed before implementation.

## Identity and CRM

- Member: authenticated customer profile keyed by Firebase UID.
- Role: permission grouping for owner, helper, and future staff roles.
- MemberTag: visible admin classification such as VIP or friend.
- MemberNote: internal notes hidden from customers.
- BlacklistHistory: formal and hidden risk history.
- GuestCustomer: admin-created customer record before Google signup.

## Product Domain

- Company: agency or official organization.
- Artist: individual artist.
- CPGroup: two or more artists grouped for browsing and sales.
- Brand: official or artist-related brand.
- Series: product line or collection.
- Product: canonical product information.
- ProductVariant: purchasable variant, including Default Variant.
- SaleCampaign: a concrete sales event with dates, rules, and status.
- ProductRelation: editable relation between products and company/artist/CP/brand/series.
- MediaAsset: images and future media references.

## Transaction Domain

- Cart: member's current intended purchase.
- Order: checkout-level grouping.
- OrderItem: lifecycle core for purchased item.
- CancellationRequest: customer or admin cancellation workflow.
- Waitlist: preorder,抢购, or shortage waiting state.
- WaitlistNotification: messages and deadlines sent for waitlist decisions.

## Payment Domain

- PaymentRequest: amount the customer is asked to pay.
- Payment: actual received bank transfer or future payment record.
- PaymentAllocation: mapping from a payment to orders, order items, receivables, or wallet.
- Receivable: remaining unpaid amount.
- Wallet: member balance summary.
- WalletTransaction: immutable balance ledger.
- Refund: money returned or converted to wallet.

## Operations Domain

- Purchase: official purchase batch.
- PurchaseItem: purchased official item.
- ArrivalBatch: arrival/checking batch.
- ArrivalItem: arrived item state.
- Supplement: second payment event.
- Shipment: delivery/export state.
- Case: exception workflow.
- AuditLog: immutable important-operation trail.
- Task: Workspace item.

## Legal and Content

- SiteSetting: editable global site settings.
- SocialLink: LINE, Instagram, Facebook, email, and official links.
- FAQ: editable help content.
- LegalDocument: legal document identity.
- LegalDocumentVersion: immutable published version.
- ConsentRecord: user/order consent to specific legal versions.
