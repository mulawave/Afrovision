const WalletService = require('../wallet/wallet.service');
const Settings = require('../admin/settings.model');
const crypto = require('crypto');

/**
 * SwapService — Pure swap execution layer.
 * No ledger writes here. Caller (distribution engine) owns the ledger.
 * No private keys in logs. Ever.
 */

function getConfig() {
  return {
    PANCAKE_ROUTER: Settings.get('PANCAKE_ROUTER'),
    VPT_TOKEN: Settings.get('VPT_TOKEN_ADDRESS'),
    WBNB: Settings.get('WBNB_ADDRESS'),
    NGN_TO_BNB_RATE: Settings.getNumber('NGN_TO_BNB_RATE') || 0.0000004,
  };
}

const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)',
];

const ERC20_ABI = [
  'function transfer(address to, uint amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

// Standard ERC-20 Transfer event topic
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/**
 * Convert NGN to BNB using admin-configurable rate.
 */
function convertNGNtoBNB(ngnAmount) {
  const { NGN_TO_BNB_RATE } = getConfig();
  return ngnAmount * NGN_TO_BNB_RATE;
}

/**
 * Check if we're in dev mode (no ethers or no treasury config).
 */
async function isDevMode() {
  const ethers = await WalletService.getEthers();
  return !ethers || !Settings.get('TREASURY_PRIVATE_KEY') || !Settings.get('BSC_RPC');
}

/**
 * Buy vPT tokens via PancakeSwap.
 * Returns { txHash, vptAmount } — no ledger writes.
 */
async function buyVPT(amountBNB) {
  const ethers = await WalletService.getEthers();
  const config = getConfig();
  const treasuryKey = Settings.get('TREASURY_PRIVATE_KEY');
  const bscRpc = Settings.get('BSC_RPC');

  if (!ethers || !treasuryKey || !bscRpc) {
    // Dev mode: simulate swap using real vPT price (₦750/vPT)
    const ngnTobnbRate = config.NGN_TO_BNB_RATE;
    const vptPrice = Settings.getNumber('VPT_PRICE_NGN') || 750;
    // Reverse BNB back to NGN, then convert at vPT price
    const ngnEquivalent = amountBNB / ngnTobnbRate;
    const simulatedVPT = Math.round((ngnEquivalent / vptPrice) * 100) / 100;
    const mockHash = '0x' + crypto.randomBytes(32).toString('hex');
    console.log(`[Swap] DEV: ${amountBNB} BNB (₦${ngnEquivalent}) → ${simulatedVPT} vPT @ ₦${vptPrice}/vPT`);
    return { txHash: mockHash, vptAmount: simulatedVPT };
  }

  // Production: PancakeSwap
  const provider = new ethers.JsonRpcProvider(bscRpc);
  const treasuryWallet = new ethers.Wallet(treasuryKey, provider);
  const router = new ethers.Contract(config.PANCAKE_ROUTER, ROUTER_ABI, treasuryWallet);

  const path = [config.WBNB, config.VPT_TOKEN];
  const deadline = Math.floor(Date.now() / 1000) + 300; // 5 min
  const value = ethers.parseEther(amountBNB.toString());

  let gasLimit;
  try {
    const estimated = await router.swapExactETHForTokens.estimateGas(
      0, path, treasuryWallet.address, deadline, { value }
    );
    gasLimit = (estimated * 120n) / 100n;
  } catch {
    gasLimit = 300000n;
  }

  const tx = await router.swapExactETHForTokens(
    0, path, treasuryWallet.address, deadline,
    { value, gasLimit }
  );

  const receipt = await tx.wait();

  // Parse received vPT from Transfer event logs (source of truth)
  const vptAmount = parseReceivedVPT(receipt, config.VPT_TOKEN, treasuryWallet.address, ethers);

  console.log(`[Swap] ${amountBNB} BNB → ${vptAmount} vPT (tx: ${receipt.hash})`);
  return { txHash: receipt.hash, vptAmount };
}

/**
 * Parse Transfer event logs to extract received vPT amount.
 * This is the CORRECT way — not balance checks.
 */
function parseReceivedVPT(receipt, vptTokenAddress, recipientAddress, ethers) {
  const vptLower = vptTokenAddress.toLowerCase();
  const recipientLower = recipientAddress.toLowerCase();

  for (const log of receipt.logs || []) {
    if (log.address.toLowerCase() !== vptLower) continue;
    if (!log.topics || log.topics[0] !== TRANSFER_TOPIC) continue;

    // topics[2] = recipient (padded to 32 bytes)
    const to = '0x' + log.topics[2].slice(26).toLowerCase();
    if (to !== recipientLower) continue;

    // data = amount (uint256)
    return parseFloat(ethers.formatUnits(log.data, 18));
  }

  // Fallback: could not parse from logs
  console.error('[Swap] WARNING: Could not parse vPT amount from tx receipt logs');
  return 0;
}

/**
 * Transfer vPT from treasury to a creator's BSC wallet.
 * Returns { txHash, amount } — no ledger writes.
 */
async function sendVPT(toAddress, amount) {
  const ethers = await WalletService.getEthers();
  const config = getConfig();
  const treasuryKey = Settings.get('TREASURY_PRIVATE_KEY');
  const bscRpc = Settings.get('BSC_RPC');

  if (!ethers || !treasuryKey || !bscRpc) {
    // Dev mode: simulate transfer
    const mockHash = '0x' + crypto.randomBytes(32).toString('hex');
    console.log(`[Swap] DEV: ${amount} vPT → ${toAddress}`);
    return { txHash: mockHash, amount };
  }

  // Production: ERC-20 transfer
  const provider = new ethers.JsonRpcProvider(bscRpc);
  const treasuryWallet = new ethers.Wallet(treasuryKey, provider);
  const tokenContract = new ethers.Contract(config.VPT_TOKEN, ERC20_ABI, treasuryWallet);

  const parsedAmount = ethers.parseUnits(amount.toString(), 18);

  let gasLimit;
  try {
    const estimated = await tokenContract.transfer.estimateGas(toAddress, parsedAmount);
    gasLimit = (estimated * 120n) / 100n;
  } catch {
    gasLimit = 100000n;
  }

  const tx = await tokenContract.transfer(toAddress, parsedAmount, { gasLimit });
  const receipt = await tx.wait();

  return { txHash: receipt.hash, amount };
}

/**
 * Get estimated vPT output for a given BNB amount.
 */
async function getVPTQuote(amountBNB) {
  const ethers = await WalletService.getEthers();
  const bscRpc = Settings.get('BSC_RPC');

  if (!ethers || !bscRpc) {
    return Math.round(amountBNB * 50000 * 100) / 100;
  }

  const provider = new ethers.JsonRpcProvider(bscRpc);
  const config = getConfig();
  const router = new ethers.Contract(config.PANCAKE_ROUTER, ROUTER_ABI, provider);
  const path = [config.WBNB, config.VPT_TOKEN];
  const value = ethers.parseEther(amountBNB.toString());

  const amounts = await router.getAmountsOut(value, path);
  return parseFloat(ethers.formatUnits(amounts[1], 18));
}

/**
 * Get treasury wallet BNB balance (admin visibility).
 */
async function getTreasuryBalance() {
  const ethers = await WalletService.getEthers();
  const treasuryKey = Settings.get('TREASURY_PRIVATE_KEY');
  const bscRpc = Settings.get('BSC_RPC');

  if (!ethers || !treasuryKey || !bscRpc) {
    return { bnb: 0, vpt: 0, address: 'DEV_MODE', mode: 'dev' };
  }

  const provider = new ethers.JsonRpcProvider(bscRpc);
  const treasuryWallet = new ethers.Wallet(treasuryKey, provider);
  const config = getConfig();

  const bnbBalance = parseFloat(ethers.formatEther(await provider.getBalance(treasuryWallet.address)));

  const tokenContract = new ethers.Contract(config.VPT_TOKEN, ERC20_ABI, provider);
  const vptBalance = parseFloat(ethers.formatUnits(await tokenContract.balanceOf(treasuryWallet.address), 18));

  return {
    bnb: bnbBalance,
    vpt: vptBalance,
    address: treasuryWallet.address,
    mode: 'production',
  };
}

module.exports = {
  buyVPT,
  sendVPT,
  getVPTQuote,
  convertNGNtoBNB,
  getTreasuryBalance,
  isDevMode,
};
