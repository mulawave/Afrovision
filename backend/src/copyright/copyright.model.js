/**
 * Copyright Report model — Firestore-backed.
 */
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'copyright_reports';
const COUNTER_DOC = 'copyright_report_counter';

const STATUS = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
};

/**
 * Generate a tracking ID like CR-20260405-0001
 */
async function generateTrackingId() {
  const db = getFirestore();
  const counterRef = db.collection('_counters').doc(COUNTER_DOC);
  const result = await db.runTransaction(async (txn) => {
    const doc = await txn.get(counterRef);
    const current = doc.exists ? doc.data().count : 0;
    const next = current + 1;
    txn.set(counterRef, { count: next }, { merge: true });
    return next;
  });
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `CR-${date}-${String(result).padStart(4, '0')}`;
}

async function create(data) {
  const db = getFirestore();
  const trackingId = await generateTrackingId();
  const now = new Date().toISOString();
  const report = {
    trackingId,
    fullName: data.fullName,
    email: data.email,
    phone: data.phone || '',
    address: data.address || '',
    copyrightWorkDescription: data.copyrightWorkDescription,
    copyrightWorkUrl: data.copyrightWorkUrl || '',
    infringingContentUrls: data.infringingContentUrls,
    infringingContentDescription: data.infringingContentDescription || '',
    signature: data.signature,
    status: STATUS.PENDING,
    adminNotes: '',
    createdAt: now,
    updatedAt: now,
  };
  const ref = db.collection(COLLECTION).doc(trackingId);
  await ref.set(report);
  return report;
}

async function list({ status, limit = 50, startAfter } = {}) {
  const db = getFirestore();
  let query = db.collection(COLLECTION).orderBy('createdAt', 'desc');
  if (status) query = query.where('status', '==', status);
  if (startAfter) query = query.startAfter(startAfter);
  query = query.limit(limit);
  const snap = await query.get();
  return snap.docs.map((d) => d.data());
}

async function getById(trackingId) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(trackingId).get();
  return doc.exists ? doc.data() : null;
}

async function updateStatus(trackingId, status, adminNotes) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(trackingId);
  const updates = { status, updatedAt: new Date().toISOString() };
  if (adminNotes !== undefined) updates.adminNotes = adminNotes;
  await ref.update(updates);
  return { trackingId, ...updates };
}

module.exports = { COLLECTION, STATUS, create, list, getById, updateStatus };
