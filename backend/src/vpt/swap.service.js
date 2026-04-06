const WalletService = require('../wallet/wallet.service');
const SettingsService = require('../admin/settings.service');

const BSC_TESTNET_CHAIN_ID = 97n;
const BSC_MAINNET_CHAIN_ID = 56n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * SwapService — Pure swap execution layer.
 * No ledger writes here. Caller (distribution engine) owns the ledger.
 * No private keys in logs. Ever.
 */

async function getConfig() {
  return {
    ENVIRONMENT: await SettingsService.get('ENVIRONMENT'),
    BSC_RPC: await SettingsService.get('BSC_RPC'),
    TREASURY_PRIVATE_KEY: await SettingsService.get('TREASURY_PRIVATE_KEY'),
    PANCAKE_ROUTER: await SettingsService.get('PANCAKE_ROUTER'),
    VPT_TOKEN: await SettingsService.get('VPT_TOKEN_ADDRESS'),
    WBNB: await SettingsService.get('WBNB_ADDRESS'),
    NGN_TO_BNB_RATE: await SettingsService.getNumber('NGN_TO_BNB_RATE'),
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

function isConfiguredAddress(address) {
  return Boolean(address) && address !== ZERO_ADDRESS;
}

function getRequiredChainId(environment) {
  if (environment === 'staging') return BSC_TESTNET_CHAIN_ID;
  if (environment === 'production') return BSC_MAINNET_CHAIN_ID;
  return null;
}

function getChainLabel(chainId) {
  if (chainId === BSC_TESTNET_CHAIN_ID) return 'bsc-testnet';
  if (chainId === BSC_MAINNET_CHAIN_ID) return 'bsc-mainnet';
  return `chain-${chainId}`;
}

function validateStaticBlockchainConfig(config, ethers) {
  const missing = [];

  if (!config.BSC_RPC) missing.push('BSC_RPC');
  if (!config.TREASURY_PRIVATE_KEY) missing.push('TREASURY_PRIVATE_KEY');
  if (!isConfiguredAddress(config.PANCAKE_ROUTER)) missing.push('PANCAKE_ROUTER');
  if (!isConfiguredAddress(config.VPT_TOKEN)) missing.push('VPT_TOKEN_ADDRESS');
  if (!isConfiguredAddress(config.WBNB)) missing.push('WBNB_ADDRESS');

  if (missing.length) {
    throw new Error(`Blockchain configuration incomplete: ${missing.join(', ')}`);
  }

  if (!ethers || !ethers.JsonRpcProvider || !ethers.Wallet || !ethers.Contract || !ethers.isAddress) {
    throw new Error('ethers runtime unavailable for blockchain execution');
  }

  const invalidAddresses = [];
  if (!ethers.isAddress(config.PANCAKE_ROUTER)) invalidAddresses.push('PANCAKE_ROUTER');
  if (!ethers.isAddress(config.VPT_TOKEN)) invalidAddresses.push('VPT_TOKEN_ADDRESS');
  if (!ethers.isAddress(config.WBNB)) invalidAddresses.push('WBNB_ADDRESS');

  if (invalidAddresses.length) {
    throw new Error(`Invalid blockchain address configuration: ${invalidAddresses.join(', ')}`);
  }
}

function getMissingBlockchainSettings(config) {
  const missing = [];

  if (!config.BSC_RPC) missing.push('BSC_RPC');
  if (!config.TREASURY_PRIVATE_KEY) missing.push('TREASURY_PRIVATE_KEY');
  if (!isConfiguredAddress(config.PANCAKE_ROUTER)) missing.push('PANCAKE_ROUTER');
  if (!isConfiguredAddress(config.VPT_TOKEN)) missing.push('VPT_TOKEN_ADDRESS');
  if (!isConfiguredAddress(config.WBNB)) missing.push('WBNB_ADDRESS');

  return missing;
}

async function getBlockchainReadiness() {
  const ethers = await WalletService.getEthers();
  const config = await getConfig();
  const missing = getMissingBlockchainSettings(config);

  if (!ethers || !ethers.JsonRpcProvider || !ethers.Wallet || !ethers.Contract || !ethers.isAddress) {
    return {
      ready: false,
      environment: config.ENVIRONMENT,
      missing,
      error: 'ethers runtime unavailable for blockchain execution',
    };
  }

  const invalid = [];
  if (config.PANCAKE_ROUTER && !ethers.isAddress(config.PANCAKE_ROUTER)) invalid.push('PANCAKE_ROUTER');
  if (config.VPT_TOKEN && !ethers.isAddress(config.VPT_TOKEN)) invalid.push('VPT_TOKEN_ADDRESS');
  if (config.WBNB && !ethers.isAddress(config.WBNB)) invalid.push('WBNB_ADDRESS');

  if (missing.length || invalid.length) {
    return {
      ready: false,
      environment: config.ENVIRONMENT,
      missing,
      invalid,
      error: missing.length
        ? `Blockchain configuration incomplete: ${missing.join(', ')}`
        : `Invalid blockchain address configuration: ${invalid.join(', ')}`,
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(config.BSC_RPC);
    const wallet = new ethers.Wallet(config.TREASURY_PRIVATE_KEY, provider);
    const network = await provider.getNetwork();
    const expectedChainId = getRequiredChainId(config.ENVIRONMENT);
    const chainMatches = expectedChainId === null || network.chainId === expectedChainId;

    return {
      ready: chainMatches,
      environment: config.ENVIRONMENT,
      missing: [],
      invalid: [],
      treasury_address: wallet.address,
      chain_id: network.chainId.toString(),
      expected_chain_id: expectedChainId ? expectedChainId.toString() : null,
      chain_label: getChainLabel(network.chainId),
      router: config.PANCAKE_ROUTER,
      token: config.VPT_TOKEN,
      wbnb: config.WBNB,
      error: chainMatches
        ? null
        : `Chain validation failed for ${config.ENVIRONMENT}: expected ${getChainLabel(expectedChainId)}, got ${getChainLabel(network.chainId)}`,
    };
  } catch (error) {
    return {
      ready: false,
      environment: config.ENVIRONMENT,
      missing: [],
      invalid: [],
      error: error.message,
    };
  }
}

async function getBlockchainContext() {
  const ethers = await WalletService.getEthers();
  const config = await getConfig();

  validateStaticBlockchainConfig(config, ethers);

  const provider = new ethers.JsonRpcProvider(config.BSC_RPC);
  const wallet = new ethers.Wallet(config.TREASURY_PRIVATE_KEY, provider);
  const network = await provider.getNetwork();
  const expectedChainId = getRequiredChainId(config.ENVIRONMENT);

  if (expectedChainId !== null && network.chainId !== expectedChainId) {
    throw new Error(
      `Chain validation failed for ${config.ENVIRONMENT}: expected ${getChainLabel(expectedChainId)}, got ${getChainLabel(network.chainId)}`
    );
  }

  return {
    mode: 'chain',
    ethers,
    config,
    provider,
    wallet,
    network,
  };
}

async function ensureChainExecutionContext() {
  const context = await getBlockchainContext();
  return context;
}

async function formatTokenAmount(amountWei, ethersOverride) {
  const ethers = ethersOverride || await WalletService.getEthers();
  if (!ethers) {
    throw new Error('ethers runtime unavailable for token formatting');
  }

  return parseFloat(ethers.formatUnits(BigInt(amountWei), 18));
}

/**
 * Convert NGN to BNB using admin-configurable rate.
 */
async function convertNGNtoBNB(ngnAmount) {
  const { NGN_TO_BNB_RATE } = await getConfig();
  return ngnAmount * NGN_TO_BNB_RATE;
}

/**
 * Compatibility helper retained for legacy callers.
 */
async function isDevMode() {
  return false;
}

/**
 * Buy vPT tokens via PancakeSwap.
 * Returns { txHash, vptAmountWei, vptAmount } — no ledger writes.
 */
async function buyVPT(amountBNB) {
  const context = await ensureChainExecutionContext();
  const { ethers, config } = context;

  const { provider, wallet: treasuryWallet } = context;

  if (!provider || !treasuryWallet) {
    throw new Error('Blockchain context missing provider or treasury wallet');
  }

  const router = new ethers.Contract(config.PANCAKE_ROUTER, ROUTER_ABI, treasuryWallet);
  const treasuryBalance = await provider.getBalance(treasuryWallet.address);
  const path = [config.WBNB, config.VPT_TOKEN];
  const deadline = Math.floor(Date.now() / 1000) + 300;
  const value = ethers.parseEther(amountBNB.toString());

  if (treasuryBalance < value) {
    throw new Error('Treasury BNB balance is insufficient for swap execution');
  }

  if (path[0].toLowerCase() === path[1].toLowerCase()) {
    throw new Error('Swap path is invalid: WBNB and vPT token addresses must differ');
  }

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
  const vptAmountWei = parseReceivedVPT(receipt, config.VPT_TOKEN, treasuryWallet.address, ethers);

  if (vptAmountWei <= 0n) {
    throw new Error('Critical parse failure: no vPT transfer to treasury found in swap receipt');
  }

  const vptAmount = await formatTokenAmount(vptAmountWei, ethers);

  console.log(`[Swap] ${amountBNB} BNB → ${vptAmount} vPT (tx: ${receipt.hash})`);
  return { txHash: receipt.hash, vptAmountWei: vptAmountWei.toString(), vptAmount };
}

/**
 * Parse Transfer event logs to extract received vPT amount.
 * This is the CORRECT way — not balance checks.
 */
function parseReceivedVPT(receipt, vptTokenAddress, recipientAddress, ethers) {
  const vptLower = vptTokenAddress.toLowerCase();
  const recipientLower = recipientAddress.toLowerCase();
  const transferInterface = new ethers.Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ]);
  let total = 0n;

  for (const log of receipt.logs || []) {
    if (log.address.toLowerCase() !== vptLower) continue;

    try {
      const parsed = transferInterface.parseLog(log);
      if (parsed?.name !== 'Transfer') continue;
      if (String(parsed.args.to).toLowerCase() !== recipientLower) continue;
      total += BigInt(parsed.args.value.toString());
    } catch {
      continue;
    }
  }

  return total;
}

/**
 * Transfer vPT from treasury to a creator's BSC wallet.
 * Returns { txHash, amountWei, amount } — no ledger writes.
 */
async function sendVPT(toAddress, amountWei) {
  const context = await ensureChainExecutionContext();
  const { ethers, config } = context;

  if (!ethers.isAddress(toAddress)) {
    throw new Error('Recipient wallet address is invalid');
  }

  const treasuryWallet = context.wallet;
  const tokenContract = new ethers.Contract(config.VPT_TOKEN, ERC20_ABI, treasuryWallet);
  const parsedAmount = BigInt(amountWei);

  if (parsedAmount <= 0n) {
    throw new Error('Transfer amount must be greater than zero');
  }

  let gasLimit;
  try {
    const estimated = await tokenContract.transfer.estimateGas(toAddress, parsedAmount);
    gasLimit = (estimated * 120n) / 100n;
  } catch {
    gasLimit = 100000n;
  }

  const tx = await tokenContract.transfer(toAddress, parsedAmount, { gasLimit });
  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    amountWei: parsedAmount.toString(),
    amount: await formatTokenAmount(parsedAmount, ethers),
  };
}

/**
 * Get estimated vPT output for a given BNB amount.
 */
async function getVPTQuote(amountBNB) {
  const context = await ensureChainExecutionContext();
  const { ethers, config } = context;

  const router = new ethers.Contract(config.PANCAKE_ROUTER, ROUTER_ABI, context.provider);
  const path = [config.WBNB, config.VPT_TOKEN];
  const value = ethers.parseEther(amountBNB.toString());

  const amounts = await router.getAmountsOut(value, path);
  return await formatTokenAmount(amounts[1], ethers);
}

/**
 * Get treasury wallet BNB balance (admin visibility).
 */
async function getTreasuryBalance() {
  const context = await ensureChainExecutionContext();
  const { ethers, config } = context;

  const provider = context.provider;
  const treasuryWallet = context.wallet;

  const bnbBalance = parseFloat(ethers.formatEther(await provider.getBalance(treasuryWallet.address)));

  const tokenContract = new ethers.Contract(config.VPT_TOKEN, ERC20_ABI, provider);
  const vptBalanceWei = await tokenContract.balanceOf(treasuryWallet.address);
  const vptBalance = await formatTokenAmount(vptBalanceWei, ethers);

  return {
    bnb: bnbBalance,
    vpt: vptBalance,
    vpt_wei: vptBalanceWei.toString(),
    address: treasuryWallet.address,
    mode: context.config.ENVIRONMENT,
  };
}

module.exports = {
  getBlockchainReadiness,
  getBlockchainContext,
  ensureChainExecutionContext,
  formatTokenAmount,
  buyVPT,
  sendVPT,
  getVPTQuote,
  convertNGNtoBNB,
  getTreasuryBalance,
  isDevMode,
};
