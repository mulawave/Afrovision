const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'creator_daily_stats';

function _getTodayKey() {
  return new Date().toISOString().split('T')[0]; // '2026-04-01'
}

function _getDayKey(date) {
  return date.toISOString().split('T')[0];
}

function _docId(creatorUid, dateKey) {
  return `${creatorUid}_${dateKey}`;
}

function _labelForDate(dateKey) {
  const d = new Date(dateKey + 'T12:00:00Z'); // noon UTC to avoid timezone drift
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
}

function _emptyDay(creatorUid, date) {
  return {
    date,
    creator_uid: creatorUid,
    gifts_ngn: 0,
    gifts_vpt: 0,
    subscriptions_ngn: 0,
    subscriptions_vpt: 0,
    stream_entries_ngn: 0,
    stream_entries_vpt: 0,
    total_earnings_ngn: 0,
    total_earnings_vpt: 0,
    new_subscribers: 0,
    total_viewers: 0,
    unique_viewers: 0,
    streams_count: 0,
    updated_at: null,
  };
}

/**
 * Increment gift earnings for the creator's share today.
 * @param {string} creatorUid
 * @param {{ ngn?: number, vpt?: number }} amounts — creator's 50% share
 */
async function incrementGifts(creatorUid, { ngn = 0, vpt = 0 } = {}) {
  const db = getFirestore();
  const admin = require('firebase-admin');
  const today = _getTodayKey();
  await db.collection(COLLECTION).doc(_docId(creatorUid, today)).set({
    date: today,
    creator_uid: creatorUid,
    gifts_ngn: admin.firestore.FieldValue.increment(ngn),
    gifts_vpt: admin.firestore.FieldValue.increment(vpt),
    total_earnings_ngn: admin.firestore.FieldValue.increment(ngn),
    total_earnings_vpt: admin.firestore.FieldValue.increment(vpt),
    updated_at: Date.now(),
  }, { merge: true });
}

/**
 * Increment subscription earnings for today. Also bumps new_subscribers.
 */
async function incrementSubscription(creatorUid, { ngn = 0, vpt = 0 } = {}) {
  const db = getFirestore();
  const admin = require('firebase-admin');
  const today = _getTodayKey();
  await db.collection(COLLECTION).doc(_docId(creatorUid, today)).set({
    date: today,
    creator_uid: creatorUid,
    subscriptions_ngn: admin.firestore.FieldValue.increment(ngn),
    subscriptions_vpt: admin.firestore.FieldValue.increment(vpt),
    total_earnings_ngn: admin.firestore.FieldValue.increment(ngn),
    total_earnings_vpt: admin.firestore.FieldValue.increment(vpt),
    new_subscribers: admin.firestore.FieldValue.increment(1),
    updated_at: Date.now(),
  }, { merge: true });
}

/**
 * Increment stream-entry earnings for today.
 */
async function incrementStreamEntry(creatorUid, { ngn = 0, vpt = 0 } = {}) {
  const db = getFirestore();
  const admin = require('firebase-admin');
  const today = _getTodayKey();
  await db.collection(COLLECTION).doc(_docId(creatorUid, today)).set({
    date: today,
    creator_uid: creatorUid,
    stream_entries_ngn: admin.firestore.FieldValue.increment(ngn),
    stream_entries_vpt: admin.firestore.FieldValue.increment(vpt),
    total_earnings_ngn: admin.firestore.FieldValue.increment(ngn),
    total_earnings_vpt: admin.firestore.FieldValue.increment(vpt),
    updated_at: Date.now(),
  }, { merge: true });
}

/**
 * Increment stream count for today (called on go-live).
 */
async function incrementStreams(creatorUid) {
  const db = getFirestore();
  const admin = require('firebase-admin');
  const today = _getTodayKey();
  await db.collection(COLLECTION).doc(_docId(creatorUid, today)).set({
    date: today,
    creator_uid: creatorUid,
    streams_count: admin.firestore.FieldValue.increment(1),
    updated_at: Date.now(),
  }, { merge: true });
}

/**
 * Get today's stats for a creator.
 */
async function getToday(creatorUid) {
  const db = getFirestore();
  const today = _getTodayKey();
  const doc = await db.collection(COLLECTION).doc(_docId(creatorUid, today)).get();
  return doc.exists ? doc.data() : _emptyDay(creatorUid, today);
}

/**
 * Get last N days of stats, ordered oldest → newest with day labels.
 */
async function getLastNDays(creatorUid, days = 7) {
  const db = getFirestore();
  const dateKeys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dateKeys.push(_getDayKey(d));
  }

  // Batch-read all days in parallel
  const refs = dateKeys.map((k) => db.collection(COLLECTION).doc(_docId(creatorUid, k)));
  const docs = await Promise.all(refs.map((r) => r.get()));

  return docs.map((doc, idx) => {
    const key = dateKeys[idx];
    const label = _labelForDate(key);
    return doc.exists
      ? { ...doc.data(), day_label: label }
      : { ..._emptyDay(creatorUid, key), day_label: label };
  });
}

module.exports = {
  incrementGifts,
  incrementSubscription,
  incrementStreamEntry,
  incrementStreams,
  getToday,
  getLastNDays,
};
