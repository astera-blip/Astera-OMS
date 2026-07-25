# System Architecture

## Current Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Version control: Git and GitHub
- Planned backend services: Firebase Authentication, Firestore, Storage, Cloud Functions or protected server APIs
- Planned deployment: Vercel
- Planned local testing: Firebase Emulator Suite

## Application Boundaries

The app should be separated into:

- Public storefront: public product browsing and content pages.
- Member area: profile, cart, and personal orders.
- Admin workspace: products, orders, members, payment checks, and operational tasks.
- Server-side operations: high-risk writes, finance changes, audit logging, and future notifications.
- Firebase rules: final data-access enforcement for Firestore and Storage.

## Data Access Rule

The most important architecture rule is:

> If a user is not authorized, protected data must not be returned at all.

This means customer-facing pages must not query documents containing internal costs, blacklist notes, profit sharing, bank records, or private admin notes.

## Environment Strategy

Planned environments:

- Local emulator
- Development Firebase project
- Production Firebase project

Real Firebase project IDs, API keys, and service account credentials are not added on Day 1.
