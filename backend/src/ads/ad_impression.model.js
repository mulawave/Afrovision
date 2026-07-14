const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'ad_impressions';

async function init() {
  return [];
}

function normalizeImpression(doc) {
  return { ...doc.data(), id: doc.id };
}

async function findByDedupeKey(dedupeKey) {
  if (!dedupeKey) return null;
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('dedupe_key', '==', dedupeKey)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return normalizeImpression(snapshot.docs[0]);
}

async function record({ adId, channelId, category, viewerCount, cost, channelOwnerId, viewerId, sessionId, placement, dedupeKey }) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const impression = {
    id,
    ad_id: adId,
    channel_id: channelId || null,
    channel_owner_id: channelOwnerId || null,
    category,
    viewer_count: viewerCount || 0,
    cost: cost || 0,
    viewer_id: viewerId || null,
    session_id: sessionId || null,
    placement: placement || null,
    dedupe_key: dedupeKey || null,
    played_at: Date.now(),
  };
  await db.collection(COLLECTION).doc(id).set(impression);
  return impression;
}

async function getByAd(adId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('ad_id', '==', adId)
    .get();
  return snapshot.docs.map(normalizeImpression);
}

async function getByChannel(channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .get();
  return snapshot.docs.map(normalizeImpression);
}

async function getByAdvertiser(adIds) {
  const uniqueAdIds = [...new Set((adIds || []).filter(Boolean))];
  if (uniqueAdIds.length === 0) return [];

  const db = getFirestore();
  const impressions = [];

  for (let index = 0; index < uniqueAdIds.length; index += 10) {
    const batch = uniqueAdIds.slice(index, index + 10);
    const snapshot = await db.collection(COLLECTION)
      .where('ad_id', 'in', batch)
      .get();
    snapshot.docs.forEach((doc) => impressions.push(normalizeImpression(doc)));
  }

  return impressions;
}

async function getStats(adId) {
  const adImpressions = await getByAd(adId);
  return {
    total_impressions: adImpressions.length,
    total_viewers: adImpressions.reduce((sum, i) => sum + (i.viewer_count || 0), 0),
    total_cost: adImpressions.reduce((sum, i) => sum + (i.cost || 0), 0),
    unique_channels: new Set(adImpressions.map((i) => i.channel_id).filter(Boolean)).size,
  };
}

async function getRecent(limit = 200) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .orderBy('played_at', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map(normalizeImpression);
}

async function getSince(sinceTimestamp, limit) {
  const db = getFirestore();
  let query = db.collection(COLLECTION)
    .where('played_at', '>=', sinceTimestamp)
    .orderBy('played_at', 'desc');

  if (Number.isInteger(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  return snapshot.docs.map(normalizeImpression);
}

async function getAll(limit = 200) {
  return getRecent(limit);
}

module.exports = {
  init,
  record,
  findByDedupeKey,
  getByAd,
  getByChannel,
  getByAdvertiser,
  getStats,
  getRecent,
  getSince,
  getAll,
};
