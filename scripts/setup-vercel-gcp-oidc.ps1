param(
  [string]$ProjectId = "astera-oms-prod",
  [string]$ProjectNumber = "",
  [string]$PoolId = "vercel-oidc",
  [string]$ProviderId = "vercel",
  [string]$ServiceAccountId = "astera-vercel-admin",
  [string]$ServiceAccountDisplayName = "Astera Vercel Admin",
  [string]$VercelProjectId = "",
  [string]$VercelTeamOrOwner = "astera-oms"
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not available on PATH."
  }
}

function Test-GcloudResource([string[]]$Arguments) {
  # Missing resources are expected on a first run. PowerShell on Windows can
  # otherwise turn gcloud's non-zero exit status into a terminating error.
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    gcloud @Arguments *> $null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

Require-Command "gcloud"

if (-not $ProjectNumber) {
  $ProjectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)"
}

if (-not $ProjectNumber) {
  throw "ProjectNumber is required."
}

$ServiceAccountEmail = "$ServiceAccountId@$ProjectId.iam.gserviceaccount.com"
$Audience = "//iam.googleapis.com/projects/$ProjectNumber/locations/global/workloadIdentityPools/$PoolId/providers/$ProviderId"

Write-Host "ProjectId=$ProjectId"
Write-Host "ProjectNumber=$ProjectNumber"
Write-Host "PoolId=$PoolId"
Write-Host "ProviderId=$ProviderId"
Write-Host "ServiceAccountEmail=$ServiceAccountEmail"
Write-Host "Audience=$Audience"

gcloud config set project $ProjectId

gcloud services enable `
  iam.googleapis.com `
  iamcredentials.googleapis.com `
  sts.googleapis.com `
  firestore.googleapis.com `
  firebase.googleapis.com `
  storage.googleapis.com `
  --project $ProjectId

if (-not (Test-GcloudResource @("iam", "service-accounts", "describe", $ServiceAccountEmail, "--project", $ProjectId))) {
  gcloud iam service-accounts create $ServiceAccountId `
    --project $ProjectId `
    --display-name $ServiceAccountDisplayName
}

gcloud projects add-iam-policy-binding $ProjectId `
  --member "serviceAccount:$ServiceAccountEmail" `
  --role "roles/datastore.user" `
  --condition=None

gcloud projects add-iam-policy-binding $ProjectId `
  --member "serviceAccount:$ServiceAccountEmail" `
  --role "roles/firebaseauth.viewer" `
  --condition=None

gcloud projects add-iam-policy-binding $ProjectId `
  --member "serviceAccount:$ServiceAccountEmail" `
  --role "roles/storage.objectViewer" `
  --condition=None

if (-not (Test-GcloudResource @("iam", "workload-identity-pools", "describe", $PoolId, "--project", $ProjectId, "--location", "global"))) {
  gcloud iam workload-identity-pools create $PoolId `
    --project $ProjectId `
    --location "global" `
    --display-name "Vercel OIDC"
}

if (-not (Test-GcloudResource @("iam", "workload-identity-pools", "providers", "describe", $ProviderId, "--project", $ProjectId, "--location", "global", "--workload-identity-pool", $PoolId))) {
  gcloud iam workload-identity-pools providers create-oidc $ProviderId `
    --project $ProjectId `
    --location "global" `
    --workload-identity-pool $PoolId `
    --display-name "Vercel" `
    --issuer-uri "https://oidc.vercel.com" `
    --allowed-audiences $Audience `
    --attribute-mapping "google.subject=assertion.sub,attribute.project_id=assertion.project_id,attribute.environment=assertion.environment"
}

$PrincipalSet = "principalSet://iam.googleapis.com/projects/$ProjectNumber/locations/global/workloadIdentityPools/$PoolId/attribute.project_id/$VercelProjectId"
if (-not $VercelProjectId) {
  Write-Warning "VercelProjectId was not provided. Skipping WorkloadIdentityUser binding. Set it to the prj_* value from Vercel project settings."
} else {
  gcloud iam service-accounts add-iam-policy-binding $ServiceAccountEmail `
    --project $ProjectId `
    --role "roles/iam.workloadIdentityUser" `
    --member $PrincipalSet
}

Write-Host ""
Write-Host "Set these Vercel env vars for Production and Preview:"
Write-Host "GOOGLE_CLOUD_PROJECT=$ProjectId"
Write-Host "GCP_PROJECT_ID=$ProjectId"
Write-Host "GCP_PROJECT_NUMBER=$ProjectNumber"
Write-Host "GCP_WORKLOAD_IDENTITY_POOL_ID=$PoolId"
Write-Host "GCP_WORKLOAD_IDENTITY_PROVIDER_ID=$ProviderId"
Write-Host "GCP_WORKLOAD_IDENTITY_AUDIENCE=$Audience"
Write-Host "GCP_SERVICE_ACCOUNT_EMAIL=$ServiceAccountEmail"
