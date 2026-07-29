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
- Domain purchase or DNS setup, which the owner has chosen to defer for now.
- Email provider verified sender/domain.

## Vercel Future Steps

1. Confirm no private data is present.
2. Keep using the Vercel hostname until the owner decides on a domain.
3. Connect production domain only after legal/privacy pages are ready.

## Firebase Future Steps

1. Decide when to enable billing if `ASIA-EAST1` Storage is still required.
2. Create Storage buckets for development and production.
3. Run rules tests before real files are added.
4. Add the production web app environment variables to Vercel after import.

## Production Read-only Preflight

Run these commands before any production write or Rules deployment:

```powershell
npm run production:env:check
npm run production:products:audit -- --project astera-oms-prod --confirm-project astera-oms-prod
npm run production:smoke -- --base-url https://astera-oms.vercel.app
```

- The environment checker prints variable names and `configured` / `missing` only.
- The product audit uses Application Default Credentials and performs Firestore reads only.
- `--project` must exactly match `--confirm-project`; this prevents accidental inspection of the wrong project.
- The smoke command sends no credentials and requires HTTPS.
- Full backup, comparison, rollout, rollback, and recovery steps are in
  `docs/SOP/正式資料備份與商品同步SOP.md`.

Before deployment, verify both `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` and
`NEXT_PUBLIC_ENABLE_E2E_TEST_AUTH` are absent or set to `false`.

## Vercel OIDC / GCP Workload Identity

The app is prepared to use Vercel OIDC instead of a long-lived service-account
JSON key. Firebase Admin initialization reads these Vercel environment variable
names:

- `GOOGLE_CLOUD_PROJECT=astera-oms-prod`
- `GCP_PROJECT_ID=astera-oms-prod`
- `GCP_PROJECT_NUMBER=1032606875618`
- `GCP_WORKLOAD_IDENTITY_POOL_ID=vercel-oidc`
- `GCP_WORKLOAD_IDENTITY_PROVIDER_ID=vercel`
- `GCP_WORKLOAD_IDENTITY_AUDIENCE=//iam.googleapis.com/projects/1032606875618/locations/global/workloadIdentityPools/vercel-oidc/providers/vercel`
- `GCP_SERVICE_ACCOUNT_EMAIL=astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com`

Known Vercel project ID:

- `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`

Prepared setup script:

```powershell
.\scripts\setup-vercel-gcp-oidc.ps1 `
  -ProjectId "astera-oms-prod" `
  -ProjectNumber "1032606875618" `
  -VercelProjectId "prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ"
```

The script requires `gcloud` on PATH and creates/updates:

- required Google Cloud APIs;
- service account `astera-vercel-admin`;
- Workload Identity Pool `vercel-oidc`;
- OIDC Provider `vercel`;
- `roles/iam.workloadIdentityUser` binding restricted to the Vercel project ID.

After the script prints the environment variable names/values, add those names
to Vercel Production and Preview environments, redeploy, then test
`POST /api/member/profile`, `/api/cart`, and Owner Product save.

### Completed configuration (2026-07-30)

- GCP service account created:
  `astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com`.
- Workload Identity Pool `vercel-oidc` and Provider `vercel` are active. The
  Provider accepts only the documented audience and maps the Vercel project ID
  claim.
- The service account has only `roles/datastore.user`,
  `roles/firebaseauth.viewer`, and `roles/storage.objectViewer`; it has no
  downloaded private key.
- `roles/iam.workloadIdentityUser` is restricted to Vercel Project
  `prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`.
- All seven OIDC variables above were stored as sensitive variables in both
  Vercel Preview and Production, then a Preview was rebuilt successfully:
  `https://astera-n850fxxzw-astera-oms.vercel.app`.

The next release verification is authenticated: save a member profile, update
the cart, and save an Owner Product on that Preview. These operations must
succeed before promoting the branch to Production.

## GitHub Actions

The CI workflow runs on push and pull request to `main`:

- dependency install
- lint
- typecheck
- unit tests
- secret scan
- high-severity audit
- production build
- Firestore and Storage Rules tests
- regular desktop / Pixel 7 Playwright
- authenticated Auth / Firestore / Storage Emulator Playwright

If GitHub Actions is disabled or requires billing confirmation, the workflow file can remain in the repo and run after the owner enables Actions.
