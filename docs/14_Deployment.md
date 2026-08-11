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
- Firebase Production default Storage bucket linked in `ASIA-EAST1` as `gs://astera-oms-prod.firebasestorage.app`.
- Firebase Development Blaze enabled and default Storage bucket linked in `ASIA-EAST1` as `gs://astera-oms-dev-b2b2e.firebasestorage.app`.
- Vercel project created and production deployment is ready at `https://astera-oms.vercel.app`.
- Local Firebase environment files created and intentionally kept out of Git.
- Environment variable names documented in `.env.example`.
- Secret scan script added.
- Build verified locally.

## Not Completed Without Owner Confirmation

- Resend API key/domain verification, domain/DNS, and production runtime acceptance.
- Production environment variables in Vercel.
- Domain purchase or DNS setup, which the owner has chosen to defer for now.
- Email provider verified sender/domain.

## Vercel Future Steps

1. Confirm no private data is present.
2. Keep using the Vercel hostname until the owner decides on a domain.
3. Connect production domain only after legal/privacy pages are ready.

## Firebase Future Steps

1. Run rules tests before real files are added.
2. Add/verify the production web app environment variables in Vercel, then redeploy.

## Production Read-only Preflight

Run these commands before any production write or Rules deployment:

```powershell
npm run production:env:check -- --strict
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

### Firebase Production Storage release (2026-08-02)

- Blaze billing is enabled for `astera-oms-prod` via billing account
  `billingAccounts/01B794-2E6BD7-33D714`.
- The official Firebase Storage `projects.defaultBucket.create` API linked
  `gs://astera-oms-prod.firebasestorage.app` in `ASIA-EAST1`.
- `node scripts/run-firebase.mjs deploy --project astera-oms-prod --only storage`
  compiled and released `storage.rules` successfully.
- Verification: `gcloud storage buckets list --project=astera-oms-prod` shows the
  bucket with `location: ASIA-EAST1`; no object upload has been performed yet.
- Vercel Production environment pull confirms all Firebase and OIDC variable names
  are configured. `RESEND_FROM_EMAIL=Astera <orders@updates.asteratw.com>` and
  `RESEND_REPLY_TO_EMAIL=astera.0920@gmail.com` are now set as non-sensitive
  Production variables. The strict check still reports `RESEND_API_KEY` missing;
  it remains blocked on Resend domain verification and the owner's secret value.

### Firebase Development Storage release (2026-08-02)

- Development `astera-oms-dev-b2b2e` is linked to billing account
  `billingAccounts/01B794-2E6BD7-33D714`; `billingEnabled=true`.
- The official Firebase Storage API linked
  `gs://astera-oms-dev-b2b2e.firebasestorage.app` in `ASIA-EAST1`.
- Development Firestore and Storage Rules were deployed successfully with the
  same tested rulesets as Production.

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

## Production redeploy release gate (2026-08-02)

- `npx vercel --prod --yes` redeployed `codex/mvp-completion`; the deployment
  reached Ready and `https://astera-oms.vercel.app` is the active alias.
- Hydrated browser verification showed the published `prod_002` product on
  `/products`. The production smoke runner was updated to accept an explicit
  hydrated product ID and passed:

  ```powershell
  npm run production:smoke -- --base-url https://astera-oms.vercel.app --product-id prod_002
  ```

  All five anonymous checks returned HTTP 200.
- Vercel build completed successfully but reported its build image as Node
  `24.15.0` while the repository engine range is `>=24.18.0 <25`; set the
  Vercel Node.js version to 24.18+ before the final public release to remove
  this runtime drift.
- Vercel Production currently has the Firebase/OIDC variables plus
  `RESEND_FROM_EMAIL` and `RESEND_REPLY_TO_EMAIL`; `RESEND_API_KEY` is still
  missing. DNS checks for `asteratw.com`, `www.asteratw.com`, and
  `updates.asteratw.com` return NXDOMAIN, and Vercel has zero attached domains.
- Do not mark the public launch gate green until domain/DNS, Resend secret and
  delivery, Owner payment-account creation, Owner image upload, and the full
  desktop/Pixel 7/physical-phone acceptance matrix are recorded.

## 2026-08-04 Task 6：帳戶指紋遷移、到期清理與金鑰治理

### Production 環境與 IAM gate

`npm run production:env:check -- --strict` 另外要求以下 Server-only 設定；值只可放在
Vercel Secret／Secret Manager，不得放入 Git、Client bundle 或一般日誌：

- `GCP_KMS_HMAC_KEY_NAME`：完整 HMAC CryptoKey resource name。
- `GCP_KMS_HMAC_KEY_VERSION`：目前新寫入使用的正整數版本。
- `GCP_KMS_REFUND_KEY_NAME`：完整退款對稱加密 CryptoKey resource name。
- `REFUND_RATE_LIMIT_HASH_SECRET`：穩定且至少 32 字元；只在沒有 active 退款驗證窗口時輪替。
- 既有 `GCP_PROJECT_NUMBER`、WIF pool/provider/audience 與 service-account email 均為必要設定。

執行身分只授予所需 Firestore、HMAC sign／verify、退款 encrypt／decrypt 權限；不得建立或
下載長期 service-account JSON key。舊 HMAC key version 只要仍被任何會員帳戶或付款快照
引用就必須長期保留，不得由排程或報告自動 disable／destroy。

### 遷移與回復

先用完全唯讀模式：

```powershell
node scripts/migrate-member-account-fingerprints.mjs --project astera-oms-prod --confirm-project astera-oms-prod --dry-run
```

stdout 只能包含文件 ID、operation/status、key version 與統計，不得包含完整帳號、末五碼、
HMAC 值或 KMS input。Owner 核對報告後，才可在維護窗口使用 `--apply`；apply 會先在已由
Git 忽略的 `.local-backups/member-account-fingerprint-<timestamp>/` 寫入本機備份，備份完成
前不會寫入 Firestore。備份含受限制舊資料，須限制本機權限、不得上傳或貼入工單，完成 rollback
觀察期並經 Owner 核准後安全銷毀。

apply 只更新 `memberPaymentAccounts`：有舊完整帳號者產生最新版本指紋並移除明文字段；
只有末五碼者標記 `needsReverification`。歷史付款快照永不改寫，缺指紋者只列入人工覆核。
不可從舊 HMAC 推導或產生新 HMAC；重新指紋化只可在會員完成身分驗證並重新輸入完整帳號時進行。

Rollback 順序：停止 apply／排程、保留安全報告、以 ignored backup 盤點受影響文件 ID、經 Owner
核准後只回復本次 migration 的欄位，再重跑 dry-run 與 Rules／API／退款稽核。不可用 rollback
覆寫付款快照，也不可把完整帳號寫入日誌或長期正式資料。

### Cloud Scheduler contract（尚未外部部署）

- 每日執行到期清理：
  `node scripts/cleanup-refund-account-temp.mjs --project <id> --confirm-project <id>`。
- 每月執行金鑰使用報告：
  `node scripts/report-fingerprint-key-usage.mjs --project <id> --confirm-project <id>`。
- Cloud Run／2nd-gen Function 必須關閉 unauthenticated invoker；Cloud Scheduler 使用專用
  service account 的 OIDC token，audience 精確等於 job endpoint，該身分只授予
  `roles/run.invoker` 與工作必要的最小權限。
- Endpoint wrapper 只接受平台驗證完成的 Scheduler OIDC 請求，且將固定 project ID 同時傳入
  `--project`／`--confirm-project`；不得接受 request body 覆寫 project、collection 或 key。
- 清理工作失敗與月報失敗會在既有 `notificationEvents` 建立不含帳號／fingerprint 的
  `owner.jobFailed` 告警。另需以 Cloud Monitoring 對非 2xx／逾時告警，避免 Firestore 自身故障
  時 Owner event 也無法寫入。

清理只移除到期的 `refundAccountCiphertext`、`refundEncryptionKeyVersion`、
`refundAccountExpiresAt`，並將 pending request 標記 `needsReverification`；不刪除任何不相關
明文字段。Owner reveal／review API 仍在每次請求即時檢查 expiry，作為排程以外的 defense in depth。
