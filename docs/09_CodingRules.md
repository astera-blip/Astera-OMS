# Coding Rules

## General

- Prefer small, focused files.
- Prefer TypeScript types for domain boundaries.
- Do not hardcode editable business content.
- Do not add new third-party services without documenting reason, cost, alternatives, and maintenance impact.
- Keep comments useful and sparse.

## Security

- Do not commit `.env`, service account files, tokens, or private exports.
- Do not put server secrets in `NEXT_PUBLIC_` variables.
- Do not rely on frontend hiding for permission control.
- Keep public and private Firestore documents separate.
- Add audit logs for high-risk operations.

## Data Modeling

- Preserve historical order item snapshots.
- Use Default Variant for products without visible options.
- Use ledger or adjustment records for money changes.
- Avoid direct overwrite of historical financial values.
- Prefer archive/status fields to hard deletion.

## Frontend

- Use Traditional Chinese user-facing copy by default.
- Keep mobile layouts usable for customer and basic admin tasks.
- Do not use in-app explanatory text to describe implementation details.
- Use system fonts until brand typography is decided.

## Git

- Commit after each meaningful small milestone.
- Keep commit messages clear.
- Do not push secrets.
- Update Decision Log when changing confirmed architecture or business rules.
