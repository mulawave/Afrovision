const User = require('../users/user.model');
const Plan = require('../subscriptions/plan.model');
const Category = require('../channels/category.model');
const SettingsService = require('./settings.service');
const Channel = require('../channels/channel.model');
const Ledger = require('../vpt/ledger.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const Withdrawal = require('../wallet/withdrawal.model');
const Wallet = require('../wallet/wallet.model');
const AuditService = require('./audit.service');
const { serializeChannelForAdmin } = require('./admin.presenter');
const { getFirestore } = require('../utils/firestore');
const { getAuth } = require('firebase-admin/auth');

const VALID_ROLES = ['viewer', 'creator', 'admin'];
const VALID_KYC = ['none', 'pending', 'verified'];

function requireAdmin(req, res) {
  const caller = User.findById(req.userId);
  if (!caller || caller.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return caller;
}

async function setRole(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;
  const { userId, role } = req.body;
  if (!userId || !role) return res.status(400).json({ error: 'userId and role are required' });
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const user = await User.setRole(userId, role);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await AuditService.logAction(caller.id, 'set_role', userId, { role });
  res.json({ user: User.toSafeUser(user) });
}

async function setPremium(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;
  const { userId, isPremium } = req.body;
  if (!userId || typeof isPremium !== 'boolean') return res.status(400).json({ error: 'userId and isPremium (bool) are required' });
  const user = await User.setPremium(userId, isPremium);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await AuditService.logAction(caller.id, 'set_premium', userId, { isPremium });
  res.json({ user: User.toSafeUser(user) });
}

async function setKyc(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;
  const { userId, kycStatus } = req.body;
  if (!userId || !kycStatus) return res.status(400).json({ error: 'userId and kycStatus are required' });
  if (!VALID_KYC.includes(kycStatus)) return res.status(400).json({ error: 'Invalid KYC status' });
  const user = await User.setKyc(userId, kycStatus);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await AuditService.logAction(caller.id, 'set_kyc', userId, { kycStatus });
  res.json({ user: User.toSafeUser(user) });
}

// --- Plan Management ---

function listPlans(req, res) {
  if (!requireAdmin(req, res)) return;
  const plans = Plan.getAll();
  res.json({ plans });
}

async function createPlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const { name, price, currency, features, display_labels, badge } = req.body;
  if (!name) return res.status(400).json({ error: 'Plan name is required' });
  const plan = await Plan.create({ name, price, currency, features, display_labels, badge });
  res.status(201).json({ plan });
}

async function updatePlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const plan = await Plan.update(req.params.id, req.body);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ plan });
}

async function deletePlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const removed = await Plan.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Plan not found' });
  res.json({ message: 'Plan deleted' });
}

async function addFeatureToPlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const { feature, label } = req.body;
  if (!feature) return res.status(400).json({ error: 'feature is required' });
  const plan = await Plan.addFeature(req.params.id, feature, label);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ plan });
}

async function removeFeatureFromPlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const plan = await Plan.removeFeature(req.params.id, req.params.feature);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ plan });
}

// --- Category Management ---

function getCategories(req, res) {
  if (!requireAdmin(req, res)) return;
  const categories = Category.getAll(true);
  res.json({ categories });
}

async function createCategory(req, res) {
  if (!requireAdmin(req, res)) return;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  const category = await Category.create({ name });
  res.status(201).json({ category });
}

async function updateCategory(req, res) {
  if (!requireAdmin(req, res)) return;
  const category = await Category.update(req.params.id, req.body);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json({ category });
}

async function deleteCategory(req, res) {
  if (!requireAdmin(req, res)) return;
  const removed = await Category.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Category not found' });
  res.json({ message: 'Category deleted' });
}

// --- Settings Management ---

function getSettingsErrorStatus(error) {
  if (error.message.startsWith('Firestore unavailable')) return 503;
  if (error.message.includes('cannot be updated')) return 400;
  if (error.message.includes('Missing setting')) return 404;
  if (error.message.includes('must be one of')) return 400;
  return 500;
}

function getAdminDataErrorStatus(error) {
  if (error.message.startsWith('Firestore unavailable')) return 503;
  return 500;
}

async function getSettings(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    const settings = await SettingsService.getAll();
    res.json({ settings });
  } catch (error) {
    res.status(getSettingsErrorStatus(error)).json({ error: error.message });
  }
}

async function getSetting(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    const setting = await SettingsService.getOne(req.params.key);
    if (!setting) return res.status(404).json({ error: 'Setting not found' });
    res.json({ setting });
  } catch (error) {
    res.status(getSettingsErrorStatus(error)).json({ error: error.message });
  }
}

async function updateSetting(req, res) {
  if (!requireAdmin(req, res)) return;
  const caller = requireAdmin(req, res);
  if (!caller) return;
  const { key } = req.params;
  const { value } = req.body;

  if (!SettingsService.isValidKey(key)) return res.status(404).json({ error: 'Setting not found' });
  if (value === undefined || value === null) return res.status(400).json({ error: 'value is required' });

  try {
    const result = await SettingsService.set(key, String(value), caller.id);
    res.json({ setting: result });
  } catch (error) {
    res.status(getSettingsErrorStatus(error)).json({ error: error.message });
  }
}

async function bulkUpdateSettings(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;
  const { settings } = req.body;

  if (!Array.isArray(settings) || settings.length === 0) {
    return res.status(400).json({ error: 'settings array is required' });
  }

  for (const entry of settings) {
    if (!entry.key || entry.value === undefined) {
      return res.status(400).json({ error: 'Each entry must have key and value' });
    }
    if (!SettingsService.isValidKey(entry.key)) {
      return res.status(400).json({ error: `Invalid setting key: ${entry.key}` });
    }
  }

  try {
    const results = await SettingsService.bulkSet(
      settings.map((s) => ({ key: s.key, value: String(s.value) })),
      caller.id
    );
    res.json({ updated: results });
  } catch (error) {
    res.status(getSettingsErrorStatus(error)).json({ error: error.message });
  }
}

async function resetSetting(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  try {
    const result = await SettingsService.reset(req.params.key, caller.id);
    if (!result) return res.status(404).json({ error: 'Setting not found' });
    res.json({ setting: result });
  } catch (error) {
    res.status(getSettingsErrorStatus(error)).json({ error: error.message });
  }
}

// --- User Management ---

function listUsers(req, res) {
  if (!requireAdmin(req, res)) return;
  const users = User.getAll().map((u) => User.toSafeUser(u));
  res.json({ users });
}

async function deleteUser(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const { uid } = req.params;
  if (!uid) return res.status(400).json({ error: 'uid is required' });
  if (uid === caller.id) return res.status(400).json({ error: 'You cannot delete your own admin account' });

  const user = User.findById(uid);
  if (!user || user.deleted_at) {
    return res.status(404).json({ error: 'User not found' });
  }

  const activeOwnedChannels = Channel.getEvery().filter((channel) => channel.owner_id === uid && channel.is_active);
  for (const channel of activeOwnedChannels) {
    await Channel.disable(channel.id);
  }

  const deleted = await User.softDelete(uid, caller.id);
  await AuditService.logAction(caller.id, 'delete_user', uid, {
    deleted_email: user.deleted_email || user.email,
    disabled_channels: activeOwnedChannels.length,
  });

  res.json({
    message: `Deleted ${user.deleted_email || user.email}`,
    user: User.toSafeUser(deleted),
  });
}

async function recoverAccounts(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  // Find all soft-deleted users in memory
  const allUsers = User.getAll(true);
  const softDeleted = allUsers.filter((u) => u.deleted_at);

  if (softDeleted.length === 0) {
    return res.json({ message: 'No soft-deleted accounts found to recover', recovered: 0, details: [] });
  }

  const details = [];
  let recovered = 0;

  for (const user of softDeleted) {
    const restored = await User.restoreSoftDeleted(user.id);
    if (restored) {
      recovered++;
      details.push({ id: restored.id, email: restored.email, was_deleted_at: user.deleted_at });
    }
  }

  await AuditService.logAction(caller.id, 'recover_soft_deleted', null, { recovered, ids: details.map((d) => d.id) });
  res.json({ message: `Recovered ${recovered} soft-deleted account${recovered !== 1 ? 's' : ''}`, recovered, details });
}

async function reconstructHardDeleted(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'userIds array is required' });
  }

  const db = getFirestore();
  const auth = getAuth();
  const results = [];

  for (const uid of userIds) {
    const result = { id: uid, status: 'unknown', source: null };

    // Check if user already exists in Firestore (not actually deleted)
    const existingDoc = await db.collection('users').doc(uid).get();
    if (existingDoc.exists) {
      result.status = 'already_exists';
      result.email = existingDoc.data().email;
      results.push(result);
      continue;
    }

    // Try to find surviving subcollections
    const docRef = db.collection('users').doc(uid);
    let subColls = [];
    try {
      subColls = await docRef.listCollections();
    } catch { /* ignore */ }

    // Try Firebase Auth lookup
    let authUser = null;
    try {
      authUser = await auth.getUser(uid);
    } catch { /* not a Firebase Auth user or doesn't exist */ }

    // Build a reconstructed user document from whatever data we have
    const reconstructed = {
      id: uid,
      role: 'viewer',
      kyc_status: 'none',
      is_premium_creator: false,
      subscription_status: 'inactive',
      vpt_balance: 0,
      created_at: null,
      recovered_at: new Date().toISOString(),
      _recovered: true,
      _recovery_sources: [],
    };

    if (authUser) {
      reconstructed.email = authUser.email || null;
      reconstructed.name = authUser.displayName || null;
      reconstructed.profilePicture = authUser.photoURL || null;
      reconstructed.phone = authUser.phoneNumber || null;
      reconstructed.created_at = authUser.metadata?.creationTime || null;
      reconstructed._recovery_sources.push('firebase_auth');
      result.source = 'firebase_auth';
      result.email = authUser.email;
    }

    // Check subcollections for any useful data
    const subcollectionNames = subColls.map((c) => c.id);
    reconstructed._surviving_subcollections = subcollectionNames;

    if (subcollectionNames.length > 0) {
      reconstructed._recovery_sources.push('subcollections');
      if (!result.source) result.source = 'subcollections';
    }

    // If system account, reconstruct with system role
    if (uid.startsWith('system_')) {
      reconstructed.email = `${uid}@system.afrovision.internal`;
      reconstructed.name = uid.replace(/_/g, ' ').replace(/^system /, 'System ');
      reconstructed.role = 'admin';
      reconstructed._recovery_sources.push('system_account');
      result.source = 'system_account';
      result.email = reconstructed.email;
    }

    // Only reconstruct if we have some identifying data
    if (!reconstructed.email && subcollectionNames.length === 0 && !uid.startsWith('system_')) {
      result.status = 'unrecoverable';
      result.detail = 'No Firebase Auth user, no subcollections, no identifying data';
      results.push(result);
      continue;
    }

    // Write the reconstructed document to Firestore
    await docRef.set(reconstructed);

    // Reload into in-memory store
    const allUsers = User.getAll(true);
    allUsers.push(reconstructed);

    result.status = 'reconstructed';
    result.subcollections = subcollectionNames;
    result.email = reconstructed.email || null;
    results.push(result);
  }

  const reconstructedCount = results.filter((r) => r.status === 'reconstructed').length;
  const alreadyExist = results.filter((r) => r.status === 'already_exists').length;
  const unrecoverable = results.filter((r) => r.status === 'unrecoverable').length;

  await AuditService.logAction(caller.id, 'reconstruct_hard_deleted', null, {
    total: userIds.length,
    reconstructed: reconstructedCount,
    already_exists: alreadyExist,
    unrecoverable,
  });

  res.json({
    message: `Processed ${userIds.length} users: ${reconstructedCount} reconstructed, ${alreadyExist} already existed, ${unrecoverable} unrecoverable`,
    reconstructed: reconstructedCount,
    already_exists: alreadyExist,
    unrecoverable,
    results,
  });
}

async function enrichRecoveredUsers(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const db = getFirestore();

  // Find all users with _recovered flag or with no email
  const allUsers = User.getAll(true);
  const targets = allUsers.filter((u) => u._recovered || (!u.email && !u.deleted_at));

  if (targets.length === 0) {
    return res.json({ message: 'No recovered users needing enrichment', enriched: 0 });
  }

  const results = [];

  for (const user of targets) {
    const uid = user.id;
    const enriched = { id: uid, email: null, sources: [] };

    // 1. Check gift_wallets collection
    try {
      const gw = await db.collection('gift_wallets').doc(uid).get();
      if (gw.exists) {
        const gwData = gw.data();
        if (gwData.email) {
          enriched.email = gwData.email;
          enriched.sources.push('gift_wallets');
        }
      }
    } catch { /* ignore */ }

    // 2. Check wallets collection (by user_id field)
    if (!enriched.email) {
      try {
        const wSnap = await db.collection('wallets').where('user_id', '==', uid).limit(1).get();
        if (!wSnap.empty) {
          const wData = wSnap.docs[0].data();
          if (wData.email) {
            enriched.email = wData.email;
            enriched.sources.push('wallets');
          }
        }
      } catch { /* ignore */ }
    }

    // 3. Check channels collection (owner_id)
    if (!enriched.email) {
      try {
        const chSnap = await db.collection('channels').where('owner_id', '==', uid).limit(1).get();
        if (!chSnap.empty) {
          const chData = chSnap.docs[0].data();
          if (chData.owner_email) {
            enriched.email = chData.owner_email;
            enriched.sources.push('channels');
          }
        }
      } catch { /* ignore */ }
    }

    // 4. Check user's FCM tokens subcollection for email
    if (!enriched.email) {
      try {
        const fcmSnap = await db.collection('users').doc(uid).collection('fcm_tokens').limit(5).get();
        for (const doc of fcmSnap.docs) {
          const d = doc.data();
          if (d.email) {
            enriched.email = d.email;
            enriched.sources.push('fcm_tokens');
            break;
          }
        }
      } catch { /* ignore */ }
    }

    // 5. Check user's contacts subcollection
    if (!enriched.email) {
      try {
        const contactSnap = await db.collection('users').doc(uid).collection('contacts').limit(5).get();
        for (const doc of contactSnap.docs) {
          const d = doc.data();
          if (d.owner_email) {
            enriched.email = d.owner_email;
            enriched.sources.push('contacts');
            break;
          }
        }
      } catch { /* ignore */ }
    }

    // 6. Check user's transactions for email references
    if (!enriched.email) {
      try {
        const txSnap = await db.collection('users').doc(uid).collection('transactions').limit(10).get();
        for (const doc of txSnap.docs) {
          const d = doc.data();
          if (d.email) { enriched.email = d.email; enriched.sources.push('transactions'); break; }
          if (d.user_email) { enriched.email = d.user_email; enriched.sources.push('transactions'); break; }
          if (d.sender_email) { enriched.email = d.sender_email; enriched.sources.push('transactions'); break; }
        }
      } catch { /* ignore */ }
    }

    // 7. Check user's notifications for email
    if (!enriched.email) {
      try {
        const notifSnap = await db.collection('users').doc(uid).collection('notifications').limit(5).get();
        for (const doc of notifSnap.docs) {
          const d = doc.data();
          if (d.email) { enriched.email = d.email; enriched.sources.push('notifications'); break; }
          if (d.user_email) { enriched.email = d.user_email; enriched.sources.push('notifications'); break; }
        }
      } catch { /* ignore */ }
    }

    // 8. Check withdrawals collection
    if (!enriched.email) {
      try {
        const wdSnap = await db.collection('withdrawals').where('uid', '==', uid).limit(1).get();
        if (!wdSnap.empty) {
          const wdData = wdSnap.docs[0].data();
          if (wdData.email) {
            enriched.email = wdData.email;
            enriched.sources.push('withdrawals');
          }
        }
      } catch { /* ignore */ }
    }

    // If we found an email, update the user document
    if (enriched.email) {
      user.email = enriched.email;
      const docRef = db.collection('users').doc(uid);
      await docRef.set({ email: enriched.email }, { merge: true });
    }

    results.push(enriched);
  }

  const enrichedCount = results.filter((r) => r.email).length;
  res.json({
    message: `Enriched ${enrichedCount} of ${targets.length} recovered users with email addresses`,
    enriched: enrichedCount,
    total: targets.length,
    results,
  });
}

async function cleanupDuplicates(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const duplicateGroups = User.findDuplicateGroups();
  if (duplicateGroups.size === 0) {
    return res.json({ message: 'No duplicate accounts found', removed: 0, details: [] });
  }

  const details = [];
  let removed = 0;

  for (const [email, group] of duplicateGroups) {
    const [original, ...dupes] = group;
    for (const dupe of dupes) {
      const activeChannels = Channel.getEvery().filter((ch) => ch.owner_id === dupe.id && ch.is_active);
      for (const ch of activeChannels) {
        await Channel.disable(ch.id);
      }
      await User.softDelete(dupe.id, caller.id);
      removed++;
      details.push({ email, kept_id: original.id, removed_id: dupe.id, created_at: dupe.created_at });
    }
  }

  await AuditService.logAction(caller.id, 'cleanup_duplicates', null, { removed, emails: details.map((d) => d.email) });
  res.json({ message: `Removed ${removed} duplicate account${removed !== 1 ? 's' : ''}`, removed, details });
}

async function cleanupEmpty(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const empties = User.findEmptyAccounts();
  if (empties.length === 0) {
    return res.json({ message: 'No empty accounts found', removed: 0, details: [] });
  }

  const details = [];
  let removed = 0;

  for (const user of empties) {
    const activeChannels = Channel.getEvery().filter((ch) => ch.owner_id === user.id && ch.is_active);
    for (const ch of activeChannels) {
      await Channel.disable(ch.id);
    }
    await User.hardDelete(user.id);
    removed++;
    details.push({ id: user.id, email: user.email || null, created_at: user.created_at });
  }

  await AuditService.logAction(caller.id, 'cleanup_empty', null, { removed, ids: details.map((d) => d.id) });
  res.json({ message: `Removed ${removed} empty account${removed !== 1 ? 's' : ''}`, removed, details });
}

function getUserWallet(req, res) {
  if (!requireAdmin(req, res)) return;

  const { uid } = req.params;
  const user = User.findById(uid);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const giftWallet = GiftWallet.findByUid(uid) || {
    uid,
    vpt_units: 0,
    ngn_balance: 0,
    updated_at: null,
  };
  const wallet = Wallet.toSafe(Wallet.findByUserId(uid));

  res.json({
    wallet: {
      uid,
      email: user.email,
      ngn_balance: giftWallet.ngn_balance || 0,
      vpt_units: giftWallet.vpt_units || 0,
      updated_at: giftWallet.updated_at || null,
      bsc_address: wallet?.bsc_address || null,
      wallet_status: wallet?.status || 'not_created',
      wallet_created_at: wallet?.created_at || null,
      wallet_last_used_at: wallet?.last_used_at || null,
    },
  });
}

function listWallets(req, res) {
  if (!requireAdmin(req, res)) return;

  const users = User.getAll();
  const giftWallets = new Map(GiftWallet.getAll().map((wallet) => [wallet.uid, wallet]));
  const blockchainWallets = new Map(Wallet.getAll().map((wallet) => [wallet.user_id, wallet]));

  const wallets = users.map((user) => {
    const giftWallet = giftWallets.get(user.id) || null;
    const blockchainWallet = blockchainWallets.get(user.id) || null;

    return {
      uid: user.id,
      email: user.email,
      role: user.role,
      ngn_balance: giftWallet?.ngn_balance || 0,
      vpt_units: giftWallet?.vpt_units || 0,
      updated_at: giftWallet?.updated_at || null,
      bsc_address: blockchainWallet?.bsc_address || null,
      wallet_status: blockchainWallet?.status || 'not_created',
      wallet_created_at: blockchainWallet?.created_at || null,
      wallet_last_used_at: blockchainWallet?.last_used_at || null,
    };
  });

  res.json({ wallets });
}

// --- Channel Control ---

function listAllChannels(req, res) {
  if (!requireAdmin(req, res)) return;
  const channels = Channel.getEvery().map((channel) => serializeChannelForAdmin(channel));
  res.json({ channels });
}

async function adminDisableChannel(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;
  const channel = await Channel.disable(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  await AuditService.logAction(caller.id, 'disable_channel', req.params.id, { name: channel.name });
  res.json({ channel: serializeChannelForAdmin(channel) });
}

async function adminEnableChannel(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;
  const channel = await Channel.enable(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  await AuditService.logAction(caller.id, 'enable_channel', req.params.id, { name: channel.name });
  res.json({ channel: serializeChannelForAdmin(channel) });
}

// --- Feature Flags ---

const FEATURES_COLLECTION = 'features';

async function getFeatureFlags(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    const db = getFirestore();
    const snapshot = await db.collection(FEATURES_COLLECTION).get();
    const flags = snapshot.docs.map((doc) => ({ key: doc.id, ...doc.data() }));
    res.json({ flags });
  } catch (error) {
    res.status(getAdminDataErrorStatus(error)).json({ error: error.message });
  }
}

async function setFeatureFlag(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;
  const { key, enabled } = req.body;
  if (!key || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'key and enabled (bool) are required' });
  }

  try {
    const db = getFirestore();
    await db.collection(FEATURES_COLLECTION).doc(key).set({ enabled, updated_at: Date.now() });
    await AuditService.logAction(caller.id, 'set_feature_flag', key, { enabled });
    res.json({ flag: { key, enabled } });
  } catch (error) {
    res.status(getAdminDataErrorStatus(error)).json({ error: error.message });
  }
}

// --- Dashboard ---

function getDashboard(req, res) {
  if (!requireAdmin(req, res)) return;

  const users = User.getAll();
  const channels = Channel.getEvery();
  const ledgerStats = Ledger.getStats();
  const giftWallets = GiftWallet.getAll();
  const pendingWithdrawals = Withdrawal.getPending();

  const totalGiftVpt = giftWallets.reduce((sum, w) => sum + (w.vpt_units || 0), 0);
  const totalGiftNgn = giftWallets.reduce((sum, w) => sum + (w.ngn_balance || 0), 0);

  res.json({
    dashboard: {
      users: {
        total: users.length,
        admins: users.filter((u) => u.role === 'admin').length,
        creators: users.filter((u) => u.role === 'creator').length,
        viewers: users.filter((u) => u.role === 'viewer').length,
        premium: users.filter((u) => u.is_premium_creator).length,
      },
      channels: {
        total: channels.length,
        active: channels.filter((c) => c.is_active).length,
        disabled: channels.filter((c) => !c.is_active).length,
        public: channels.filter((c) => c.type === 'public' && c.is_active).length,
        private: channels.filter((c) => c.type === 'private' && c.is_active).length,
      },
      financial: {
        ...ledgerStats,
        gift_wallets: giftWallets.length,
        total_gift_vpt: totalGiftVpt,
        total_gift_ngn: totalGiftNgn,
        pending_withdrawals: pendingWithdrawals.length,
      },
    },
  });
}

function getDashboardTrend(req, res) {
  if (!requireAdmin(req, res)) return;

  const requestedDays = parseInt(req.query.days, 10);
  const days = Number.isFinite(requestedDays) ? Math.min(Math.max(requestedDays, 3), 30) : 7;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const dayKeys = [];
  const revenueMap = new Map();
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    dayKeys.push(key);
    revenueMap.set(key, 0);
  }

  for (const entry of Ledger.getAll()) {
    if (entry.status !== 'success') continue;
    if (entry.currency !== 'ngn') continue;
    if (entry.direction !== 'debit') continue;
    const key = new Date(entry.created_at).toISOString().slice(0, 10);
    if (!revenueMap.has(key)) continue;
    revenueMap.set(key, revenueMap.get(key) + (entry.amount_ngn || 0));
  }

  const trend = dayKeys.map((key) => ({
    day: new Date(`${key}T00:00:00.000Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }),
    revenue: revenueMap.get(key) || 0,
  }));

  res.json({ trend });
}

// --- Audit Logs ---

async function getAuditLogs(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = await AuditService.getRecent(Math.min(limit, 200));
    res.json({ logs });
  } catch (error) {
    res.status(getAdminDataErrorStatus(error)).json({ error: error.message });
  }
}

// --- User Detail (rich profile + subcollections) ---

const SUBCOLLECTION_LIMITS = {
  badges: 50,
  brands: 20,
  contacts: 50,
  fcm_tokens: 20,
  invites: 50,
  membership: 5,
  memory_bank: 5,
  notifications: 50,
  ratings: 50,
  ratings_meta: 5,
  transactions: 100,
  wallet_ledger: 100,
  wallet_summary: 5,
};

function serializeFirestoreValue(val) {
  if (val === null || val === undefined) return val;
  if (val._seconds !== undefined && val._nanoseconds !== undefined) {
    return new Date(val._seconds * 1000).toISOString();
  }
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (Array.isArray(val)) return val.map(serializeFirestoreValue);
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = serializeFirestoreValue(v);
    }
    return out;
  }
  return val;
}

async function getUserDetail(req, res) {
  if (!requireAdmin(req, res)) return;

  const { uid } = req.params;
  if (!uid) return res.status(400).json({ error: 'uid is required' });

  try {
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      // Fall back to in-memory model
      const memUser = User.findById(uid);
      if (!memUser) return res.status(404).json({ error: 'User not found' });
      return res.json({ user: User.toDetailedUser(memUser), subcollections: {} });
    }

    const rawData = userDoc.data();
    // Strip sensitive fields
    const SENSITIVE = new Set(['password_hash', 'pinHash']);
    const user = {};
    for (const [key, val] of Object.entries(rawData)) {
      if (SENSITIVE.has(key)) continue;
      user[key] = serializeFirestoreValue(val);
    }
    user.id = userDoc.id;

    // Lazy-load BSC address from wallet model
    try {
      const wallet = Wallet.findByUserId(uid);
      if (wallet) user.bsc_address = wallet.bsc_address;
    } catch { /* ignore */ }

    // Fetch subcollections
    const subcollections = {};
    const subColls = await userDoc.ref.listCollections();

    for (const subColl of subColls) {
      const limit = SUBCOLLECTION_LIMITS[subColl.id] || 30;
      const snap = await subColl.orderBy('createdAt', 'desc').limit(limit).get().catch(() =>
        subColl.limit(limit).get()
      );
      subcollections[subColl.id] = {
        count: snap.size,
        items: snap.docs.map((doc) => {
          const data = doc.data();
          const serialized = {};
          for (const [k, v] of Object.entries(data)) {
            serialized[k] = serializeFirestoreValue(v);
          }
          serialized._id = doc.id;
          return serialized;
        }),
      };
    }

    res.json({ user, subcollections });
  } catch (error) {
    res.status(getAdminDataErrorStatus(error)).json({ error: error.message });
  }
}

/**
 * Scans email_index, invites, referrals, and other surviving collections
 * to find user UIDs whose documents were hard-deleted, then reconstructs
 * them with the proper Firestore schema matching the Flutter app.
 */
async function recoverFromEmailIndex(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const db = getFirestore();
  const results = { found: [], already_exist: [], reconstructed: [], errors: [] };

  // 1. Scan email_index — each doc is {emailLower} with field {uid}
  const emailIndexSnap = await db.collection('email_index').get();
  const emailToUid = new Map();
  for (const doc of emailIndexSnap.docs) {
    const data = doc.data();
    if (data.uid) {
      emailToUid.set(doc.id, data.uid);
    }
  }

  // 2. Also scan invites for consumedByUid
  const invitesSnap = await db.collection('invites').get();
  const invitesByUid = new Map();
  for (const doc of invitesSnap.docs) {
    const data = doc.data();
    if (data.consumedByUid) {
      if (!invitesByUid.has(data.consumedByUid)) {
        invitesByUid.set(data.consumedByUid, []);
      }
      invitesByUid.get(data.consumedByUid).push({
        code: data.code || doc.id,
        sponsorUid: data.sponsorUid || null,
        email: data.ref_email || null,
        fname: data.ref_fname || null,
        mname: data.ref_mname || null,
        lname: data.ref_lname || null,
        phone: data.ref_phone || null,
      });
    }
  }

  // 3. Scan referrals for additional data
  const referralsSnap = await db.collection('referrals').get();
  const referralsByUid = new Map();
  for (const doc of referralsSnap.docs) {
    const data = doc.data();
    const uid = data.uid || data.referredUid || data.userId;
    if (uid) {
      referralsByUid.set(uid, data);
    }
  }

  // 4. Check each email_index entry — if user doc doesn't exist, reconstruct it
  for (const [emailLower, uid] of emailToUid) {
    results.found.push({ email: emailLower, uid });

    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      results.already_exist.push({ email: emailLower, uid });
      continue;
    }

    // User doc was deleted — reconstruct it
    try {
      // Build the document matching Flutter's user_manager.dart schema
      const reconstructed = {
        email: emailLower,
        emailLower: emailLower,
        firstName: '',
        middleName: '',
        lastName: '',
        profilePicture: '',
        isVerified: false,
        isAdmin: false,
        cash: 0,
        vpt: 0,
        coins: 0,
        currency: 'NGN',
        slots: 0,
        level: 5,
        tagsCount: 0,
        badges: [],
        lastTagDate: null,
        streakCount: 0,
        deviceToken: '',
        vpinId: '',
        stake_wallet: '',
        blockchain_tokens: '0',
        equity_percentage: '0.00',
        profit: '',
        kyc_type: '',
        kyc_id: '',
        kyc_5: '',
        mobile: '',
        refCode: '',
        points: '0.00',
        badge_live_wire: 0,
        online: false,
        mode: 'exploring',
        appState: 'background',
        canonical_uid: uid,
        _recovered: true,
        _recovered_at: new Date().toISOString(),
        _recovery_source: 'email_index',
      };

      // Enrich from invites data if available
      const invites = invitesByUid.get(uid);
      if (invites && invites.length > 0) {
        const invite = invites[0];
        if (invite.fname) reconstructed.firstName = invite.fname;
        if (invite.mname) reconstructed.middleName = invite.mname;
        if (invite.lname) reconstructed.lastName = invite.lname;
        if (invite.phone) reconstructed.mobile = invite.phone;
        if (invite.email && !reconstructed.email) reconstructed.email = invite.email;
        if (invite.sponsorUid) reconstructed.sponsoruid = invite.sponsorUid;
        if (invite.code) reconstructed.vpinId = invite.code;
        reconstructed._recovery_source += ',invites';
      }

      // Enrich from referrals
      const referral = referralsByUid.get(uid);
      if (referral) {
        if (referral.firstName && !reconstructed.firstName) reconstructed.firstName = referral.firstName;
        if (referral.lastName && !reconstructed.lastName) reconstructed.lastName = referral.lastName;
        if (referral.phone && !reconstructed.mobile) reconstructed.mobile = referral.phone;
        reconstructed._recovery_source += ',referrals';
      }

      // Check subcollections for surviving data
      const docRef = db.collection('users').doc(uid);
      let subColls = [];
      try { subColls = await docRef.listCollections(); } catch { /* ignore */ }
      reconstructed._surviving_subcollections = subColls.map((c) => c.id);

      // Write the reconstructed document
      await docRef.set(reconstructed);
      results.reconstructed.push({
        email: emailLower,
        uid,
        firstName: reconstructed.firstName,
        lastName: reconstructed.lastName,
        sources: reconstructed._recovery_source,
        subcollections: reconstructed._surviving_subcollections,
      });
    } catch (err) {
      results.errors.push({ email: emailLower, uid, error: err.message });
    }
  }

  // 5. Reload in-memory store
  const reloaded = await User.reinit();

  await AuditService.logAction(caller.id, 'recover_from_email_index', null, {
    found: results.found.length,
    already_exist: results.already_exist.length,
    reconstructed: results.reconstructed.length,
    errors: results.errors.length,
  });

  res.json({
    message: `Found ${results.found.length} email_index entries, ${results.already_exist.length} already exist, reconstructed ${results.reconstructed.length}, ${results.errors.length} errors. Reloaded ${reloaded.length} users.`,
    ...results,
    reloaded_count: reloaded.length,
  });
}

async function reloadFromFirestore(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  try {
    const reloaded = await User.reinit();
    await AuditService.logAction(caller.id, 'reload_from_firestore', null, { user_count: reloaded.length });
    res.json({
      message: `Reloaded ${reloaded.length} users from Firestore`,
      count: reloaded.length,
      users: reloaded.map((u) => ({ id: u.id, email: u.email || u.emailLower || null, firstName: u.firstName || null })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function cleanupRecoveryShells(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const db = getFirestore();
  const snapshot = await db.collection('users').get();
  const shells = [];
  const deleted = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    // A recovery shell has _recovered flag AND no real user data
    if (data._recovered === true && !data.email && !data.firstName && !data.emailLower) {
      shells.push({ id: doc.id, fields: Object.keys(data) });
      await db.collection('users').doc(doc.id).delete();
      deleted.push(doc.id);
    }
  }

  // Reload in-memory store after cleanup
  const reloaded = await User.reinit();

  await AuditService.logAction(caller.id, 'cleanup_recovery_shells', null, { deleted: deleted.length, reloaded: reloaded.length });
  res.json({
    message: `Deleted ${deleted.length} empty recovery shells, reloaded ${reloaded.length} users`,
    deleted_shells: deleted.length,
    reloaded_users: reloaded.length,
    shell_ids: deleted,
  });
}

/**
 * Admin endpoint to directly write/merge fields into a user's Firestore document.
 * Used for data recovery - restoring known field values to damaged/reconstructed docs.
 * Accepts { uid, data: { field1: value1, ... } } in body.
 * Uses Firestore merge so existing fields are preserved.
 */
async function repairUserDocument(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const { uid, data } = req.body;
  if (!uid || typeof uid !== 'string') {
    return res.status(400).json({ error: 'uid is required' });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'data object is required' });
  }

  // Safety: never allow writing sensitive fields
  const forbidden = ['password_hash', 'pinHash'];
  for (const key of forbidden) {
    delete data[key];
  }

  const db = getFirestore();
  const docRef = db.collection('users').doc(uid);

  // Use merge to preserve existing fields and only update/add new ones
  await docRef.set(data, { merge: true });

  // Reload in-memory store
  await User.reinit();

  // Read back the full document
  const updatedDoc = await docRef.get();
  const updatedData = updatedDoc.exists ? updatedDoc.data() : null;

  await AuditService.logAction(caller.id, 'repair_user_document', uid, {
    fields_written: Object.keys(data),
    field_count: Object.keys(data).length,
  });

  res.json({
    message: `Repaired user ${uid} with ${Object.keys(data).length} fields`,
    uid,
    fields_written: Object.keys(data),
    current_email: updatedData?.email || updatedData?.emailLower || null,
    current_name: [updatedData?.firstName, updatedData?.lastName].filter(Boolean).join(' ') || null,
  });
}

async function pitrRestore(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const admin = require('firebase-admin');
  const db = getFirestore();
  const { dryRun = true, readTime } = req.body;
  if (!readTime) return res.status(400).json({ error: 'readTime (ISO string) is required' });

  const readTimestamp = admin.firestore.Timestamp.fromDate(new Date(readTime));

  // Read ALL user docs at the PITR timestamp (before deletion)
  const pitrSnapshot = await db.collection('users')
    .get({ readTime: readTimestamp });

  // Read ALL current user docs
  const currentSnapshot = await db.collection('users').get();
  const currentDocs = new Map();
  currentSnapshot.forEach(doc => currentDocs.set(doc.id, doc.data()));

  // Categorize
  const toRestore = [];
  const toRepair = [];
  const unchanged = [];

  pitrSnapshot.forEach(doc => {
    const pitrData = doc.data();
    const currentData = currentDocs.get(doc.id);

    if (!currentData) {
      toRestore.push({ id: doc.id, data: pitrData, reason: 'hard-deleted' });
    } else if (currentData._recovered) {
      const pitrFields = Object.keys(pitrData).length;
      const currentFields = Object.keys(currentData).filter(k => !k.startsWith('_')).length;
      if (pitrFields > currentFields) {
        toRepair.push({ id: doc.id, pitrData, currentData, reason: 'recovered-shell' });
      } else {
        unchanged.push(doc.id);
      }
    } else {
      unchanged.push(doc.id);
    }
  });

  const summary = {
    pitr_docs: pitrSnapshot.size,
    current_docs: currentDocs.size,
    to_restore: toRestore.length,
    to_repair: toRepair.length,
    unchanged: unchanged.length,
    restore_details: toRestore.map(r => ({
      id: r.id,
      email: r.data.email || r.data.emailLower || '?',
      name: r.data.firstName || r.data.name || '?',
      fields: Object.keys(r.data).length,
    })),
    repair_details: toRepair.map(r => ({
      id: r.id,
      email: r.pitrData.email || r.pitrData.emailLower || '?',
      name: r.pitrData.firstName || r.pitrData.name || '?',
      pitr_fields: Object.keys(r.pitrData).length,
      current_fields: Object.keys(r.currentData).filter(k => !k.startsWith('_')).length,
    })),
  };

  if (dryRun) {
    // Include a sample of actual PITR data for first 3 repair items
    const samplePitrData = toRepair.slice(0, 3).map(item => ({
      id: item.id,
      email: item.pitrData.email,
      pitr_cash: item.pitrData.cash,
      pitr_coins: item.pitrData.coins,
      pitr_vpt: item.pitrData.vpt,
      pitr_slots: item.pitrData.slots,
      pitr_recovered: item.pitrData._recovered,
      pitr_fields_keys: Object.keys(item.pitrData).sort(),
      current_cash: item.currentData.cash,
      current_coins: item.currentData.coins,
      current_vpt: item.currentData.vpt,
      current_slots: item.currentData.slots,
    }));
    return res.json({ dryRun: true, ...summary, samplePitrData });
  }

  // Write back the original data
  let restored = 0;
  let repaired = 0;
  const allWrites = [
    ...toRestore.map(r => ({ ...r, type: 'restore' })),
    ...toRepair.map(r => ({ ...r, type: 'repair' })),
  ];

  for (let i = 0; i < allWrites.length; i += 500) {
    const batch = db.batch();
    const chunk = allWrites.slice(i, i + 500);

    for (const item of chunk) {
      const ref = db.collection('users').doc(item.id);
      if (item.type === 'restore') {
        const writeData = {
          ...item.data,
          _pitr_restored: true,
          _pitr_restored_at: new Date().toISOString(),
          _pitr_read_time: readTime,
        };
        batch.set(ref, writeData);
        restored++;
      } else {
        const writeData = {
          ...item.pitrData,
          _pitr_repaired: true,
          _pitr_repaired_at: new Date().toISOString(),
          _pitr_read_time: readTime,
        };
        batch.set(ref, writeData, { merge: true });
        repaired++;
      }
    }

    await batch.commit();
  }

  // Reload in-memory store
  await User.reinit();

  await AuditService.logAction(caller.id, 'pitr_restore', null, { readTime, restored, repaired });

  res.json({
    dryRun: false,
    restored,
    repaired,
    ...summary,
    message: `PITR restore complete: ${restored} restored, ${repaired} repaired`,
  });
}

module.exports = {
  setRole,
  setPremium,
  setKyc,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  addFeatureToPlan,
  removeFeatureFromPlan,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getSettings,
  getSetting,
  updateSetting,
  bulkUpdateSettings,
  resetSetting,
  listUsers,
  deleteUser,
  cleanupDuplicates,
  cleanupEmpty,
  recoverAccounts,
  reconstructHardDeleted,
  enrichRecoveredUsers,
  getUserWallet,
  listWallets,
  listAllChannels,
  adminDisableChannel,
  adminEnableChannel,
  getFeatureFlags,
  setFeatureFlag,
  getDashboard,
  getDashboardTrend,
  getAuditLogs,
  getUserDetail,
  reloadFromFirestore,
  cleanupRecoveryShells,
  recoverFromEmailIndex,
  repairUserDocument,
  pitrRestore,
};
