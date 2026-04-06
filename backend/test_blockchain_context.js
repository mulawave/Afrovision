const SwapService = require('./src/vpt/swap.service');

async function main() {
  try {
    const readiness = await SwapService.getBlockchainReadiness();

    console.log(JSON.stringify(readiness, null, 2));

    if (!readiness.ready) {
      process.exit(1);
    }
  } catch (error) {
    console.error(JSON.stringify({
      error: error.message,
    }, null, 2));
    process.exit(1);
  }
}

main();
