const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'ad_clicks';

function normalizeClick(doc) {
  return { ...doc.data(), id: doc.id };
}

async function record({ adId, channelId, category, viewerId, sessionId, clickUrl, placement }) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const click = {
    id,
    ad_id: adId,
    channel_id: channelId || null,
    category,
    viewer_id: viewerId || null,
    session_id: sessionId || null,
    click_url: clickUrl || '',
    placement: placement || null,
    clicked_at: Date.now(),
  };
  await db.collection(COLLECTION).doc(id).set(click);
  return click;
}

async function getByAd(adId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('ad_id', '==', adId)
    .get();
  return snapshot.docs.map(normalizeClick);
}

async function getByAdvertiser(adIds) {
  const uniqueAdIds = [...new Set((adIds || []).filter(Boolean))];
  if (uniqueAdIds.length === 0) return [];

  const db = getFirestore();
  const clicks = [];

  for (let index = 0; index < uniqueAdIds.length; index += 10) {
    const batch = uniqueAdIds.slice(index, index + 10);
    const snapshot = await db.collection(COLLECTION)
      .where('ad_id', 'in', batch)
      .get();
    snapshot.docs.forEach((doc) => clicks.push(normalizeClick(doc)));
  }

  return clicks;
}

module.exports = {
  record,
  getByAd,
  getByAdvertiser,
};
