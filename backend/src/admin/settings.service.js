const crypto = require('crypto');
const {
  SETTING_DEFINITIONS,
  SETTING_CATEGORIES,
} = require('./settings.model');
const { getFirestore } = require('../utils/firestore');

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_AUDIT_COLLECTION = 'settings_audit';
const VALID_ENVIRONMENTS = new Set(['staging', 'production']);

// ── In-memory cache ──────────────────────────────
let _definitionsEnsured = false;
const _cache = new Map(); // key → { value, ts }
const CACHE_TTL = 60_000; // 60 seconds

function getDefinition(key) {
  return SETTING_DEFINITIONS[key] || null;
}

function isValidKey(key) {
  return key in SETTING_DEFINITIONS;
}

function normalizeStoredValue(data) {
  if (!data) return null;

  return data.value;
}

function validateValue(key, value) {
  if (key === 'ENVIRONMENT' && !VALID_ENVIRONMENTS.has(value)) {
    throw new Error('ENVIRONMENT must be one of: staging, production');
  }

  if (key === 'EXCLUSIVE_ROLLOUT_PERCENT') {
    const asNumber = Number(value);
    if (!Number.isFinite(asNumber) || asNumber < 0 || asNumber > 100) {
      throw new Error('EXCLUSIVE_ROLLOUT_PERCENT must be a number between 0 and 100');
    }
  }

  if (key === 'LIBRARY_ROLLOUT_PERCENT') {
    const asNumber = Number(value);
    if (!Number.isFinite(asNumber) || asNumber < 0 || asNumber > 100) {
      throw new Error('LIBRARY_ROLLOUT_PERCENT must be a number between 0 and 100');
    }
  }
}

function shouldApplyDefault(existingData, definition) {
  if (!existingData) {
    return true;
  }

  const value = normalizeStoredValue(existingData);
  return (value === null || value === undefined || value === '')
    && definition.defaultValue !== null
    && definition.defaultValue !== undefined
    && definition.defaultValue !== '';
}

async function ensureDefinitionsExist() {
  if (_definitionsEnsured) return;
  const db = getFirestore();

  await Promise.all(
    Object.entries(SETTING_DEFINITIONS).map(async ([key, definition]) => {
      const ref = db.collection(SETTINGS_COLLECTION).doc(key);
      const existing = await ref.get();
      const existingData = existing.exists ? existing.data() : null;

      if (!existing.exists) {
        const timestamp = Date.now();
        await ref.set({
          key,
          value: definition.defaultValue,
          is_secret: Boolean(definition.sensitive),
          category: definition.category,
          description: definition.description,
          created_at: timestamp,
          updated_at: timestamp,
          updated_by: 'system',
        });

        await writeAuditEntry({
          key,
          action: 'initialized',
          performedBy: 'system',
        });
        return;
      }

      if (!shouldApplyDefault(existingData, definition)) {
        return;
      }

      const timestamp = Date.now();
      await ref.set({
        key,
        value: definition.defaultValue,
        is_secret: Boolean(definition.sensitive),
        category: definition.category,
        description: definition.description,
        created_at: existingData.created_at || timestamp,
        updated_at: timestamp,
        updated_by: 'system',
      });

      await writeAuditEntry({
        key,
        action: 'default_backfilled',
        performedBy: 'system',
      });
    })
  );
  _definitionsEnsured = true;
}

async function getStoredSettingsMap() {
  await ensureDefinitionsExist();
  const db = getFirestore();
  const snapshot = await db.collection(SETTINGS_COLLECTION).get();
  const stored = new Map();

  snapshot.forEach((doc) => {
    stored.set(doc.id, doc.data());
  });

  return stored;
}

async function writeAuditEntry({ key, action, performedBy }) {
  const db = getFirestore();
  await db.collection(SETTINGS_AUDIT_COLLECTION).add({
    key,
    action,
    performed_by: performedBy || 'system',
    timestamp: Date.now(),
  });
}

const BOOLEAN_VALUES = new Set(['true', 'false']);

function _inferType(definition, effectiveValue) {
  if (BOOLEAN_VALUES.has(String(definition.defaultValue)) || BOOLEAN_VALUES.has(String(effectiveValue))) {
    return 'boolean';
  }
  return 'text';
}

function buildPublicSetting(key, definition, storedData) {
  const effectiveValue = storedData ? normalizeStoredValue(storedData) : definition.defaultValue;
  const isSecret = Boolean(storedData ? storedData.is_secret : definition.sensitive);
  const hasValue = effectiveValue !== null && effectiveValue !== undefined && effectiveValue !== '';

  return {
    key,
    value: isSecret ? null : effectiveValue,
    has_value: hasValue,
    value_preview: isSecret && hasValue ? `••••${String(effectiveValue).slice(-4)}` : undefined,
    type: _inferType(definition, effectiveValue),
    is_secret: isSecret,
    category: definition.category,
    category_label: SETTING_CATEGORIES[definition.category],
    description: definition.description,
    source: 'firestore',
    updated_at: storedData ? storedData.updated_at || null : null,
    updated_by: storedData ? storedData.updated_by || null : null,
  };
}

async function get(key) {
  const definition = getDefinition(key);
  if (!definition) {
    throw new Error(`Missing setting: ${key}`);
  }

  // Return cached value if fresh
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.value;
  }

  const db = getFirestore();
  await ensureDefinitionsExist();
  const doc = await db.collection(SETTINGS_COLLECTION).doc(key).get();

  if (!doc.exists) {
    throw new Error(`Missing setting: ${key}`);
  }

  const value = normalizeStoredValue(doc.data());
  _cache.set(key, { value, ts: Date.now() });
  return value;
}

async function getNumber(key) {
  const value = await get(key);
  return value !== null && value !== undefined ? parseFloat(value) : null;
}

async function getAll() {
  const stored = await getStoredSettingsMap();

  return Object.entries(SETTING_DEFINITIONS).map(([key, definition]) => {
    const storedData = stored.get(key) || null;
    return buildPublicSetting(key, definition, storedData);
  });
}

async function getOne(key) {
  const definition = getDefinition(key);
  if (!definition) return null;

  const db = getFirestore();
  await ensureDefinitionsExist();
  const doc = await db.collection(SETTINGS_COLLECTION).doc(key).get();

  return buildPublicSetting(key, definition, doc.exists ? doc.data() : null);
}

async function set(key, value, actor) {
  const definition = getDefinition(key);
  if (!definition) return null;

  validateValue(key, value);

  const db = getFirestore();
  await ensureDefinitionsExist();
  const ref = db.collection(SETTINGS_COLLECTION).doc(key);
  const existing = await ref.get();
  const timestamp = Date.now();

  await ref.set({
    key,
    value,
    is_secret: Boolean(definition.sensitive),
    category: definition.category,
    description: definition.description,
    created_at: existing.exists ? existing.data().created_at || timestamp : timestamp,
    updated_at: timestamp,
    updated_by: actor || 'system',
  });

  _cache.delete(key);
  await writeAuditEntry({ key, action: 'updated', performedBy: actor });
  return getOne(key);
}

async function bulkSet(entries, actor) {
  const results = [];

  for (const entry of entries) {
    const result = await set(entry.key, entry.value, actor);
    if (result) results.push(result);
  }

  return results;
}

async function reset(key, actor) {
  const definition = getDefinition(key);
  if (!definition) return null;

  const db = getFirestore();
  await ensureDefinitionsExist();
  const timestamp = Date.now();

  await db.collection(SETTINGS_COLLECTION).doc(key).set({
    key,
    value: definition.defaultValue,
    is_secret: Boolean(definition.sensitive),
    category: definition.category,
    description: definition.description,
    created_at: timestamp,
    updated_at: timestamp,
    updated_by: actor || 'system',
  });
  _cache.delete(key);
  await writeAuditEntry({ key, action: 'reset', performedBy: actor });

  return getOne(key);
}

/**
 * Auto-generate secrets for staging environments.
 * ONLY runs when ENVIRONMENT === 'staging'. Production requires manual configuration.
 * Idempotent: skips any secret that already has a non-null value.
 * Also corrects known stale blockchain defaults from prior initializations.
 */
async function ensureStagingSecrets() {
  const environment = await get('ENVIRONMENT');
  if (environment !== 'staging') {
    return;
  }

  // Correct stale blockchain defaults that may exist in Firestore from prior inits
  const STALE_CORRECTIONS = {
    BSC_RPC: {
      stale: ['https://data-seed-prebsc-1-s1.bnbchain.org:8545'],
      correct: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    },
    PANCAKE_ROUTER: {
      stale: ['0xD99D1c33F9fC3444f8101754aBC46c52416550D1'],
      correct: '0x9ac64cc6e4415144c455bd8e4837fea55603e5c3',
    },
  };

  for (const [key, { stale, correct }] of Object.entries(STALE_CORRECTIONS)) {
    const current = await get(key);
    if (stale.includes(current)) {
      await set(key, correct, 'staging-auto');
      console.log(`[Staging] Corrected ${key}: ${current} → ${correct}`);
    }
  }

  // JWT_SECRET
  const jwtSecret = await get('JWT_SECRET');
  if (!jwtSecret) {
    const generated = crypto.randomBytes(64).toString('hex');
    await set('JWT_SECRET', generated, 'staging-auto');
    console.log('[Staging] Auto-generated JWT_SECRET');
  }

  // WALLET_SECRET
  const walletSecret = await get('WALLET_SECRET');
  if (!walletSecret) {
    const generated = crypto.randomBytes(32).toString('hex');
    await set('WALLET_SECRET', generated, 'staging-auto');
    console.log('[Staging] Auto-generated WALLET_SECRET');
  }

  // TREASURY_PRIVATE_KEY — needs ethers for wallet generation
  const treasuryKey = await get('TREASURY_PRIVATE_KEY');
  if (!treasuryKey) {
    try {
      const mod = await import('ethers');
      const ethers = mod.ethers || mod;
      const wallet = ethers.Wallet.createRandom();
      await set('TREASURY_PRIVATE_KEY', wallet.privateKey, 'staging-auto');
      console.log(`[Staging] Auto-generated treasury wallet`);
      console.log(`[Staging]   Address: ${wallet.address}`);
      console.log(`[Staging]   Fund with testnet BNB: https://testnet.bnbchain.org/faucet-smart`);
    } catch (err) {
      console.error('[Staging] Failed to generate treasury key:', err.message);
    }
  }
}

module.exports = {
  ensureDefinitionsExist,
  ensureStagingSecrets,
  get,
  getNumber,
  getAll,
  getOne,
  set,
  bulkSet,
  reset,
  isValidKey,
};