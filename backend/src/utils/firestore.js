const admin = require('firebase-admin');

let dbInstance = null;

function getProjectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || undefined;
}

function initializeFirestore() {
  if (dbInstance) return dbInstance;

  try {
    if (!admin.apps.length) {
      const options = {};
      const projectId = getProjectId();
      if (projectId) options.projectId = projectId;

      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        ...options,
      });
    }

    dbInstance = admin.firestore();
    return dbInstance;
  } catch (error) {
    const guidance = [
      'Firestore unavailable.',
      error.message,
      'For local development, set GOOGLE_APPLICATION_CREDENTIALS to a Firebase or Google Cloud service-account JSON file and set FIREBASE_PROJECT_ID if needed.',
      'On Cloud Run, Application Default Credentials are provided automatically.',
    ].join(' ');
    throw new Error(guidance);
  }
}

function getFirestore() {
  return initializeFirestore();
}

module.exports = {
  getFirestore,
};