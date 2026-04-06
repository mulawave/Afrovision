@echo off
echo === Starting Website Deploy ===
echo %date% %time%
cd /d c:\Users\HomePC\Documents\AfroVision_web\Afrovision\website

echo.
echo === Deploying Website to Cloud Run ===
call gcloud run deploy afrovision-website --source . --region us-central1 --port 8080 --allow-unauthenticated --memory 1Gi --timeout 60 --set-env-vars "NODE_ENV=production" --set-build-env-vars "NEXT_PUBLIC_API_URL=https://afrovision-backend-134538542038.us-central1.run.app" --quiet

echo.
echo === Deploy Exit Code: %ERRORLEVEL% ===
echo %date% %time%
echo === Done ===
