const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'wave_pulses';
const DAILY_LIMIT = 10;

/**
 * Add a pulse to a wave.
 * Returns null if the daily limit is already reached.
 */
async function addPulse(waveId, userId, intensity, momentSeconds) {
  const db = getFirestore();

  // Rate-limit: max DAILY_LIMIT pulses per user per wave per UTC day
  const dayKey = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const countId = `${waveId}_${userId}_${dayKey}`;
  const counterDoc = await db.collection('wave_pulse_counters').doc(countId).get();
  const currentCount = counterDoc.exists ? (counterDoc.data().count || 0) : 0;
  if (currentCount >= DAILY_LIMIT) return null;

  const id = crypto.randomUUID();
  const pulse = {
    id,
    wave_id: waveId,
    user_id: userId,
    intensity: intensity || 1,
    moment_seconds: momentSeconds || 0,
    created_at: Date.now(),
  };
  await db.collection(COLLECTION).doc(id).set(pulse);

  // Update daily counter
  const { FieldValue } = require('firebase-admin').firestore;
  await db.collection('wave_pulse_counters').doc(countId).set(
    { count: FieldValue.increment(1) },
    { merge: true }
  );

  return pulse;
}

/**
 * Get total pulse count and intensity-weighted score for a wave.
 */
async function getPulseStats(waveId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('wave_id', '==', waveId)
    .get();

  let total = 0;
  let weightedScore = 0;
  const moments = [];

  snapshot.docs.forEach((doc) => {
    const p = doc.data();
    total += 1;
    weightedScore += p.intensity || 1;
    moments.push({ moment_seconds: p.moment_seconds || 0, intensity: p.intensity || 1 });
  });

  return { total, weightedScore, moments };
}

/**
 * Get pulse moment heatmap for a wave (grouped by second).
 */
async function getPulseMoments(waveId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('wave_id', '==', waveId)
    .get();

  const buckets = {};
  snapshot.docs.forEach((doc) => {
    const p = doc.data();
    const sec = Math.floor(p.moment_seconds || 0);
    buckets[sec] = (buckets[sec] || 0) + (p.intensity || 1);
  });

  // Return as sorted array of { second, intensity_sum }
  return Object.entries(buckets)
    .map(([s, v]) => ({ second: parseInt(s, 10), intensity_sum: v }))
    .sort((a, b) => a.second - b.second);
}

module.exports = { addPulse, getPulseStats, getPulseMoments };
