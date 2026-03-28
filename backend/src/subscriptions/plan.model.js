const crypto = require('crypto');

const plans = [
  {
    id: 'plan_basic',
    name: 'basic',
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
];

function getAll() {
  return plans.filter((p) => p.is_active);
}

function findById(id) {
  return plans.find((p) => p.id === id);
}

function findByName(name) {
  return plans.find((p) => p.name === name);
}

function create({ name, price, currency, features, display_labels, badge }) {
  const plan = {
    id: `plan_${crypto.randomUUID().slice(0, 8)}`,
    name,
    price: price || 0,
    currency: currency || 'NGN',
    features: features || [],
    display_labels: display_labels || {},
    badge: badge || null,
    is_active: true,
  };
  plans.push(plan);
  return plan;
}

function update(id, fields) {
  const plan = findById(id);
  if (!plan) return null;
  if (fields.name !== undefined) plan.name = fields.name;
  if (fields.price !== undefined) plan.price = fields.price;
  if (fields.currency !== undefined) plan.currency = fields.currency;
  if (fields.features !== undefined) plan.features = fields.features;
  if (fields.display_labels !== undefined) plan.display_labels = fields.display_labels;
  if (fields.badge !== undefined) plan.badge = fields.badge;
  if (fields.is_active !== undefined) plan.is_active = fields.is_active;
  return plan;
}

function addFeature(id, feature, label) {
  const plan = findById(id);
  if (!plan) return null;
  if (!plan.features.includes(feature)) {
    plan.features.push(feature);
  }
  if (label) plan.display_labels[feature] = label;
  return plan;
}

function removeFeature(id, feature) {
  const plan = findById(id);
  if (!plan) return null;
  plan.features = plan.features.filter((f) => f !== feature);
  delete plan.display_labels[feature];
  return plan;
}

function remove(id) {
  const idx = plans.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  plans.splice(idx, 1);
  return true;
}

module.exports = { getAll, findById, findByName, create, update, addFeature, removeFeature, remove };
