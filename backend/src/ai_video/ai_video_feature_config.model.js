const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'ai_video';
const DOC_ID = 'feature_config';

const DEFAULT_CONFIG = {
  id: DOC_ID,
  enabled: false,
  mode: 'disabled',
  minimum_creator_plan: 'pro',
  allow_text_to_video: true,
  allow_image_to_video: true,
  allow_template_based: false,
  allow_post_to_waves: true,
  require_moderation_before_publish: true,
  daily_request_limit: 5,
  monthly_request_limit: 50,
  max_duration_seconds: 30,
  max_resolution: '720p',
  default_provider: 'runway',
  watermark_mode: 'required',
  created_at: Date.now(),
  updated_at: Date.now(),
  updated_by: null,
};

function sanitizeUpdate(fields = {}) {
  const updates = {};
  const allowed = [
    'enabled',
    'mode',
    'minimum_creator_plan',
    'allow_text_to_video',
    'allow_image_to_video',
    'allow_template_based',
    'allow_post_to_waves',
    'require_moderation_before_publish',
    'daily_request_limit',
    'monthly_request_limit',
    'max_duration_seconds',
    'max_resolution',
    'default_provider',
    'watermark_mode',
    'updated_by',
  ];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      updates[key] = fields[key];
    }
  }

  if (updates.mode && !['disabled', 'internal_only', 'pilot_whitelist', 'eligible_creators_only', 'open_beta'].includes(updates.mode)) {
    throw new Error('Invalid AI video mode');
  }

  if (updates.daily_request_limit != null) updates.daily_request_limit = Number(updates.daily_request_limit || 0);
  if (updates.monthly_request_limit != null) updates.monthly_request_limit = Number(updates.monthly_request_limit || 0);
  if (updates.max_duration_seconds != null) updates.max_duration_seconds = Number(updates.max_duration_seconds || 0);

  return updates;
}

async function get() {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(DOC_ID);
  const doc = await ref.get();
  if (!doc.exists) {
    await ref.set(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  return { ...DEFAULT_CONFIG, ...doc.data(), id: DOC_ID };
}

async function update(fields = {}) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(DOC_ID);
  const existing = await get();
  const updates = sanitizeUpdate(fields);
  const next = {
    ...existing,
    ...updates,
    updated_at: Date.now(),
  };
  await ref.set(next);
  return next;
}

module.exports = {
  get,
  update,
  DEFAULT_CONFIG,
};
