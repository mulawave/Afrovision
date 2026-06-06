const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'ai_video_provider_configs';

const DEFAULT_PROVIDERS = [
  {
    provider_key: 'runway',
    enabled: false,
    api_base_url: '',
    api_key_secret_ref: '',
    webhook_signing_secret_ref: '',
    model_name: 'gen4_turbo',
    timeout_seconds: 120,
    rate_limit_per_minute: 10,
    supports_text_to_video: true,
    supports_image_to_video: true,
    supports_extend_video: false,
    supports_upscale: false,
    cost_per_second: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
  },
];

function sanitizeUpdate(fields = {}) {
  const updates = {};
  const allowed = [
    'enabled',
    'api_base_url',
    'api_key_secret_ref',
    'webhook_signing_secret_ref',
    'model_name',
    'timeout_seconds',
    'rate_limit_per_minute',
    'supports_text_to_video',
    'supports_image_to_video',
    'supports_extend_video',
    'supports_upscale',
    'cost_per_second',
  ];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      updates[key] = fields[key];
    }
  }

  if (updates.timeout_seconds != null) updates.timeout_seconds = Number(updates.timeout_seconds || 0);
  if (updates.rate_limit_per_minute != null) updates.rate_limit_per_minute = Number(updates.rate_limit_per_minute || 0);
  if (updates.cost_per_second != null) updates.cost_per_second = Number(updates.cost_per_second || 0);

  if (updates.api_base_url != null) {
    updates.api_base_url = String(updates.api_base_url || '').trim();
    if (updates.api_base_url && !/^https?:\/\//i.test(updates.api_base_url)) {
      throw new Error('Provider API base URL must start with http:// or https://');
    }
  }

  if (updates.api_key_secret_ref != null) {
    updates.api_key_secret_ref = String(updates.api_key_secret_ref || '').trim();
  }

  if (updates.webhook_signing_secret_ref != null) {
    updates.webhook_signing_secret_ref = String(updates.webhook_signing_secret_ref || '').trim();
  }

  if (updates.model_name != null) {
    updates.model_name = String(updates.model_name || '').trim();
  }

  return updates;
}

async function ensureDefaults() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).limit(1).get();
  if (!snapshot.empty) return;

  const batch = db.batch();
  for (const provider of DEFAULT_PROVIDERS) {
    const ref = db.collection(COLLECTION).doc(provider.provider_key);
    batch.set(ref, provider);
  }
  await batch.commit();
}

async function getAll() {
  await ensureDefaults();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), provider_key: doc.id }));
}

async function findByKey(providerKey) {
  await ensureDefaults();
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(providerKey).get();
  if (!doc.exists) return null;
  return { ...doc.data(), provider_key: doc.id };
}

async function upsert(providerKey, fields = {}) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(providerKey);
  const existing = await findByKey(providerKey);
  const next = {
    ...(existing || {
      provider_key: providerKey,
      created_at: Date.now(),
    }),
    ...sanitizeUpdate(fields),
    provider_key: providerKey,
    updated_at: Date.now(),
  };
  await ref.set(next);
  return next;
}

function validateForTest(provider) {
  if (!provider) {
    return {
      ok: false,
      issues: ['Provider configuration not found.'],
    };
  }

  const issues = [];
  if (!provider.model_name) issues.push('Model name is required.');
  if (!provider.api_base_url) issues.push('API base URL is required.');
  if (!provider.api_key_secret_ref) issues.push('API key secret reference is required.');
  if (provider.enabled && !provider.webhook_signing_secret_ref) {
    issues.push('Webhook signing secret reference is required for enabled providers.');
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

module.exports = {
  getAll,
  findByKey,
  upsert,
  validateForTest,
};
