const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'exclusive_channel_request';

const VALID_STATUSES = Object.freeze([
  'pending',
  'approved_pending_payment',
  'approved',
  'rejected',
  'more_info',
]);

function isValidStatus(status) {
  return VALID_STATUSES.includes(status);
}

function now() {
  return Date.now();
}

async function create({
  userUid,
  channelId,
  channelName,
  note,
  referralSource,
}) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc();
  const record = {
    id: ref.id,
    user_uid: userUid,
    channel_id: channelId,
    channel_name: channelName || 'Exclusive channel',
    status: 'pending',
    note: note || '',
    referral_source: referralSource || null,
    admin_message: '',
    user_reply: '',
    payment_reference: null,
    access_id: null,
    created_at: now(),
    updated_at: now(),
    resolved_at: null,
    resolved_by: null,
  };
  await ref.set(record);
  return record;
}

async function findById(id) {
  if (!id) return null;
  const snap = await getFirestore().collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

async function findPendingByUserAndChannel(userUid, channelId) {
  const db = getFirestore();
  const snap = await db.collection(COLLECTION)
    .where('user_uid', '==', userUid)
    .where('channel_id', '==', channelId)
    .where('status', 'in', ['pending', 'more_info', 'approved_pending_payment'])
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function listByChannel(channelId, { statusFilter = null } = {}) {
  const db = getFirestore();
  let q = db.collection(COLLECTION).where('channel_id', '==', channelId);
  if (statusFilter && isValidStatus(statusFilter)) {
    q = q.where('status', '==', statusFilter);
  }
  const snap = await q.orderBy('created_at', 'desc').limit(200).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function update(id, patch) {
  if (!id) return null;
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(id);
  const merged = { ...patch, updated_at: now() };
  await ref.set(merged, { merge: true });
  return findById(id);
}

async function transitionStatus(id, {
  status,
  adminMessage,
  resolvedBy,
  markResolved = true,
}) {
  if (!isValidStatus(status)) {
    throw new Error(`invalid status: ${status}`);
  }
  const patch = {
    status,
    admin_message: adminMessage || '',
  };
  if (resolvedBy) patch.resolved_by = resolvedBy;
  if (markResolved) patch.resolved_at = now();
  return update(id, patch);
}

module.exports = {
  COLLECTION,
  VALID_STATUSES,
  isValidStatus,
  create,
  findById,
  findPendingByUserAndChannel,
  listByChannel,
  update,
  transitionStatus,
};
