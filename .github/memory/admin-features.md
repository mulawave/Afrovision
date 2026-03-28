# AfroVision — Admin Features Memory

> **Policy**: Every new module/feature implementation MUST include its admin controls documented here.
> Admin has full control and management over every aspect of the project.

---

## Module 1 — Auth & User Management

### Implemented ✅
| Feature | Endpoint | Method | Description |
|---------|----------|--------|-------------|
| Set User Role | `/admin/set-role` | POST | Assign role: viewer / creator / admin |
| Set Premium Creator | `/admin/set-premium` | POST | Toggle premium creator status (bool) |
| Set KYC Status | `/admin/set-kyc` | POST | Set KYC: none / pending / verified |

### TODO 🔲
- [ ] **List All Users** — GET `/admin/users` — paginated user list with filters (role, kyc, premium, subscription status)
- [ ] **Get User Detail** — GET `/admin/users/:id` — full user profile with subscription, wallet, vPT balance, ledger history
- [ ] **Suspend/Ban User** — POST `/admin/users/:id/suspend` — disable user account
- [ ] **Delete User** — DELETE `/admin/users/:id` — remove user and related data
- [ ] **Admin Bootstrap** — POST `/admin/bootstrap` — create first admin (one-time, when no admin exists)
- [ ] **Audit Log for Role Changes** — log all role/kyc/premium changes to ledger

---

## Module 2 — Subscription Plans

### Implemented ✅
| Feature | Endpoint | Method | Description |
|---------|----------|--------|-------------|
| Create Plan | `/admin/plans` | POST | Create subscription plan (name, price, currency, features, badge) |
| Update Plan | `/admin/plans/:id` | PATCH | Update plan fields |
| Delete Plan | `/admin/plans/:id` | DELETE | Remove plan |
| Add Feature to Plan | `/admin/plans/:id/features` | POST | Add feature key + label |
| Remove Feature from Plan | `/admin/plans/:id/features/:feature` | DELETE | Remove feature from plan |

### TODO 🔲
- [ ] **List All Plans** — GET `/admin/plans` — list all plans (active + inactive)
- [ ] **Toggle Plan Active/Inactive** — PATCH `/admin/plans/:id/toggle` — enable/disable plan without deleting
- [ ] **View Plan Subscribers** — GET `/admin/plans/:id/subscribers` — list users on a specific plan
- [ ] **Subscription Analytics** — GET `/admin/subscriptions/stats` — total revenue, plan distribution, churn rate
- [ ] **Override User Subscription** — POST `/admin/users/:id/subscription` — manually set/extend user subscription

---

## Module 3 — Channels & Categories

### Implemented ✅
| Feature | Endpoint | Method | Description |
|---------|----------|--------|-------------|
| List Categories | `/admin/categories` | GET | Get all categories (including inactive) |
| Create Category | `/admin/categories` | POST | Create new content category |
| Update Category | `/admin/categories/:id` | PATCH | Update category name/status |
| Delete Category | `/admin/categories/:id` | DELETE | Remove category |

### TODO 🔲
- [ ] **List All Channels** — GET `/admin/channels` — paginated list of all channels with stats
- [ ] **Get Channel Detail** — GET `/admin/channels/:id` — full channel data + subscriber count + revenue
- [ ] **Suspend Channel** — POST `/admin/channels/:id/suspend` — disable a channel
- [ ] **Delete Channel** — DELETE `/admin/channels/:id` — remove channel and content
- [ ] **Feature/Pin Channel** — POST `/admin/channels/:id/feature` — promote channel on home screen
- [ ] **Content Moderation Queue** — GET `/admin/moderation` — flagged content review
- [ ] **Channel Analytics** — GET `/admin/channels/stats` — growth, engagement, top creators

---

## Module 4 — Currencies

### Implemented ✅
_(Currencies are currently hardcoded with static rates)_

### TODO 🔲
- [ ] **View Currency Rates** — GET `/admin/currencies` — list all currency conversion rates
- [ ] **Update Currency Rate** — PATCH `/admin/currencies/:code` — set custom conversion rate
- [ ] **Add Currency** — POST `/admin/currencies` — add new supported currency
- [ ] **Toggle Currency Active** — PATCH `/admin/currencies/:code/toggle` — enable/disable currency

---

## Module 5 — Economic Engine (vPT / Wallet / Distribution)

### Implemented ✅
| Feature | Endpoint | Method | Description |
|---------|----------|--------|-------------|
| Queue Stats | `/vpt/admin/stats` | GET | Pending/processing/completed/failed counts, total NGN pending, total vPT distributed |
| Full Ledger | `/vpt/admin/ledger` | GET | System-wide financial audit trail (limit param) |
| Trigger Batch Process | `/vpt/admin/process-batch` | POST | Manually trigger vPT batch swap + distribution |

### TODO 🔲
- [ ] **View All Wallets** — GET `/admin/wallets` — list all BSC wallets with balances
- [ ] **Get Wallet Detail** — GET `/admin/wallets/:userId` — wallet info + transaction history
- [ ] **Freeze Wallet** — POST `/admin/wallets/:userId/freeze` — disable wallet transactions
- [ ] **Set vPT Balance** — POST `/admin/users/:id/vpt-balance` — manual vPT balance adjustment
- [ ] **Retry Failed Distributions** — POST `/admin/distributions/retry` — retry all failed queue items
- [ ] **Distribution History** — GET `/admin/distributions` — paginated distribution history with filters
- [ ] **Treasury Dashboard** — GET `/admin/treasury` — treasury wallet balance, total swaps, total distributed

---

## Module 5.1 — Admin Settings (Runtime Config)

### Implemented ✅
| Feature | Endpoint | Method | Description |
|---------|----------|--------|-------------|
| Get All Settings | `/admin/settings` | GET | View all configurable settings with categories |
| Get Setting by Key | `/admin/settings/:key` | GET | View single setting |
| Update Setting | `/admin/settings/:key` | PATCH | Update setting value at runtime |
| Bulk Update Settings | `/admin/settings/bulk` | PATCH | Update multiple settings at once |
| Reset Setting to Default | `/admin/settings/:key/reset` | POST | Reset setting to .env / hardcoded default |

### Configurable Settings
| Key | Category | Description | Default Source |
|-----|----------|-------------|---------------|
| `WALLET_SECRET` | blockchain | AES-256-CBC wallet encryption secret | .env |
| `BSC_RPC` | blockchain | BSC RPC endpoint URL | .env |
| `TREASURY_PRIVATE_KEY` | blockchain | Treasury wallet private key | .env |
| `VPT_TOKEN_ADDRESS` | blockchain | vPT token contract address | .env |
| `PANCAKE_ROUTER` | blockchain | PancakeSwap router contract address | .env |
| `WBNB_ADDRESS` | blockchain | WBNB token contract address | .env |
| `NGN_TO_BNB_RATE` | rates | NGN to BNB conversion rate | .env (0.0000004) |
| `COMMUNITY_POOL_PERCENT` | rates | % of subscription allocated to community pool | hardcoded (30) |
| `BATCH_SIZE` | system | Max items per batch distribution | hardcoded (100) |
| `MAX_RETRY_ATTEMPTS` | system | Max retry attempts for failed distributions | hardcoded (3) |

### TODO 🔲
- [ ] **Settings Change Audit Log** — log every settings change with who/when/old-value/new-value
- [ ] **Settings Encryption** — encrypt sensitive settings (private keys, secrets) at rest
- [ ] **Settings Validation** — validate setting values (e.g., valid BSC address, valid URL format)
- [ ] **Settings Export/Import** — export/import settings as JSON for backup/migration

---

## Global Admin TODO 🔲

- [ ] **Admin Dashboard Summary** — GET `/admin/dashboard` — aggregated stats (users, revenue, vPT, channels)
- [ ] **System Health** — GET `/admin/health` — server status, memory usage, queue backlog
- [ ] **Activity Log** — GET `/admin/activity` — recent admin actions audit trail
- [ ] **Notification System** — POST `/admin/notifications` — send system notifications to users
- [ ] **Maintenance Mode** — POST `/admin/maintenance` — toggle maintenance mode (block non-admin requests)
- [ ] **Rate Limiting Config** — configurable rate limits per endpoint group
- [ ] **Backup/Export** — GET `/admin/export` — export all data as JSON (for migration to database)
