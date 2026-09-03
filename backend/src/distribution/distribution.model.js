/**
 * TV Distribution Model
 * Firestore data layer for the distributor-licensed TV activation platform:
 * distributors, marketers, activation codes, TV devices, remittance ledger,
 * TV messaging, and global distribution settings.
 */

const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const DISTRIBUTORS = 'distributors';
const MARKETERS = 'marketers';
const ACTIVATION_CODES = 'activation_codes';
const TV_DEVICES = 'tv_devices';
const REMITTANCES = 'remittances';
const TV_MESSAGES = 'tv_messages';
const TV_MESSAGE_REPLIES = 'tv_message_replies';
const SETTINGS_COLLECTION = 'distribution_settings';
const SETTINGS_DOC = 'global';

// ── Settings ────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  activation_price_ngn: 15000,
  default_split_percent_afrovision: 40,
  license_fee_ngn: 500000,
  license_duration_days: 365,
  qr_whitelist_user_ids: [],
  tv_app: {
    latest_version_code: 22,
    latest_version_name: '3.7',
    apk_url: 'https://storage.googleapis.com/afrovision-media/tv-updates/afrovision-tv-latest.apk',
  },
  config_version: 1,
};

async function getSettings() {
  const db = getFirestore();
  const doc = await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).get();
  if (!doc.exists) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...doc.data() };
}

async function updateSettings(patch) {
  const db = getFirestore();
  const current = await getSettings();
  const next = { ...current, ...patch };
  // Any settings change bumps config_version so TVs pick up changes.
  next.config_version = (current.config_version || 1) + 1;
  await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).set(next);
  return next;
}

// ── Distributors ────────────────────────────────────────────────

async function createDistributor({
  companyName,
  contactName,
  email,
  phone,
  passwordHash,
  licenseDurationDays,
  quotaTotal,
  splitPercentAfrovision,
}) {
  const db = getFirestore();
  const now = Date.now();
  const durationMs = (licenseDurationDays || 365) * 24 * 60 * 60 * 1000;
  const distributor = {
    id: crypto.randomUUID(),
    company_name: companyName,
    contact_name: contactName || null,
    email: String(email).trim().toLowerCase(),
    phone: phone || null,
    password_hash: passwordHash,
    status: 'active', // active | frozen | banned
    license_issued_at: new Date(now).toISOString(),
    license_expires_at: new Date(now + durationMs).toISOString(),
    quota_total: Number(quotaTotal) || 0,
    quota_used: 0,
    split_percent_afrovision: splitPercentAfrovision != null ? Number(splitPercentAfrovision) : null,
    created_at: new Date(now).toISOString(),
  };
  await db.collection(DISTRIBUTORS).doc(distributor.id).set(distributor);
  return distributor;
}

async function findDistributorById(id) {
  if (!id) return null;
  const db = getFirestore();
  const doc = await db.collection(DISTRIBUTORS).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function findDistributorByEmail(email) {
  if (!email) return null;
  const db = getFirestore();
  const snapshot = await db.collection(DISTRIBUTORS)
    .where('email', '==', String(email).trim().toLowerCase())
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function listDistributors() {
  const db = getFirestore();
  const snapshot = await db.collection(DISTRIBUTORS).orderBy('created_at', 'desc').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function updateDistributor(id, patch) {
  const db = getFirestore();
  await db.collection(DISTRIBUTORS).doc(id).update(patch);
  return findDistributorById(id);
}

async function deleteDistributor(id) {
  const db = getFirestore();
  // Cascade: disable marketers, revoke unused codes. Devices stay activated
  // (owners already paid) but are re-attributed for audit.
  const marketers = await listMarketersByDistributor(id);
  const batch = db.batch();
  for (const marketer of marketers) {
    batch.update(db.collection(MARKETERS).doc(marketer.id), { status: 'disabled' });
  }
  const codesSnapshot = await db.collection(ACTIVATION_CODES)
    .where('distributor_id', '==', id)
    .where('status', '==', 'issued')
    .get();
  for (const doc of codesSnapshot.docs) {
    batch.update(doc.ref, { status: 'revoked', revoked_at: new Date().toISOString() });
  }
  batch.delete(db.collection(DISTRIBUTORS).doc(id));
  await batch.commit();
}

function isLicenseValid(distributor) {
  if (!distributor || !distributor.license_expires_at) return false;
  return new Date(distributor.license_expires_at).getTime() > Date.now();
}

function distributorSplitPercent(distributor, settings) {
  const override = distributor?.split_percent_afrovision;
  if (override != null && Number.isFinite(Number(override))) return Number(override);
  return Number(settings?.default_split_percent_afrovision ?? 40);
}

function toSafeDistributor(distributor) {
  if (!distributor) return null;
  const { password_hash, ...safe } = distributor;
  return safe;
}

// ── Marketers ───────────────────────────────────────────────────

async function createMarketer({ distributorId, name, phone, username, pinHash }) {
  const db = getFirestore();
  const marketer = {
    id: crypto.randomUUID(),
    distributor_id: distributorId,
    name,
    phone: phone || null,
    username: String(username).trim().toLowerCase(),
    pin_hash: pinHash,
    status: 'active', // active | disabled
    codes_requested: 0,
    activation_count: 0,
    created_at: new Date().toISOString(),
  };
  await db.collection(MARKETERS).doc(marketer.id).set(marketer);
  return marketer;
}

async function findMarketerById(id) {
  if (!id) return null;
  const db = getFirestore();
  const doc = await db.collection(MARKETERS).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function findMarketerByUsername(username) {
  if (!username) return null;
  const db = getFirestore();
  const snapshot = await db.collection(MARKETERS)
    .where('username', '==', String(username).trim().toLowerCase())
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function listMarketersByDistributor(distributorId) {
  const db = getFirestore();
  const snapshot = await db.collection(MARKETERS)
    .where('distributor_id', '==', distributorId)
    .get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

async function updateMarketer(id, patch) {
  const db = getFirestore();
  await db.collection(MARKETERS).doc(id).update(patch);
  return findMarketerById(id);
}

function toSafeMarketer(marketer) {
  if (!marketer) return null;
  const { pin_hash, ...safe } = marketer;
  return safe;
}

// ── Activation Codes ────────────────────────────────────────────

// Unambiguous alphabet (no 0/O, 1/I/L) for codes read over the phone.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateActivationCode() {
  const chars = [];
  for (let i = 0; i < 12; i += 1) {
    chars.push(CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)]);
  }
  const raw = chars.join('');
  return `AV-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function mintActivationCode({ distributorId, marketerId }) {
  const db = getFirestore();
  const code = generateActivationCode();
  const entry = {
    code,
    distributor_id: distributorId,
    marketer_id: marketerId,
    status: 'issued', // issued | activated | revoked
    issued_at: new Date().toISOString(),
    activated_at: null,
    device_id: null,
    owner_user_id: null,
  };
  // Doc ID is the normalized code for O(1) lookups.
  await db.collection(ACTIVATION_CODES).doc(normalizeCode(code)).set(entry);
  return entry;
}

async function findActivationCode(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const db = getFirestore();
  const doc = await db.collection(ACTIVATION_CODES).doc(normalized).get();
  return doc.exists ? doc.data() : null;
}

async function updateActivationCode(code, patch) {
  const db = getFirestore();
  await db.collection(ACTIVATION_CODES).doc(normalizeCode(code)).update(patch);
  return findActivationCode(code);
}

async function listCodesByMarketer(marketerId, limit = 100) {
  const db = getFirestore();
  const snapshot = await db.collection(ACTIVATION_CODES)
    .where('marketer_id', '==', marketerId)
    .get();
  return snapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => (b.issued_at || '').localeCompare(a.issued_at || ''))
    .slice(0, limit);
}

async function listCodesByDistributor(distributorId, limit = 500) {
  const db = getFirestore();
  const snapshot = await db.collection(ACTIVATION_CODES)
    .where('distributor_id', '==', distributorId)
    .get();
  return snapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => (b.issued_at || '').localeCompare(a.issued_at || ''))
    .slice(0, limit);
}

// ── TV Devices ──────────────────────────────────────────────────

async function upsertDevice(deviceId, data) {
  const db = getFirestore();
  await db.collection(TV_DEVICES).doc(deviceId).set(data, { merge: true });
  return findDeviceById(deviceId);
}

async function findDeviceById(deviceId) {
  if (!deviceId) return null;
  const db = getFirestore();
  const doc = await db.collection(TV_DEVICES).doc(deviceId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function listDevices({ distributorId = null, limit = 500 } = {}) {
  const db = getFirestore();
  let query = db.collection(TV_DEVICES);
  if (distributorId) query = query.where('distributor_id', '==', distributorId);
  const snapshot = await query.get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.activated_at || '').localeCompare(a.activated_at || ''))
    .slice(0, limit);
}

async function updateDevice(deviceId, patch) {
  const db = getFirestore();
  await db.collection(TV_DEVICES).doc(deviceId).update(patch);
  return findDeviceById(deviceId);
}

// ── Remittance Ledger ───────────────────────────────────────────

/**
 * Ledger entry types:
 *  - license_fee: distributor paid the annual license fee (informational credit)
 *  - activation_revenue: an activation occurred; records the split
 *  - payment: distributor remitted money to AfroVision (reduces balance due)
 */
async function addLedgerEntry(entry) {
  const db = getFirestore();
  const record = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...entry,
  };
  await db.collection(REMITTANCES).doc(record.id).set(record);
  return record;
}

async function listLedgerByDistributor(distributorId) {
  const db = getFirestore();
  const snapshot = await db.collection(REMITTANCES)
    .where('distributor_id', '==', distributorId)
    .get();
  return snapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

async function listAllLedgerEntries(limit = 2000) {
  const db = getFirestore();
  const snapshot = await db.collection(REMITTANCES).get();
  return snapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, limit);
}

/**
 * Compute financial totals from a distributor's ledger.
 * Remittance due = sum(afrovision_share of activation revenue) - sum(payments received).
 */
function computeFinancials(entries) {
  let totalRevenue = 0;
  let afrovisionShare = 0;
  let distributorShare = 0;
  let paymentsReceived = 0;
  let activations = 0;
  for (const entry of entries) {
    if (entry.type === 'activation_revenue') {
      totalRevenue += Number(entry.amount_ngn) || 0;
      afrovisionShare += Number(entry.afrovision_share_ngn) || 0;
      distributorShare += Number(entry.distributor_share_ngn) || 0;
      activations += 1;
    } else if (entry.type === 'payment') {
      paymentsReceived += Number(entry.amount_ngn) || 0;
    }
  }
  return {
    total_revenue_ngn: totalRevenue,
    afrovision_share_ngn: afrovisionShare,
    distributor_share_ngn: distributorShare,
    payments_received_ngn: paymentsReceived,
    remittance_due_ngn: Math.max(0, afrovisionShare - paymentsReceived),
    activations,
  };
}

// ── TV Messaging ────────────────────────────────────────────────

async function createMessage({ type, title, body, target, createdBy, allowReply }) {
  const db = getFirestore();
  const message = {
    id: crypto.randomUUID(),
    type: type || 'program_update', // program_update | psa | marketing | critical
    title,
    body,
    target: target || { scope: 'all' }, // { scope: 'all'|'distributor'|'device', distributor_id?, device_id? }
    allow_reply: allowReply !== false,
    created_by: createdBy || null,
    created_at: new Date().toISOString(),
  };
  await db.collection(TV_MESSAGES).doc(message.id).set(message);
  return message;
}

async function listMessages(limit = 200) {
  const db = getFirestore();
  const snapshot = await db.collection(TV_MESSAGES).get();
  return snapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, limit);
}

function messageTargetsDevice(message, device) {
  const target = message.target || { scope: 'all' };
  if (target.scope === 'all') return true;
  if (target.scope === 'distributor') return target.distributor_id === device.distributor_id;
  if (target.scope === 'device') return target.device_id === device.id;
  return false;
}

async function listMessagesForDevice(device, limit = 50) {
  const messages = await listMessages(500);
  return messages.filter((message) => messageTargetsDevice(message, device)).slice(0, limit);
}

async function findMessageById(id) {
  if (!id) return null;
  const db = getFirestore();
  const doc = await db.collection(TV_MESSAGES).doc(id).get();
  return doc.exists ? doc.data() : null;
}

async function addMessageReply({ messageId, deviceId, body }) {
  const db = getFirestore();
  const reply = {
    id: crypto.randomUUID(),
    message_id: messageId,
    device_id: deviceId,
    body,
    created_at: new Date().toISOString(),
  };
  await db.collection(TV_MESSAGE_REPLIES).doc(reply.id).set(reply);
  return reply;
}

async function listRepliesForMessage(messageId) {
  const db = getFirestore();
  const snapshot = await db.collection(TV_MESSAGE_REPLIES)
    .where('message_id', '==', messageId)
    .get();
  return snapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
}

module.exports = {
  // settings
  getSettings,
  updateSettings,
  // distributors
  createDistributor,
  findDistributorById,
  findDistributorByEmail,
  listDistributors,
  updateDistributor,
  deleteDistributor,
  isLicenseValid,
  distributorSplitPercent,
  toSafeDistributor,
  // marketers
  createMarketer,
  findMarketerById,
  findMarketerByUsername,
  listMarketersByDistributor,
  updateMarketer,
  toSafeMarketer,
  // codes
  generateActivationCode,
  normalizeCode,
  mintActivationCode,
  findActivationCode,
  updateActivationCode,
  listCodesByMarketer,
  listCodesByDistributor,
  // devices
  upsertDevice,
  findDeviceById,
  listDevices,
  updateDevice,
  // ledger
  addLedgerEntry,
  listLedgerByDistributor,
  listAllLedgerEntries,
  computeFinancials,
  // messaging
  createMessage,
  listMessages,
  listMessagesForDevice,
  messageTargetsDevice,
  findMessageById,
  addMessageReply,
  listRepliesForMessage,
};
