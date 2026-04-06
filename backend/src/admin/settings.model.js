/**
 * Admin Settings definitions.
 * Firestore is the only source of truth for persisted setting values.
 */

const SETTING_CATEGORIES = {
  blockchain: 'Blockchain & Smart Contracts',
  rates: 'Conversion Rates',
  system: 'System Configuration',
};

// Setting definitions with Firestore-backed defaults.
const SETTING_DEFINITIONS = {
  WALLET_SECRET: {
    category: 'blockchain',
    description: 'AES-256-CBC wallet encryption secret',
    sensitive: true,
    defaultValue: null,
  },
  BSC_RPC: {
    category: 'blockchain',
    description: 'Binance Smart Chain RPC endpoint URL',
    sensitive: false,
    defaultValue: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
  },
  TREASURY_PRIVATE_KEY: {
    category: 'blockchain',
    description: 'Treasury BSC wallet private key',
    sensitive: true,
    defaultValue: null,
  },
  VPT_TOKEN_ADDRESS: {
    category: 'blockchain',
    description: 'vPT token contract address on BSC',
    sensitive: false,
    defaultValue: '0x0000000000000000000000000000000000000000',
  },
  PANCAKE_ROUTER: {
    category: 'blockchain',
    description: 'PancakeSwap router contract address',
    sensitive: false,
    defaultValue: '0x9ac64cc6e4415144c455bd8e4837fea55603e5c3',
  },
  WBNB_ADDRESS: {
    category: 'blockchain',
    description: 'WBNB token contract address on BSC',
    sensitive: false,
    defaultValue: '0xae13d989dac2f0debff460ac112a837c89baa7cd',
  },
  NGN_TO_BNB_RATE: {
    category: 'rates',
    description: 'NGN to BNB conversion rate (e.g., 0.0000004 = ~1 BNB per 2.5M NGN)',
    sensitive: false,
    defaultValue: '0.0000004',
  },
  COMMUNITY_POOL_PERCENT: {
    category: 'rates',
    description: 'Percentage of subscription price allocated to community pool',
    sensitive: false,
    defaultValue: '20',
  },
  VPT_EXTRACTION_PERCENT: {
    category: 'rates',
    description: 'Percentage of community pool extracted for vPT conversion',
    sensitive: false,
    defaultValue: '30',
  },
  VPT_PRICE_NGN: {
    category: 'rates',
    description: 'Reference price of 1 vPT in Naira for display and financial calculations',
    sensitive: false,
    defaultValue: '750',
  },
  BATCH_SIZE: {
    category: 'system',
    description: 'Maximum items per batch distribution processing',
    sensitive: false,
    defaultValue: '100',
  },
  MAX_RETRY_ATTEMPTS: {
    category: 'system',
    description: 'Maximum retry attempts for failed distributions',
    sensitive: false,
    defaultValue: '3',
  },
  JWT_SECRET: {
    category: 'system',
    description: 'JWT signing secret for API authentication',
    sensitive: true,
    defaultValue: null,
  },
  ENVIRONMENT: {
    category: 'system',
    description: 'Runtime environment for blockchain execution guards (staging, production)',
    sensitive: false,
    defaultValue: 'staging',
  },
  RECAPTCHA_SITE_KEY: {
    category: 'system',
    description: 'Google reCAPTCHA v2 site key (public, visible to users)',
    sensitive: false,
    defaultValue: '',
  },
  RECAPTCHA_SECRET_KEY: {
    category: 'system',
    description: 'Google reCAPTCHA v2 secret key (server-side verification)',
    sensitive: true,
    defaultValue: null,
  },
};

module.exports = {
  SETTING_DEFINITIONS,
  SETTING_CATEGORIES,
};
