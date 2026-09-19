const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const USERS_COLLECTION = 'users';
const RESET_TOKENS_COLLECTION = 'password_reset_tokens';
const NOTIFICATION_TARGETS_COLLECTION = 'notification_targets';
const OPS_SUMMARIES_COLLECTION = 'ops_summaries';
const USER_BALANCE_SUMMARY_DOC = 'user_balances';

const usersById = new Map();
const usersByEmail = new Map();
const userLoadsById = new Map();
const userLoadsByEmail = new Map();

function generateWalletReference() {
  // Same style as referral codes: short, unique, safe to display/share.
  // Prefixed so it's unambiguous in support tickets / logs.
  return `AV-W-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

let resetTokens = new Map();
let initialized = false;
let allUsersLoaded = false;
let allUsersLoadPromise = null;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function shouldIndexEmail(user) {
  const email = normalizeEmail(user?.email);
  return Boolean(email) && !user?.deleted_at;
}

function cacheUser(user) {
  if (!user || !user.id) return null;

  const previous = usersById.get(user.id);
  if (previous?.email) {
    const previousEmailKey = normalizeEmail(previous.email);
    if (usersByEmail.get(previousEmailKey)?.id === user.id) {
      usersByEmail.delete(previousEmailKey);
    }
  }

  usersById.set(user.id, user);

  if (shouldIndexEmail(user)) {
    usersByEmail.set(normalizeEmail(user.email), user);
  }

  return user;
}

function removeCachedUser(userId) {
  if (!userId) return null;
  const existing = usersById.get(userId) || null;
  if (existing?.email) {
    const emailKey = normalizeEmail(existing.email);
    if (usersByEmail.get(emailKey)?.id === userId) {
      usersByEmail.delete(emailKey);
    }
  }
  usersById.delete(userId);
  return existing;
}

function cloneUserDoc(doc) {
  return { ...doc.data(), id: doc.id };
}

async function persistUser(user) {
  cacheUser(user);
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

function collectPushTokens(user) {
  if (!user) return [];
  const tokenSet = new Set(Array.isArray(user.fcm_tokens) ? user.fcm_tokens : []);
  if (user.afroDeviceToken) tokenSet.add(user.afroDeviceToken);
  return [...tokenSet].map((token) => String(token || '').trim()).filter(Boolean);
}

async function persistNotificationTargetByUser(userId, user = null) {
  if (!userId) return;
  const db = getFirestore();
  const docRef = db.collection(NOTIFICATION_TARGETS_COLLECTION).doc(userId);

  let source = user;
  if (!source) {
    source = await findById(userId);
  }

  const tokens = collectPushTokens(source);
  await docRef.set({
    user_id: userId,
    has_tokens: tokens.length > 0,
    token_count: tokens.length,
    tokens,
    updated_at: Date.now(),
  }, { merge: true });
}

async function deleteNotificationTarget(userId) {
  if (!userId) return;
  const db = getFirestore();
  await db.collection(NOTIFICATION_TARGETS_COLLECTION).doc(userId).delete().catch(() => {});
}

async function listNotificationTargetsPage({ limit = 500, startAfterId = null } = {}) {
  const db = getFirestore();
  let query = db.collection(NOTIFICATION_TARGETS_COLLECTION)
    .where('has_tokens', '==', true)
    .orderBy('__name__')
    .limit(Math.max(1, Math.min(limit, 1000)));

  if (startAfterId) {
    query = query.startAfter(startAfterId);
  }

  const snapshot = await query.get();
  const targets = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const nextCursor = snapshot.docs.length === Math.max(1, Math.min(limit, 1000))
    ? snapshot.docs[snapshot.docs.length - 1].id
    : null;

  return { targets, nextCursor };
}

async function deletePersistedResetToken(token) {
  const db = getFirestore();
  await db.collection(RESET_TOKENS_COLLECTION).doc(token).delete();
}

async function incrementUserBalanceSummary({ cashDelta = 0, vptDelta = 0, coinsDelta = 0 } = {}) {
  const hasDelta = cashDelta !== 0 || vptDelta !== 0 || coinsDelta !== 0;
  if (!hasDelta) return;

  const db = getFirestore();
  const docRef = db.collection(OPS_SUMMARIES_COLLECTION).doc(USER_BALANCE_SUMMARY_DOC);

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(docRef);
    const current = snapshot.exists ? snapshot.data() : {};
    tx.set(docRef, {
      total_cash: Number(current.total_cash || 0) + Number(cashDelta || 0),
      total_vpt: Number(current.total_vpt || 0) + Number(vptDelta || 0),
      total_coins: Number(current.total_coins || 0) + Number(coinsDelta || 0),
      updated_at: Date.now(),
    }, { merge: true });
  });
}

async function getBalanceSummary() {
  const db = getFirestore();
  const snapshot = await db.collection(OPS_SUMMARIES_COLLECTION).doc(USER_BALANCE_SUMMARY_DOC).get();
  if (!snapshot.exists) {
    return {
      total_cash: 0,
      total_vpt: 0,
      total_coins: 0,
    };
  }

  const data = snapshot.data() || {};
  return {
    total_cash: Number(data.total_cash || 0),
    total_vpt: Number(data.total_vpt || 0),
    total_coins: Number(data.total_coins || 0),
  };
}

async function init() {
  const db = getFirestore();
  const resetTokensSnapshot = await db.collection(RESET_TOKENS_COLLECTION).get();

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
  return [];
}

function isInitialized() {
  return initialized;
}

async function reinit() {
  initialized = false;
  resetTokens = new Map();
  usersById.clear();
  usersByEmail.clear();
  userLoadsById.clear();
  userLoadsByEmail.clear();
  allUsersLoaded = false;
  allUsersLoadPromise = null;
  return init();
}

function findCachedByEmail(email, includeDeleted = false) {
  const cached = usersByEmail.get(normalizeEmail(email)) || null;
  if (!cached) return null;
  if (!includeDeleted && cached.deleted_at) return null;
  return cached;
}

function findCachedById(id, includeDeleted = true) {
  const cached = usersById.get(id) || null;
  if (!cached) return null;
  if (!includeDeleted && cached.deleted_at) return null;
  return cached;
}

function getCachedAll(includeDeleted = false) {
  const cached = Array.from(usersById.values());
  if (includeDeleted) return cached;
  return cached.filter((user) => !user.deleted_at);
}

async function loadUserById(id) {
  if (!id) return null;

  const cached = findCachedById(id);
  if (cached) return cached;

  if (userLoadsById.has(id)) {
    return userLoadsById.get(id);
  }

  const promise = (async () => {
    const db = getFirestore();
    const doc = await db.collection(USERS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return cacheUser(cloneUserDoc(doc));
  })();

  userLoadsById.set(id, promise);

  try {
    return await promise;
  } finally {
    userLoadsById.delete(id);
  }
}

async function loadUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const cached = findCachedByEmail(normalizedEmail, true);
  if (cached) return cached;

  if (userLoadsByEmail.has(normalizedEmail)) {
    return userLoadsByEmail.get(normalizedEmail);
  }

  const promise = (async () => {
    const db = getFirestore();
    const snapshot = await db.collection(USERS_COLLECTION)
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return cacheUser(cloneUserDoc(snapshot.docs[0]));
  })();

  userLoadsByEmail.set(normalizedEmail, promise);

  try {
    return await promise;
  } finally {
    userLoadsByEmail.delete(normalizedEmail);
  }
}

async function hydrateAllUsers() {
  if (allUsersLoaded) return getCachedAll(true);
  if (allUsersLoadPromise) return allUsersLoadPromise;

  allUsersLoadPromise = (async () => {
    const db = getFirestore();
    const snapshot = await db.collection(USERS_COLLECTION).get();

    usersById.clear();
    usersByEmail.clear();

    for (const doc of snapshot.docs) {
      cacheUser(cloneUserDoc(doc));
    }

    allUsersLoaded = true;
    return getCachedAll(true);
  })();

  try {
    return await allUsersLoadPromise;
  } finally {
    allUsersLoadPromise = null;
  }
}

function findByEmail(email) {
  const cached = findCachedByEmail(email, true);
  if (cached) {
    return cached.deleted_at ? null : cached;
  }

  return loadUserByEmail(email).then((user) => {
    if (!user || user.deleted_at) return null;
    return user;
  });
}

function findById(id) {
  const cached = findCachedById(id);
  return cached ? _ensureWalletReference(cached) : loadUserById(id).then(_ensureWalletReference);
}

// Accounts created before wallet_reference existed don't have one yet.
// Backfill lazily on first read after this change ships, instead of a
// one-off migration script, so every existing user gets a real, persisted
// reference the first time their profile is loaded.
function _ensureWalletReference(user) {
  if (!user || user.wallet_reference) return user;
  user.wallet_reference = generateWalletReference();
  persistUser(user).catch((err) => {
    console.error('[User] Failed to backfill wallet_reference:', err.message);
  });
  return user;
}

async function create({ email, passwordHash }) {
  const user = {
    id: crypto.randomUUID(),
    email: normalizeEmail(email),
    password_hash: passwordHash,
    name: null,
    firstName: null,
    lastName: null,
    country: null,
    state: null,
    city: null,
    address: null,
    phoneNumber: null,
    referralSource: null,
    referralSourceDetail: null,
    role: 'viewer',
    is_premium_creator: false,
    kyc_status: 'none',
    date_of_birth: null,
    is_minor: false,
    guardian_id: null,
    kyc_grace_period_end: null,
    kyc_reminder_count: 0,
    subscription_plan: null,
    subscription_status: 'inactive',
    subscription_expiry: null,
    preferred_currency: 'NGN',
    vpt: 0,
    cash: 0,
    coins: 0,
    bank_details: null,
    wallet_reference: generateWalletReference(),
    first_subscription_at: null,
    following_creator_ids: [],
    following_channel_ids: [],
    fcm_tokens: [],
    created_at: new Date().toISOString(),
  };
  await persistUser(user);
  return user;
}

async function updatePassword(userId, passwordHash) {
  const user = await findById(userId);
  if (!user) return null;
  user.password_hash = passwordHash;
  await persistUser(user);
  return user;
}

async function updateProfile(userId, fields) {
  const user = await findById(userId);
  if (!user) return null;
  if (fields.name !== undefined) user.name = fields.name;
  if (fields.email !== undefined) user.email = normalizeEmail(fields.email);
  if (fields.avatar_url !== undefined) user.avatar_url = fields.avatar_url;
  if (fields.preferred_currency !== undefined) user.preferred_currency = fields.preferred_currency;
  if (fields.bank_details !== undefined) user.bank_details = fields.bank_details;
  if (fields.firstName !== undefined) user.firstName = fields.firstName;
  if (fields.lastName !== undefined) user.lastName = fields.lastName;
  if (fields.country !== undefined) user.country = fields.country;
  if (fields.state !== undefined) user.state = fields.state;
  if (fields.city !== undefined) user.city = fields.city;
  if (fields.address !== undefined) user.address = fields.address;
  if (fields.phoneNumber !== undefined) user.phoneNumber = fields.phoneNumber;
  if (fields.referralSource !== undefined) user.referralSource = fields.referralSource;
  if (fields.referralSourceDetail !== undefined) user.referralSourceDetail = fields.referralSourceDetail;
  if (fields.date_of_birth !== undefined) user.date_of_birth = fields.date_of_birth;
  if (fields.is_minor !== undefined) user.is_minor = fields.is_minor;
  if (fields.guardian_id !== undefined) user.guardian_id = fields.guardian_id;
  if (fields.kyc_grace_period_end !== undefined) user.kyc_grace_period_end = fields.kyc_grace_period_end;
  if (fields.kyc_reminder_count !== undefined) user.kyc_reminder_count = fields.kyc_reminder_count;
  if (fields.player_settings !== undefined) user.player_settings = fields.player_settings;
  await persistUser(user);
  return user;
}

async function setBankDetails(userId, bankDetails) {
  const user = await findById(userId);
  if (!user) return null;
  user.bank_details = bankDetails;
  await persistUser(user);
  return user;
}

async function setRole(userId, role) {
  const user = await findById(userId);
  if (!user) return null;
  user.role = role;
  await persistUser(user);
  return user;
}

async function setPremium(userId, isPremium) {
  const user = await findById(userId);
  if (!user) return null;
  user.is_premium_creator = isPremium;
  await persistUser(user);
  return user;
}

async function setKyc(userId, kycStatus) {
  const user = await findById(userId);
  if (!user) return null;
  user.kyc_status = kycStatus;
  await persistUser(user);
  return user;
}

function computeIsMinor(dob) {
  if (!dob) return false;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return false;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age < 18;
}

async function setDateOfBirth(userId, dob) {
  const user = await findById(userId);
  if (!user) return null;
  user.date_of_birth = dob;
  user.is_minor = computeIsMinor(dob);
  await persistUser(user);
  return user;
}

async function setGuardian(userId, guardianId) {
  const user = await findById(userId);
  if (!user) return null;
  user.guardian_id = guardianId;
  await persistUser(user);
  return user;
}

async function setKycGracePeriod(userId, endDate) {
  const user = await findById(userId);
  if (!user) return null;
  user.kyc_grace_period_end = endDate;
  await persistUser(user);
  return user;
}

async function incrementKycReminderCount(userId) {
  const user = await findById(userId);
  if (!user) return null;
  user.kyc_reminder_count = (user.kyc_reminder_count || 0) + 1;
  await persistUser(user);
  return user;
}

async function setSubscription(userId, { plan, status, expiry }) {
  const user = await findById(userId);
  if (!user) return null;
  user.subscription_plan = plan;
  user.subscription_status = status;
  user.subscription_expiry = expiry;
  await persistUser(user);
  return user;
}

async function setFirstSubscriptionAt(userId, firstSubscriptionAt) {
  const user = await findById(userId);
  if (!user) return null;
  user.first_subscription_at = firstSubscriptionAt;
  await persistUser(user);
  return user;
}

async function adjustVpt(userId, delta) {
  const user = await findById(userId);
  if (!user) return null;
  user.vpt = Math.round(((user.vpt || 0) + delta) * 10000) / 10000;
  await persistUser(user);
  await incrementUserBalanceSummary({ vptDelta: delta }).catch(() => {});
  return user;
}

async function adjustCash(userId, delta) {
  const user = await findById(userId);
  if (!user) return null;
  user.cash = Math.round(((user.cash || 0) + delta) * 100) / 100;
  await persistUser(user);
  await incrementUserBalanceSummary({ cashDelta: delta }).catch(() => {});
  return user;
}

async function adjustCoins(userId, delta) {
  const user = await findById(userId);
  if (!user) return null;
  user.coins = Math.round(((user.coins || 0) + delta) * 100) / 100;
  await persistUser(user);
  await incrementUserBalanceSummary({ coinsDelta: delta }).catch(() => {});
  return user;
}

async function setBlockchainTokens(userId, rawValue) {
  const user = await findById(userId);
  if (!user) return null;
  user.blockchain_tokens = rawValue != null ? String(rawValue) : null;
  await persistUser(user);
  return user;
}

async function addFcmToken(userId, token) {
  const user = await findById(userId);
  if (!user) return null;
  if (!Array.isArray(user.fcm_tokens)) user.fcm_tokens = [];

  let changed = false;
  if (user.afroDeviceToken !== token) {
    user.afroDeviceToken = token;
    changed = true;
  }

  if (!user.fcm_tokens.includes(token)) {
    user.fcm_tokens.push(token);
    changed = true;
  }

  if (changed) {
    await persistUser(user);
    await persistNotificationTargetByUser(userId, user);
  }
  return user;
}

function ensureFollowingList(user) {
  if (!Array.isArray(user.following_creator_ids)) {
    user.following_creator_ids = [];
  }
}

function ensureFollowingChannelList(user) {
  if (!Array.isArray(user.following_channel_ids)) {
    user.following_channel_ids = [];
  }
}

async function followCreator(userId, creatorId) {
  const user = await findById(userId);
  if (!user) return null;
  ensureFollowingList(user);
  if (!user.following_creator_ids.includes(creatorId)) {
    user.following_creator_ids.push(creatorId);
    await persistUser(user);
  }
  return user;
}

async function unfollowCreator(userId, creatorId) {
  const user = await findById(userId);
  if (!user) return null;
  ensureFollowingList(user);
  const before = user.following_creator_ids.length;
  user.following_creator_ids = user.following_creator_ids.filter((id) => id !== creatorId);
  if (before !== user.following_creator_ids.length) {
    await persistUser(user);
  }
  return user;
}

async function isFollowing(userId, creatorId) {
  const user = await findById(userId);
  if (!user) return false;
  ensureFollowingList(user);
  return user.following_creator_ids.includes(creatorId);
}

async function countFollowers(creatorId) {
  const db = getFirestore();
  const snapshot = await db.collection(USERS_COLLECTION)
    .where('following_creator_ids', 'array-contains', creatorId)
    .count()
    .get();
  return snapshot.data().count || 0;
}

async function getFollowingCreatorIds(userId) {
  const user = await findById(userId);
  if (!user) return [];
  ensureFollowingList(user);
  return [...user.following_creator_ids];
}

async function followChannel(userId, channelId) {
  const user = await findById(userId);
  if (!user) return null;
  ensureFollowingChannelList(user);
  if (!user.following_channel_ids.includes(channelId)) {
    user.following_channel_ids.push(channelId);
    await persistUser(user);
  }
  return user;
}

async function unfollowChannel(userId, channelId) {
  const user = await findById(userId);
  if (!user) return null;
  ensureFollowingChannelList(user);
  const before = user.following_channel_ids.length;
  user.following_channel_ids = user.following_channel_ids.filter((id) => id !== channelId);
  if (before !== user.following_channel_ids.length) {
    await persistUser(user);
  }
  return user;
}

async function isFollowingChannel(userId, channelId) {
  const user = await findById(userId);
  if (!user) return false;
  ensureFollowingChannelList(user);
  return user.following_channel_ids.includes(channelId);
}

async function countChannelFollowers(channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(USERS_COLLECTION)
    .where('following_channel_ids', 'array-contains', channelId)
    .count()
    .get();
  return snapshot.data().count || 0;
}

async function removeFcmToken(userId, token) {
  const user = await findById(userId);
  if (!user) return null;
  if (!Array.isArray(user.fcm_tokens)) {
    user.fcm_tokens = [];
    return user;
  }
  const before = user.fcm_tokens.length;
  user.fcm_tokens = user.fcm_tokens.filter((t) => t !== token);
  if (user.afroDeviceToken === token) {
    user.afroDeviceToken = null;
  }
  if (user.fcm_tokens.length !== before) {
    await persistUser(user);
    await persistNotificationTargetByUser(userId, user);
  } else if (user.afroDeviceToken === null) {
    await persistNotificationTargetByUser(userId, user);
  }
  return user;
}

async function softDelete(userId, deletedBy) {
  const user = await findById(userId);
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
  user.afroDeviceToken = null;
  user.fcm_tokens = [];
  user.following_creator_ids = [];
  await persistUser(user);
  await persistNotificationTargetByUser(userId, user);
  return user;
}

async function hardDelete(userId) {
  const existing = await findById(userId);
  if (!existing) return null;
  removeCachedUser(userId);
  const db = getFirestore();
  await deleteNotificationTarget(userId);
  await db.collection(USERS_COLLECTION).doc(userId).delete();
  return existing;
}

async function restoreSoftDeleted(userId) {
  const user = await findById(userId);
  if (!user || !user.deleted_at) return null;
  user.email = user.deleted_email || user.email;
  delete user.deleted_at;
  delete user.deleted_by;
  delete user.deleted_email;
  await persistUser(user);
  return user;
}

async function findDuplicateGroups() {
  const allUsers = await getAll(true);
  const groups = new Map();
  for (const user of allUsers) {
    if (user.deleted_at) continue;
    const email = normalizeEmail(user.email);
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

async function findEmptyAccounts() {
  const allUsers = await getAll();
  return allUsers.filter((user) => {
    const email = String(user.email || '').trim();
    const hasEmail = email && !email.endsWith('@afrovision.invalid');
    const hasName = (user.name && user.name.trim())
      || (user.firstName && user.firstName.trim())
      || (user.lastName && user.lastName.trim());
    const hasBalance = parseFloat(user.cash || 0) > 0
      || parseFloat(user.coins || 0) > 0
      || parseFloat(user.vpt || 0) > 0
      || parseFloat(user.slots || 0) > 0;
    const hasRole = user.role && user.role !== 'viewer';
    const hasSub = user.subscription_status && user.subscription_status !== 'inactive';
    const hasPremium = user.is_premium_creator === true;
    const hasKyc = user.kyc_status && user.kyc_status !== 'none';
    const hasFlutterData = user.vpinId || user.deviceToken || user.refCode
      || user.isVerified === true || user.isAdmin === true
      || user.profilePicture || user.phone || user.mobile;
    if (hasEmail || hasName || hasBalance || hasRole || hasSub || hasPremium || hasKyc || hasFlutterData) {
      return false;
    }
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

function hasActiveSubscription(user) {
  if (!user) return false;
  if (user.subscription_status !== 'active') return false;
  if (!user.subscription_expiry) return false;
  const expiry = new Date(user.subscription_expiry);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() > Date.now();
}

function toSafeUser(user) {
  let bscAddress = null;
  let subscriptionPlanType = null;
  try {
    const WalletModel = require('../wallet/wallet.model');
    const wallet = WalletModel.findCachedByUserId(user.id);
    if (wallet) bscAddress = wallet.bsc_address;
  } catch {}

  try {
    const PlanModel = require('../subscriptions/plan.model');
    subscriptionPlanType = user.subscription_plan
      ? PlanModel.findCachedByName(user.subscription_plan)?.type || null
      : null;
  } catch {}

  const profileSetupComplete = user.role === 'admin' || (
    Boolean(user.firstName && String(user.firstName).trim()) &&
    Boolean(user.lastName && String(user.lastName).trim()) &&
    Boolean(user.country && String(user.country).trim()) &&
    Boolean(user.state && String(user.state).trim()) &&
    Boolean(user.city && String(user.city).trim()) &&
    Boolean(user.address && String(user.address).trim()) &&
    Boolean(user.phoneNumber && String(user.phoneNumber).trim()) &&
    Boolean(user.referralSource && String(user.referralSource).trim()) &&
    (user.referralSource !== 'Other, please specify' || Boolean(user.referralSourceDetail && String(user.referralSourceDetail).trim())) &&
    Boolean(user.avatar_url || user.profilePicture)
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
    firstName: user.firstName || null,
    middleName: user.middleName || null,
    lastName: user.lastName || null,
    avatar_url: user.avatar_url || user.profilePicture || null,
    profilePicture: user.profilePicture || user.avatar_url || null,
    mobile: user.mobile || null,
    phoneNumber: user.phoneNumber || null,
    country: user.country || null,
    state: user.state || null,
    city: user.city || null,
    address: user.address || null,
    referralSource: user.referralSource || null,
    referralSourceDetail: user.referralSourceDetail || null,
    profile_setup_complete: profileSetupComplete,
    vpinId: user.vpinId || null,
    role: user.role,
    is_premium_creator: user.is_premium_creator,
    kyc_status: user.kyc_status,
    date_of_birth: user.date_of_birth || null,
    is_minor: user.is_minor || false,
    guardian_id: user.guardian_id || null,
    kyc_grace_period_end: user.kyc_grace_period_end || null,
    kyc_reminder_count: user.kyc_reminder_count || 0,
    subscription_plan: user.subscription_plan,
    subscription_plan_type: subscriptionPlanType,
    subscription_status: user.subscription_status,
    subscription_expiry: user.subscription_expiry,
    preferred_currency: user.preferred_currency,
    vpt: Number(user.vpt) || 0,
    cash: Number(user.cash) || 0,
    coins: Number(user.coins) || 0,
    bank_details: user.bank_details || null,
    player_settings: user.player_settings || null,
    wallet_reference: user.wallet_reference || null,
    bsc_address: bscAddress,
    first_subscription_at: user.first_subscription_at,
    following_creator_ids: Array.isArray(user.following_creator_ids) ? user.following_creator_ids : [],
    following_creators_count: Array.isArray(user.following_creator_ids) ? user.following_creator_ids.length : 0,
    following_channel_ids: Array.isArray(user.following_channel_ids) ? user.following_channel_ids : [],
    following_channels_count: Array.isArray(user.following_channel_ids) ? user.following_channel_ids.length : 0,
    created_at: user.created_at,
    is_banned: user.is_banned || false,
    banned_at: user.banned_at || null,
    ban_reason: user.ban_reason || null,
    wallet_frozen: user.wallet_frozen || false,
    withdrawal_banned: user.withdrawal_banned || false,
    channel_creation_banned: user.channel_creation_banned || false,
  };
}

function toDetailedUser(user) {
  const SENSITIVE = new Set(['password_hash', 'pinHash']);
  const detailed = {};
  for (const [key, value] of Object.entries(user)) {
    if (SENSITIVE.has(key)) continue;
    detailed[key] = value;
  }

  detailed.id = user.id || user.userId || user.canonical_uid;

  let bscAddress = null;
  try {
    const WalletModel = require('../wallet/wallet.model');
    const wallet = WalletModel.findCachedByUserId(user.id);
    if (wallet) bscAddress = wallet.bsc_address;
  } catch {}
  detailed.bsc_address = bscAddress;

  try {
    const PlanModel = require('../subscriptions/plan.model');
    detailed.subscription_plan_type = user.subscription_plan
      ? PlanModel.findCachedByName(user.subscription_plan)?.type || null
      : null;
  } catch {
    detailed.subscription_plan_type = null;
  }

  detailed.following_creator_ids = Array.isArray(user.following_creator_ids) ? user.following_creator_ids : [];
  detailed.following_creators_count = detailed.following_creator_ids.length;
  detailed.following_channel_ids = Array.isArray(user.following_channel_ids) ? user.following_channel_ids : [];
  detailed.following_channels_count = detailed.following_channel_ids.length;
  detailed.badges = Array.isArray(user.badges) ? user.badges : [];

  return detailed;
}

function getAll(includeDeleted = false) {
  if (allUsersLoaded) {
    return getCachedAll(includeDeleted);
  }

  return hydrateAllUsers().then(() => getCachedAll(includeDeleted));
}

async function reloadFromFirestore(userId) {
  const db = getFirestore();
  const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
  if (!doc.exists) {
    removeCachedUser(userId);
    return null;
  }
  return cacheUser(cloneUserDoc(doc));
}

async function banUser(userId, reason) {
  const user = await findById(userId);
  if (!user) return null;
  user.is_banned = true;
  user.banned_at = new Date().toISOString();
  user.ban_reason = reason || null;
  await persistUser(user);
  return user;
}

async function unbanUser(userId) {
  const user = await findById(userId);
  if (!user) return null;
  user.is_banned = false;
  user.banned_at = null;
  user.ban_reason = null;
  await persistUser(user);
  return user;
}

async function freezeWallet(userId) {
  const user = await findById(userId);
  if (!user) return null;
  user.wallet_frozen = true;
  await persistUser(user);
  return user;
}

async function unfreezeWallet(userId) {
  const user = await findById(userId);
  if (!user) return null;
  user.wallet_frozen = false;
  await persistUser(user);
  return user;
}

async function banWithdrawal(userId) {
  const user = await findById(userId);
  if (!user) return null;
  user.withdrawal_banned = true;
  await persistUser(user);
  return user;
}

async function unbanWithdrawal(userId) {
  const user = await findById(userId);
  if (!user) return null;
  user.withdrawal_banned = false;
  await persistUser(user);
  return user;
}

async function banChannelCreation(userId, reason) {
  const user = await findById(userId);
  if (!user) return null;
  user.channel_creation_banned = true;
  user.channel_creation_ban_reason = reason || null;
  await persistUser(user);
  return user;
}

async function unbanChannelCreation(userId) {
  const user = await findById(userId);
  if (!user) return null;
  user.channel_creation_banned = false;
  user.channel_creation_ban_reason = null;
  await persistUser(user);
  return user;
}

module.exports = {
  init,
  reinit,
  isInitialized,
  findByEmail,
  findById,
  findCachedByEmail,
  findCachedById,
  create,
  getAll,
  getCachedAll,
  updatePassword,
  updateProfile,
  setRole,
  setPremium,
  setKyc,
  computeIsMinor,
  setDateOfBirth,
  setGuardian,
  setKycGracePeriod,
  incrementKycReminderCount,
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
  followChannel,
  unfollowChannel,
  isFollowingChannel,
  countChannelFollowers,
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
  hasActiveSubscription,
  toSafeUser,
  toDetailedUser,
  reloadFromFirestore,
  persistNotificationTargetByUser,
  listNotificationTargetsPage,
  getBalanceSummary,
  banUser,
  unbanUser,
  freezeWallet,
  unfreezeWallet,
  banWithdrawal,
  unbanWithdrawal,
  banChannelCreation,
  unbanChannelCreation,
};
