# Astera OMS Production Security Worker Design

**Date:** 2026-08-09
**Status:** Approved design pending implementation-plan review
**Scope:** Production KMS, Vercel Workload Identity, refund-vault governance jobs.

## Goal

Enable the existing member-account fingerprint and fourteen-day refund-vault
implementation in `astera-oms-prod` without storing KMS key material, exposing
scheduled operations publicly, or giving the Vercel runtime broad project roles.

## Chosen architecture

Use one Cloud KMS key ring in `asia-east1`, the existing Vercel Workload Identity
pool, and a private Cloud Run service dedicated to scheduled governance work.
Cloud Scheduler invokes that service with OIDC. There is no public endpoint and
no long-lived service-account private key.

### KMS resources

Create `astera-oms-security` in `asia-east1` with the following Software-protected,
non-exportable keys:

| Key | Purpose | Algorithm | Use |
| --- | --- | --- | --- |
| `member-account-fingerprint` | `MAC` | `HMAC_SHA256` | New permanent account fingerprints and refund comparison only. |
| `refund-account-vault` | `ENCRYPT_DECRYPT` | Google symmetric encryption | Temporary full refund-account ciphertext only. |

The HMAC primary version is recorded in `GCP_KMS_HMAC_KEY_VERSION`. New permanent
identities always use that version. Historical refund verification uses the
immutable payment snapshot version. No automatic re-fingerprinting exists and an
old HMAC version is never used to create a new permanent fingerprint.

### Workload identities and IAM

The existing service account
`astera-vercel-admin@astera-oms-prod.iam.gserviceaccount.com` remains the Vercel
runtime identity. Its existing Firestore, Firebase Auth viewer, and Storage
metadata permissions remain unchanged. Add only key-level bindings:

- `roles/cloudkms.signer` on `member-account-fingerprint`;
- `roles/cloudkms.cryptoKeyEncrypterDecrypter` on `refund-account-vault`.

The existing `vercel-oidc` pool binding remains restricted to Vercel project
`prj_0R0Z3jMOdoonvApGG7Ii2BjgoUYJ`. No project-wide KMS role is granted.

Create a distinct Cloud Run worker service account with only the Firestore
permissions required to run the existing cleanup and key-usage report. It does
not receive decrypt, encrypt, or HMAC-sign permission. Create a distinct Scheduler
invoker service account with only `roles/run.invoker` on the worker service.

### Private scheduled worker

Implement a small Cloud Run service in `asia-east1` with two authenticated routes:

- daily `cleanup-refund-account-temp` runs the existing expiry cleanup;
- monthly `report-fingerprint-key-usage` runs the existing non-destructive report.

The worker verifies the platform-authenticated Scheduler identity. Cloud Run does
not allow unauthenticated invokers. Each route supplies the fixed Production
project ID to shared internal job functions, never accepts a caller-supplied project
or key name, and returns only safe aggregate status. Failures create the existing
safe `owner.jobFailed` notification event. Cloud Monitoring alerts on non-2xx and
timeout complete the operational loop.

The existing command-line scripts remain usable for a reviewed manual run and
production migration; the worker reuses extracted server-only job functions rather
than spawning shell commands.

### Environment and secrets

Vercel Production and Preview receive only configuration identifiers:

- `GOOGLE_CLOUD_PROJECT`, `GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`;
- `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER_ID`,
  `GCP_WORKLOAD_IDENTITY_AUDIENCE`, `GCP_SERVICE_ACCOUNT_EMAIL`;
- `GCP_KMS_HMAC_KEY_NAME`, `GCP_KMS_HMAC_KEY_VERSION`, `GCP_KMS_REFUND_KEY_NAME`;
- a cryptographically random `REFUND_RATE_LIMIT_HASH_SECRET` of at least 32
  characters.

The rate-limit secret is created directly in the Vercel secret store and is never
printed, committed, or sent through chat. `production:env:check -- --strict` is a
final all-service gate and will remain red until the separately scoped Resend
variables are also configured.

## Deployment sequence

1. Enable the required Cloud KMS, Cloud Run, Cloud Scheduler, Artifact Registry,
   and Cloud Build APIs under the existing Blaze billing account.
2. Create the KMS key ring and the two keys, then add exact key-level IAM bindings.
3. Set the Vercel Production/Preview configuration and validate the non-Resend
   portion without exposing values.
4. Implement, test, review, and deploy the private worker with minimum instances
   set to zero.
5. Create the Scheduler invoker identity, then the daily and monthly OIDC jobs and
   Cloud Monitoring alerts.
6. Run an authenticated worker smoke test, then the migration dry-run and backup.
7. Add Resend, run the strict environment check, and continue Preview acceptance.

## Guardrails

- Do not enable unauthenticated Cloud Run invocation.
- Do not use a service-account private key or put any secret in source control.
- Do not pass full bank accounts, HMAC inputs, fingerprints, ciphertext, or complete
  secrets to logs, URLs, Scheduler payloads, error tracking, or chat.
- Do not rotate or destroy an HMAC key version while any permanent account or payment
  snapshot references it.
- Do not run production migration apply without a reviewed dry-run, ignored local
  backup, and an explicit exact-project confirmation.

## Cost boundary

Use Software KMS keys, Cloud Run request-based scaling with `min instances = 0`,
and two Scheduler jobs. The expected MVP usage is within or close to free tiers;
budget alerts are required before deployment.
