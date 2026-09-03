@echo off
echo Applying CORS configuration to GCS bucket...
gsutil cors set cors.json gs://afrovision-media
echo.
echo CORS configuration applied successfully!
echo.
echo Verifying CORS configuration:
gsutil cors get gs://afrovision-media
