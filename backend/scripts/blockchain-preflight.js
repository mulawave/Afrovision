const SettingsService = require('../src/admin/settings.service');
const SwapService = require('../src/vpt/swap.service');

function printFailure(error) {
  console.error('Blockchain preflight failed.');
  console.error(error.message);
  if (String(error.message).includes('default credentials')) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS for local execution before rerunning this command.');
  }
}

process.on('unhandledRejection', (error) => {
  printFailure(error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  printFailure(error);
  process.exit(1);
});

async function main() {
  try {
    await SettingsService.ensureDefinitionsExist();
    await SettingsService.ensureStagingSecrets();
    const readiness = await SwapService.getBlockchainReadiness();
    console.log(JSON.stringify(readiness, null, 2));

    if (!readiness.ready) {
      process.exit(2);
    }
  } catch (error) {
    printFailure(error);
    process.exit(1);
  }
}

main();