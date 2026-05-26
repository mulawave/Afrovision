const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { getFirestore } = require('./utils/firestore');
const authRoutes = require('./auth/auth.routes');
const userRoutes = require('./users/user.routes');
const UserModel = require('./users/user.model');
const adminRoutes = require('./admin/admin.routes');
const SettingsService = require('./admin/settings.service');
const subscriptionRoutes = require('./subscriptions/subscription.routes');
const channelRoutes = require('./channels/channel.routes');
const categoryRoutes = require('./channels/category.routes');
const homeRoutes = require('./channels/home.routes');
const currencyRoutes = require('./currencies/currency.routes');
const vptRoutes = require('./vpt/vpt.routes');
const walletRoutes = require('./wallet/wallet.routes');
const broadcastRoutes = require('./broadcast/broadcast.routes');
const interactionsRoutes = require('./interactions/interactions.routes');
const withdrawalRoutes = require('./wallet/withdrawal.routes');
const paymentRoutes = require('./payments/payment.routes');
const notificationRoutes = require('./notifications/notification.routes');
const RenewalWorker = require('./subscriptions/renewal.worker');
const reputationRoutes = require('./reputation/reputation.routes');
const ReputationService = require('./reputation/reputation.service');
const ReminderWorker = require('./broadcast/reminder.worker');
const ExclusiveLifecycleWorker = require('./channels/exclusive_lifecycle.worker');
const ExclusiveReconciliationService = require('./channels/exclusive_reconciliation.service');
const SwapService = require('./vpt/swap.service');
const PoolService = require('./vpt/pool.service');
const creatorSubscriptionRoutes = require('./subscriptions/creator_subscription.routes');
const channelSubscriptionRoutes = require('./subscriptions/channel_subscription.routes');
const referralRoutes = require('./referrals/referral.routes');
const creatorAnalyticsRoutes = require('./analytics/creator_analytics.routes');
const copyrightRoutes = require('./copyright/copyright.routes');
const challengeRoutes = require('./challenge/challenge.routes');
const kycRoutes = require('./kyc/kyc.routes');
const adRoutes = require('./ads/ad.routes');
const subtitleRoutes = require('./subtitles/subtitle.routes');
const libraryRoutes = require('./library/library.routes');
const waveRoutes = require('./wave/wave.routes');
const { initializeSocketServer } = require('./realtime/socket.service');

const app = express();

const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Start listening ASAP for Cloud Run readiness and keep app responsive
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});

// Socket.IO must be available even if later startup checks fail and the HTTP
// server keeps serving requests.
initializeSocketServer(server);

// Trust the first proxy (Cloud Run, nginx, etc.) so req.ip reflects the real client IP
app.set('trust proxy', 1);

app.use(helmet());

// Tolerate missing ALLOWED_ORIGINS for startup; default to '*', log warning
let allowedOrigins = '*';
if (!process.env.ALLOWED_ORIGINS) {
  console.warn('[Config] ALLOWED_ORIGINS is not set. Defaulting to * (development-only).');
} else {
  allowedOrigins = process.env.ALLOWED_ORIGINS
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowedOrigins.length === 0) allowedOrigins = '*';
  console.log('[Config] ALLOWED_ORIGINS:', allowedOrigins);
}
app.use(cors({ origin: allowedOrigins, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Legacy /uploads route — redirects to GCS for migrated files, serves local as fallback
const GCS_BUCKET = process.env.GCS_BUCKET;
app.use('/uploads', (req, res, next) => {
  if (!GCS_BUCKET) {
    return res.status(503).json({ error: 'GCS is not configured' });
  }
  const filename = req.path.replace(/^\//, '');
  if (!filename) return next();
  const ext = path.extname(filename).toLowerCase();
  const folder = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext) ? 'videos' : 'images';
  res.redirect(301, `https://storage.googleapis.com/${GCS_BUCKET}/${folder}/${filename}`);
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/channels', channelRoutes);
app.use('/categories', categoryRoutes);
app.use('/home', homeRoutes);
app.use('/currencies', currencyRoutes);
app.use('/vpt', vptRoutes);
app.use('/wallet', walletRoutes);
app.use('/broadcast', broadcastRoutes);
app.use('/interactions', interactionsRoutes);
app.use('/withdrawals', withdrawalRoutes);
app.use('/payments', paymentRoutes);
app.use('/notifications', notificationRoutes);
app.use('/subscriptions', creatorSubscriptionRoutes);
app.use('/subscriptions', channelSubscriptionRoutes);
app.use('/referrals', referralRoutes);
app.use('/analytics/creator', creatorAnalyticsRoutes);
app.use('/copyright', copyrightRoutes);
app.use('/challenge', challengeRoutes);
app.use('/kyc', kycRoutes);
app.use('/ads', adRoutes);
app.use('/subtitles', subtitleRoutes);
app.use('/reputation', reputationRoutes);
app.use('/', libraryRoutes);
app.use('/wave', waveRoutes);

function getOpsSecret() {
  return process.env.OPS_SECRET || null;
}

// Promo modal — public endpoint (no auth required)
const promoModalCtrl = require('./promo/promo-modal.controller');
app.get('/promo-modal', promoModalCtrl.getPromoModal);

// One-time admin recalculation endpoint — protected by ADMIN_PASSWORD env var
app.post('/ops/recalculate-payouts', async (req, res) => {
  const { secret } = req.body;
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw || secret !== adminPw) {
    return res.status(403).json({ error: 'Invalid secret' });
  }
  const referralCtrl = require('./referrals/referral.controller');
  // Set admin userId and bypass role check by setting req._opsAuth
  const adminUser = await UserModel.findByEmail('richardobroh@gmail.com');
  if (!adminUser) return res.status(500).json({ error: 'Admin user not found' });
  req.userId = adminUser.id;
  req._opsAuth = true; // Signal to bypass role check
  return referralCtrl.adminRecalculatePayouts(req, res);
});

// Renewal trigger endpoint — intended for Cloud Scheduler or other external single-owner job runners.
app.post('/ops/run-renewals', async (req, res) => {
  const { secret, force } = req.body || {};
  const opsSecret = getOpsSecret();
  if (!opsSecret || secret !== opsSecret) {
    return res.status(403).json({ error: 'Invalid secret' });
  }

  try {
    const result = await RenewalWorker.runScheduledRenewals({
      trigger: 'ops-http',
      force: force === true,
    });
    return res.json({ result });
  } catch (error) {
    console.error('[RenewalWorker] HTTP trigger error:', error.message);
    return res.status(500).json({ error: error.message || 'Renewal run failed' });
  }
});

app.post('/ops/run-pool-distribution', async (req, res) => {
  const { secret, force } = req.body || {};
  const opsSecret = getOpsSecret();
  if (!opsSecret || secret !== opsSecret) {
    return res.status(403).json({ error: 'Invalid secret' });
  }

  try {
    const result = await PoolService.runScheduledDistribution({
      trigger: 'ops-http',
      force: force === true,
    });
    return res.json({ result });
  } catch (error) {
    console.error('[Pool Cron] HTTP trigger error:', error.message);
    return res.status(500).json({ error: error.message || 'Pool distribution failed' });
  }
});

app.post('/ops/run-reminders', async (req, res) => {
  const { secret, force } = req.body || {};
  const opsSecret = getOpsSecret();
  if (!opsSecret || secret !== opsSecret) {
    return res.status(403).json({ error: 'Invalid secret' });
  }

  try {
    const result = await ReminderWorker.runScheduledReminderDispatch({
      trigger: 'ops-http',
      force: force === true,
    });
    return res.json({ result });
  } catch (error) {
    console.error('[ReminderWorker] HTTP trigger error:', error.message);
    return res.status(500).json({ error: error.message || 'Reminder dispatch failed' });
  }
});

app.post('/ops/run-exclusive-lifecycle', async (req, res) => {
  const { secret, force } = req.body || {};
  const opsSecret = getOpsSecret();
  if (!opsSecret || secret !== opsSecret) {
    return res.status(403).json({ error: 'Invalid secret' });
  }

  try {
    const result = await ExclusiveLifecycleWorker.runScheduledExclusiveLifecycle({
      trigger: 'ops-http',
      force: force === true,
    });
    return res.json({ result });
  } catch (error) {
    console.error('[ExclusiveLifecycleWorker] HTTP trigger error:', error.message);
    return res.status(500).json({ error: error.message || 'Exclusive lifecycle run failed' });
  }
});

app.post('/ops/run-exclusive-reconciliation', async (req, res) => {
  const { secret, lookbackHours } = req.body || {};
  const opsSecret = getOpsSecret();
  if (!opsSecret || secret !== opsSecret) {
    return res.status(403).json({ error: 'Invalid secret' });
  }

  try {
    const result = await ExclusiveReconciliationService.runScheduledExclusiveReconciliation({
      trigger: 'ops-http',
      lookbackHours: Number(lookbackHours || 72),
    });
    return res.json({ result });
  } catch (error) {
    console.error('[ExclusiveReconciliation] HTTP trigger error:', error.message);
    return res.status(500).json({ error: error.message || 'Exclusive reconciliation failed' });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'AfroVision API running' });
});

// 404 handler — returns JSON instead of Express default HTML
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler — must be after all routes; returns JSON instead of HTML
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.message || err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 10 MB per file.' });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function ensureAdminSeed() {
  const bcrypt = require('bcrypt');
  const crypto = require('crypto');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@afrovision.com';
  const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(20).toString('base64url');
  const isGeneratedPassword = !process.env.ADMIN_PASSWORD;

  // Check specifically for the seed account email, not just any admin
  const existing = await UserModel.findByEmail(adminEmail);
  if (existing) {
    if (existing.role !== 'admin') {
      await UserModel.setRole(existing.id, 'admin');
      console.log(`[Seed] Promoted ${adminEmail} to admin`);
    }
    // If ADMIN_PASSWORD env var is set, always sync the password
    if (!isGeneratedPassword) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await UserModel.updatePassword(existing.id, passwordHash);
      console.log(`[Seed] Admin password synced from ADMIN_PASSWORD env var`);
    } else {
      console.log(`[Seed] Admin seed account already exists: ${adminEmail}`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await UserModel.create({ email: adminEmail, passwordHash });
  await UserModel.setRole(admin.id, 'admin');
  console.log('[Seed] ✓ Default admin created');
  console.log(`[Seed]   Email   : ${adminEmail}`);
  console.log('[Seed]   Password: (set via ADMIN_PASSWORD env var or auto-generated)');
}

async function validateRuntimeConfiguration() {
  const missing = [];

  // Admin panel is the source of truth for SMTP settings.
  const [smtpHost, smtpUser, smtpPassword, smtpFromEmail, elevenLabsSetting] = await Promise.all([
    SettingsService.get('SMTP_HOST'),
    SettingsService.get('SMTP_USERNAME'),
    SettingsService.get('SMTP_PASSWORD'),
    SettingsService.get('SMTP_FROM_EMAIL'),
    SettingsService.get('ELEVENLABS_API_KEY'),
  ]);

  if (!smtpHost) missing.push('SMTP_HOST (admin setting)');
  if (!smtpUser) missing.push('SMTP_USERNAME (admin setting)');
  if (!smtpPassword) missing.push('SMTP_PASSWORD (admin setting)');
  if (!smtpFromEmail) missing.push('SMTP_FROM_EMAIL (admin setting)');

  // TTS can come from admin settings first, then env var as fallback.
  if (!elevenLabsSetting && !process.env.ELEVENLABS_API_KEY) {
    console.warn('[Config] ELEVENLABS_API_KEY not set — TTS features will be unavailable');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required runtime configuration: ${missing.join(', ')}`);
  }
}

async function startServer() {
  await Promise.all([
    SettingsService.ensureDefinitionsExist(),
    // ChannelStatsModel has no init; it initializes lazily on demand
    PoolService.init(),
  ]);

  console.log('[RenewalWorker] Waiting for external renewal trigger ownership');

  console.log('[Pool Cron] Waiting for external distribution trigger ownership');
  console.log('[ReminderWorker] Waiting for external reminder trigger ownership');
  console.log('[ExclusiveLifecycleWorker] Waiting for external lifecycle trigger ownership');

  // Seed default admin user (skipped if one already exists)
  await ensureAdminSeed();

  // ── One-time Migration: gift_wallets → users ───────────────
  try {
    const migDb = getFirestore();
    const migFlag = migDb.doc('ops_migrations/gift_wallets_to_users_v1');
    const migSnap = await migFlag.get();
    if (!migSnap.exists) {
      const gwSnap = await migDb.collection('gift_wallets').get();
      let merged = 0;
      let batch = migDb.batch();
      let batchCount = 0;
      for (const doc of gwSnap.docs) {
        const data = doc.data();
        const uid = doc.id;
        const vpt = data.vpt_units || 0;
        const cash = data.ngn_balance || 0;
        if (vpt === 0 && cash === 0) continue;
        const userRef = migDb.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) continue;
        const u = userSnap.data();
        const newVpt = parseFloat(((u.vpt || 0) + vpt).toFixed(4));
        const newCash = parseFloat(((u.cash || 0) + cash).toFixed(2));
        batch.update(userRef, { vpt: newVpt, cash: newCash });
        // Also sync the local cache if this user was already read during runtime.
        const inMem = UserModel.findCachedById(uid);
        if (inMem) { inMem.vpt = newVpt; inMem.cash = newCash; }
        merged++;
        batchCount++;
        if (batchCount >= 450) { await batch.commit(); batch = migDb.batch(); batchCount = 0; }
      }
      if (batchCount > 0) await batch.commit();
      await migFlag.set({ completed_at: Date.now(), merged });
      console.log(`[Migration] gift_wallets → users: merged ${merged} wallets`);
    }
  } catch (migErr) {
    console.error('[Migration] gift_wallets → users failed (non-fatal):', migErr.message);
  }

  // Auto-generate secrets for staging (no-op in production)
  await SettingsService.ensureStagingSecrets();

  // Fail fast on missing critical configuration (admin-first)
  await validateRuntimeConfiguration();

  // Blockchain readiness diagnostic
  try {
    const readiness = await SwapService.getBlockchainReadiness();
    console.log(`[Blockchain] Environment: ${readiness.environment}`);
    if (readiness.ready) {
      console.log(`[Blockchain] Ready — treasury: ${readiness.treasury_address}, chain: ${readiness.chain_label}`);
    } else if (readiness.missing && readiness.missing.length) {
      console.log(`[Blockchain] Not ready — missing: ${readiness.missing.join(', ')}`);
      if (readiness.missing.includes('VPT_TOKEN_ADDRESS') && readiness.missing.length === 1) {
        console.log('[Blockchain] Deploy test token: DEPLOYER_PRIVATE_KEY=<treasury_key> npm run deploy:testnet');
      }
    } else if (readiness.error) {
      console.log(`[Blockchain] Not ready — ${readiness.error}`);
    }
  } catch (err) {
    console.log(`[Blockchain] Readiness check skipped: ${err.message}`);
  }
}

startServer().catch((error) => {
  console.error('[Bootstrap] Failed to initialize persistence (continuing to serve):', error.message);
});
