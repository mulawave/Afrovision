const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const USERS_COLLECTION = 'users';
const RESET_TOKENS_COLLECTION = 'password_reset_tokens';
let users = [];
let resetTokens = new Map();
let initialized = false;

async function persistUser(user) {
  const db = getFirestore();
  await db.collection(USERS_COLLECTION).doc(user.id).set(user);
}

async function persistResetToken(token, entry) {
  const db = getFirestore();
  await db.collection(RESET_TOKENS_COLLECTION).doc(token).set({
    token,
    userId: entry.userId,
    expires: entry.expires,
  });
}

async function deletePersistedResetToken(token) {
  const db = getFirestore();
  await db.collection(RESET_TOKENS_COLLECTION).doc(token).delete();
}

async function init() {
  const db = getFirestore();
  const [usersSnapshot, resetTokensSnapshot] = await Promise.all([
    db.collection(USERS_COLLECTION).get(),
    db.collection(RESET_TOKENS_COLLECTION).get(),
  ]);

  users = usersSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  resetTokens = new Map();

  for (const doc of resetTokensSnapshot.docs) {
    const data = doc.data();
    if (Date.now() > data.expires) {
      await deletePersistedResetToken(doc.id);
      continue;
    }
    resetTokens.set(doc.id, { userId: data.userId, expires: data.expires });
  }

  initialized = true;
  return users;
}

function isInitialized() {
  return initialized;
}

async function reinit() {
  initialized = false;
  users = [];
  resetTokens = new Map();
  return init();
}

function findByEmail(email) {
  return users.find((u) => !u.deleted_at && u.email === email);
}

function findById(id) {
  return users.find((u) => u.id === id);
}

async function create({ email, passwordHash }) {
  const user = {
    id: crypto.randomUUID(),
    email,
    password_hash: passwordHash,
    name: null,
    role: 'viewer',
    is_premium_creator: false,
    kyc_status: 'none',
    subscription_plan: null,
    subscription_status: 'inactive',
    subscription_expiry: null,
    preferred_currency: 'NGN',
    vpt: 0,
    cash: 0,
    coins: 0,
    bank_details: null,
    first_subscription_at: null,
    following_creator_ids: [],
    fcm_tokens: [],
    created_at: new Date().toISOString(),
  };
  users.push(user);
  await persistUser(user);
  return user;
}

async function updatePassword(userId, passwordHash) {
  const user = findById(userId);
  if (!user) return null;
  user.password_hash = passwordHash;
  await persistUser(user);
  return user;
}

async function updateProfile(userId, fields) {
  const user = findById(userId);
  if (!user) return null;
  if (fields.name !== undefined) user.name = fields.name;
  if (fields.email !== undefined) user.email = fields.email;
  if (fields.avatar_url !== undefined) user.avatar_url = fields.avatar_url;
  if (fields.preferred_currency !== undefined) user.preferred_currency = fields.preferred_currency;
  if (fields.bank_details !== undefined) user.bank_details = fields.bank_details;
  await persistUser(user);
  return user;
}

async function setBankDetails(userId, bankDetails) {
  const user = findById(userId);
  if (!user) return null;
  user.bank_details = bankDetails;
  await persistUser(user);
  return user;
}

async function setRole(userId, role) {
  const user = findById(userId);
  if (!user) return null;
  user.role = role;
  await persistUser(user);
  return user;
}

async function setPremium(userId, isPremium) {
  const user = findById(userId);
  if (!user) return null;
  user.is_premium_creator = isPremium;
  await persistUser(user);
  return user;
}

async function setKyc(userId, kycStatus) {
  const user = findById(userId);
  if (!user) return null;
  user.kyc_status = kycStatus;
  await persistUser(user);
  return user;
}

async function setSubscription(userId, { plan, status, expiry }) {
  const user = findById(userId);
  if (!user) return null;
  user.subscription_plan = plan;
  user.subscription_status = status;
  user.subscription_expiry = expiry;
  await persistUser(user);
  return user;
}

async function setFirstSubscriptionAt(userId, firstSubscriptionAt) {
  const user = findById(userId);
  if (!user) return null;
  user.first_subscription_at = firstSubscriptionAt;
  await persistUser(user);
  return user;
}

async function adjustVpt(userId, delta) {
  const user = findById(userId);
  if (!user) return null;
  user.vpt = Math.round(((user.vpt || 0) + delta) * 10000) / 10000;
  await persistUser(user);
  return user;
}

async function adjustCash(userId, delta) {
  const user = findById(userId);
  if (!user) return null;
  user.cash = Math.round(((user.cash || 0) + delta) * 100) / 100;
  await persistUser(user);
  return user;
}

async function adjustCoins(userId, delta) {
  const user = findById(userId);
  if (!user) return null;
  user.coins = Math.round(((user.coins || 0) + delta) * 100) / 100;
  await persistUser(user);
  return user;
}

async function setBlockchainTokens(userId, rawValue) {
  const user = findById(userId);
  if (!user) return null;
  user.blockchain_tokens = rawValue != null ? String(rawValue) : null;
  await persistUser(user);
  return user;
}

async function addFcmToken(userId, token) {
  const user = findById(userId);
  if (!user) return null;
  if (!Array.isArray(user.fcm_tokens)) user.fcm_tokens = [];

  // afroDeviceToken is AfroVision-exclusive — always track the latest token so
  // reinstalls/token rotations don't leave a stale afroDeviceToken in Firestore.
  let changed = false;
  if (user.afroDeviceToken !== token) {
    user.afroDeviceToken = token;
    changed = true;
  }

  if (!user.fcm_tokens.includes(token)) {
    user.fcm_tokens.push(token);
    changed = true;
  }

  if (changed) await persistUser(user);
  return user;
}

function ensureFollowingList(user) {
  if (!Array.isArray(user.following_creator_ids)) {
    user.following_creator_ids = [];
  }
}

async function followCreator(userId, creatorId) {
  const user = findById(userId);
  if (!user) return null;
  ensureFollowingList(user);
  if (!user.following_creator_ids.includes(creatorId)) {
    user.following_creator_ids.push(creatorId);
    await persistUser(user);
  }
  return user;
}

async function unfollowCreator(userId, creatorId) {
  const user = findById(userId);
  if (!user) return null;
  ensureFollowingList(user);
  const before = user.following_creator_ids.length;
  user.following_creator_ids = user.following_creator_ids.filter((id) => id !== creatorId);
  if (before !== user.following_creator_ids.length) {
    await persistUser(user);
  }
  return user;
}

function isFollowing(userId, creatorId) {
  const user = findById(userId);
  if (!user) return false;
  ensureFollowingList(user);
  return user.following_creator_ids.includes(creatorId);
}

function countFollowers(creatorId) {
  return users.filter((user) => {
    ensureFollowingList(user);
    return user.following_creator_ids.includes(creatorId);
  }).length;
}

function getFollowingCreatorIds(userId) {
  const user = findById(userId);
  if (!user) return [];
  ensureFollowingList(user);
  return [...user.following_creator_ids];
}

async function removeFcmToken(userId, token) {
  const user = findById(userId);
  if (!user) return null;
  if (!Array.isArray(user.fcm_tokens)) {
    user.fcm_tokens = [];
    return user;
  }
  const before = user.fcm_tokens.length;
  user.fcm_tokens = user.fcm_tokens.filter((t) => t !== token);
  if (user.fcm_tokens.length !== before) await persistUser(user);
  return user;
}

async function softDelete(userId, deletedBy) {
  const user = findById(userId);
  if (!user) return null;
  if (user.deleted_at) return user;

  const originalEmail = user.deleted_email || user.email;
  user.deleted_at = new Date().toISOString();
  user.deleted_by = deletedBy || null;
  user.deleted_email = originalEmail;
  user.email = `deleted+${user.id}@afrovision.invalid`;
  user.password_hash = null;
  user.role = 'viewer';
  user.is_premium_creator = false;
  user.subscription_plan = null;
  user.subscription_status = 'inactive';
  user.subscription_expiry = null;
  user.fcm_tokens = [];
  user.following_creator_ids = [];
  await persistUser(user);
  return user;
}

async function hardDelete(userId) {
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) return null;
  const removed = users.splice(index, 1)[0];
  const db = getFirestore();
  await db.collection(USERS_COLLECTION).doc(userId).delete();
  return removed;
}

async function restoreSoftDeleted(userId) {
  const user = users.find((u) => u.id === userId);
  if (!user || !user.deleted_at) return null;
  user.email = user.deleted_email || user.email;
  delete user.deleted_at;
  delete user.deleted_by;
  delete user.deleted_email;
  await persistUser(user);
  return user;
}

function findDuplicateGroups() {
  const groups = new Map();
  for (const user of users) {
    if (user.deleted_at) continue;
    const email = (user.email || '').toLowerCase().trim();
    if (!email || email.endsWith('@afrovision.invalid')) continue;
    if (!groups.has(email)) groups.set(email, []);
    groups.get(email).push(user);
  }
  const duplicates = new Map();
  for (const [email, group] of groups) {
    if (group.length > 1) {
      group.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
      duplicates.set(email, group);
    }
  }
  return duplicates;
}

function findEmptyAccounts() {
  return users.filter((user) => {
    if (user.deleted_at) return false;
    const email = (user.email || '').trim();
    const hasEmail = email && !email.endsWith('@afrovision.invalid');
    // Check BOTH backend name field AND Flutter firstName/lastName fields
    const hasName = (user.name && user.name.trim()) ||
                    (user.firstName && user.firstName.trim()) ||
                    (user.lastName && user.lastName.trim());
    // Check ALL balance fields (Flutter cash/coins/vpt/slots)
    const hasBalance = parseFloat(user.cash || 0) > 0 ||
                       parseFloat(user.coins || 0) > 0 ||
                       parseFloat(user.vpt || 0) > 0 ||
                       parseFloat(user.slots || 0) > 0;
    const hasRole = user.role && user.role !== 'viewer';
    const hasSub = user.subscription_status && user.subscription_status !== 'inactive';
    const hasPremium = user.is_premium_creator === true;
    const hasKyc = user.kyc_status && user.kyc_status !== 'none';
    // Check Flutter-specific fields that indicate a real account
    const hasFlutterData = user.vpinId || user.deviceToken || user.refCode ||
                           user.isVerified === true || user.isAdmin === true ||
                           user.profilePicture || user.phone || user.mobile;
    // Any meaningful data means NOT empty
    if (hasEmail || hasName || hasBalance || hasRole || hasSub || hasPremium || hasKyc || hasFlutterData) return false;
    return true;
  });
}

async function storeResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 3600000;
  const entry = { userId, expires };
  resetTokens.set(token, entry);
  await persistResetToken(token, entry);
  return token;
}

function validateResetToken(token) {
  const entry = resetTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    resetTokens.delete(token);
    return null;
  }
  return entry;
}

async function deleteResetToken(token) {
  resetTokens.delete(token);
  await deletePersistedResetToken(token);
}

function toSafeUser(user) {
  // Lazy-load wallet to include BSC address
  let bscAddress = null;
  let subscriptionPlanType = null;
  try {
    const WalletModel = require('../wallet/wallet.model');
    const wallet = WalletModel.findByUserId(user.id);
    if (wallet) bscAddress = wallet.bsc_address;
  } catch { /* wallet module not loaded yet */ }

  try {
    const PlanModel = require('../subscriptions/plan.model');
    subscriptionPlanType = user.subscription_plan
      ? PlanModel.findByName(user.subscription_plan)?.type || null
      : null;
  } catch { /* plans module not loaded yet */ }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url || null,
    role: user.role,
    is_premium_creator: user.is_premium_creator,
    kyc_status: user.kyc_status,
    subscription_plan: user.subscription_plan,
    subscription_plan_type: subscriptionPlanType,
    subscription_status: user.subscription_status,
    subscription_expiry: user.subscription_expiry,
    preferred_currency: user.preferred_currency,
    vpt: Number(user.vpt) || 0,
    cash: Number(user.cash) || 0,
    coins: Number(user.coins) || 0,
    bank_details: user.bank_details || null,
    bsc_address: bscAddress,
    first_subscription_at: user.first_subscription_at,
    following_creator_ids: Array.isArray(user.following_creator_ids) ? user.following_creator_ids : [],
    following_creators_count: Array.isArray(user.following_creator_ids) ? user.following_creator_ids.length : 0,
    created_at: user.created_at,
  };
}

function toDetailedUser(user) {
  const SENSITIVE = new Set(['password_hash', 'pinHash']);
  const detailed = {};
  for (const [key, value] of Object.entries(user)) {
    if (SENSITIVE.has(key)) continue;
    detailed[key] = value;
  }

  // Normalize id
  detailed.id = user.id || user.userId || user.canonical_uid;

  // Lazy-load wallet
  let bscAddress = null;
  try {
    const WalletModel = require('../wallet/wallet.model');
    const wallet = WalletModel.findByUserId(user.id);
    if (wallet) bscAddress = wallet.bsc_address;
  } catch { /* wallet module not loaded yet */ }
  detailed.bsc_address = bscAddress;

  try {
    const PlanModel = require('../subscriptions/plan.model');
    detailed.subscription_plan_type = user.subscription_plan
      ? PlanModel.findByName(user.subscription_plan)?.type || null
      : null;
  } catch {
    detailed.subscription_plan_type = null;
  }

  // Ensure arrays
  detailed.following_creator_ids = Array.isArray(user.following_creator_ids) ? user.following_creator_ids : [];
  detailed.following_creators_count = detailed.following_creator_ids.length;
  detailed.badges = Array.isArray(user.badges) ? user.badges : [];

  return detailed;
}

function getAll(includeDeleted = false) {
  if (includeDeleted) return users;
  return users.filter((user) => !user.deleted_at);
}

async function reloadFromFirestore(userId) {
  const db = getFirestore();
  const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
  if (!doc.exists) return null;
  const fresh = { ...doc.data(), id: doc.id };
  const idx = users.findIndex((u) => u.id === userId);
  if (idx >= 0) users[idx] = fresh;
  else users.push(fresh);
  return fresh;
}

module.exports = {
  init,
  reinit,
  isInitialized,
  findByEmail,
  findById,
  create,
  getAll,
  updatePassword,
  updateProfile,
  setRole,
  setPremium,
  setKyc,
  setSubscription,
  setFirstSubscriptionAt,
  adjustVpt,
  adjustCash,
  adjustCoins,
  setBankDetails,
  setBlockchainTokens,
  followCreator,
  unfollowCreator,
  isFollowing,
  countFollowers,
  getFollowingCreatorIds,
  addFcmToken,
  removeFcmToken,
  softDelete,
  hardDelete,
  restoreSoftDeleted,
  findDuplicateGroups,
  findEmptyAccounts,
  storeResetToken,
  validateResetToken,
  deleteResetToken,
  toSafeUser,
  toDetailedUser,
  reloadFromFirestore,
};
