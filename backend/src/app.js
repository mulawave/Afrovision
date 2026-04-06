const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
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
const notificationRoutes = require('./notifications/notification.routes');
const NotificationModel = require('./notifications/notification.model');
const creatorSubscriptionRoutes = require('./subscriptions/creator_subscription.routes');
const referralRoutes = require('./referrals/referral.routes');
const creatorAnalyticsRoutes = require('./analytics/creator_analytics.routes');
const copyrightRoutes = require('./copyright/copyright.routes');
const challengeRoutes = require('./challenge/challenge.routes');
const kycRoutes = require('./kyc/kyc.routes');
const ChallengeModel = require('./challenge/challenge.model');
const KycModel = require('./kyc/kyc.model');
const RenewalWorker = require('./subscriptions/renewal.worker');
const ChannelAccessModel = require('./channels/channel_access.model');
const CreatorSubscriptionModel = require('./subscriptions/creator_subscription.model');
const ReferralModel = require('./referrals/referral.model');
const WalletModel = require('./wallet/wallet.model');
const WithdrawalModel = require('./wallet/withdrawal.model');
const VideoModel = require('./broadcast/video.model');
const ProgramModel = require('./broadcast/program.model');
const LedgerModel = require('./vpt/ledger.model');
const DistributionModel = require('./vpt/distribution.model');
const BatchModel = require('./vpt/batch.model');
const VptModel = require('./vpt/vpt.model');
const SwapService = require('./vpt/swap.service');
const GiftModel = require('./interactions/gift.model');
const GiftWalletModel = require('./interactions/gift-wallet.model');
const StreamStatsModel = require('./analytics/stream_stats.model');
const ChannelModel = require('./channels/channel.model');
const CategoryModel = require('./channels/category.model');
const PlanModel = require('./subscriptions/plan.model');
const { initializeSocketServer } = require('./realtime/socket.service');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*', // staging: allow all; production: set ALLOWED_ORIGINS
}));
app.use(express.json({ limit: '1mb' }));

// Legacy /uploads route — redirects to GCS for migrated files, serves local as fallback
const GCS_BUCKET = process.env.GCS_BUCKET || 'afrovision-media';
app.use('/uploads', (req, res, next) => {
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
app.use('/notifications', notificationRoutes);
app.use('/subscriptions', creatorSubscriptionRoutes);
app.use('/referrals', referralRoutes);
app.use('/analytics/creator', creatorAnalyticsRoutes);
app.use('/copyright', copyrightRoutes);
app.use('/challenge', challengeRoutes);
app.use('/kyc', kycRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'AfroVision API running' });
});

// Global error handler — must be after all routes; returns JSON instead of HTML
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.message || err);
  res.status(500).json({ error: 'Internal server error' });
});

async function ensureAdminSeed() {
  const bcrypt = require('bcrypt');
  const crypto = require('crypto');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@afrovision.com';
  const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(20).toString('base64url');
  const isGeneratedPassword = !process.env.ADMIN_PASSWORD;

  // Check specifically for the seed account email, not just any admin
  const existing = UserModel.findByEmail(adminEmail);
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
  if (isGeneratedPassword) {
    console.log('[Seed]   Password: (auto-generated — check Cloud Run env or set ADMIN_PASSWORD)');
  } else {
    console.log('[Seed]   Password: (from ADMIN_PASSWORD env var)');
  }
}

async function startServer() {
  await Promise.all([
    SettingsService.ensureDefinitionsExist(),
    UserModel.init(),
    WalletModel.init(),
    LedgerModel.init(),
    DistributionModel.init(),
    BatchModel.init(),
    VptModel.init(),
    VideoModel.init(),
    ProgramModel.init(),
    GiftModel.init(),
    GiftWalletModel.init(),
    StreamStatsModel.init(),
    WithdrawalModel.init(),
    NotificationModel.init(),
    ChannelAccessModel.init(),
    CreatorSubscriptionModel.init(),
    ReferralModel.init(),
    ChallengeModel.init(),
    KycModel.init(),
    ChannelModel.init(),
    CategoryModel.init(),
    PlanModel.init(),
  ]);

  // Start the renewal worker AFTER models are initialized
  RenewalWorker.start();

  // Seed default admin user (skipped if one already exists)
  await ensureAdminSeed();

  // Auto-generate secrets for staging (no-op in production)
  await SettingsService.ensureStagingSecrets();

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

  initializeSocketServer(server);

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('[Bootstrap] Failed to initialize persistence:', error.message);
  process.exit(1);
});
