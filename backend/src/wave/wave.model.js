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
    duration: duration || 0,
    age_classification: normalizedClassification,
    has_explicit_language: Boolean(hasExplicitLanguage),
    has_nudity: Boolean(hasNudity),
    has_violence: Boolean(hasViolence),
    has_revealing_clothes: Boolean(hasRevealingClothes),
    has_partial_nudity: Boolean(hasPartialNudity),
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
  }
}

module.exports = {
  create,
  findById,
  getFeed,
  getByChannel,
  incrementField,
  updatePulseScore,
  updateStatus,
  update,
  remove,
  trackView,
  ALLOWED_AGE_CLASSIFICATIONS,
};
