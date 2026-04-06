const { getFirestore } = require('../src/utils/firestore');

function printGuidance(error) {
  console.error('Firestore connection failed.');
  console.error(error.message);
  console.error('Fix for local development:');
  console.error('1. Download a service-account JSON from Firebase or Google Cloud.');
  console.error('2. Set GOOGLE_APPLICATION_CREDENTIALS to that file path.');
  console.error('3. Set FIREBASE_PROJECT_ID if your environment does not already provide it.');
}

process.on('unhandledRejection', (error) => {
  printGuidance(error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  printGuidance(error);
  process.exit(1);
});

async function main() {
  try {
    const db = getFirestore();
    await db.listCollections();
    console.log('Firestore connection OK');
    console.log(`Project: ${process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'auto-detected'}`);
  } catch (error) {
    printGuidance(error);
    process.exit(1);
  }
}

main();