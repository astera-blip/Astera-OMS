# Database Design Draft

## Firestore Principles

- Separate public documents from private operational documents.
- Keep customer-readable documents small and intentionally shaped.
- Store snapshots for historical order content.
- Use immutable ledger-style records for money and high-risk history.
- Prefer soft delete, archive, or status changes over hard deletion.
- Add audit logs for important admin actions.

## Draft Collections

Identity and CRM:

- `members`
- `roles`
- `permissions`
- `memberTags`
- `memberNotes`
- `blacklistHistory`
- `guestCustomers`

Products:

- `companies`
- `artists`
- `cpGroups`
- `brands`
- `series`
- `products`
- `productVariants`
- `saleCampaigns`
- `productRelations`
- `mediaAssets`

Transactions:

- `carts`
- `orders`
- `orderItems`
- `cancellationRequests`
- `waitlists`
- `waitlistNotifications`

Payments:

- `paymentRequests`
- `payments`
- `paymentAllocations`
- `receivables`
- `wallets`
- `walletTransactions`
- `refunds`

Operations:

- `purchases`
- `purchaseItems`
- `arrivalBatches`
- `arrivalItems`
- `supplements`
- `supplementItems`
- `shipments`
- `cases`
- `caseEvents`
- `auditLogs`
- `tasks`

Content and legal:

- `siteSettings`
- `socialLinks`
- `faqs`
- `legalDocuments`
- `legalDocumentVersions`
- `consentRecords`

## Open Design Questions

- Whether products and variants should be nested or top-level collections.
- Exact order status and order item status state machines.
- Role and permission matrix.
- Index requirements after query design.
- Whether public product documents should be generated projections.
