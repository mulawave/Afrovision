/**
 * Admin Settings definitions.
 * Firestore is the only source of truth for persisted setting values.
 */

const SETTING_CATEGORIES = {
  payments: 'Payment Gateways',
  smtp: 'Email & SMTP',
  blockchain: 'Blockchain & Smart Contracts',
  rates: 'Conversion Rates',
  economy: 'Economy & Exchange',
  app_links: 'App Linking & Store',
  ads: 'Ads & Monetization',
  system: 'System Configuration',
};

// Setting definitions with Firestore-backed defaults.
const SETTING_DEFINITIONS = {
  PAYSTACK_SECRET_KEY: {
    category: 'payments',
    description: 'Paystack secret key (sk_live_... or sk_test_...) — used server-side for bank list and account verification',
    sensitive: true,
    defaultValue: null,
  },
  PAYSTACK_PUBLIC_KEY: {
    category: 'payments',
    description: 'Paystack public key (pk_live_... or pk_test_...) — safe to expose to clients',
    sensitive: false,
    defaultValue: null,
  },
  FLUTTERWAVE_SECRET_KEY: {
    category: 'payments',
    description: 'Flutterwave secret key (FLWSECK_...) — used server-side for payment processing',
    sensitive: true,
    defaultValue: null,
  },
  FLUTTERWAVE_PUBLIC_KEY: {
    category: 'payments',
    description: 'Flutterwave public key (FLWPUBK_...) — safe to expose to clients',
    sensitive: false,
    defaultValue: null,
  },
  SMTP_HOST: {
    category: 'smtp',
    description: 'SMTP server hostname for outbound transactional email',
    sensitive: false,
    defaultValue: '',
  },
  SMTP_PORT: {
    category: 'smtp',
    description: 'SMTP server port (usually 587 for STARTTLS or 465 for SSL)',
    sensitive: false,
    defaultValue: '587',
  },
  SMTP_SECURE: {
    category: 'smtp',
    description: 'Use implicit TLS for SMTP (true for port 465, false for STARTTLS on 587)',
    sensitive: false,
    defaultValue: 'false',
  },
  SMTP_USERNAME: {
    category: 'smtp',
    description: 'SMTP account username',
    sensitive: false,
    defaultValue: '',
  },
  SMTP_PASSWORD: {
    category: 'smtp',
    description: 'SMTP account password or app password',
    sensitive: true,
    defaultValue: null,
  },
  SMTP_FROM_EMAIL: {
    category: 'smtp',
    description: 'Default sender email address for platform notifications',
    sensitive: false,
    defaultValue: '',
  },
  SMTP_FROM_NAME: {
    category: 'smtp',
    description: 'Default sender display name for platform notifications',
    sensitive: false,
    defaultValue: 'AfroVision',
  },
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
  VIEWER_REWARD_PERCENT: {
    category: 'rates',
    description: 'Percentage of community pool distributed to viewers per reward cycle',
    sensitive: false,
    defaultValue: '10',
  },
  VIEWER_REWARD_INTERVAL_HOURS: {
    category: 'rates',
    description: 'Hours between automatic viewer reward distributions (e.g. 24 = daily)',
    sensitive: false,
    defaultValue: '24',
  },
  VPT_PRICE_NGN: {
    category: 'rates',
    description: 'Reference price of 1 vPT in Naira for display and financial calculations',
    sensitive: false,
    defaultValue: '750',
  },
  RAVEN_NGN_RATE: {
    category: 'economy',
    description: 'How many Naira 1 Raven represents (display only — Ravens cannot convert to NGN)',
    sensitive: false,
    defaultValue: '10',
  },
  VPT_RAVEN_RATE: {
    category: 'economy',
    description: 'How many Ravens equal 1 off-chain vPT (bidirectional conversion)',
    sensitive: false,
    defaultValue: '75',
  },
  ANDROID_APP_LINKS_ENABLED: {
    category: 'app_links',
    description: 'Enable Android App Links statement generation (true/false)',
    sensitive: false,
    defaultValue: 'false',
  },
  ANDROID_APP_PACKAGE: {
    category: 'app_links',
    description: 'Android app package name (e.g. com.afrovision.afrovision)',
    sensitive: false,
    defaultValue: 'com.afrovision.afrovision',
  },
  ANDROID_APP_SHA256_FINGERPRINTS: {
    category: 'app_links',
    description: 'Comma-separated SHA-256 signing certificate fingerprints for Digital Asset Links',
    sensitive: false,
    defaultValue: '',
  },
  ANDROID_PLAY_STORE_URL: {
    category: 'app_links',
    description: 'Play Store listing URL to save after app is approved and published',
    sensitive: false,
    defaultValue: '',
  },
  IOS_UNIVERSAL_LINKS_ENABLED: {
    category: 'app_links',
    description: 'Enable iOS Universal Links association output (true/false)',
    sensitive: false,
    defaultValue: 'false',
  },
  IOS_TEAM_ID: {
    category: 'app_links',
    description: 'Apple Developer Team ID for Universal Links (leave blank until iOS app is planned)',
    sensitive: false,
    defaultValue: '',
  },
  IOS_BUNDLE_ID: {
    category: 'app_links',
    description: 'iOS bundle identifier for Universal Links',
    sensitive: false,
    defaultValue: 'com.afrovision.afrovision',
  },
  APP_LINK_PATHS: {
    category: 'app_links',
    description: 'Comma-separated deep-link paths allowed for app linking (e.g. /reset-password*)',
    sensitive: false,
    defaultValue: '/reset-password*',
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
  RECAPTCHA_ENTERPRISE_API_KEY: {
    category: 'system',
    description: 'Google reCAPTCHA Enterprise API key used for assessments endpoint',
    sensitive: true,
    defaultValue: null,
  },
  AD_BREAK_BUFFER_SECONDS: {
    category: 'system',
    description: 'Seconds of buffer added between programs for ad breaks (pre-roll + brief). Set to 0 to disable.',
    sensitive: false,
    defaultValue: '45',
  },
  AD_SCHEDULING_ENABLED: {
    category: 'system',
    description: 'Whether to insert ad break buffers in sequential scheduling (true/false)',
    sensitive: false,
    defaultValue: 'true',
  },
  ELEVENLABS_API_KEY: {
    category: 'system',
    description: 'ElevenLabs API key for TTS flash screen audio generation',
    sensitive: true,
    defaultValue: null,
  },
  ELEVENLABS_VOICE_ID: {
    category: 'system',
    description: 'ElevenLabs voice ID for TTS (default: Sarah = EXAVITQu4vr4xnSDxMaL)',
    sensitive: false,
    defaultValue: 'EXAVITQu4vr4xnSDxMaL',
  },
};

module.exports = {
  SETTING_DEFINITIONS,
  SETTING_CATEGORIES,
};
