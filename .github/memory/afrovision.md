# AfroVision Project

## Stack
- **Frontend**: Flutter (Dart)
- **Backend**: Node.js + Express (in-memory store, no DB yet)
- **Auth**: JWT (7d expiry), bcrypt, shared_preferences for token storage

## Structure
- Flutter app: `/Users/user/Documents/afrovision/lib/`
- Backend: `/Users/user/Documents/afrovision/backend/`
- Backend entry: `backend/src/app.js` — runs on port 3000

## Module 1 (Auth) — COMPLETE ✅ (Tested end-to-end)
- Routes: POST /auth/register, POST /auth/login, GET /auth/me, POST /auth/forgot-password, POST /auth/reset-password, POST /auth/logout
- Flutter screens: splash, login, register, forgot-password, reset-password, home (placeholder), terms, privacy-policy
- Named routes: /splash, /login, /register, /forgot-password, /reset-password, /home, /terms, /privacy-policy
- Password strength indicator with auto-hide criteria on all password creation screens
- Terms & Privacy acceptance checkbox enforced on both login and register
- "Email already registered" error links to login screen
- No state management package yet — plain StatefulWidgets
- No DB — in-memory arrays in user.model.js
- baseUrl config in lib/core/config/app_config.dart (set to 10.180.138.184:3000 for physical device)

## Brand Colors
- darkBlue: #050A30, lightBlue: #173A6D, lightOrange: #F5C16C, orange: #F49617, white: #FFFFFF

## Design Rules (MANDATORY)
1. ALL screens must use `AppColors.primaryGradient` (lightBlue→darkBlue top→bottom) as background gradient.
2. ALL screens must maintain the same premium, futuristic, sophisticated look — consistent structure, alignment, spacing, visual effects, animations, and dark theme throughout the entire application.
3. Use existing reusable widgets: AppTextField, AppButton, AppLogo, PasswordStrengthIndicator.
4. Brand colors defined in `lib/core/theme/app_colors.dart` — never use hardcoded colors outside that file.

## Module 5.0 → 5.2 Economic Engine — PRODUCTION GRADE ✅
- **Ledger = source of truth** — every financial event logged with status (pending/success/failed)
- **Batched swaps only** — no per-user swaps, all via batch pipeline
- **Batch pipeline**: queueVPT → createBatch → executeSwap → distribute
- **Plan activation flow**: 20% community pool → 30% extraction → vPT queue (₦10k plan → ₦600 vPT)
- **Per-item failure isolation** — frozen wallet doesn't block others
- **Batch-level retry** — max 3 attempts
- **Admin endpoints**: /vpt/admin/stats, /vpt/admin/batches, /vpt/admin/batches/failed, /vpt/admin/batches/:id/retry, /vpt/admin/treasury, /vpt/admin/ledger, /vpt/admin/ledger-stats
- **Settings**: COMMUNITY_POOL_PERCENT=20, VPT_EXTRACTION_PERCENT=30 (admin-configurable)
- **Security**: no private key logging, AES-256-CBC wallet encryption, WALLET_SECRET required
- **Test**: `node test_economic_engine.js` — 106 assertions, starts own server on port 3002

### Key files (backend/src/)
- vpt/ledger.model.js — source of truth, status tracking
- vpt/batch.model.js — batch lifecycle (pending→swapped→distributed→failed)
- vpt/distribution.model.js — queue items with batch_id linking
- vpt/distribution.service.js — 3-step pipeline engine
- vpt/swap.service.js — pure execution layer, TX receipt parsing
- wallet/wallet.model.js — status field (active/frozen)
- subscriptions/subscription.controller.js — split math engine

## Economy Display Rules
- vPT is a BSC crypto token — symbol is "vPT", never prefix with ₦
- Display: `{amount} vPT` primary, `≈ ₦{nairaEquiv}` secondary
- Exchange rate: 1 vPT = ₦750 (VPT_PRICE_NGN setting)
- For naira amounts: `₦{amount}` primary, `≈ {vptEquiv} vPT` secondary

## Commands
- Start backend: `cd backend && node src/app.js`
- Run economic engine test: `node test_economic_engine.js` (106 tests, port 3002)
- Run economy flow test: `cd backend && node test_economy_flow.js`
- Flutter analyze: `flutter analyze`
- Flutter run: `flutter run`
