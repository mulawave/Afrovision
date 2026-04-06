@echo off
echo === Starting Backend Deploy ===
echo %date% %time%
cd /d %~dp0

echo.
echo === Deploying to Cloud Run ===
call gcloud run deploy afrovision-backend --source . --region us-central1 --port 8080 --allow-unauthenticated --memory 512Mi --timeout 60 --set-env-vars "FIREBASE_PROJECT_ID=raven-ai-6ff76,GCS_BUCKET=afrovision-media,ADMIN_PASSWORD=AfroVision@Admin2026!" --quiet

echo.
echo === Deploy Exit Code: %ERRORLEVEL% ===
echo %date% %time%
echo === Done ===
