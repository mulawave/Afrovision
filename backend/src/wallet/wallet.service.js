const crypto = require('crypto');
const Wallet = require('./wallet.model');
const Ledger = require('../vpt/ledger.model');
const SettingsService = require('../admin/settings.service');
const { encryptWithSecret, decryptWithSecret } = require('../utils/crypto');

let ethersModule = null;

/**
 * Lazy-load ethers (ESM-only in v6).
 */
async function getEthers() {
  if (ethersModule) return ethersModule;
  try {
    const mod = await import('ethers');
    ethersModule = mod.ethers || mod;
    return ethersModule;
  } catch {
    return null;
  }
}

async function getSecret() {
  const secret = await SettingsService.get('WALLET_SECRET');
  if (!secret) {
    throw new Error('WALLET_SECRET is required in Firebase settings for wallet encryption');
  }
  return secret;
}

async function encrypt(text) {
  return encryptWithSecret(text, await getSecret());
}

async function decrypt(text) {
  return decryptWithSecret(text, await getSecret());
}

/**
 * Create a new BSC wallet for a user.
 * Uses ethers random wallet generation for staging/production environments.
 */
async function createWallet(userId) {
  const existing = Wallet.findByUserId(userId);
  if (existing) {
    return existing;
  }

  const ethers = await getEthers();

  if (!ethers || !ethers.Wallet) {
    throw new Error('ethers runtime unavailable for wallet creation');
  }

  const wallet = ethers.Wallet.createRandom();
  const address = wallet.address;
  const privateKey = wallet.privateKey;

  const encryptedKey = await encrypt(privateKey);

  const walletRecord = await Wallet.create({
    userId,
    bscAddress: address,
    encryptedPrivateKey: encryptedKey,
  });

  await Ledger.create({
    uid: userId,
    type: 'WALLET_CREATED',
    amount_ngn: 0,
    amount_vpt: 0,
    status: 'success',
    description: `BSC wallet created: ${address}`,
  });

  return walletRecord;
}

/**
 * Get or create wallet for user. Returns ethers Wallet instance.
 */
async function getWallet(userId) {
  let walletRecord = Wallet.findByUserId(userId);

  if (!walletRecord) {
    walletRecord = await createWallet(userId);
  }

  await Wallet.touchLastUsed(userId);

  const ethers = await getEthers();

  if (!ethers || !ethers.Wallet) {
    throw new Error('ethers runtime unavailable for wallet access');
  }

  const privateKey = await decrypt(walletRecord.encrypted_private_key);
  const provider = await getProvider(ethers);
  if (provider) {
    return new ethers.Wallet(privateKey, provider);
  }

  return new ethers.Wallet(privateKey);
}

/**
 * Get BSC JSON-RPC provider (production only).
 */
async function getProvider(ethers) {
  const rpc = await SettingsService.get('BSC_RPC');
  if (!rpc || !ethers.JsonRpcProvider) return null;
  return new ethers.JsonRpcProvider(rpc);
}

/**
 * Get wallet address for a user (safe — no private key exposed).
 */
async function getWalletAddress(userId) {
  let walletRecord = Wallet.findByUserId(userId);
  if (!walletRecord) {
    walletRecord = await createWallet(userId);
  }
  return walletRecord.bsc_address;
}

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

/**
 * Scan a BSC address for vPT and BNB balances.
 * Returns { vpt_balance_raw, vpt_balance, bnb_balance, address, token_address }.
 */
async function scanAddressBalance(address) {
  const ethers = await getEthers();
  if (!ethers) throw new Error('ethers runtime unavailable');

  const provider = await getProvider(ethers);
  if (!provider) throw new Error('BSC RPC not configured');

  const tokenAddress = await SettingsService.get('VPT_TOKEN_ADDRESS');
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  // BNB balance
  const bnbBalanceWei = await provider.getBalance(address);
  const bnbBalance = parseFloat(ethers.formatEther(bnbBalanceWei));

  // vPT balance (only if token contract is configured)
  let vptBalanceRaw = '0';
  let vptBalance = 0;
  if (tokenAddress && tokenAddress !== ZERO_ADDRESS) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const rawBal = await tokenContract.balanceOf(address);
    vptBalanceRaw = rawBal.toString();
    vptBalance = parseFloat(ethers.formatEther(rawBal));
  }

  return {
    address,
    vpt_balance_raw: vptBalanceRaw,
    vpt_balance: vptBalance,
    bnb_balance: bnbBalance,
    token_address: tokenAddress || null,
    token_configured: Boolean(tokenAddress && tokenAddress !== ZERO_ADDRESS),
  };
}

/**
 * Import external BSC address for a user.
 * Creates or updates wallet record to use the external address.
 * Updates user's blockchain_tokens with on-chain vPT balance.
 */
async function importExternalAddress(userId, address) {
  const User = require('../users/user.model');
  const user = User.findById(userId);
  if (!user) throw new Error('User not found');

  // Validate BSC address format
  const ethers = await getEthers();
  if (!ethers) throw new Error('ethers runtime unavailable');
  if (!ethers.isAddress(address)) throw new Error('Invalid BSC address format');

  // Check if address is already used by another user
  const existingWallet = Wallet.findByAddress(address);
  if (existingWallet && existingWallet.user_id !== userId) {
    throw new Error('This wallet address is already linked to another account');
  }

  // Scan the address for on-chain balances
  const balances = await scanAddressBalance(address);

  // Create or update wallet record
  let walletRecord = Wallet.findByUserId(userId);
  if (walletRecord) {
    await Wallet.updateBscAddress(userId, address);
    walletRecord = Wallet.findByUserId(userId);
  } else {
    // Create a wallet record without a private key (external wallet)
    walletRecord = await Wallet.create({
      userId,
      bscAddress: address,
      encryptedPrivateKey: '__external__',
    });
  }

  // Update user's blockchain_tokens with on-chain vPT raw balance
  if (balances.vpt_balance_raw !== '0') {
    await User.setBlockchainTokens(userId, balances.vpt_balance_raw);
  }

  // Log the import
  await Ledger.create({
    uid: userId,
    type: 'WALLET_IMPORTED',
    amount_ngn: 0,
    amount_vpt: balances.vpt_balance,
    status: 'success',
    description: `External wallet imported: ${address}`,
  });

  return {
    wallet: Wallet.toSafe(walletRecord),
    balances,
  };
}

/**
 * Transfer vPT from treasury to an external address.
 */
async function transferVptToExternal(userId, amount, toAddress) {
  const ethers = await getEthers();
  if (!ethers) throw new Error('ethers runtime unavailable');
  if (!ethers.isAddress(toAddress)) throw new Error('Invalid recipient address');
  if (amount <= 0) throw new Error('Amount must be greater than 0');

  const tokenAddress = await SettingsService.get('VPT_TOKEN_ADDRESS');
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  if (!tokenAddress || tokenAddress === ZERO_ADDRESS) {
    throw new Error('vPT token contract not configured');
  }

  // Get treasury wallet
  const treasuryKey = await SettingsService.get('TREASURY_PRIVATE_KEY');
  if (!treasuryKey) throw new Error('Treasury wallet not configured');

  const provider = await getProvider(ethers);
  if (!provider) throw new Error('BSC RPC not configured');

  const treasuryWallet = new ethers.Wallet(treasuryKey, provider);
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, treasuryWallet);
  const amountWei = ethers.parseEther(String(amount));

  const tx = await tokenContract.transfer(toAddress, amountWei);
  const receipt = await tx.wait();

  await Ledger.create({
    uid: userId,
    type: 'VPT_TRANSFER_OUT',
    direction: 'debit',
    currency: 'vpt',
    amount_ngn: 0,
    amount_vpt: amount,
    status: 'success',
    description: `Transferred ${amount} vPT to ${toAddress}`,
    tx_hash: receipt.hash,
  });

  return { tx_hash: receipt.hash, amount, to: toAddress };
}

/**
 * Transfer BNB from treasury to an external address.
 */
async function transferBnbToExternal(userId, amount, toAddress) {
  const ethers = await getEthers();
  if (!ethers) throw new Error('ethers runtime unavailable');
  if (!ethers.isAddress(toAddress)) throw new Error('Invalid recipient address');
  if (amount <= 0) throw new Error('Amount must be greater than 0');

  const treasuryKey = await SettingsService.get('TREASURY_PRIVATE_KEY');
  if (!treasuryKey) throw new Error('Treasury wallet not configured');

  const provider = await getProvider(ethers);
  if (!provider) throw new Error('BSC RPC not configured');

  const treasuryWallet = new ethers.Wallet(treasuryKey, provider);
  const amountWei = ethers.parseEther(String(amount));

  const tx = await treasuryWallet.sendTransaction({
    to: toAddress,
    value: amountWei,
  });
  const receipt = await tx.wait();

  await Ledger.create({
    uid: userId,
    type: 'BNB_TRANSFER_OUT',
    direction: 'debit',
    currency: 'bnb',
    amount_ngn: 0,
    amount_vpt: 0,
    status: 'success',
    description: `Transferred ${amount} BNB to ${toAddress}`,
    tx_hash: receipt.hash,
  });

  return { tx_hash: receipt.hash, amount, to: toAddress };
}

module.exports = {
  createWallet,
  getWallet,
  getWalletAddress,
  encrypt,
  decrypt,
  getEthers,
  getProvider,
  scanAddressBalance,
  importExternalAddress,
  transferVptToExternal,
  transferBnbToExternal,
};
