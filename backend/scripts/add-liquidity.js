/**
 * Add tVPT/BNB liquidity to PancakeSwap on BSC Testnet.
 *
 * Reads TREASURY_PRIVATE_KEY, VPT_TOKEN_ADDRESS, PANCAKE_ROUTER, and BSC_RPC
 * from Firestore settings. The treasury wallet must hold both tVPT tokens and
 * testnet BNB.
 *
 * Usage:
 *   node scripts/add-liquidity.js [tokenAmount] [bnbAmount]
 *
 * Defaults: 1,000,000 tVPT + 1 BNB
 */

const SettingsService = require('../src/admin/settings.service');

const ROUTER_ABI = [
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

async function main() {
  await SettingsService.ensureDefinitionsExist();

  const [bscRpc, treasuryKey, tokenAddress, routerAddress] = await Promise.all([
    SettingsService.get('BSC_RPC'),
    SettingsService.get('TREASURY_PRIVATE_KEY'),
    SettingsService.get('VPT_TOKEN_ADDRESS'),
    SettingsService.get('PANCAKE_ROUTER'),
  ]);

  if (!treasuryKey) {
    console.error('TREASURY_PRIVATE_KEY not set. Start the server first to auto-generate it.');
    process.exit(1);
  }

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  if (!tokenAddress || tokenAddress === ZERO_ADDRESS) {
    console.error('VPT_TOKEN_ADDRESS not set. Deploy the token first: npm run deploy:testnet');
    process.exit(1);
  }

  const mod = await import('ethers');
  const ethers = mod.ethers || mod;

  const provider = new ethers.JsonRpcProvider(bscRpc);
  const wallet = new ethers.Wallet(treasuryKey, provider);
  console.log('Wallet address:', wallet.address);

  const bnbBalance = await provider.getBalance(wallet.address);
  console.log('BNB balance:', ethers.formatEther(bnbBalance));

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const tokenBalance = await token.balanceOf(wallet.address);
  console.log('tVPT balance:', ethers.formatUnits(tokenBalance, 18));

  // Parse amounts from CLI args or use defaults
  const tokenAmountHuman = process.argv[2] || '1000000';
  const bnbAmountHuman = process.argv[3] || '1';
  const tokenAmount = ethers.parseUnits(tokenAmountHuman, 18);
  const bnbAmount = ethers.parseEther(bnbAmountHuman);

  console.log(`\nAdding liquidity: ${tokenAmountHuman} tVPT + ${bnbAmountHuman} BNB`);

  if (tokenBalance < tokenAmount) {
    console.error(`Insufficient tVPT. Have ${ethers.formatUnits(tokenBalance, 18)}, need ${tokenAmountHuman}`);
    process.exit(1);
  }

  if (bnbBalance < bnbAmount) {
    console.error(`Insufficient BNB. Have ${ethers.formatEther(bnbBalance)}, need ${bnbAmountHuman}`);
    process.exit(1);
  }

  // Approve router to spend tokens
  console.log('Approving router to spend tVPT...');
  const approveTx = await token.approve(routerAddress, tokenAmount);
  await approveTx.wait();
  console.log('Approved. TX:', approveTx.hash);

  // Add liquidity
  const router = new ethers.Contract(routerAddress, ROUTER_ABI, wallet);
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes

  console.log('Adding liquidity to PancakeSwap...');
  const tx = await router.addLiquidityETH(
    tokenAddress,
    tokenAmount,
    0,      // amountTokenMin — accept any for testnet
    0,      // amountETHMin — accept any for testnet
    wallet.address,
    deadline,
    { value: bnbAmount }
  );

  const receipt = await tx.wait();
  console.log('\nLiquidity added successfully!');
  console.log('TX hash:', receipt.hash);
  console.log('Explorer: https://testnet.bscscan.com/tx/' + receipt.hash);
  console.log('\nPancakeSwap pool is now ready for vPT swaps.');

  process.exit(0);
}

main().catch((error) => {
  console.error('Failed to add liquidity:', error.message);
  process.exit(1);
});
