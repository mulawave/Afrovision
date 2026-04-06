/**
 * Deploy TestVPT token to BSC Testnet and save address to Firestore.
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=<key> npx hardhat run scripts/deploy.js --network bscTestnet
 *
 * Or via npm script:
 *   DEPLOYER_PRIVATE_KEY=<key> npm run deploy:testnet
 */

const hre = require('hardhat');
const SettingsService = require('../src/admin/settings.service');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying TestVPT with account:', deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', hre.ethers.formatEther(balance), 'BNB');

  if (balance === 0n) {
    console.error('ERROR: Deployer account has no BNB. Fund it first:');
    console.error('  https://testnet.bnbchain.org/faucet-smart');
    process.exit(1);
  }

  const TestVPT = await hre.ethers.getContractFactory('TestVPT');
  const token = await TestVPT.deploy();
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log('TestVPT deployed to:', address);
  console.log('Explorer: https://testnet.bscscan.com/address/' + address);

  // Save to Firestore settings
  try {
    await SettingsService.ensureDefinitionsExist();
    await SettingsService.set('VPT_TOKEN_ADDRESS', address, 'deploy-script');
    console.log('VPT_TOKEN_ADDRESS saved to Firestore');
  } catch (err) {
    console.error('Failed to save to Firestore (save manually):', err.message);
    console.log('Manual save: set VPT_TOKEN_ADDRESS =', address);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
