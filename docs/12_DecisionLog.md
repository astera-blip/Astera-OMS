# Decision Log

## 2026-07-26: Use Next.js and TypeScript for the web app

**Decision:** Use Next.js, React, and TypeScript as the application foundation.

**Reason:** This matches the existing project handoff and supports storefront, member area, admin workspace, and future server-side routes.

**Alternatives Considered:** Plain React, Vue, or a no-code storefront.

**Impact:** The project can grow into a full OMS while still supporting fast MVP development.

## 2026-07-26: Use Firebase as the planned backend platform

**Decision:** Plan around Firebase Authentication, Firestore, Storage, and Emulator Suite.

**Reason:** Firebase covers Google login, database, file storage, security rules, and local emulator testing without adding many third-party services.

**Alternatives Considered:** Supabase, custom backend, Clerk plus separate database.

**Impact:** Security rules and data modeling must be designed carefully before real customer data is stored.

## 2026-07-26: Start with deny-by-default Firebase rules

**Decision:** Initial Firestore and Storage rules deny all reads and writes.

**Reason:** No production data model or role system exists yet. Deny-by-default prevents accidental exposure.

**Alternatives Considered:** Add permissive development rules.

**Impact:** Future feature work must intentionally open the minimum required access and add emulator tests.

## 2026-07-26: Remove default Google Fonts dependency

**Decision:** Use system fonts instead of the default `next/font/google` setup.

**Reason:** Builds should not fail when Google Fonts cannot be fetched.

**Alternatives Considered:** Keep Google Fonts and rely on network access.

**Impact:** The app is more reliable in local and CI builds. Brand typography can be revisited during visual design.

## 2026-07-26: Defer custom domain purchase during development

**Decision:** Use the Vercel hostname for development and testing, and delay buying a custom domain until the brand and public launch timing are confirmed.

**Reason:** The project is still in foundation and workflow discovery. Keeping the domain decision open avoids unnecessary cost and avoids committing to a public-facing brand URL too early.

**Alternatives Considered:** Buy `astera-oms.com` immediately, buy `astera-oms.shop` immediately, or wait until launch.

**Impact:** Hosting and functional testing can continue without domain setup. Domain purchase remains a pending owner decision for later.
