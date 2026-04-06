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

module.exports = {
  createWallet,
  getWallet,
  getWalletAddress,
  encrypt,
  decrypt,
  getEthers,
  getProvider,
};
