# AfroVision Backend — Complete Report

**Stack:** Express.js 5.2, Firestore, JWT (7-day), bcrypt, ethers.js (BSC/PancakeSwap), FCM, multer

---

## 1. Auth (`/auth`) — 6 routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | ❌ | Register with email + password (8+ chars, upper/lower/digit). Optional referral code. |
| POST | `/auth/login` | ❌ | Login. Returns JWT (7-day expiry). |
| GET | `/auth/me` | ✅ | Return current user profile. |
| POST | `/auth/forgot-password` | ❌ | Generate reset token. |
| POST | `/auth/reset-password` | ❌ | Validate token + set new password. |
| POST | `/auth/logout` | ❌ | No-op (frontend handles token deletion). |

- Rate-limited: 10 attempts per 60 sec per IP on register/login/forgot/reset.
- Referral attribution: async, non-blocking. Credits referrer's gift wallet (500 vPT) when threshold reached.

---

## 2. Users (`/users`) — 6 routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | ✅ | Return user profile (safe fields only). |
| PUT | `/users/update-profile` | ✅ | Update `name` field. |
| PATCH | `/users/currency` | ✅ | Set `preferred_currency` (validated against active currencies). |
| POST | `/users/request-creator` | ✅ | Request creator status (must subscribe to plan). |
| POST | `/users/fcm-token` | ✅ | Register FCM device token for push notifications. |
| POST | `/users/fcm-token/remove` | ✅ | Unregister FCM device token. |

**User Model Fields:** id, email, password_hash, name, role (viewer|creator|admin), is_premium_creator, kyc_status (none|pending|verified), subscription_plan, subscription_status, subscription_expiry, preferred_currency, vpt_balance, first_subscription_at, fcm_tokens, created_at.

---

## 3. Subscriptions — 2 Sub-Modules

### 3a. Platform Plans (`/subscriptions`) — 3 routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/subscriptions/plans` | ❌ | List all active subscription plans. |
| POST | `/subscriptions/subscribe` | ✅ | Subscribe to a plan. Triggers economic engine. |
| GET | `/subscriptions/me` | ✅ | Return user's current subscription + plan details. |

**Plans:**
- **Basic** — ₦2,000 (digital_tv)
- **Pro** — ₦10,000 (digital_tv, sync_live, 1 premium channel, up to 4 channels)
- **Premium** — ₦50,000 (digital_tv, sim_live, sync_live, private channel, premium stream, unlimited channels)

**Business Logic:**
1. First subscription = fiat only. Renewals can use vPT if balance sufficient.
2. Economic Engine triggered: payment → ledger → community pool (20%) → vPT extraction (30% of pool) → queue → batch swap → distribute tokens.
3. Auto-creates BSC wallet. Auto-sets role to creator. Premium plan → `is_premium_creator = true`.
4. Subscription expires after 30 days.

### 3b. Creator Subscriptions (`/subscriptions/creator`) — 5 routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/subscriptions/creator/subscribe` | ✅ | Subscribe to a creator. Charges gift wallet (NGN or vPT). |
| DELETE | `/subscriptions/creator/:id/cancel` | ✅ | Cancel subscription (subscriber or admin). |
| GET | `/subscriptions/creator/mine` | ✅ | List all creator subscriptions (active + cancelled). |
| GET | `/subscriptions/creator/subscribers` | ✅ | List all active subscribers to current creator. |
| GET | `/subscriptions/creator/check/:creatorUid` | ✅ | Check if authenticated user is subscribed to a creator. |

- Creator gets 70%, ops/community 30%.
- **Auto-renewal worker** runs every hour — charges or cancels on insufficient funds.
- Monthly billing cycle (30 days).

---

## 4. Channels (`/channels`) — 14 routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/channels` | ✅ | Create channel (creator/admin only). |
| POST | `/channels/create-with-media` | ✅ | Create + upload logo & banner in one request. |
| GET | `/channels` | ❌ | List all public channels with owner info. |
| GET | `/channels/me` | ✅ | List channels owned by authenticated user. |
| GET | `/channels/my-accesses` | ✅ | List premium channels user has active access to. |
| GET | `/channels/subscriber-feed` | ✅ | Feed of channels user is subscribed to. |
| GET | `/channels/number/:channelNumber` | ✅ | Lookup channel by unique 6-digit number. |
| GET | `/channels/:id` | ✅ | Get channel details (includes premium info). |
| GET | `/channels/:id/access` | ✅ | Check if user has valid access to premium channel. |
| POST | `/channels/:id/pay` | ✅ | Pay entry fee for premium channel (time-limited access). |
| PATCH | `/channels/:id/enable` | ✅ | Enable channel (owner only, requires 500+ vPT balance). |
| POST | `/channels/:id/upload/:mediaType` | ✅ | Upload logo or banner (owner only). |
| PATCH | `/channels/:id` | ✅ | Update name/description/category (owner only, requires 500+ vPT). |
| DELETE | `/channels/:id` | ✅ | Soft-delete channel (owner only). |

**Premium Stream Logic:**
- `checkAccess` — returns `has_access: true` or fee info.
- `payForAccess` — charges gift wallet, splits 50/30/20 (creator/ops/community), grants time-limited access (default 120 min).

### Categories (`/categories`) — 1 route

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/categories` | ❌ | List all active categories. |

Pre-populated: Entertainment, Sports, News, Education, Music, Gaming, Lifestyle, Technology, Comedy, Documentary.

### Home (`/home`) — 1 route

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/home/stats` | ✅ | Community pool balance, recent channels (10), promoted channels (5), total stats. |

---

## 5. Broadcast (`/broadcast`) — 11 routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/broadcast/time` | ❌ | Return server timestamp (for sync). |
| POST | `/broadcast/videos` | ✅ | Upload video file (creator/admin only). |
| GET | `/broadcast/videos/me` | ✅ | List videos uploaded by authenticated creator. |
| GET | `/broadcast/videos/channel/:channelId` | ✅ | List videos for a channel. |
| POST | `/broadcast/videos/:videoId/thumbnail` | ✅ | Upload thumbnail for video. |
| DELETE | `/broadcast/videos/:videoId` | ✅ | Delete video (owner only). |
| POST | `/broadcast/schedule` | ✅ | Schedule a video to play at specific time. |
| POST | `/broadcast/schedule/sequential` | ✅ | Schedule multiple videos sequentially. |
| GET | `/broadcast/schedule/:channelId` | ✅ | Get scheduled programs for a channel. |
| DELETE | `/broadcast/schedule/:programId` | ✅ | Delete scheduled program. |
| GET | `/broadcast/now-playing/:channelId` | ✅ | Get currently playing video (subscription-gated). |
| POST | `/broadcast/go-live` | ✅ | Trigger go-live FCM notification to subscribers. |

**Sim-Live System:** Pre-uploaded videos + scheduled programs + now-playing endpoint. Server calculates current playback position based on schedule start time vs server time.

---

## 6. VPT Economic Engine (`/vpt`) — 13 routes

### Creator Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/vpt/balance` | ✅ | Return vPT balance + transaction history. |
| GET | `/vpt/transactions` | ✅ | List vPT transactions. |
| GET | `/vpt/ledger` | ✅ | List ledger entries for current user. |
| GET | `/vpt/queue` | ✅ | List pending vPT conversions. |

### Admin Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/vpt/admin/stats` | ✅ | Queue statistics (pending, processing, failed). |
| GET | `/vpt/admin/ledger-stats` | ✅ | Ledger statistics (totals by type, currency). |
| GET | `/vpt/admin/ledger` | ✅ | Full ledger entries (default: 50 most recent). |
| GET | `/vpt/admin/batches` | ✅ | Batch processing history (default: 20). |
| GET | `/vpt/admin/batches/failed` | ✅ | Failed batches awaiting retry. |
| GET | `/vpt/admin/preflight` | ✅ | Blockchain readiness check (RPC, addresses, chain). |
| POST | `/vpt/admin/process-batch` | ✅ | Manually trigger batch processing (swap + distribute). |
| POST | `/vpt/admin/batches/:batchId/retry` | ✅ | Retry failed batch (max 3 attempts). |
| GET | `/vpt/admin/treasury` | ✅ | Current treasury balance on BSC. |

**Pipeline:** `queueVPT → createBatch → executeSwap (PancakeSwap) → distribute → complete`

**Ledger Event Types:** PLAN_PAYMENT, SPLIT, VPT_QUEUE, VPT_SWAP, VPT_DISTRIBUTION, WALLET_CREATED, SWAP_FAILED, DISTRIBUTION_FAILED, REFERRAL_REWARD, SUBSCRIPTION_PAYMENT, SUBSCRIPTION_RENEWAL, STREAM_ENTRY_VPT, STREAM_ENTRY_NGN, WITHDRAWAL, GIFT_SENT.

---

## 7. Wallet (`/wallet`) + Withdrawals (`/withdrawals`) — 11 routes

### Wallet

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/wallet/me` | ✅ | Get BSC wallet (auto-creates for creators). |
| POST | `/wallet/create` | ✅ | Explicitly create BSC wallet. |

- BSC wallet via ethers.js. Private key encrypted with AES-256-CBC (`WALLET_SECRET`).

### Withdrawals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/withdrawals` | ✅ | List withdrawals for authenticated user. |
| POST | `/withdrawals/request` | ✅ | Request NGN withdrawal (min ₦100, max ₦5M). |
| GET | `/withdrawals/all` | ✅ | List all withdrawal requests (admin only). |
| POST | `/withdrawals/:id/approve` | ✅ | Approve withdrawal (admin). Deducts from gift wallet. |
| POST | `/withdrawals/:id/reject` | ✅ | Reject withdrawal (admin). |
| POST | `/withdrawals/fund` | ✅ | Fund user's gift wallet (admin only). |
| POST | `/withdrawals/reverse` | ✅ | Create transaction reversal (admin only). |
| GET | `/withdrawals/admin/user/:uid/transactions` | ✅ | Get all transactions for a user (admin). |
| GET | `/withdrawals/admin/channel/:channelId/earnings` | ✅ | Get earnings for a channel (admin). |
| GET | `/withdrawals/admin/system-totals` | ✅ | System-wide financial totals (admin). |

---

## 8. Interactions (`/interactions`) — 11 routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/interactions/gifts` | ✅ | List active gifts. |
| GET | `/interactions/gifts/all` | ✅ | List all gifts (admin only). |
| POST | `/interactions/gifts` | ✅ | Create gift (admin only). |
| PATCH | `/interactions/gifts/:giftId` | ✅ | Update gift (admin only). |
| DELETE | `/interactions/gifts/:giftId` | ✅ | Delete gift (admin only). |
| GET | `/interactions/wallet` | ✅ | Get gift wallet (vPT units + NGN balance). |
| POST | `/interactions/reactions` | ✅ | Send free emoji reaction (rate limited: 5 per 5 sec). |
| POST | `/interactions/gifts/send` | ✅ | Send paid gift. Split: creator 50% / ops 30% / community 20%. |
| GET | `/interactions/combo` | ✅ | Get combo multiplier stats (consecutive gifts). |
| GET | `/interactions/leaderboard/:channelId` | ✅ | Top gift senders for a channel. |
| GET | `/interactions/events/:channelId` | ✅ | Recent gift/reaction events for a channel. |

---

## 9. Referrals (`/referrals`) — 2 routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/referrals/my-code` | ✅ | Return referral code + invite count + reward status. |
| POST | `/referrals/apply` | ✅ | Apply a referral code (post-registration flow). |

- Reward: 500 vPT units when invites reach configurable threshold.
- Credited to gift wallet. Logged as REFERRAL_REWARD ledger entry.

---

## 10. Admin (`/admin`) — 25+ routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| **User Management** | | | |
| POST | `/admin/set-role` | ✅ | Set user role (viewer/creator/admin). |
| POST | `/admin/set-premium` | ✅ | Set `is_premium_creator` flag. |
| POST | `/admin/set-kyc` | ✅ | Set KYC status (none/pending/verified). |
| GET | `/admin/users` | ✅ | List all users. |
| **Plan Management** | | | |
| POST | `/admin/plans` | ✅ | Create subscription plan. |
| PATCH | `/admin/plans/:id` | ✅ | Update plan details. |
| DELETE | `/admin/plans/:id` | ✅ | Delete plan. |
| POST | `/admin/plans/:id/features` | ✅ | Add feature to plan. |
| DELETE | `/admin/plans/:id/features/:feature` | ✅ | Remove feature from plan. |
| **Category Management** | | | |
| GET | `/admin/categories` | ✅ | List categories. |
| POST | `/admin/categories` | ✅ | Create category. |
| PATCH | `/admin/categories/:id` | ✅ | Update category. |
| DELETE | `/admin/categories/:id` | ✅ | Delete category. |
| **Settings Management** | | | |
| GET | `/admin/settings` | ✅ | List all settings (with sensitive markers). |
| GET | `/admin/settings/:key` | ✅ | Get single setting value. |
| PATCH | `/admin/settings/:key` | ✅ | Update setting value. |
| POST | `/admin/settings/:key/reset` | ✅ | Reset setting to default. |
| PATCH | `/admin/settings/bulk` | ✅ | Update multiple settings at once. |
| **Channel Management** | | | |
| GET | `/admin/channels` | ✅ | List all channels. |
| POST | `/admin/channels/:id/disable` | ✅ | Disable channel. |
| POST | `/admin/channels/:id/enable` | ✅ | Enable channel. |
| **Premium Stream Management** | | | |
| GET | `/admin/channels/premium` | ✅ | List premium-enabled channels. |
| PATCH | `/admin/channels/:id/premium` | ✅ | Configure premium settings (fee, duration, type). |
| **Creator Subscription Management** | | | |
| GET | `/admin/creator-subscriptions` | ✅ | List all creator subscriptions. |
| DELETE | `/admin/creator-subscriptions/:id/cancel` | ✅ | Cancel creator subscription. |
| **Features & Flags** | | | |
| GET | `/admin/features` | ✅ | List feature flags. |
| POST | `/admin/features` | ✅ | Set feature flag on/off. |
| **Dashboard & Audit** | | | |
| GET | `/admin/dashboard` | ✅ | Admin dashboard (users, channels, revenue totals). |
| GET | `/admin/audit` | ✅ | Audit trail of admin actions. |

**Key Settings:** ENVIRONMENT, JWT_SECRET, WALLET_SECRET, COMMUNITY_POOL_PERCENT (20), VPT_EXTRACTION_PERCENT (30), BSC_RPC, TREASURY_PRIVATE_KEY, PANCAKE_ROUTER, VPT_TOKEN_ADDRESS, WBNB_ADDRESS, NGN_TO_BNB_RATE (0.000038), ADMIN_EMAIL, ADMIN_PASSWORD.

---

## 11. Currencies (`/currencies`) — 2 routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/currencies` | ❌ | List supported currencies with conversion rates. |
| GET | `/currencies/plans` | ❌ | Get subscription plans converted to selected currency. |

Supported: NGN (₦), USD ($), GBP (£), EUR (€).

---

## 12. Notifications (`/notifications`) — 2 routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/notifications/send-user` | ✅ | Send push notification to specific user (admin only). |
| POST | `/notifications/broadcast` | ✅ | Broadcast push to all users (admin only). |

Via Firebase Cloud Messaging (FCM). Invalid/expired tokens auto-cleaned.

---

## 13. Analytics — NOT MOUNTED

Creator stats + channel stats models exist but routes are **not registered** in `app.js`.

---

## Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts (id, email, role, vpt_balance, subscription) |
| `password_reset_tokens` | Password reset tokens with expiry |
| `channels` | Channels/pods (owner, name, category, premium config) |
| `channel_access` | Premium channel time-limited access grants |
| `creator_subscriptions` | Creator-to-creator subscriptions |
| `creator_daily_stats` | Creator social proof counters |
| `videos` | Uploaded video files |
| `programs` | Scheduled broadcast programs |
| `wallets` | BSC wallets (encrypted private keys) |
| `gifts` | Gift catalog |
| `gift_wallets` | User gift/NGN balances |
| `gift_events` | Sent gifts & reactions |
| `withdrawals` | Withdrawal requests |
| `ledger` | Financial event log (**source of truth**) |
| `vpt_transactions` | vPT transaction history |
| `distribution_queue` | Pending vPT conversions |
| `batches` | Batch swap operations |
| `referrals` | Referral codes & invites |
| `settings` | Configuration settings |
| `settings_audit` | Settings audit trail |
| `feature_flags` | Feature toggles |

---

## Key Business Rules

1. **First subscription** — fiat only → auto-converts to creator role.
2. **Premium plan** — sets `is_premium_creator = true` → unlocks private channels, unlimited premium channels.
3. **Channel editing** — requires 500+ vPT balance.
4. **Private channels** — premium creators only.
5. **Premium streams** — time-limited access (default 120 min) charged per-entry.
6. **Gift split** — creator 50%, operations 30%, community 20%.
7. **Creator subscription split** — creator 70%, ops/community 30%.
8. **Subscription renewal** — auto-charges every 30 days, cancels on insufficient funds.
9. **Referral reward** — 500 vPT when invites reach threshold.
10. **Economic engine** — subscription → split → queue → batch swap (PancakeSwap) → distribute.
11. **Ledger** — all financial events logged atomically; ledger = source of truth.
12. **Batch retry** — failed swaps retryable up to 3 times.

---

## Summary

| Metric | Count |
|--------|-------|
| Total API routes | ~100+ |
| Firestore collections | 20 |
| Ledger event types | 13 |
| Background workers | 1 (subscription renewal, hourly) |

### Fully Operational
Auth, users, channels, broadcast (sim-live), gifts/reactions, creator subscriptions, referrals, currencies, admin panel, settings, audit logs, FCM notifications, ledger system.

### Requires Configuration
VPT economic engine + wallet + withdrawals — functional but requires BSC RPC, treasury key, PancakeSwap router, and VPT token address in settings.

### Not Yet Active
Analytics module — code exists but isn't mounted in Express app.
