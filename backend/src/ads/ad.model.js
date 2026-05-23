const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'advertisements';

/**
 * Ad categories:
 *   banner_home    – Static/animated banner on home page
 *   banner_page    – Banner ad on channel/other pages
 *   in_stream_pre  – Pre-roll video ad before program starts
 *   in_stream_mid  – Mid-roll video ad during program
 *   in_stream_brief – Short bumper ad (≤15s)
 *
 * Ad statuses: pending, approved, rejected, active, paused, expired, depleted
 */

const VALID_CATEGORIES = ['banner_home', 'banner_page', 'in_stream_pre', 'in_stream_mid', 'in_stream_brief'];
const VALID_STATUSES = ['pending', 'approved', 'rejected', 'active', 'paused', 'expired', 'depleted'];

// Max durations per category (seconds)
const MAX_DURATION = {
  banner_home: 0,      // banners have no duration (static)
  banner_page: 0,
  in_stream_pre: 30,
  in_stream_mid: 60,
  in_stream_brief: 15,
};

async function init() {
  return [];
}

async function create({
  advertiserId,
  category,
  title,
  description,
  mediaUrl,
  thumbnailUrl,
  clickUrl,
  duration,
  budget,
  pricePerImpression,
  targetChannels,
  startDate,
  endDate,
  isSuperAd,
}) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const ad = {
    id,
    advertiser_id: advertiserId,
    category,
    title: title || '',
    description: description || '',
    media_url: mediaUrl || '',
    thumbnail_url: thumbnailUrl || '',
    click_url: clickUrl || '',
    duration: duration || 0,
    budget: budget || 0,
    spent: 0,
    price_per_impression: pricePerImpression || 0,
    target_channels: targetChannels || [],  // empty = all channels
    start_date: startDate || null,
    end_date: endDate || null,
    status: 'pending',
    is_super_ad: isSuperAd || false,  // admin-created priority ads
    impression_count: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  await db.collection(COLLECTION).doc(id).set(ad);
  return ad;
}

async function findById(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

async function getAll() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function listPage({ limit = 100, startAfterUpdatedAt = null, startAfterId = null, status = null } = {}) {
  const db = getFirestore();
  let query = db.collection(COLLECTION);
  if (status) {
    query = query.where('status', '==', status);
  }

  query = query.orderBy('updated_at', 'desc').orderBy('__name__', 'desc').limit(Math.max(1, Math.min(limit, 500)));

  if (startAfterUpdatedAt != null && startAfterId) {
    query = query.startAfter(startAfterUpdatedAt, startAfterId);
  }

  const snapshot = await query.get();
  const ads = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

  return {
    ads,
    nextCursor: lastDoc
      ? {
        updated_at: Number(lastDoc.data().updated_at || 0),
        id: lastDoc.id,
      }
      : null,
  };
}

async function getByAdvertiser(advertiserId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('advertiser_id', '==', advertiserId)
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function getActiveByCategory(category) {
  const now = Date.now();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('category', '==', category)
    .where('status', '==', 'active')
    .get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .filter((a) =>
    a.category === category &&
    a.status === 'active' &&
    (!a.start_date || a.start_date <= now) &&
    (!a.end_date || a.end_date >= now) &&
    (a.budget <= 0 || a.spent < a.budget)
  );
}

async function getApproved() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'approved')
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function getPending() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'pending')
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

const ALLOWED_UPDATE_FIELDS = [
  'title', 'description', 'media_url', 'thumbnail_url', 'click_url',
  'duration', 'budget', 'price_per_impression', 'target_channels',
  'start_date', 'end_date', 'status', 'is_super_ad',
];

async function update(id, fields) {
  const ad = await findById(id);
  if (!ad) return null;
  const db = getFirestore();
  const updates = {};
  for (const key of Object.keys(fields)) {
    if (ALLOWED_UPDATE_FIELDS.includes(key)) {
      updates[key] = fields[key];
      ad[key] = fields[key];
    }
  }
  if (Object.keys(updates).length === 0) return ad;
  updates.updated_at = Date.now();
  ad.updated_at = updates.updated_at;
  await db.collection(COLLECTION).doc(id).update(updates);
  return ad;
}

async function recordImpression(id, cost) {
  const ad = await findById(id);
  if (!ad) return null;
  const db = getFirestore();
  ad.impression_count += 1;
  ad.spent += cost;
  ad.updated_at = Date.now();
  // Auto-deplete if budget exhausted
  if (ad.budget > 0 && ad.spent >= ad.budget) {
    ad.status = 'depleted';
  }
  await db.collection(COLLECTION).doc(id).update({
    impression_count: ad.impression_count,
    spent: ad.spent,
    status: ad.status,
    updated_at: ad.updated_at,
  });
  return ad;
}

async function remove(id) {
  const ad = await findById(id);
  if (!ad) return false;
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  return true;
}

module.exports = {
  VALID_CATEGORIES,
  VALID_STATUSES,
  MAX_DURATION,
  init,
  create,
  findById,
  getAll,
  listPage,
  getByAdvertiser,
  getActiveByCategory,
  getApproved,
  getPending,
  update,
  recordImpression,
  remove,
};
