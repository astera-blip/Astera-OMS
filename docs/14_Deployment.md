# Deployment Readiness

This project is prepared for deployment, but production deployment is intentionally not completed until the owner logs in and confirms external service settings.

## Prepared Automatically

- GitHub repository connected.
- `main` branch pushed.
- GitHub Actions CI workflow added.
- GitHub Actions confirmed on `main`.
- CI blocks high-severity production dependency audit failures.
- Node.js version pinned in `.node-version` and `.nvmrc`.
- Firebase configuration files added.
- Firebase development project connected: `astera-oms-dev-b2b2e`.
- Firebase production project connected: `astera-oms-prod`.
- Firebase Google Authentication provider enabled for both projects.
- Firebase web apps registered for development and production.
- Local Firebase environment files created and intentionally kept out of Git.
- Environment variable names documented in `.env.example`.
- Secret scan script added.
- Build verified locally.

## Not Completed Without Owner Confirmation

- Firestore database and Storage bucket creation, because the region/location decision should be confirmed first.
- Vercel account connection.
- Vercel project import.
- Production environment variables in Vercel.
- Domain purchase or DNS setup.
- Email provider verified sender/domain.

## Vercel Future Steps

1. Owner logs in to Vercel.
2. Import `astera-blip/Astera-OMS`.
3. Confirm framework is Next.js.
4. Add environment variables from `.env.example`.
5. Deploy preview environment first.
6. Confirm no private data is present.
7. Connect production domain only after legal/privacy pages are ready.

## Firebase Future Steps

1. Confirm the Firestore and Storage location.
2. Create Firestore databases for development and production.
3. Create Storage buckets for development and production.
4. Run rules tests before real data is added.
5. Add the production web app environment variables to Vercel after import.

## GitHub Actions

The CI workflow runs on push and pull request to `main`:

- dependency install
- lint
- typecheck
- unit tests
- secret scan
- high-severity audit
- production build

If GitHub Actions is disabled or requires billing confirmation, the workflow file can remain in the repo and run after the owner enables Actions.
