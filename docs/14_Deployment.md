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
- Firestore databases created for development and production in `asia-east1`.
- Firebase Storage buckets intentionally not created yet.
- Vercel project created and production deployment is ready at `https://astera-oms.vercel.app`.
- Local Firebase environment files created and intentionally kept out of Git.
- Environment variable names documented in `.env.example`.
- Secret scan script added.
- Build verified locally.

## Not Completed Without Owner Confirmation

- Firebase Storage bucket creation. `ASIA-EAST1` was selected, but bucket creation was skipped to avoid upgrading or adding billing before the owner is ready.
- Production environment variables in Vercel.
- Domain purchase or DNS setup.
- Email provider verified sender/domain.

## Vercel Future Steps

1. Add a custom domain when the owner picks one.
2. Confirm no private data is present.
3. Connect production domain only after legal/privacy pages are ready.

## Firebase Future Steps

1. Decide when to enable billing if `ASIA-EAST1` Storage is still required.
2. Create Storage buckets for development and production.
3. Run rules tests before real files are added.
4. Add the production web app environment variables to Vercel after import.

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
