const crypto = require('crypto');
const Wallet = require('./wallet.model');
const Ledger = require('../vpt/ledger.model');
const Settings = require('../admin/settings.model');

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;

let ethersModule = null;

/**
 * Lazy-load ethers (ESM-only in v6). Falls back to dev mode if unavailable.
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

function getSecret() {
  const secret = Settings.get('WALLET_SECRET');
  if (!secret) {
    throw new Error('WALLET_SECRET is required for wallet encryption (set via admin settings or .env)');
  }
  // Derive a 32-byte key from the secret using SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(text) {
  const key = getSecret();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const key = getSecret();
  const [ivHex, encryptedHex] = text.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Create a new BSC wallet for a user.
 * Uses ethers in production, crypto fallback in dev.
 */
async function createWallet(userId) {
  const existing = Wallet.findByUserId(userId);
  if (existing) {
    return existing;
  }

  const ethers = await getEthers();

  let address, privateKey;

  if (ethers && ethers.Wallet) {
    // Production: real BSC wallet
    const wallet = ethers.Wallet.createRandom();
    address = wallet.address;
    privateKey = wallet.privateKey;
  } else {
    // Dev mode: simulated wallet
    privateKey = '0x' + crypto.randomBytes(32).toString('hex');
    address = '0x' + crypto.createHash('sha256')
      .update(privateKey)
      .digest('hex')
      .slice(0, 40);
    console.log('[WalletService] Dev mode — simulated wallet created');
  }

  const encryptedKey = encrypt(privateKey);

  const walletRecord = Wallet.create({
    userId,
    bscAddress: address,
    encryptedPrivateKey: encryptedKey,
  });

  Ledger.create({
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
 * Get or create wallet for user. Returns ethers Wallet instance if ethers available,
 * otherwise returns the wallet record.
 */
async function getWallet(userId) {
  let walletRecord = Wallet.findByUserId(userId);

  if (!walletRecord) {
    walletRecord = await createWallet(userId);
  }

  Wallet.touchLastUsed(userId);

  const ethers = await getEthers();

  if (ethers && ethers.Wallet) {
    const privateKey = decrypt(walletRecord.encrypted_private_key);
    const provider = getProvider(ethers);
    if (provider) {
      return new ethers.Wallet(privateKey, provider);
    }
    return new ethers.Wallet(privateKey);
  }

  // Dev mode: return record with decrypted key for internal use
  return {
    address: walletRecord.bsc_address,
    privateKey: decrypt(walletRecord.encrypted_private_key),
    _record: walletRecord,
  };
}

/**
 * Get BSC JSON-RPC provider (production only).
 */
function getProvider(ethers) {
  const rpc = Settings.get('BSC_RPC');
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
