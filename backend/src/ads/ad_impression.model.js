const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'ad_impressions';
const impressions = [];
let initialized = false;

async function init() {
  if (initialized) return;
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  snapshot.forEach((doc) => {
    const data = doc.data();
    data.id = doc.id;
    impressions.push(data);
  });
  initialized = true;
}

async function record({ adId, channelId, category, viewerCount, cost, channelOwnerId }) {
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
    played_at: Date.now(),
  };
  await db.collection(COLLECTION).doc(id).set(impression);
  impressions.push(impression);
  return impression;
}

function getByAd(adId) {
  return impressions.filter((i) => i.ad_id === adId);
}

function getByChannel(channelId) {
  return impressions.filter((i) => i.channel_id === channelId);
}

function getByAdvertiser(adIds) {
  const set = new Set(adIds);
  return impressions.filter((i) => set.has(i.ad_id));
}

function getStats(adId) {
  const adImpressions = getByAd(adId);
  return {
    total_impressions: adImpressions.length,
    total_viewers: adImpressions.reduce((sum, i) => sum + (i.viewer_count || 0), 0),
    total_cost: adImpressions.reduce((sum, i) => sum + (i.cost || 0), 0),
    unique_channels: new Set(adImpressions.map((i) => i.channel_id).filter(Boolean)).size,
  };
}

function getAll() {
  return [...impressions];
}

module.exports = {
  init,
  record,
  getByAd,
  getByChannel,
  getByAdvertiser,
  getStats,
  getAll,
};
