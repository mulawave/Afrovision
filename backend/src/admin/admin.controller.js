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
const SmtpService = require('./smtp.service');
const RenewalWorker = require('../subscriptions/renewal.worker');
const { serializeChannelForAdmin } = require('./admin.presenter');
const { getFirestore } = require('../utils/firestore');
const { getAuth } = require('firebase-admin/auth');
const {
  parseMaintenanceRequest,
  getMaintenanceConfirmationMessage,
} = require('../utils/maintenance');

const VALID_ROLES = ['viewer', 'creator', 'admin'];
const VALID_KYC = ['none', 'pending', 'verified'];

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '').trim();
}

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

async function listPlans(req, res) {
  if (!requireAdmin(req, res)) return;
  const type = req.query.type;
  const plans = type ? await Plan.getAllByType(type) : await Plan.getAll();
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

// --- Viewer Plan Management ---

async function listViewerPlans(req, res) {
  if (!requireAdmin(req, res)) return;
  const includeInactive = req.query.all === 'true';
  const plans = includeInactive ? await Plan.getAllByType('viewer') : await Plan.getByType('viewer');
  res.json({ plans });
}

async function createViewerPlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const { name, price, yearly_price, currency, features, display_labels, badge, reward_multiplier } = req.body;
  if (!name) return res.status(400).json({ error: 'Plan name is required' });
  if (price === undefined || price === null) return res.status(400).json({ error: 'Monthly price is required' });
  const plan = await Plan.create({
    name,
    type: 'viewer',
    price: Number(price),
    yearly_price: yearly_price != null ? Number(yearly_price) : null,
    currency: currency || 'NGN',
    features: features || [],
    display_labels: display_labels || {},
    badge: badge || null,
    reward_multiplier: reward_multiplier != null ? Number(reward_multiplier) : null,
  });
  res.status(201).json({ plan });
}

async function updateViewerPlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const existing = await Plan.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Plan not found' });
  if (existing.type !== 'viewer') return res.status(400).json({ error: 'This endpoint only manages viewer plans' });
  const fields = { ...req.body };
  if (fields.price !== undefined) fields.price = Number(fields.price);
  if (fields.yearly_price !== undefined) fields.yearly_price = fields.yearly_price != null ? Number(fields.yearly_price) : null;
  if (fields.reward_multiplier !== undefined) fields.reward_multiplier = fields.reward_multiplier != null ? Number(fields.reward_multiplier) : null;
  delete fields.type; // Prevent type change
  const plan = await Plan.update(req.params.id, fields);
  res.json({ plan });
}

async function deleteViewerPlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const existing = await Plan.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Plan not found' });
  if (existing.type !== 'viewer') return res.status(400).json({ error: 'This endpoint only manages viewer plans' });
  const removed = await Plan.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Plan not found' });
  res.json({ message: 'Viewer plan deleted' });
}

async function toggleViewerPlanActive(req, res) {
  if (!requireAdmin(req, res)) return;
  const existing = await Plan.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Plan not found' });
  if (existing.type !== 'viewer') return res.status(400).json({ error: 'This endpoint only manages viewer plans' });
  const plan = await Plan.update(req.params.id, { is_active: !existing.is_active });
  res.json({ plan });
}

// --- Category Management ---

async function getCategories(req, res) {
  if (!requireAdmin(req, res)) return;
  const categories = await Category.getAll(true);
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

async function testSmtpSettings(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const email = String(req.body?.email || '').trim();
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  try {
    const result = await SmtpService.sendTestEmail({
      toEmail: email,
      initiatedBy: caller.email || caller.id,
    });

    await AuditService.logAction(caller.id, 'smtp_test_email', email, {
      accepted: result.accepted,
      rejected: result.rejected,
      message_id: result.messageId,
    });

    res.json({
      message: `Test email sent to ${email}`,
      result,
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'SMTP test failed' });
  }
}

// --- User Management ---

async function listUsers(req, res) {
  if (!requireAdmin(req, res)) return;

  const requestedLimit = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100;
  const cursor = String(req.query.cursor || '').trim();
  const includeDeleted = req.query.include_deleted === 'true';

  const db = getFirestore();
  let query = db.collection('users').orderBy('__name__').limit(limit);
  if (cursor) {
    query = query.startAfter(cursor);
  }

  const snapshot = await query.get();
  let users = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((user) => includeDeleted || !user.deleted_at)
    .map((u) => ({
    ...User.toSafeUser(u),
    deviceToken: u.deviceToken || null,
    fcm_tokens: Array.isArray(u.fcm_tokens) ? u.fcm_tokens : [],
  }));

  if (!includeDeleted && users.length > limit) {
    users = users.slice(0, limit);
  }

  const next_cursor = snapshot.size === limit ? snapshot.docs[snapshot.docs.length - 1].id : null;
  res.json({ users, limit, next_cursor, has_more: Boolean(next_cursor) });
}

async function deleteUser(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const { uid } = req.params;
  if (!uid) return res.status(400).json({ error: 'uid is required' });
  if (uid === caller.id) return res.status(400).json({ error: 'You cannot delete your own admin account' });

  const user = await User.findById(uid);
  if (!user || user.deleted_at) {
    return res.status(404).json({ error: 'User not found' });
  }

  const activeOwnedChannels = (await Channel.getAllByOwner(uid)).filter((channel) => channel.is_active);
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

  const maintenance = parseMaintenanceRequest(req, {
    confirmationToken: 'RECOVER_SOFT_DELETED',
    defaultLimit: 100,
    maxLimit: 500,
  });
  if (maintenance.error) {
    return res.status(400).json({ error: maintenance.error });
  }
  if (!maintenance.dryRun && !maintenance.confirmed) {
    return res.status(400).json({
      error: getMaintenanceConfirmationMessage(maintenance.confirmationToken),
      limit: maintenance.limit,
    });
  }

  const db = getFirestore();
  const softDeletedSnapshot = await db.collection('users')
    .where('deleted_at', '>=', '')
    .orderBy('deleted_at')
    .limit(maintenance.limit)
    .get();
  const softDeleted = softDeletedSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (softDeleted.length === 0) {
    return res.json({
      maintenance: true,
      dry_run: maintenance.dryRun,
      confirmation_token: maintenance.confirmationToken,
      message: 'No soft-deleted accounts found to recover',
      recovered: 0,
      details: [],
    });
  }

  if (maintenance.dryRun) {
    return res.json({
      maintenance: true,
      dry_run: true,
      confirmation_token: maintenance.confirmationToken,
      preview: {
        candidates: softDeleted.length,
        ids: softDeleted.map((u) => u.id),
      },
      message: 'Dry run only. Re-send with confirmation=RECOVER_SOFT_DELETED to execute account recovery.',
    });
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
      vpt: 0,
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
    await User.reloadFromFirestore(uid);

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

  const maintenance = parseMaintenanceRequest(req, {
    confirmationToken: 'ENRICH_RECOVERED_USERS',
    defaultLimit: 100,
    maxLimit: 500,
  });
  if (maintenance.error) {
    return res.status(400).json({ error: maintenance.error });
  }
  if (!maintenance.dryRun && !maintenance.confirmed) {
    return res.status(400).json({
      error: getMaintenanceConfirmationMessage(maintenance.confirmationToken),
      limit: maintenance.limit,
    });
  }

  const db = getFirestore();

  // Process only explicitly recovered users in bounded windows.
  const targetsSnapshot = await db.collection('users')
    .where('_recovered', '==', true)
    .limit(maintenance.limit)
    .get();
  const targets = targetsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (targets.length === 0) {
    return res.json({
      maintenance: true,
      dry_run: maintenance.dryRun,
      confirmation_token: maintenance.confirmationToken,
      message: 'No recovered users needing enrichment',
      enriched: 0,
    });
  }

  if (maintenance.dryRun) {
    return res.json({
      maintenance: true,
      dry_run: true,
      confirmation_token: maintenance.confirmationToken,
      preview: {
        candidates: targets.length,
        ids: targets.map((u) => u.id),
      },
      message: 'Dry run only. Re-send with confirmation=ENRICH_RECOVERED_USERS to execute enrichment.',
    });
  }

  const results = [];

  for (const user of targets) {
    const uid = user.id;
    const enriched = { id: uid, email: null, sources: [] };

    // 1. Check users collection (unified wallet)
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.email) {
          enriched.email = userData.email;
          enriched.sources.push('users');
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

  const duplicateGroups = await User.findDuplicateGroups();
  if (duplicateGroups.size === 0) {
    return res.json({ message: 'No duplicate accounts found', removed: 0, details: [] });
  }

  const details = [];
  let removed = 0;

  for (const [email, group] of duplicateGroups) {
    const [original, ...dupes] = group;
    for (const dupe of dupes) {
      const activeChannels = (await Channel.getAllByOwner(dupe.id)).filter((ch) => ch.is_active);
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

  const empties = await User.findEmptyAccounts();
  if (empties.length === 0) {
    return res.json({ message: 'No empty accounts found', removed: 0, details: [] });
  }

  const details = [];
  let removed = 0;

  for (const user of empties) {
    const activeChannels = (await Channel.getAllByOwner(user.id)).filter((ch) => ch.is_active);
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

async function getUserWallet(req, res) {
  if (!requireAdmin(req, res)) return;

  const { uid } = req.params;
  const user = await User.findById(uid);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const wallet = Wallet.toSafe(await Wallet.findByUserId(uid));

  res.json({
    wallet: {
      uid,
      email: user.email,
      cash: user.cash || 0,
      vpt: user.vpt || 0,
      coins: user.coins || 0,
      bsc_address: wallet?.bsc_address || null,
      wallet_status: wallet?.status || 'not_created',
      wallet_created_at: wallet?.created_at || null,
      wallet_last_used_at: wallet?.last_used_at || null,
    },
  });
}

async function listWallets(req, res) {
  if (!requireAdmin(req, res)) return;

  const requestedLimit = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100;
  const cursor = String(req.query.cursor || '').trim();

  const db = getFirestore();
  let query = db.collection('users').orderBy('__name__').limit(limit);
  if (cursor) {
    query = query.startAfter(cursor);
  }

  const snapshot = await query.get();
  const users = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((user) => !user.deleted_at);

  const walletEntries = await Promise.all(users.map(async (user) => {
    const wallet = await Wallet.findByUserId(user.id);
    return [user.id, wallet];
  }));
  const blockchainWallets = new Map(walletEntries);

  const wallets = users.map((user) => {
    const blockchainWallet = blockchainWallets.get(user.id) || null;

    return {
      uid: user.id,
      email: user.email,
      role: user.role,
      cash: user.cash || 0,
      vpt: user.vpt || 0,
      coins: user.coins || 0,
      bsc_address: blockchainWallet?.bsc_address || null,
      wallet_status: blockchainWallet?.status || 'not_created',
      wallet_created_at: blockchainWallet?.created_at || null,
      wallet_last_used_at: blockchainWallet?.last_used_at || null,
    };
  });

  const next_cursor = snapshot.size === limit ? snapshot.docs[snapshot.docs.length - 1].id : null;
  res.json({ wallets, limit, next_cursor, has_more: Boolean(next_cursor) });
}

// --- Channel Control ---

async function listAllChannels(req, res) {
  if (!requireAdmin(req, res)) return;
  const channels = (await Channel.getEvery()).map((channel) => serializeChannelForAdmin(channel));
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

/**
 * PATCH /admin/channels/:id/number
 * Body: { channel_number: number | string }
 */
async function adminUpdateChannelNumber(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const channel = await Channel.findAnyById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const rawNumber = req.body?.channel_number ?? req.body?.number;
  if (rawNumber === undefined || rawNumber === null || String(rawNumber).trim() === '') {
    return res.status(422).json({ error: 'channel_number is required' });
  }

  try {
    const updated = await Channel.updateChannelNumber(channel.id, rawNumber);
    await AuditService.logAction(caller.id, 'update_channel_number', channel.id, {
      old_channel_number: channel.channel_number,
      channel_number: updated.channel_number,
    });
    res.json({ channel: serializeChannelForAdmin(updated) });
  } catch (error) {
    return res.status(422).json({ error: error.message || 'Could not update channel number' });
  }
}

/**
 * PATCH /admin/channels/:id/owner-display
 * Body: { owner_display_mode: show_owner | hide_owner | brand_only, owner_brand_name?: string }
 */
async function adminUpdateChannelOwnerDisplay(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const channel = await Channel.findAnyById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const mode = req.body?.owner_display_mode;
  const brandNameRaw = req.body?.owner_brand_name;

  if (!mode || !Channel.ALLOWED_OWNER_DISPLAY_MODES.includes(mode)) {
    return res.status(422).json({
      error: `owner_display_mode must be one of: ${Channel.ALLOWED_OWNER_DISPLAY_MODES.join(', ')}`,
    });
  }

  const normalizedBrandName = typeof brandNameRaw === 'string'
    ? sanitize(brandNameRaw).trim()
    : '';

  if (mode === 'brand_only' && !normalizedBrandName) {
    return res.status(422).json({ error: 'owner_brand_name is required for brand_only mode' });
  }

  const updated = await Channel.updateOwnerDisplay(channel.id, {
    owner_display_mode: mode,
    owner_brand_name: mode === 'brand_only' ? normalizedBrandName : null,
  });

  await AuditService.logAction(caller.id, 'update_channel_owner_display', channel.id, {
    owner_display_mode: mode,
    owner_brand_name: mode === 'brand_only' ? normalizedBrandName : null,
  });

  res.json({ channel: serializeChannelForAdmin(updated) });
}

// ── AV-STR-007: Free-to-Air Channel Import & Operations ──────────────────────

const StreamResolver = require('../channels/stream_resolver.service');

/**
 * POST /admin/channels/import-with-media
 * Create an admin-imported channel backed by an external playback source.
 * Body: { name, description?, category?, source_url, stream_source_mode?, type? }
 * Multipart fields (optional): logo, banner
 */
async function adminImportChannel(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const {
    name,
    description,
    category,
    source_url,
    stream_source_mode,
    type,
  } = req.body || {};

  const allowedSourceModes = new Set([
    'external_youtube',
    'external_hls',
    'external_dash',
  ]);

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(422).json({ error: 'Channel name is required' });
  }
  if (!source_url || typeof source_url !== 'string' || source_url.trim().length === 0) {
    return res.status(422).json({ error: 'source_url is required' });
  }

  if (typeof req.body?.logo_url === 'string' || typeof req.body?.banner_url === 'string') {
    return res.status(422).json({
      error: 'Image URLs are not allowed. Upload logo and banner files instead.',
    });
  }

  const channelType = type || 'public';
  if (!['public', 'private'].includes(channelType)) {
    return res.status(422).json({ error: 'type must be public or private' });
  }
  if (stream_source_mode && !allowedSourceModes.has(stream_source_mode)) {
    return res.status(422).json({
      error: 'stream_source_mode must be one of external_youtube, external_hls, external_dash',
    });
  }

  // Resolve & validate the source URL before creating anything
  const resolved = await StreamResolver.resolveSource(source_url.trim());
  if (!resolved.ok) {
    return res.status(422).json({
      error: resolved.error_message,
      error_code: resolved.error_code,
    });
  }

  if (
    stream_source_mode &&
    resolved.stream_source_mode !== stream_source_mode
  ) {
    return res.status(422).json({
      error: `Selected source provider does not match URL. Expected ${stream_source_mode}, resolved ${resolved.stream_source_mode}.`,
    });
  }

  // Create the channel with a system sentinel owner (no real Firebase user)
  let channel;
  try {
    channel = await Channel.create({
      ownerId: 'system_import',
      name: name.trim(),
      description: description ? description.trim() : null,
      category: category || null,
      type: channelType,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  // Apply logo / banner from uploaded files only.
  const uploadedLogo = req.files?.logo?.[0]?.gcsUrl || null;
  const uploadedBanner = req.files?.banner?.[0]?.gcsUrl || null;

  if (uploadedLogo || uploadedBanner) {
    try {
      const db = require('../utils/firestore').getFirestore();
      const logoUpdate = {};
      if (uploadedLogo) logoUpdate.logo_url = uploadedLogo;
      if (uploadedBanner) logoUpdate.banner_url = uploadedBanner;
      await db.collection('channels').doc(channel.id).update(logoUpdate);
      Object.assign(channel, logoUpdate);
    } catch {
      // non-fatal — logo/banner update failure should not block import
    }
  }

  // Persist external source contract
  channel = await Channel.updateExternalSource(channel.id, {
    stream_source_mode: resolved.stream_source_mode,
    external_provider: resolved.external_provider,
    external_url: resolved.external_url,
    resolved_playback_url: resolved.resolved_playback_url,
    stream_status: resolved.stream_status,
    last_checked_at: resolved.last_checked_at,
    provider_metadata: resolved.provider_metadata,
  });

  await AuditService.logAction(caller.id, 'import_channel', channel.id, {
    name: channel.name,
    stream_source_mode: channel.stream_source_mode,
    external_provider: channel.external_provider,
  });

  res.status(201).json({ channel: serializeChannelForAdmin(channel) });
}

/**
 * GET /admin/channels/imported
 * List all channels with a non-native stream source mode.
 */
async function adminListImportedChannels(req, res) {
  if (!requireAdmin(req, res)) return;

  const all = await Channel.getEvery();
  const imported = all
    .filter((ch) => ch.stream_source_mode && ch.stream_source_mode !== 'native')
    .map((ch) => serializeChannelForAdmin(ch));

  res.json({ channels: imported });
}

/**
 * POST /admin/channels/:id/recheck-source
 * Re-probe the external stream source and persist updated health state.
 */
async function adminRecheckChannelSource(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const channel = await Channel.findAnyById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.stream_source_mode === 'native' || !channel.resolved_playback_url) {
    return res.status(422).json({ error: 'Channel does not have an external source configured' });
  }

  const health = await StreamResolver.recheckHealth(
    channel.resolved_playback_url,
    channel.stream_source_mode,
  );

  const updated = await Channel.updateExternalSource(channel.id, {
    stream_status: health.stream_status,
    last_checked_at: health.last_checked_at,
    provider_metadata: {
      ...(channel.provider_metadata || {}),
      last_probe_http_status: health.probe_http_status,
      last_probe_latency_ms: health.probe_latency_ms,
      last_probe_method: health.probe_method || 'head',
    },
  });

  await AuditService.logAction(caller.id, 'recheck_channel_source', channel.id, {
    stream_status: health.stream_status,
  });

  res.json({ channel: serializeChannelForAdmin(updated) });
}

/**
 * PATCH /admin/channels/:id/external-source
 * Update an imported channel's source URL and re-resolve.
 * Body: { source_url }
 */
async function adminUpdateChannelExternalSource(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  const channel = await Channel.findAnyById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const { source_url } = req.body || {};
  if (!source_url || typeof source_url !== 'string' || source_url.trim().length === 0) {
    return res.status(422).json({ error: 'source_url is required' });
  }

  const resolved = await StreamResolver.resolveSource(source_url.trim());
  if (!resolved.ok) {
    return res.status(422).json({
      error: resolved.error_message,
      error_code: resolved.error_code,
    });
  }

  const updated = await Channel.updateExternalSource(channel.id, {
    stream_source_mode: resolved.stream_source_mode,
    external_provider: resolved.external_provider,
    external_url: resolved.external_url,
    resolved_playback_url: resolved.resolved_playback_url,
    stream_status: resolved.stream_status,
    last_checked_at: resolved.last_checked_at,
    provider_metadata: resolved.provider_metadata,
  });

  await AuditService.logAction(caller.id, 'update_channel_external_source', channel.id, {
    stream_source_mode: resolved.stream_source_mode,
    external_provider: resolved.external_provider,
  });

  res.json({ channel: serializeChannelForAdmin(updated) });
}

/**
 * POST /admin/channels/bulk-recheck-sources
 * Re-probe every channel that has an external source and persist the refreshed
 * stream_status + last_checked_at.  This is intentionally sequential so we
 * don't hammer third-party services with concurrent requests.
 * Returns { checked, failed, total, results[] }
 */
async function adminBulkRecheckSources(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  try {
    const all = await Channel.getEvery();
    const external = all.filter(
      (ch) => ch.stream_source_mode && ch.stream_source_mode !== 'native',
    );

    const results = [];
    let checked = 0;
    let failed = 0;

    for (const channel of external) {
      try {
        const playbackUrl = channel.resolved_playback_url || channel.external_url;
        if (!playbackUrl) {
          failed += 1;
          results.push({ id: channel.id, name: channel.name, error: 'no_playback_url' });
          continue;
        }

        const health = await StreamResolver.recheckHealth(playbackUrl, channel.stream_source_mode);

        const updatedMetadata = channel.provider_metadata
          ? {
              ...channel.provider_metadata,
              probe_http_status: health.probe_http_status,
              probe_latency_ms: health.probe_latency_ms,
            }
          : null;

        await Channel.updateExternalSource(channel.id, {
          stream_status: health.stream_status,
          last_checked_at: health.last_checked_at,
          ...(updatedMetadata !== null ? { provider_metadata: updatedMetadata } : {}),
        });

        results.push({
          id: channel.id,
          name: channel.name,
          stream_status: health.stream_status,
          last_checked_at: health.last_checked_at,
        });
        checked += 1;
      } catch (err) {
        failed += 1;
        results.push({ id: channel.id, name: channel.name, error: err.message });
      }
    }

    await AuditService.logAction(caller.id, 'bulk_recheck_sources', 'system', {
      checked,
      failed,
      total: external.length,
    });

    res.json({
      message: `Rechecked ${checked} channel${checked !== 1 ? 's' : ''}`,
      checked,
      failed,
      total: external.length,
      results,
    });
  } catch (err) {
    console.error('[adminBulkRecheckSources]', err);
    res.status(500).json({ error: 'Bulk recheck failed', detail: err.message });
  }
}

/**
 * POST /admin/channels/backfill-defaults
 * Backfill legacy channel documents with external-source field defaults.
 * Idempotent — only channels missing the fields are written.
 */
async function adminBackfillChannelDefaults(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;
  try {
    const result = await Channel.backfillNativeDefaults();
    await AuditService.logAction(caller.id, 'backfill_channel_defaults', 'system', result);
    res.json({ message: 'Backfill complete', ...result });
  } catch (err) {
    console.error('[adminBackfillChannelDefaults]', err);
    res.status(500).json({ error: 'Backfill failed', detail: err.message });
  }
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

async function getDashboard(req, res) {
  if (!requireAdmin(req, res)) return;

  const db = getFirestore();
  const [
    totalUsersSnap,
    deletedUsersSnap,
    adminUsersSnap,
    creatorUsersSnap,
    premiumUsersSnap,
    totalChannelsSnap,
    activeChannelsSnap,
    publicChannelsSnap,
    privateChannelsSnap,
  ] = await Promise.all([
    db.collection('users').count().get(),
    db.collection('users').where('deleted_at', '>=', '').count().get(),
    db.collection('users').where('role', '==', 'admin').count().get(),
    db.collection('users').where('role', '==', 'creator').count().get(),
    db.collection('users').where('is_premium_creator', '==', true).count().get(),
    db.collection('channels').count().get(),
    db.collection('channels').where('is_active', '==', true).count().get(),
    db.collection('channels').where('type', '==', 'public').where('is_active', '==', true).count().get(),
    db.collection('channels').where('type', '==', 'private').where('is_active', '==', true).count().get(),
  ]);

  const totalUsers = totalUsersSnap.data().count || 0;
  const deletedUsers = deletedUsersSnap.data().count || 0;
  const activeUsers = Math.max(0, totalUsers - deletedUsers);
  const admins = adminUsersSnap.data().count || 0;
  const creators = creatorUsersSnap.data().count || 0;
  const viewers = Math.max(0, activeUsers - admins - creators);

  const totalChannels = totalChannelsSnap.data().count || 0;
  const activeChannels = activeChannelsSnap.data().count || 0;
  const publicChannels = publicChannelsSnap.data().count || 0;
  const privateChannels = privateChannelsSnap.data().count || 0;

  const ledgerStats = await Ledger.getStats();
  const pendingWithdrawals = await Withdrawal.getPending();
  const totals = await User.getBalanceSummary();

  res.json({
    dashboard: {
      users: {
        total: activeUsers,
        admins,
        creators,
        viewers,
        premium: premiumUsersSnap.data().count || 0,
      },
      channels: {
        total: totalChannels,
        active: activeChannels,
        disabled: Math.max(0, totalChannels - activeChannels),
        public: publicChannels,
        private: privateChannels,
      },
      financial: {
        ...ledgerStats,
        total_vpt: totals.total_vpt,
        total_cash: totals.total_cash,
        total_ravens: totals.total_coins,
        pending_withdrawals: pendingWithdrawals.length,
      },
    },
  });
}

async function getDashboardTrend(req, res) {
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

  const entries = await Ledger.getSuccessfulDebitsInRange({
    currency: 'ngn',
    startMs: start.getTime(),
    endMs: Date.now() + (24 * 60 * 60 * 1000),
  });

  for (const entry of entries) {
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

async function runRenewals(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  try {
    const force = req.body?.force === true;
    const result = await RenewalWorker.runScheduledRenewals({
      trigger: `admin:${caller.id}`,
      force,
    });

    await AuditService.logAction(caller.id, 'run_subscription_renewals', null, {
      force,
      skipped: Boolean(result.skipped),
      reason: result.reason || null,
    });

    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to run renewals' });
  }
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
      const memUser = await User.findById(uid);
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
      const wallet = await Wallet.findByUserId(uid);
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

  const maintenance = parseMaintenanceRequest(req, {
    confirmationToken: 'RECOVER_FROM_INDEX',
    defaultLimit: 100,
    maxLimit: 500,
  });
  if (maintenance.error) {
    return res.status(400).json({ error: maintenance.error });
  }
  if (!maintenance.dryRun && !maintenance.confirmed) {
    return res.status(400).json({
      error: getMaintenanceConfirmationMessage(maintenance.confirmationToken),
      limit: maintenance.limit,
    });
  }

  const db = getFirestore();
  const results = {
    found: [],
    already_exist: [],
    reconstructed: [],
    missing: [],
    errors: [],
    limit: maintenance.limit,
    processed: 0,
    remaining: 0,
    total_email_index_entries: 0,
  };

  const totalEmailIndexSnapshot = await db.collection('email_index').count().get();
  results.total_email_index_entries = totalEmailIndexSnapshot.data().count || 0;

  // 1. Scan a bounded subset of email_index — each doc is {emailLower} with field {uid}
  const emailIndexSnap = await db.collection('email_index').limit(maintenance.limit).get();
  const emailEntries = [];
  for (const doc of emailIndexSnap.docs) {
    const data = doc.data();
    if (data.uid) {
      emailEntries.push([doc.id, data.uid]);
    }
  }
  results.processed = emailEntries.length;
  results.remaining = Math.max(0, results.total_email_index_entries - results.processed);

  if (emailEntries.length === 0) {
    return res.json({
      maintenance: true,
      dry_run: maintenance.dryRun,
      confirmation_token: maintenance.confirmationToken,
      message: 'No email_index entries found in the requested window.',
      ...results,
    });
  }

  const targetUids = [...new Set(emailEntries.map(([, uid]) => uid).filter(Boolean))];

  const invitesByUid = new Map();
  const referralsByUid = new Map();

  async function loadByUid(collectionName, fieldName, onData) {
    for (let index = 0; index < targetUids.length; index += 10) {
      const batch = targetUids.slice(index, index + 10);
      const snapshot = await db.collection(collectionName)
        .where(fieldName, 'in', batch)
        .get();
      for (const doc of snapshot.docs) {
        onData(doc);
      }
    }
  }

  // 2. Load only invite/referral records relevant to the bounded uid set.
  if (!maintenance.dryRun) {
    await loadByUid('invites', 'consumedByUid', (doc) => {
      const data = doc.data();
      if (!data.consumedByUid) return;
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
    });

    for (const fieldName of ['uid', 'referredUid', 'userId']) {
      await loadByUid('referrals', fieldName, (doc) => {
        const data = doc.data();
        const uid = data.uid || data.referredUid || data.userId;
        if (uid && !referralsByUid.has(uid)) {
          referralsByUid.set(uid, data);
        }
      });
    }
  }

  // 4. Check each email_index entry — if user doc doesn't exist, reconstruct it
  for (const [emailLower, uid] of emailEntries) {
    results.found.push({ email: emailLower, uid });

    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      results.already_exist.push({ email: emailLower, uid });
      continue;
    }

    if (maintenance.dryRun) {
      results.missing.push({ email: emailLower, uid });
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

  if (maintenance.dryRun) {
    await AuditService.logAction(caller.id, 'recover_from_email_index_dry_run', null, {
      found: results.found.length,
      already_exist: results.already_exist.length,
      missing: results.missing.length,
      processed: results.processed,
      remaining: results.remaining,
    });

    return res.json({
      maintenance: true,
      dry_run: true,
      confirmation_token: maintenance.confirmationToken,
      message: `Dry run scanned ${results.processed} of ${results.total_email_index_entries} email_index entries and found ${results.missing.length} missing user documents. Re-send with confirmation=RECOVER_FROM_INDEX to execute reconstruction for this window.`,
      ...results,
    });
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

// ──────────────────────────────────────────────────────────
//  MARQUEE / LIVE WIRE TOPICS
// ──────────────────────────────────────────────────────────
const MARQUEE_COLLECTION = 'live_wire_topics';
const MARQUEE_CACHE_TTL_MS = 60_000;

let marqueeCache = {
  topics: null,
  updatedAt: 0,
};

function sortMarqueeTopics(topics) {
  return topics.sort((a, b) => (a.priority || 0) - (b.priority || 0));
}

function invalidateMarqueeCache() {
  marqueeCache = {
    topics: null,
    updatedAt: 0,
  };
}

async function getMarqueeTopics(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const db = getFirestore();
    const snap = await db.collection(MARQUEE_COLLECTION).get();
    const topics = [];
    snap.forEach((doc) => topics.push({ id: doc.id, ...doc.data() }));
    res.json(sortMarqueeTopics(topics));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createMarqueeTopic(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const { text, priority, active } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
    const db = getFirestore();
    const ref = db.collection(MARQUEE_COLLECTION).doc();
    const topic = {
      text: text.trim(),
      priority: priority ?? 1,
      active: active !== false,
      updatedAt: new Date(),
    };
    await ref.set(topic);
    invalidateMarqueeCache();
    res.json({ id: ref.id, ...topic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateMarqueeTopic(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const { text, priority, active } = req.body;
    const db = getFirestore();
    const ref = db.collection(MARQUEE_COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Topic not found' });
    const updates = { updatedAt: new Date() };
    if (text !== undefined) updates.text = text.trim();
    if (priority !== undefined) updates.priority = priority;
    if (active !== undefined) updates.active = active;
    await ref.update(updates);
    invalidateMarqueeCache();
    res.json({ id, ...doc.data(), ...updates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteMarqueeTopic(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const db = getFirestore();
    await db.collection(MARQUEE_COLLECTION).doc(id).delete();
    invalidateMarqueeCache();
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Public endpoint — no auth required (website reads this)
async function getActiveMarqueeTopics(req, res) {
  try {
    if (marqueeCache.topics && Date.now() - marqueeCache.updatedAt < MARQUEE_CACHE_TTL_MS) {
      return res.json(marqueeCache.topics);
    }

    const db = getFirestore();
    const snap = await db.collection(MARQUEE_COLLECTION).where('active', '==', true).get();
    const topics = [];
    snap.forEach((doc) => topics.push({ id: doc.id, ...doc.data() }));
    const sortedTopics = sortMarqueeTopics(topics);
    marqueeCache = {
      topics: sortedTopics,
      updatedAt: Date.now(),
    };
    res.json(sortedTopics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  testSmtpSettings,
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
  adminUpdateChannelNumber,
  adminUpdateChannelOwnerDisplay,
  adminImportChannel,
  adminListImportedChannels,
  adminRecheckChannelSource,
  adminUpdateChannelExternalSource,
  adminBulkRecheckSources,
  adminBackfillChannelDefaults,
  getFeatureFlags,
  setFeatureFlag,
  getDashboard,
  getDashboardTrend,
  runRenewals,
  getAuditLogs,
  getUserDetail,
  reloadFromFirestore,
  cleanupRecoveryShells,
  recoverFromEmailIndex,
  repairUserDocument,
  pitrRestore,
  getMarqueeTopics,
  createMarqueeTopic,
  updateMarqueeTopic,
  deleteMarqueeTopic,
  getActiveMarqueeTopics,
  listViewerPlans,
  createViewerPlan,
  updateViewerPlan,
  deleteViewerPlan,
  toggleViewerPlanActive,
};

// ─── Email Send / Broadcast ──────────────────────────────────────────────────

/**
 * POST /admin/email/send
 * Body: { toEmail, subject, html }
 * Sends a pre-rendered HTML email to a single address via SMTP.
 */
async function sendEmailToUser(req, res) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  const toEmail = String(req.body?.toEmail || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const html    = String(req.body?.html    || '').trim();

  if (!toEmail)  return res.status(400).json({ error: 'toEmail is required' });
  if (!subject)  return res.status(400).json({ error: 'subject is required' });
  if (!html)     return res.status(400).json({ error: 'html is required' });

  try {
    const result = await SmtpService.sendRawHtmlEmail({ toEmail, subject, html });
    await AuditService.logAction(caller.id, 'send_email_template', toEmail, { subject });
    res.json({ sent: 1, result });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to send email' });
  }
}

/**
 * POST /admin/email/broadcast
 * Body: { subject, html }
 * Personalises {{name}} and {{email}} tokens per-user, then sends to every
 * non-deleted user that has an email address on record.
 */
async function broadcastEmail(req, res) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  const subject = String(req.body?.subject || '').trim();
  const html    = String(req.body?.html    || '').trim();

  if (!subject) return res.status(400).json({ error: 'subject is required' });
  if (!html)    return res.status(400).json({ error: 'html is required' });

  try {
    const db = getFirestore();
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((u) => !u.deleted_at && u.email);

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const user of users) {
      const personalised = html
        .replace(/\{\{name\}\}/g,  user.displayName || user.name || user.email.split('@')[0])
        .replace(/\{\{email\}\}/g, user.email);
      try {
        await SmtpService.sendRawHtmlEmail({ toEmail: user.email, subject, html: personalised });
        sent++;
      } catch (err) {
        failed++;
        errors.push({ email: user.email, error: err.message });
      }
    }

    await AuditService.logAction(caller.id, 'broadcast_email_template', null, {
      subject,
      sent,
      failed,
      total: users.length,
    });

    res.json({ sent, failed, total: users.length, errors: errors.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Broadcast failed' });
  }
}

module.exports.sendEmailToUser  = sendEmailToUser;
module.exports.broadcastEmail   = broadcastEmail;
