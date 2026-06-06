const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'ai_video_jobs';

function sanitizeJobUpdate(fields = {}) {
  const updates = {};
  const allowed = [
    'request_type',
    'status',
    'provider',
    'provider_job_id',
    'prompt',
    'negative_prompt',
    'duration_seconds',
    'aspect_ratio',
    'resolution',
    'seed',
    'source_image_url',
    'output_asset_url',
    'thumbnail_url',
    'moderation_status',
    'publish_status',
    'wave_id',
    'started_at',
    'completed_at',
    'failed_at',
    'failure_code',
    'failure_message',
  ];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      updates[key] = fields[key];
    }
  }

  if (updates.duration_seconds != null) {
    updates.duration_seconds = Number(updates.duration_seconds || 0);
  }

  return updates;
}

async function createJob(fields = {}) {
  const db = getFirestore();
  const job = {
    id: crypto.randomUUID(),
    creator_uid: fields.creator_uid,
    request_type: fields.request_type || 'text_to_video',
    status: fields.status || 'draft',
    provider: fields.provider || null,
    provider_job_id: fields.provider_job_id || null,
    prompt: fields.prompt || '',
    negative_prompt: fields.negative_prompt || '',
    duration_seconds: Number(fields.duration_seconds || 0),
    aspect_ratio: fields.aspect_ratio || '16:9',
    resolution: fields.resolution || '720p',
    seed: fields.seed || null,
    source_image_url: fields.source_image_url || null,
    output_asset_url: fields.output_asset_url || null,
    thumbnail_url: fields.thumbnail_url || null,
    moderation_status: fields.moderation_status || 'pending',
    publish_status: fields.publish_status || 'not_published',
    wave_id: fields.wave_id || null,
    created_at: Date.now(),
    started_at: null,
    completed_at: null,
    failed_at: null,
    failure_code: null,
    failure_message: null,
  };
  await db.collection(COLLECTION).doc(job.id).set(job);
  return job;
}

async function findById(jobId) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(jobId).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

async function listByCreatorUid(creatorUid, { limit = 50 } = {}) {
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTION)
    .where('creator_uid', '==', creatorUid)
    .orderBy('created_at', 'desc')
    .limit(Math.max(1, Math.min(Number(limit || 50), 100)))
    .get();

  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function updateJob(jobId, fields = {}) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(jobId);
  const existing = await findById(jobId);
  if (!existing) return null;

  const next = {
    ...existing,
    ...sanitizeJobUpdate(fields),
    id: existing.id,
    updated_at: Date.now(),
  };

  await ref.set(next);
  return next;
}

module.exports = {
  createJob,
  findById,
  listByCreatorUid,
  updateJob,
};
