#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  AfroVision Backend — Google Cloud Run Deployment Script
#  Usage: ./deploy.sh [PROJECT_ID] [REGION]
#  Defaults: PROJECT_ID=raven-ai-6ff76  REGION=us-central1
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="${1:-raven-ai-6ff76}"
REGION="${2:-us-central1}"
SERVICE_NAME="afrovision-backend"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AfroVision — Deploying to Cloud Run"
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo "  Service : ${SERVICE_NAME}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 0. Prerequisites check ─────────────────────────────────────────────────
command -v gcloud >/dev/null 2>&1 || { echo "ERROR: gcloud CLI not found. Install from https://cloud.google.com/sdk"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker not found. Install from https://docker.com"; exit 1; }

# ── 1. Set active project ──────────────────────────────────────────────────
gcloud config set project "${PROJECT_ID}"

# ── 2. Enable required APIs (idempotent) ───────────────────────────────────
echo "→ Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  --quiet

# ── 3. Grant Cloud Run service account Firestore access ───────────────────
#  The default Compute Engine SA is used by Cloud Run.
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
CLOUD_RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "→ Granting Firestore access to Cloud Run service account..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_RUN_SA}" \
  --role="roles/datastore.user" \
  --quiet

# ── 4. Configure Docker to push to GCR ────────────────────────────────────
echo "→ Configuring Docker auth for GCR..."
gcloud auth configure-docker --quiet

# ── 5. Build Docker image ──────────────────────────────────────────────────
echo "→ Building Docker image..."
docker build --platform linux/amd64 -t "${IMAGE}" .

# ── 6. Push image to Container Registry ───────────────────────────────────
echo "→ Pushing image to GCR..."
docker push "${IMAGE}"

# ── 7. Deploy to Cloud Run ─────────────────────────────────────────────────
echo "→ Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --platform managed \
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

# ── 8. Print service URL ───────────────────────────────────────────────────
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --format="value(status.url)")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deployment complete!"
echo "  🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "  Next steps:"
echo "  1. Update Flutter AppConfig.baseUrl to: ${SERVICE_URL}"
echo "  2. Set ALLOWED_ORIGINS if restricting CORS:"
echo "     gcloud run services update ${SERVICE_NAME} \\"
echo "       --region ${REGION} \\"
echo "       --update-env-vars ALLOWED_ORIGINS=https://your-flutter-app-domain"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
