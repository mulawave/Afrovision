# ─────────────────────────────────────────────────────────────────────────────
#  AfroVision — Full Deployment Script (PowerShell)
#  Deploys: Backend, Website, Admin → Cloud Run + Firebase Hosting
#  Domain:  afrovision.online
#  Usage:   .\deploy_all.ps1
# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"

$PROJECT_ID = "raven-ai-6ff76"
$REGION = "us-central1"
$DOMAIN = "afrovision.online"
$BACKEND_SERVICE = "afrovision-backend"
$WEBSITE_SERVICE = "afrovision-website"
$ADMIN_SERVICE = "afrovision-admin"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  AfroVision — Full Stack Deployment" -ForegroundColor Cyan
Write-Host "  Project : $PROJECT_ID"
Write-Host "  Region  : $REGION"
Write-Host "  Domain  : $DOMAIN"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# ── 0. Prerequisites ─────────────────────────────────────────────────────
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: gcloud CLI not found." -ForegroundColor Red; exit 1
}
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: firebase CLI not found. Run: npm install -g firebase-tools" -ForegroundColor Red; exit 1
}

gcloud config set project $PROJECT_ID --quiet 2>$null

# ── 1. Enable APIs ──────────────────────────────────────────────────────
Write-Host "→ [1/8] Enabling required GCP APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com --quiet
Write-Host "  ✅ APIs enabled" -ForegroundColor Green

# ── 2. Deploy Backend ──────────────────────────────────────────────────
Write-Host ""
Write-Host "→ [2/8] Deploying Backend to Cloud Run..." -ForegroundColor Yellow
Push-Location backend
gcloud run deploy $BACKEND_SERVICE `
  --source . `
  --region $REGION `
  --port 8080 `
  --allow-unauthenticated `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 5 `
  --timeout 60 `
  --set-env-vars "FIREBASE_PROJECT_ID=$PROJECT_ID" `
  --quiet
Pop-Location

$BACKEND_URL = (gcloud run services describe $BACKEND_SERVICE --platform managed --region $REGION --format="value(status.url)").Trim()
Write-Host "  ✅ Backend deployed: $BACKEND_URL" -ForegroundColor Green

# ── 3. Deploy Website ──────────────────────────────────────────────────
Write-Host ""
Write-Host "→ [3/8] Deploying Website to Cloud Run..." -ForegroundColor Yellow
Push-Location website
gcloud run deploy $WEBSITE_SERVICE `
  --source . `
  --region $REGION `
  --port 8080 `
  --allow-unauthenticated `
  --memory 1Gi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 5 `
  --timeout 60 `
  --set-env-vars "NEXT_PUBLIC_API_URL=$BACKEND_URL,HOSTNAME=0.0.0.0,PORT=8080" `
  --quiet
Pop-Location

$WEBSITE_URL = (gcloud run services describe $WEBSITE_SERVICE --platform managed --region $REGION --format="value(status.url)").Trim()
Write-Host "  ✅ Website deployed: $WEBSITE_URL" -ForegroundColor Green

# ── 4. Deploy Admin ───────────────────────────────────────────────────
Write-Host ""
Write-Host "→ [4/8] Deploying Admin to Cloud Run..." -ForegroundColor Yellow
Push-Location admin
gcloud run deploy $ADMIN_SERVICE `
  --source . `
  --region $REGION `
  --port 8080 `
  --allow-unauthenticated `
  --memory 1Gi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 3 `
  --timeout 60 `
  --set-env-vars "NEXT_PUBLIC_API_BASE_URL=$BACKEND_URL,HOSTNAME=0.0.0.0,PORT=8080" `
  --quiet
Pop-Location

$ADMIN_URL = (gcloud run services describe $ADMIN_SERVICE --platform managed --region $REGION --format="value(status.url)").Trim()
Write-Host "  ✅ Admin deployed: $ADMIN_URL" -ForegroundColor Green

# ── 5. Update CORS on Backend ────────────────────────────────────────
Write-Host ""
Write-Host "→ [5/8] Updating Backend CORS..." -ForegroundColor Yellow
$ALLOWED = "$WEBSITE_URL,$ADMIN_URL,https://$DOMAIN,https://admin.$DOMAIN"
gcloud run services update $BACKEND_SERVICE `
  --region $REGION `
  --update-env-vars "ALLOWED_ORIGINS=$ALLOWED" `
  --quiet
Write-Host "  ✅ CORS updated" -ForegroundColor Green

# ── 6. Firebase Login Check ──────────────────────────────────────────
Write-Host ""
Write-Host "→ [6/8] Checking Firebase authentication..." -ForegroundColor Yellow
$fbCheck = firebase projects:list --project $PROJECT_ID 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Firebase not logged in. Running firebase login..." -ForegroundColor Yellow
    firebase login
}
Write-Host "  ✅ Firebase authenticated" -ForegroundColor Green

# ── 7. Firebase Hosting Setup & Deploy ───────────────────────────────
Write-Host ""
Write-Host "→ [7/8] Setting up Firebase Hosting..." -ForegroundColor Yellow

# Create hosting sites (ignore errors if already exist)
firebase hosting:sites:create $WEBSITE_SERVICE --project $PROJECT_ID 2>$null
firebase hosting:sites:create $ADMIN_SERVICE --project $PROJECT_ID 2>$null

firebase deploy --only hosting --project $PROJECT_ID
Write-Host "  ✅ Firebase Hosting deployed" -ForegroundColor Green

# ── 8. Summary ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  ✅ Full Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend : $BACKEND_URL"
Write-Host "  Website : $WEBSITE_URL"
Write-Host "  Admin   : $ADMIN_URL"
Write-Host ""
Write-Host "  Firebase Hosting URLs:" -ForegroundColor Yellow
Write-Host "    Website: https://${WEBSITE_SERVICE}.web.app"
Write-Host "    Admin  : https://${ADMIN_SERVICE}.web.app"
Write-Host ""
Write-Host "  ─── Custom Domain Setup ───" -ForegroundColor Yellow
Write-Host "  Add custom domain in Firebase Console:"
Write-Host "    https://console.firebase.google.com/project/$PROJECT_ID/hosting/sites"
Write-Host ""
Write-Host "  DNS Records to add at your registrar for $DOMAIN :"
Write-Host "    Website (afrovision.online)        → See Firebase Console for A records"
Write-Host "    Admin   (admin.afrovision.online)   → CNAME → ${ADMIN_SERVICE}.web.app"
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
