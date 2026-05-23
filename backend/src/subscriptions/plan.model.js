const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'plans';
const plansById = new Map();
const plansByName = new Map();
let defaultsEnsured = false;
let ensureDefaultsPromise = null;

const DEFAULTS = [
  {
    id: 'plan_basic',
    name: 'basic',
    type: 'creator',
    price: 2000,
    currency: 'NGN',
    features: ['digital_tv'],
    display_labels: {
      digital_tv: 'Digital TV',
    },
    badge: null,
    is_active: true,
  },
  {
    id: 'plan_pro',
    name: 'pro',
    type: 'creator',
    price: 10000,
    currency: 'NGN',
    features: [
      'digital_tv',
      'sync_live',
      '1_premium_channel',
      'up_to_4_channels',
    ],
    display_labels: {
      digital_tv: 'Digital TV',
      sync_live: 'Sync Live',
      '1_premium_channel': '1 Premium Channel',
      up_to_4_channels: 'Up to 4 Channels',
    },
    badge: 'Pro',
    is_active: true,
  },
  {
    id: 'plan_premium',
    name: 'premium',
    type: 'creator',
    price: 50000,
    currency: 'NGN',
    features: [
      'digital_tv',
      'sim_live',
      'sync_live',
      'private_channel',
      'premium_stream',
      'unlimited_channels',
      'unlimited_premium_channels',
    ],
    display_labels: {
      digital_tv: 'Digital TV',
      sim_live: 'Sim Live',
      sync_live: 'Sync Live',
      private_channel: 'Private Channel',
      premium_stream: 'Premium Stream',
      unlimited_channels: 'Unlimited Channels',
      unlimited_premium_channels: 'Unlimited Premium Channels',
    },
    badge: 'Premium',
    is_active: true,
  },
  {
    id: 'plan_viewer_free',
    name: 'free',
    type: 'viewer',
    price: 0,
    yearly_price: 0,
    currency: 'NGN',
    features: [
      'public_channels',
      'ads_viewing',
    ],
    display_labels: {
      public_channels: 'Public Channels',
      ads_viewing: 'Ads Viewing',
    },
    badge: null,
    reward_multiplier: 0,
    is_active: true,
  },
  {
    id: 'plan_viewer_basic',
    name: 'basic_viewer',
    type: 'viewer',
    price: 500,
    yearly_price: 5100,
    currency: 'NGN',
    features: [
      'public_channels',
      'private_channels',
      'ad_free',
    ],
    display_labels: {
      public_channels: 'Public Channels',
      private_channels: 'Private Channels',
      ad_free: 'Ad-Free Viewing',
    },
    badge: 'Dull Blue',
    reward_multiplier: 0.5,
    is_active: true,
  },
  {
    id: 'plan_viewer_pro',
    name: 'pro_viewer',
    type: 'viewer',
    price: 1000,
    yearly_price: 9600,
    currency: 'NGN',
    features: [
      'public_channels',
      'private_channels',
      'premium_channels',
      'ad_free',
      'priority_support',
    ],
    display_labels: {
      public_channels: 'Public Channels',
      private_channels: 'Private Channels',
      premium_channels: 'Premium Channels',
      ad_free: 'Ad-Free Viewing',
      priority_support: 'Priority Support',
    },
    badge: 'Royal Purple',
    reward_multiplier: 1.5,
    is_active: true,
  },
  {
    id: 'plan_viewer_premium',
    name: 'premium_viewer',
    type: 'viewer',
    price: 3000,
    yearly_price: 30000,
    currency: 'NGN',
    features: [
      'all_channels',
      'ad_free',
      'priority_support',
      'early_access',
      'exclusive_deals',
    ],
    display_labels: {
      all_channels: 'All Channels',
      ad_free: 'Ad-Free Viewing',
      priority_support: 'Priority Support',
      early_access: 'Early Access',
      exclusive_deals: 'Exclusive Deals',
    },
    badge: 'Premium Gold',
    reward_multiplier: 3.5,
    is_active: true,
  },
];

function cachePlan(plan) {
  if (!plan || !plan.id) return plan;
  const normalized = { ...plan };
  plansById.set(normalized.id, normalized);
  if (normalized.name) {
    plansByName.set(normalized.name, normalized);
  }
  return normalized;
}

function removeCachedPlan(plan) {
  if (!plan) return;
  if (plan.id) plansById.delete(plan.id);
  if (plan.name) plansByName.delete(plan.name);
}

function findDefaultById(id) {
  const plan = DEFAULTS.find((entry) => entry.id === id);
  return plan ? cachePlan(plan) : null;
}

function findDefaultByName(name) {
  const plan = DEFAULTS.find((entry) => entry.name === name);
  return plan ? cachePlan(plan) : null;
}

async function ensureDefaultsSeeded() {
  if (defaultsEnsured) return;
  if (ensureDefaultsPromise) {
    await ensureDefaultsPromise;
    return;
  }

  ensureDefaultsPromise = (async () => {
    const db = getFirestore();
    const snapshot = await db.collection(COLLECTION).limit(1).get();
    if (snapshot.empty) {
      const batch = db.batch();
      for (const plan of DEFAULTS) {
        batch.set(db.collection(COLLECTION).doc(plan.id), plan);
        cachePlan(plan);
      }
      await batch.commit();
      console.log(`[PlanModel] Seeded ${DEFAULTS.length} default plans`);
    }
    defaultsEnsured = true;
  })();

  try {
    await ensureDefaultsPromise;
  } finally {
    ensureDefaultsPromise = null;
  }
}

async function init() {
  await ensureDefaultsSeeded();
  return getAll();
}

async function loadAllPlans() {
  await ensureDefaultsSeeded();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  if (snapshot.empty) {
    return DEFAULTS.map((plan) => cachePlan(plan));
  }
  return snapshot.docs.map((doc) => cachePlan({ ...doc.data(), id: doc.id }));
}

function findCachedById(id) {
  if (!id) return null;
  return plansById.get(id) || findDefaultById(id);
}

function findCachedByName(name) {
  if (!name) return null;
  return plansByName.get(name) || findDefaultByName(name);
}

async function getAll() {
  const plans = await loadAllPlans();
  return plans.filter((p) => p.is_active);
}

async function findById(id) {
  const cached = findCachedById(id);
  if (cached) return cached;
  await ensureDefaultsSeeded();
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return cachePlan({ ...doc.data(), id: doc.id });
}

async function findByName(name) {
  const cached = findCachedByName(name);
  if (cached) return cached;
  await ensureDefaultsSeeded();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('name', '==', name)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return cachePlan({ ...doc.data(), id: doc.id });
}

async function create({ name, type, price, yearly_price, currency, features, display_labels, badge, reward_multiplier }) {
  const db = getFirestore();
  const plan = {
    id: `plan_${crypto.randomUUID().slice(0, 8)}`,
    name,
    type: type || 'creator',
    price: price || 0,
    yearly_price: yearly_price ?? null,
    currency: currency || 'NGN',
    features: features || [],
    display_labels: display_labels || {},
    badge: badge || null,
    reward_multiplier: reward_multiplier ?? null,
    is_active: true,
  };
  await db.collection(COLLECTION).doc(plan.id).set(plan);
  cachePlan(plan);
  return plan;
}

async function getByType(type) {
  await ensureDefaultsSeeded();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('type', '==', type)
    .where('is_active', '==', true)
    .get();
  return snapshot.docs.map((doc) => cachePlan({ ...doc.data(), id: doc.id }));
}

async function getAllByType(type) {
  await ensureDefaultsSeeded();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('type', '==', type)
    .get();
  return snapshot.docs.map((doc) => cachePlan({ ...doc.data(), id: doc.id }));
}

async function update(id, fields) {
  const plan = await findById(id);
  if (!plan) return null;
  const previousName = plan.name;
  const updates = {};
  if (fields.name !== undefined) { plan.name = fields.name; updates.name = fields.name; }
  if (fields.type !== undefined) { plan.type = fields.type; updates.type = fields.type; }
  if (fields.price !== undefined) { plan.price = fields.price; updates.price = fields.price; }
  if (fields.yearly_price !== undefined) { plan.yearly_price = fields.yearly_price; updates.yearly_price = fields.yearly_price; }
  if (fields.currency !== undefined) { plan.currency = fields.currency; updates.currency = fields.currency; }
  if (fields.features !== undefined) { plan.features = fields.features; updates.features = fields.features; }
  if (fields.display_labels !== undefined) { plan.display_labels = fields.display_labels; updates.display_labels = fields.display_labels; }
  if (fields.badge !== undefined) { plan.badge = fields.badge; updates.badge = fields.badge; }
  if (fields.reward_multiplier !== undefined) { plan.reward_multiplier = fields.reward_multiplier; updates.reward_multiplier = fields.reward_multiplier; }
  if (fields.is_active !== undefined) { plan.is_active = fields.is_active; updates.is_active = fields.is_active; }
  if (Object.keys(updates).length > 0) {
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).update(updates);
  }
  if (previousName && previousName !== plan.name) {
    plansByName.delete(previousName);
  }
  cachePlan(plan);
  return plan;
}

async function addFeature(id, feature, label) {
  const plan = await findById(id);
  if (!plan) return null;
  if (!plan.features.includes(feature)) {
    plan.features.push(feature);
  }
  if (label) plan.display_labels[feature] = label;
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ features: plan.features, display_labels: plan.display_labels });
  cachePlan(plan);
  return plan;
}

async function removeFeature(id, feature) {
  const plan = await findById(id);
  if (!plan) return null;
  plan.features = plan.features.filter((f) => f !== feature);
  delete plan.display_labels[feature];
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ features: plan.features, display_labels: plan.display_labels });
  cachePlan(plan);
  return plan;
}

async function remove(id) {
  const existing = await findById(id);
  if (!existing) return false;
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  removeCachedPlan(existing);
  return true;
}

module.exports = { init, getAll, getByType, getAllByType, findById, findByName, findCachedByName, create, update, addFeature, removeFeature, remove };
