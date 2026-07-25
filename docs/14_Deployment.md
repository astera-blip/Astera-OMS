# Deployment Readiness

This project is prepared for deployment, but production deployment is intentionally not completed until the owner logs in and confirms external service settings.

## Prepared Automatically

- GitHub repository connected.
- `main` branch pushed.
- GitHub Actions CI workflow added.
- Node.js version pinned in `.node-version` and `.nvmrc`.
- Firebase configuration files added with placeholder project IDs.
- Environment variable names documented in `.env.example`.
- Secret scan script added.
- Build verified locally.

## Not Completed Without Owner Confirmation

- Firebase dev project creation.
- Firebase production project creation.
- Firebase Google login enablement.
- Firebase project aliases in `.firebaserc`.
- Vercel account connection.
- Vercel project import.
- Production environment variables.
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

1. Owner logs in to Firebase Console.
2. Create separate development and production projects.
3. Enable Google Authentication provider.
4. Add web app configuration to local `.env.local`.
5. Replace placeholder aliases in `.firebaserc`.
6. Start emulator locally.
7. Run rules tests before real data is added.

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
