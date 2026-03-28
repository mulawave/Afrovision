/**
 * Admin Settings Model — Runtime-configurable settings.
 * Falls back to process.env / hardcoded defaults when no admin override exists.
 * In-memory store (persists for server lifetime).
 */

const SETTING_CATEGORIES = {
  blockchain: 'Blockchain & Smart Contracts',
  rates: 'Conversion Rates',
  system: 'System Configuration',
};

// Setting definitions with defaults sourced from env or hardcoded values
const SETTING_DEFINITIONS = {
  WALLET_SECRET: {
    category: 'blockchain',
    description: 'AES-256-CBC wallet encryption secret',
    sensitive: true,
    envKey: 'WALLET_SECRET',
    defaultValue: null,
  },
  BSC_RPC: {
    category: 'blockchain',
    description: 'Binance Smart Chain RPC endpoint URL',
    sensitive: false,
    envKey: 'BSC_RPC',
    defaultValue: null,
  },
  TREASURY_PRIVATE_KEY: {
    category: 'blockchain',
    description: 'Treasury BSC wallet private key',
    sensitive: true,
    envKey: 'TREASURY_PRIVATE_KEY',
    defaultValue: null,
  },
  VPT_TOKEN_ADDRESS: {
    category: 'blockchain',
    description: 'vPT token contract address on BSC',
    sensitive: false,
    envKey: 'VPT_TOKEN_ADDRESS',
    defaultValue: '0x0000000000000000000000000000000000000000',
  },
  PANCAKE_ROUTER: {
    category: 'blockchain',
    description: 'PancakeSwap router contract address',
    sensitive: false,
    envKey: 'PANCAKE_ROUTER',
    defaultValue: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  },
  WBNB_ADDRESS: {
    category: 'blockchain',
    description: 'WBNB token contract address on BSC',
    sensitive: false,
    envKey: 'WBNB_ADDRESS',
    defaultValue: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  },
  NGN_TO_BNB_RATE: {
    category: 'rates',
    description: 'NGN to BNB conversion rate (e.g., 0.0000004 = ~1 BNB per 2.5M NGN)',
    sensitive: false,
    envKey: 'NGN_TO_BNB_RATE',
    defaultValue: '0.0000004',
  },
  COMMUNITY_POOL_PERCENT: {
    category: 'rates',
    description: 'Percentage of subscription price allocated to community pool',
    sensitive: false,
    envKey: null,
    defaultValue: '20',
  },
  VPT_EXTRACTION_PERCENT: {
    category: 'rates',
    description: 'Percentage of community pool extracted for vPT conversion',
    sensitive: false,
    envKey: null,
    defaultValue: '30',
  },
  VPT_PRICE_NGN: {
    category: 'rates',
    description: 'Price of 1 vPT in Naira (used for mock/dev conversion)',
    sensitive: false,
    envKey: null,
    defaultValue: '750',
  },
  BATCH_SIZE: {
    category: 'system',
    description: 'Maximum items per batch distribution processing',
    sensitive: false,
    envKey: null,
    defaultValue: '100',
  },
  MAX_RETRY_ATTEMPTS: {
    category: 'system',
    description: 'Maximum retry attempts for failed distributions',
    sensitive: false,
    envKey: null,
    defaultValue: '3',
  },
};

// Runtime overrides (admin-set values)
const overrides = new Map();

/**
 * Get the effective value for a setting.
 * Priority: admin override → process.env → hardcoded default
 */
function get(key) {
  const def = SETTING_DEFINITIONS[key];
  if (!def) return undefined;

  // 1. Admin override
  if (overrides.has(key)) {
    return overrides.get(key);
  }

  // 2. Environment variable
  if (def.envKey && process.env[def.envKey]) {
    return process.env[def.envKey];
  }

  // 3. Hardcoded default
  return def.defaultValue;
}

/**
 * Get a numeric setting value.
 */
function getNumber(key) {
  const val = get(key);
  return val !== null && val !== undefined ? parseFloat(val) : null;
}

/**
 * Set a runtime override for a setting.
 */
function set(key, value) {
  if (!SETTING_DEFINITIONS[key]) return null;

  overrides.set(key, value);

  return {
    key,
    value: SETTING_DEFINITIONS[key].sensitive ? '********' : value,
    source: 'admin_override',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Bulk-set multiple settings.
 */
function bulkSet(entries) {
  const results = [];
  for (const { key, value } of entries) {
    const result = set(key, value);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Reset a setting to its default (remove admin override).
 */
function reset(key) {
  if (!SETTING_DEFINITIONS[key]) return null;
  overrides.delete(key);

  const effectiveValue = get(key);
  const def = SETTING_DEFINITIONS[key];

  return {
    key,
    value: def.sensitive ? '********' : effectiveValue,
    source: def.envKey && process.env[def.envKey] ? 'env' : 'default',
  };
}

/**
 * Get all settings with metadata (masks sensitive values).
 */
function getAll() {
  const settings = [];

  for (const [key, def] of Object.entries(SETTING_DEFINITIONS)) {
    const effectiveValue = get(key);
    let source = 'default';
    if (overrides.has(key)) source = 'admin_override';
    else if (def.envKey && process.env[def.envKey]) source = 'env';

    settings.push({
      key,
      value: def.sensitive ? (effectiveValue ? '********' : null) : effectiveValue,
      category: def.category,
      category_label: SETTING_CATEGORIES[def.category],
      description: def.description,
      sensitive: def.sensitive,
      source,
    });
  }

  return settings;
}

/**
 * Get a single setting's metadata.
 */
function getOne(key) {
  const def = SETTING_DEFINITIONS[key];
  if (!def) return null;

  const effectiveValue = get(key);
  let source = 'default';
  if (overrides.has(key)) source = 'admin_override';
  else if (def.envKey && process.env[def.envKey]) source = 'env';

  return {
    key,
    value: def.sensitive ? (effectiveValue ? '********' : null) : effectiveValue,
    category: def.category,
    category_label: SETTING_CATEGORIES[def.category],
    description: def.description,
    sensitive: def.sensitive,
    source,
  };
}

/**
 * Check if a setting key is valid.
 */
function isValidKey(key) {
  return key in SETTING_DEFINITIONS;
}

module.exports = {
  get,
  getNumber,
  set,
  bulkSet,
  reset,
  getAll,
  getOne,
  isValidKey,
  SETTING_DEFINITIONS,
  SETTING_CATEGORIES,
};
