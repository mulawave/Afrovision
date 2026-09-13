const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'waves';
const ALLOWED_AGE_CLASSIFICATIONS = new Set(['minor_safe', 'teen', 'adult']);

function isIndexError(error) {
  const message = error?.message || '';
  return message.includes('requires an index') || message.includes('FAILED_PRECONDITION');
}

function syncWave(wave) {
  return wave;
}

function normalizeAgeClassification(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return ALLOWED_AGE_CLASSIFICATIONS.has(normalized) ? normalized : null;
}

async function create({
  creatorUid,
  channelId,
  title,
  description,
  videoUrl,
  thumbnailUrl,
  duration,
  ageClassification,
  hasExplicitLanguage,
  hasNudity,
  hasViolence,
  hasRevealingClothes,
  hasPartialNudity,
  hasExplicitContent = false,
  hasParentalGuidance = false,
  hasEroticDancing = false,
  hasSexualNature = false,
  hasSex = false,
}) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const normalizedClassification = normalizeAgeClassification(ageClassification);
  if (!normalizedClassification) {
    throw new Error('Invalid age classification');
  }

  const wave = {
    id,
    creator_uid: creatorUid,
    channel_id: channelId,
    title: title || '',
    description: description || '',
    video_url: videoUrl,
    thumbnail_url: thumbnailUrl || null,
    thumbnail_status: thumbnailUrl ? 'ready' : null,
    duration: duration || 0,
    age_classification: normalizedClassification,
    has_explicit_language: Boolean(hasExplicitLanguage),
    has_nudity: Boolean(hasNudity),
    has_violence: Boolean(hasViolence),
    has_revealing_clothes: Boolean(hasRevealingClothes),
    has_partial_nudity: Boolean(hasPartialNudity),
    has_explicit_content: Boolean(hasExplicitContent),
    has_parental_guidance: Boolean(hasParentalGuidance),
    has_erotic_dancing: Boolean(hasEroticDancing),
    has_sexual_nature: Boolean(hasSexualNature),
    has_sex: Boolean(hasSex),
    pulse_count: 0,
    comment_count: 0,
    bookmark_count: 0,
    pulse_score: 0,
    views_count: 0,
    repeat_play_count: 0,
    status: 'active',
    created_at: Date.now(),
  };
  await db.collection(COLLECTION).doc(id).set(wave);
  return syncWave(wave);
}

async function findById(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return syncWave({ ...doc.data(), id: doc.id });
}

async function queryFeedPage({ limit, cursor = null, includeStatus = true }) {
  const db = getFirestore();
  let query = db.collection(COLLECTION).orderBy('created_at', 'desc').limit(limit);

  if (includeStatus) {
    query = db.collection(COLLECTION)
      .where('status', '==', 'active')
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  if (cursor) {
    const cursorDoc = await db.collection(COLLECTION).doc(cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => syncWave({ ...doc.data(), id: doc.id }));
}

async function getFeed({ limit = 20, cursor = null } = {}) {
  try {
    return await queryFeedPage({ limit, cursor, includeStatus: true });
  } catch (error) {
    if (!isIndexError(error)) throw error;

    const fallbackLimit = Math.min(limit * 5, 200);
    const waves = await queryFeedPage({ limit: fallbackLimit, cursor, includeStatus: false });
    return waves
      .filter((wave) => wave.status === 'active')
      .slice(0, limit);
  }
}

/**
 * Return active waves from a given set of channel IDs, newest first.
 * Supports cursor-based pagination (cursor = last wave ID from previous page).
 * Batches channel IDs in groups of 30 to stay within Firestore `in` query limits.
 */
async function getFollowingFeed(channelIds = [], { limit = 20, cursor = null } = {}) {
  if (!channelIds.length) return { waves: [], nextCursor: null };

  const db = getFirestore();
  const BATCH = 30; // Firestore `in` clause max
  const batches = [];
  for (let i = 0; i < channelIds.length; i += BATCH) {
    batches.push(channelIds.slice(i, i + BATCH));
  }

  // Resolve cursor document for startAfter (same created_at ordering as global feed)
  let cursorDoc = null;
  if (cursor) {
    const snap = await db.collection(COLLECTION).doc(cursor).get();
    if (snap.exists) cursorDoc = snap;
  }

  const fetchBatch = (ids, withStatusFilter) => {
    let q = db.collection(COLLECTION)
      .where('channel_id', 'in', ids);
    if (withStatusFilter) {
      q = q.where('status', '==', 'active');
    }
    q = q.orderBy('created_at', 'desc');
    if (cursorDoc) q = q.startAfter(cursorDoc);
    return q.limit(limit * batches.length).get();
  };

  let batchResults;
  try {
    // First attempt: with composite index (channel_id + status + created_at)
    batchResults = await Promise.all(
      batches.map((ids) => fetchBatch(ids, true)),
    );
  } catch (error) {
    if (!isIndexError(error)) throw error;
    // Fallback: fetch without status filter, filter in memory
    batchResults = await Promise.all(
      batches.map((ids) => fetchBatch(ids, false)),
    );
  }

  const all = batchResults.flatMap((snap) =>
    snap.docs.map((doc) => syncWave({ ...doc.data(), id: doc.id })),
  );

  // Filter to active only (needed for fallback path; no-op for primary path)
  const active = all.filter((w) => w.status === 'active');

  // Re-sort merged results (individual batches are sorted but not cross-batch)
  active.sort((a, b) => {
    const tA = typeof a.created_at === 'number' ? a.created_at : new Date(a.created_at).getTime();
    const tB = typeof b.created_at === 'number' ? b.created_at : new Date(b.created_at).getTime();
    return tB - tA;
  });

  const page = active.slice(0, limit);
  const nextCursor = page.length === limit ? page[page.length - 1].id : null;
  return { waves: page, nextCursor };
}

async function getByChannel(channelId, options = {}) {
  const includeHidden = options.includeHidden === true;
  const visibleStatuses = includeHidden ? ['active', 'hidden'] : ['active'];
  const db = getFirestore();
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('channel_id', '==', channelId)
      .where('status', 'in', visibleStatuses)
      .orderBy('created_at', 'desc')
      .get();
    return snapshot.docs.map((doc) => syncWave({ ...doc.data(), id: doc.id }));
  } catch (error) {
    if (!isIndexError(error)) throw error;

    const snapshot = await db.collection(COLLECTION)
      .where('channel_id', '==', channelId)
      .get();
    return snapshot.docs
      .map((doc) => syncWave({ ...doc.data(), id: doc.id }))
      .filter((wave) => visibleStatuses.includes(wave.status))
      .sort((a, b) => b.created_at - a.created_at);
  }
}

async function incrementField(id, field, amount = 1) {
  const db = getFirestore();
  const { FieldValue } = require('firebase-admin').firestore;
  await db.collection(COLLECTION).doc(id).update({
    [field]: FieldValue.increment(amount),
  });
}

/**
 * Decrement a counter field, floored at 0. FieldValue.increment(-amount)
 * can't clamp on its own, so this reads the current value first — used by
 * admin injection tooling to "remove" views/replays without going negative.
 */
async function decrementFieldClamped(id, field, amount = 1) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return null;
  const current = Number(doc.data()[field]) || 0;
  const next = Math.max(0, current - Math.max(0, Math.floor(amount)));
  await ref.update({ [field]: next });
  return next;
}

async function updatePulseScore(id, score) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ pulse_score: score });
}

async function updateStatus(id, status) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ status });
}

async function update(id, fields) {
  const db = getFirestore();
  const allowed = [
    'title',
    'description',
    'thumbnail_url',
    'age_classification',
    'has_explicit_language',
    'has_nudity',
    'has_violence',
    'has_revealing_clothes',
    'has_partial_nudity',
    'has_explicit_content',
    'has_parental_guidance',
    'has_erotic_dancing',
    'has_sexual_nature',
    'has_sex',
  ];
  const updates = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) updates[key] = fields[key];
  }
  if (updates.age_classification !== undefined) {
    const normalizedClassification = normalizeAgeClassification(
      updates.age_classification,
    );
    if (!normalizedClassification) {
      throw new Error('Invalid age classification');
    }
    updates.age_classification = normalizedClassification;
  }
  if (Object.keys(updates).length === 0) return findById(id);
  await db.collection(COLLECTION).doc(id).update(updates);
  return findById(id);
}

async function updateTranscoding(id, fields) {
  const db = getFirestore();
  const allowed = [
    'transcoding_status',
    'transcoding_job_name',
    'transcoding_error',
    'hls_output_prefix',
    'master_playlist_url',
    'available_renditions',
    'transcoding_completed_at',
    'transcoding_checked_at',
  ];
  const updates = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) updates[key] = fields[key];
  }
  if (Object.keys(updates).length === 0) return findById(id);
  await db.collection(COLLECTION).doc(id).update(updates);
  return findById(id);
}

/**
 * Update thumbnail-related fields using `set(..., { merge: true })` so we never
 * fail when a wave document is missing or concurrently deleted.
 * This is intentionally separate from [update] because thumbnail jobs are
 * asynchronous and the doc may be modified by another path.
 */
async function updateThumbnailStatus(id, fields) {
  const db = getFirestore();
  const allowed = [
    'thumbnail_url',
    'thumbnail_status',
    'thumbnail_error',
    'thumbnail_started_at',
    'thumbnail_generated_at',
    'thumbnail_failed_at',
  ];
  const updates = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) updates[key] = fields[key];
  }
  if (Object.keys(updates).length === 0) return;
  await db.collection(COLLECTION).doc(id).set(updates, { merge: true });
}

async function remove(id) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ status: 'deleted' });
}

async function trackView(waveId, userKey) {
  const db = getFirestore();
  const { FieldValue } = require('firebase-admin').firestore;
  const logRef = db.collection('wave_view_logs').doc(`${waveId}_${userKey}`);
  const logDoc = await logRef.get();
  // Always increment repeat_play_count
  await db.collection(COLLECTION).doc(waveId).update({
    repeat_play_count: FieldValue.increment(1),
  });
  // Only increment views_count once per user/device
  if (!logDoc.exists) {
    await Promise.all([
      db.collection(COLLECTION).doc(waveId).update({
        views_count: FieldValue.increment(1),
      }),
      logRef.set({ wave_id: waveId, user_key: userKey, created_at: Date.now() }),
    ]);
    return { unique: true };
  }
  return { unique: false };
}

module.exports = {
  create,
  findById,
  getFeed,
  getFollowingFeed,
  getByChannel,
  incrementField,
  decrementFieldClamped,
  updatePulseScore,
  updateStatus,
  update,
  updateTranscoding,
  updateThumbnailStatus,
  remove,
  trackView,
  ALLOWED_AGE_CLASSIFICATIONS,
};
