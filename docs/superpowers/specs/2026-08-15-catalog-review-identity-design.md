# Catalog Review Identity Presentation Design

## Goal

Make the Owner and Partner catalog-review screen understandable to an operator without exposing Firebase UIDs or raw version values.

## Scope

- Applies only to `CatalogReviewBoard` and its protected catalog-change-request read API.
- Reuses the existing `members` collection fields: `displayName` and `communityId`.
- Does not modify product, campaign, checkout, Firestore Rules, or catalog-change approval semantics.

## Read model

The protected catalog-change-request GET route will enrich each request with a server-resolved creator presentation value. The persistent request remains anchored to `createdBy` UID for authorization and auditing; the presentation value is response-only.

Resolution order:

1. `displayName` is the primary visible creator name.
2. When present and different, `communityId` follows in parentheses.
3. If no completed profile is available, show `未完成會員資料`.
4. Never display the Firebase UID as a fallback in the UI.

## Review card wording

- Replace `建立者` UID with `建立者` and the resolved presentation value.
- Replace raw `基準版本` with `送審時版本`:
  - Existing product: `以送審當下的正式商品為準；若之後被更新，系統會阻止核准並要求重新送審。`
  - New product: `新商品草稿，尚無既有正式版本。`
- The raw version token remains internal to the request and server stale guard, but is not shown on the card.

## Error handling

Failure to resolve a member profile must not fail the catalog-review list. The response falls back to `未完成會員資料`; it must not disclose the UID.

## Tests

- Repository/API read test: creator profile is resolved into the response-only presentation field and missing profile uses the safe fallback.
- Component behavior test: display name/community ID is shown, while the UID and raw base-version value are absent.
- Existing authorization and stale-version tests remain unchanged.

## Non-goals

- No new member fields or collection migration.
- No UID replacement in persisted audit logs or catalog-change records.
- No changes to review approval, rejection, role permissions, or public product projections.
