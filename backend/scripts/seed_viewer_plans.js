/**
 * Upsert the 4 viewer plans into Firestore.
 * Run: node backend/scripts/seed_viewer_plans.js
 */
const admin = require('firebase-admin');

const projectId = process.env.FIREBASE_PROJECT_ID || 'raven-ai-6ff76';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

const db = admin.firestore();

const VIEWER_PLANS = [
  {
    id: 'plan_viewer_free',
    name: 'free',
    type: 'viewer',
    price: 0,
    yearly_price: 0,
    currency: 'NGN',
    features: ['public_channels', 'ads_viewing'],
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
    features: ['public_channels', 'private_channels', 'ad_free'],
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
    features: ['public_channels', 'private_channels', 'premium_channels', 'ad_free', 'priority_support'],
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
    features: ['all_channels', 'ad_free', 'priority_support', 'early_access', 'exclusive_deals'],
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

async function seed() {
  const batch = db.batch();
  for (const plan of VIEWER_PLANS) {
    batch.set(db.collection('plans').doc(plan.id), plan, { merge: true });
    console.log(`  → ${plan.id} (${plan.name}) — ₦${plan.price}/mo, ${plan.reward_multiplier}x`);
  }
  await batch.commit();
  console.log(`\nSeeded ${VIEWER_PLANS.length} viewer plans into Firestore.`);
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
