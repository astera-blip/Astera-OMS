# Changelog

## 2026-07-26

- Installed Node.js LTS `v24.18.0`.
- Created the Next.js, TypeScript, Tailwind, and ESLint app.
- Removed build-time Google Fonts dependency from the default template.
- Set the app language to Traditional Chinese for Taiwan.
- Connected the local Git repository to `https://github.com/astera-blip/Astera-OMS.git`.
- Created and pushed the initial app commit.
- Added Day 1 foundation documentation and Firebase scaffolding.
- Added CI, Dependabot, local test tooling, Firebase rules tests, and local development guide.
- Created Firebase development project `astera-oms-dev-b2b2e`.
- Created Firebase production project `astera-oms-prod`.
- Enabled Google Authentication provider for both Firebase projects.
- Registered Firebase web apps for development and production.
- Connected Firebase project aliases in `.firebaserc`.
- Added production dependency audit script for CI.
- Overrode vulnerable Next.js transitive production dependencies while waiting for an upstream Next.js release.
- Confirmed GitHub Actions CI passes on `main`.
- Created development and production Firestore databases in `asia-east1`.
- Intentionally skipped Firebase Storage bucket creation until the owner is ready for the billing/location decision.
- Created the Vercel project and confirmed the production deployment is live at `https://astera-oms.vercel.app`.
