#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  AfroVision — Full Deployment Script
#  Deploys: Backend, Website, Admin → Cloud Run + Firebase Hosting
#  Domain:  afrovision.online
#  Usage:   ./deploy_all.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="raven-ai-6ff76"
REGION="us-central1"
DOMAIN="afrovision.online"

# Cloud Run service names
BACKEND_SERVICE="afrovision-backend"
WEBSITE_SERVICE="afrovision-website"
ADMIN_SERVICE="afrovision-admin"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AfroVision — Full Stack Deployment"
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo "  Domain  : ${DOMAIN}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 0. Prerequisites ─────────────────────────────────────────────────────
command -v gcloud >/dev/null 2>&1 || { echo "ERROR: gcloud CLI not found."; exit 1; }
command -v firebase >/dev/null 2>&1 || { echo "ERROR: firebase CLI not found. Run: npm install -g firebase-tools"; exit 1; }

gcloud config set project "${PROJECT_ID}" --quiet

# ── 1. Enable APIs ──────────────────────────────────────────────────────
echo "→ [1/8] Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  --quiet

# ── 2. Deploy Backend ──────────────────────────────────────────────────
echo ""
echo "→ [2/8] Deploying Backend to Cloud Run..."
cd backend
gcloud run deploy "${BACKEND_SERVICE}" \
  --source . \
  --region "${REGION}" \
  --port 8080 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 60 \
  --set-env-vars "FIREBASE_PROJECT_ID=${PROJECT_ID}" \
  --quiet
cd ..

BACKEND_URL=$(gcloud run services describe "${BACKEND_SERVICE}" \
  --platform managed --region "${REGION}" --format="value(status.url)")
echo "  ✅ Backend deployed: ${BACKEND_URL}"

# ── 3. Deploy Website ──────────────────────────────────────────────────
echo ""
echo "→ [3/8] Deploying Website to Cloud Run..."
cd website
gcloud run deploy "${WEBSITE_SERVICE}" \
  --source . \
  --region "${REGION}" \
  --port 8080 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 60 \
  --set-env-vars "NEXT_PUBLIC_API_URL=${BACKEND_URL},HOSTNAME=0.0.0.0,PORT=8080" \
  --quiet
cd ..

WEBSITE_URL=$(gcloud run services describe "${WEBSITE_SERVICE}" \
  --platform managed --region "${REGION}" --format="value(status.url)")
echo "  ✅ Website deployed: ${WEBSITE_URL}"

# ── 4. Deploy Admin ───────────────────────────────────────────────────
echo ""
echo "→ [4/8] Deploying Admin to Cloud Run..."
cd admin
gcloud run deploy "${ADMIN_SERVICE}" \
  --source . \
  --region "${REGION}" \
  --port 8080 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 60 \
  --set-env-vars "NEXT_PUBLIC_API_BASE_URL=${BACKEND_URL},HOSTNAME=0.0.0.0,PORT=8080" \
  --quiet
cd ..

ADMIN_URL=$(gcloud run services describe "${ADMIN_SERVICE}" \
  --platform managed --region "${REGION}" --format="value(status.url)")
echo "  ✅ Admin deployed: ${ADMIN_URL}"

# ── 5. Update CORS on Backend ────────────────────────────────────────
echo ""
echo "→ [5/8] Updating Backend CORS..."
ALLOWED="${WEBSITE_URL},${ADMIN_URL},https://${DOMAIN},https://admin.${DOMAIN}"
gcloud run services update "${BACKEND_SERVICE}" \
  --region "${REGION}" \
  --update-env-vars "ALLOWED_ORIGINS=${ALLOWED}" \
  --quiet
echo "  ✅ CORS updated"

# ── 6. Firebase Hosting Setup ────────────────────────────────────────
echo ""
echo "→ [6/8] Creating Firebase Hosting sites..."

# Create hosting sites (ignore errors if already exist)
firebase hosting:sites:create "${WEBSITE_SERVICE}" --project "${PROJECT_ID}" 2>/dev/null || true
firebase hosting:sites:create "${ADMIN_SERVICE}" --project "${PROJECT_ID}" 2>/dev/null || true

echo "  ✅ Hosting sites ready"

# ── 7. Deploy Firebase Hosting ───────────────────────────────────────
echo ""
echo "→ [7/8] Deploying Firebase Hosting rewrites..."
firebase deploy --only hosting --project "${PROJECT_ID}"
echo "  ✅ Firebase Hosting deployed"

# ── 8. Custom Domain ─────────────────────────────────────────────────
echo ""
echo "→ [8/8] Custom domain setup..."
echo ""
echo "  To connect ${DOMAIN} to Firebase Hosting, run:"
echo ""
echo "    firebase hosting:channel:deploy live --site ${WEBSITE_SERVICE}"
echo ""
echo "  Then add your custom domain in the Firebase Console:"
echo "    https://console.firebase.google.com/project/${PROJECT_ID}/hosting/sites"
echo ""
echo "  DNS records to add at your domain registrar:"
echo "    ┌──────────────────────────────────────────────────┐"
echo "    │ Type  │ Host    │ Value                          │"
echo "    ├──────────────────────────────────────────────────┤"
echo "    │ A     │ @       │ 151.101.1.195                  │"
echo "    │ A     │ @       │ 151.101.65.195                 │"
echo "    │ CNAME │ admin   │ ${ADMIN_SERVICE}.web.app       │"
echo "    │ TXT   │ @       │ (from Firebase Console)        │"
echo "    └──────────────────────────────────────────────────┘"
echo ""
echo "  Note: Firebase will provide exact DNS records in the console."
echo "  The A records above are generic — use the ones Firebase gives you."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Full Deployment Complete!"
echo ""
echo "  Backend : ${BACKEND_URL}"
echo "  Website : ${WEBSITE_URL}"
echo "  Admin   : ${ADMIN_URL}"
echo ""
echo "  Pending: Add custom domain ${DOMAIN} in Firebase Console"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
