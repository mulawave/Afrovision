# Reputation System — Implementation Tracker
> Last updated: April 21, 2026

## Overview
Platform-wide viewer reputation system. Viewers earn Reps by gifting (1 Rep = 1 NGN-equivalent of gift value). Three levels unlock higher viewer plans and Community Pool eligibility (gated by KYC + threshold). Badges appear next to usernames everywhere on the platform.

---

## Key Design Decisions
| Aspect | Decision |
|---|---|
| Rep formula | `gift.naira_value` (NGN equivalent) per gift sent |
| Accumulation | Permanent — no decay, global across all channels |
| Level 0 | 0–5,099 Reps — no badge — Free plan only |
| Level 1 | 5,100+ Reps — Dull Blue Shield — Basic Viewer unlocked |
| Level 2 | 9,000+ Reps — Royal Purple Shield + Padlock — Pro Viewer unlocked |
| Level 3 | 30,000+ Reps — Gold Shield + Padlock + Check — Premium Viewer unlocked |
| Community Pool gate | KYC verified + `total_reps` ≥ level threshold |
| Special Privileges | Level badges displayed next to username everywhere |
| Creator plans | NOT gated by reputation |
| Distribution mechanism | Untouched — existing community pool service unchanged |

---

## Rep Score Visibility Surfaces
| Surface | Location | What Shows |
|---|---|---|
| Home screen | Below "Welcome back, [Name]" in `_buildTopBar()` | "12,450 Reps · Level 2" + badge |
| Profile screen | Below display name (L263) | "12,450 Reps · Level 2" subtitle |
| Profile screen body | `ReputationCard` section | Rep count + progress bar + "View Details" tap |
| Wallet screen | After `_buildBalanceCard()` in ListView | Badge + count + mini progress bar tile |
| Reputation screen | Header | Large rep count display |
| Leaderboard | Per-row | Each user's total reps |
| Chat / Gift overlay | Next to sender name | Badge icon only |

---

## Phase 1 — Backend Foundation
> Implementing one step at a time to avoid gaps.

- [x] **1A** — Create `backend/src/reputation/reputation.model.js`
  - Firestore collection `reputation`, doc ID = user_id
  - Fields: `user_id`, `total_reps`, `level` (0–3), `total_gifting_ngn`, `total_gifting_vpt`, `community_pool_eligible`, `leaderboard_rank`, `last_updated`, `created_at`
  - In-memory cache pattern (same as `plan.model.js` — Map keyed by user_id, `init()` loads all docs)
  - Exports: `getByUserId(uid)`, `upsert(data)`, `getLeaderboard(limit, offset)`, `getAll()`
  - Done: added `backend/src/reputation/reputation.model.js` with Firestore persistence, cache-backed reads, normalized numeric fields, stable leaderboard sorting, and upsert support keyed by `user_id`

- [x] **1B** — Create `backend/src/reputation/reputation.service.js`
  - Constants: `LEVEL_THRESHOLDS = {1:5100, 2:9000, 3:30000}` and `PLAN_LEVEL_GATE = {plan_viewer_free:0, plan_viewer_basic:1, plan_viewer_pro:2, plan_viewer_premium:3}`
  - `init()` — calls `ReputationModel.init()`
  - `calculateLevel(totalReps)` → 0|1|2|3
  - `awardReps(userId, ngnValue, vptValue)` — upsert record, add reps, recalculate level + community_pool_eligible (kyc_status='verified' + totalReps >= threshold)
  - `checkCommunityPoolEligibility(userId)` → boolean
  - `canSubscribeToPlan(userId, planId)` → stored level >= `PLAN_LEVEL_GATE[planId]`
  - `getLeaderboard(limit, offset)` → sorted by total_reps desc: `[{rank, user_id, name, total_reps, level}]`
  - `recalculateAllRanks()` — update `leaderboard_rank` on all records (called after each `awardReps`)
  - `getReputation(userId)` → full reputation record
  - Done: added `backend/src/reputation/reputation.service.js` with level thresholds, viewer plan gates, zero-state reputation records, KYC-based community pool eligibility, deterministic rank recalculation, and leaderboard hydration with viewer names

- [x] **1C** — Create `backend/src/reputation/reputation.controller.js`
  - `GET /me` — auth required → `ReputationService.getReputation(req.userId)`
  - `GET /leaderboard?limit=50&offset=0` — public → `ReputationService.getLeaderboard()`
  - `GET /user/:userId` — public → `ReputationService.getReputation(userId)` (public fields only)
  - Done: added `backend/src/reputation/reputation.controller.js` with authenticated `getMyReputation`, public leaderboard pagination, public user reputation lookup, and separate private/public response shapes

- [x] **1D** — Create `backend/src/reputation/reputation.routes.js`
  - Mount controller methods with auth middleware (same pattern as existing route files)
  - Done: added `backend/src/reputation/reputation.routes.js` with authenticated `/me` plus public `/leaderboard` and `/user/:userId` endpoints wired to the new controller

---

## Phase 2 — Backend Wiring
> Depends on Phase 1

- [x] **2A** — Modify `backend/src/interactions/interactions.controller.js`
  - After gift balances updated (~L250+): call `ReputationService.awardReps(senderId, gift.naira_value, gift.vpt_units)`
  - Fetch updated level and append `sender_rep_level` to the WebSocket event payload
  - Include `sender_rep_level` (in-memory lookup) in outgoing chat message payloads
  - Done: added `const ReputationService = require('../reputation/reputation.service')`, wrapped `awardReps` in non-fatal try/catch after `_registerCombo`, appended `sender_rep_level` to `emitChannelEvent` gift payload

- [x] **2B** — Modify `backend/src/subscriptions/subscription.controller.js`
  - Before activating any viewer plan (except `plan_viewer_free`): check `ReputationService.canSubscribeToPlan(userId, planId)`
  - Return `403 { error: 'REPUTATION_GATE', message: '...' }` if not met
  - Creator plans: bypass this check entirely
  - Done: added `ReputationService` require, added reputation gate in `subscribe` handler before VPT deduction (avoids needing a refund path), fires 403 with `error: 'REPUTATION_GATE'` message

- [x] **2C** — Modify `backend/src/app.js`
  - Add `app.use('/reputation', reputationRoutes)`
  - Add `await ReputationService.init()` to app startup sequence
  - Done: required `reputation.routes` and `reputation.service`, mounted `/reputation` route after `/ads`, added `ReputationService.init()` to `Promise.all` in `startServer()`

- [x] **2D** — Modify the KYC approval/status update flow to refresh stored reputation eligibility
  - When KYC status changes to `verified`, `rejected`, or `expired`, call a reputation sync method so `community_pool_eligible` stays correct even before the next gift is sent
  - This closes the gap between dynamic eligibility checks and the persisted eligibility field used elsewhere in the platform
  - Done: added `refreshEligibility(userId)` to `reputation.service.js` (reads stored record, recomputes eligibility with fresh KYC status, upserts only if changed); added `ReputationService` require to `kyc.controller.js`; called `refreshEligibility` fire-and-forget after `UserModel.setKyc` in `adminReviewKyc`

---

## Phase 3 — Flutter Reputation Feature
> Depends on Phase 1+2 for API contracts. Screens (3E) run in parallel.

- [x] **3A** — Create `lib/features/reputation/models/reputation_model.dart`
  - Fields: `userId`, `totalReps`, `level`, `totalGiftingNgn`, `communityPoolEligible`, `leaderboardRank`, `lastUpdated`
  - `fromJson(Map)` / `toJson()`
  - Getters: `levelName` ('None'|'Level 1'|'Level 2'|'Level 3'), `nextLevelThreshold` (5100|9000|30000|null), `progressPercent` (double 0.0–1.0)
  - Also create `ReputationLeaderboardEntry`: rank, userId, name, totalReps, level

- [x] **3B** — Create `lib/features/reputation/services/reputation_service.dart`
  - `getMyReputation()` → GET /reputation/me → `ReputationModel`
  - `getLeaderboard({int limit = 50, int offset = 0})` → GET /reputation/leaderboard → `List<ReputationLeaderboardEntry>`
  - `getUserReputation(String userId)` → GET /reputation/user/:userId

- [x] **3C** — Create `lib/core/widgets/reputation_badge.dart` — `ReputationBadgeWidget`
  - Params: `int level`, `double size` (default 16), `bool showTooltip` (default false)
  - Level 0: `SizedBox.shrink()`
  - Level 1: `Icons.shield` in `AppColors.reputationBlue` (#7B9EC8)
  - Level 2: Row `[Icons.shield, Icons.lock]` in `AppColors.reputationPurple` (#7B2FBE)
  - Level 3: Row `[Icons.shield, Icons.lock, Icons.verified]` in `AppColors.orange`
  - `showTooltip=true` wraps in `Tooltip("Level X Reputation")`
  - Add `reputationBlue = Color(0xFF7B9EC8)` and `reputationPurple = Color(0xFF7B2FBE)` to `lib/core/theme/app_colors.dart`

- [x] **3D** — Update `lib/features/interactions/models/interaction_models.dart`
  - Add `senderRepLevel` (int, default 0, JSON key `sender_rep_level`) to `GiftNotification`
  - Add `senderRepLevel` (int, default 0, JSON key `sender_rep_level`) to `ChatMessage`

- [x] **3E-1** — Create `lib/features/reputation/screens/reputation_screen.dart`
  - `AppColors.primaryGradient` background + fade/slide entry animations
  - Header: large badge + level name + rep count ("12,450 Reps")
  - Progress bar toward next level (uses `RepProgressBar` widget)
  - Account Health card: "Excellent" (KYC verified + level ≥ 2) / "Good" (KYC + any level) / "Building" (no KYC). Show KYC status chip.
  - Popularity Standing card: leaderboard rank "#142 globally"
  - Community Pool Eligibility card: green check or lock, KYC requirement, gifting threshold
  - "How to earn more Reps" info section
  - "View Leaderboard" button → `/reputation/leaderboard`
  - Entry: profile screen reputation card tap → push `/reputation`

- [x] **3E-2** — Create `lib/features/reputation/screens/leaderboard_screen.dart`
  - `AppColors.primaryGradient` background + animations
  - Paginated sorted-by-reps ListView
  - Each tile: rank | avatar initials | name + `ReputationBadgeWidget` | total reps
  - Highlight current user's row
  - Pull-to-refresh
  - Entry: reputation screen → "View Leaderboard" → push `/reputation/leaderboard`

- [x] **3E-3** — Create `lib/features/reputation/widgets/reputation_card.dart`
  - Compact card for insertion into `profile_screen.dart`
  - Shows: badge, level name, rep count, mini progress bar, "View Details" arrow
  - Tap → navigate to `/reputation`

- [x] **3E-4** — Create `lib/features/reputation/widgets/rep_progress_bar.dart`
  - Animated gradient-fill progress bar
  - Level-appropriate colors
  - Numeric labels: current reps / needed reps

---

## Phase 4 — Flutter Integration
> Depends on Phase 3

- [x] **4A** — Modify `lib/features/auth/models/user_model.dart`
  - Add optional fields: `reputationLevel` (int?, default 0), `totalReps` (double?, default 0)
  - Populated from separate reputation load, not the auth token

- [x] **4B** — Modify `lib/features/profile/screens/profile_screen.dart`
  - Add `ReputationService.getMyReputation()` to parallel `Future.wait` load
  - Add `ReputationBadgeWidget` next to user display name (L263)
  - Add subtitle below name: "12,450 Reps · Level 2" (smaller, muted white)
  - Insert `ReputationCard` widget in profile body (new section after existing stats cards)
  - Store `_reputation` state variable of type `ReputationModel?`

- [x] **4C** — Modify `lib/features/interactions/widgets/live_chat_panel.dart`
  - At L356 where `message.senderName` is rendered: add `ReputationBadgeWidget(level: message.senderRepLevel, size: 14)` inline next to name

- [x] **4D** — Modify `lib/features/interactions/widgets/gift_overlay.dart`
  - At L253 where `widget.data.senderName` is rendered: add `ReputationBadgeWidget(level: widget.data.senderRepLevel ?? 0, size: 14)` next to sender name

- [x] **4E** — Modify `lib/features/subscription/screens/plans_screen.dart`
  - Load reputation in screen init via `ReputationService.getMyReputation()`
  - For each viewer plan card: compute `isLocked = userRepLevel < PLAN_LEVEL_GATE[plan.id]`
    - PLAN_LEVEL_GATE: `plan_viewer_free=0`, `plan_viewer_basic=1`, `plan_viewer_pro=2`, `plan_viewer_premium=3`
  - Locked plans: lock icon overlay, disabled Subscribe button, "Requires Level X Reputation" label
  - Show "Your Level: Level X" chip in viewer plans tab header

- [x] **4F** — Modify `lib/main.dart`
  - Add `'/reputation': (context) => const ReputationScreen()`
  - Add `'/reputation/leaderboard': (context) => const LeaderboardScreen()`

- [x] **4G** — Modify `lib/features/auth/screens/home_screen.dart`
  - In `_buildTopBar()` at L316/L332, below user name Text: add "X,XXX Reps · Level Y" subtitle + inline `ReputationBadgeWidget`
  - Add `ReputationService.getMyReputation()` to home screen's existing parallel `_loadData()` call
  - Store `_reputation` state variable of type `ReputationModel?`

- [x] **4H** — Modify `lib/features/wallet/screens/digital_assets_screen.dart`
  - Add `_buildReputationCard()` helper inserted in ListView at L313, after `_buildBalanceCard()` (~L1120)
  - Shows: badge + level name, rep count, mini progress bar, tapping → `/reputation`
  - Add `ReputationService.getMyReputation()` to wallet screen data loading

---

## Files Summary

### Backend — Create
| File | Step |
|---|---|
| `backend/src/reputation/reputation.model.js` | 1A |
| `backend/src/reputation/reputation.service.js` | 1B |
| `backend/src/reputation/reputation.controller.js` | 1C |
| `backend/src/reputation/reputation.routes.js` | 1D |

### Backend — Modify
| File | Change | Step |
|---|---|---|
| `backend/src/interactions/interactions.controller.js` | Award reps + `sender_rep_level` in WS events | 2A |
| `backend/src/subscriptions/subscription.controller.js` | Viewer plan reputation gate | 2B |
| `backend/src/app.js` | Mount `/reputation` route + init service | 2C |

### Flutter — Create
| File | Step |
|---|---|
| `lib/features/reputation/models/reputation_model.dart` | 3A |
| `lib/features/reputation/services/reputation_service.dart` | 3B |
| `lib/core/widgets/reputation_badge.dart` | 3C |
| `lib/features/reputation/screens/reputation_screen.dart` | 3E-1 |
| `lib/features/reputation/screens/leaderboard_screen.dart` | 3E-2 |
| `lib/features/reputation/widgets/reputation_card.dart` | 3E-3 |
| `lib/features/reputation/widgets/rep_progress_bar.dart` | 3E-4 |

### Flutter — Modify
| File | Change | Step |
|---|---|---|
| `lib/core/theme/app_colors.dart` | Add `reputationBlue`, `reputationPurple` | 3C |
| `lib/features/auth/models/user_model.dart` | Optional reputation fields | 4A |
| `lib/features/interactions/models/interaction_models.dart` | `senderRepLevel` on both models | 3D |
| `lib/features/interactions/widgets/live_chat_panel.dart` | Badge next to sender name | 4C |
| `lib/features/interactions/widgets/gift_overlay.dart` | Badge next to sender name | 4D |
| `lib/features/profile/screens/profile_screen.dart` | Reputation card + badge + rep subtitle | 4B |
| `lib/features/subscription/screens/plans_screen.dart` | Reputation gating UI | 4E |
| `lib/features/auth/screens/home_screen.dart` | Rep score below username | 4G |
| `lib/features/wallet/screens/digital_assets_screen.dart` | Reputation card tile | 4H |
| `lib/main.dart` | 2 new routes | 4F |

---

## Verification Checklist
- [x] Phase 1: `get_errors` clean for reputation model/service/controller/routes and plan file
- [x] Phase 1: `node --check` passed for all reputation backend files
- [x] Phase 1: backend `npm test` passed (smoke/static-pages/homepage tests)
- [x] Phase 1: reputation routes module loads and exposes `/me`, `/leaderboard`, `/user/:userId`
- [x] Phase 2: `get_errors` clean for all five modified files (interactions, subscription, app, kyc, reputation.service)
- [x] Phase 2: `node --check` passed for all five modified files
- [x] Phase 2: backend `npm test` passed — 22 tests, 0 failures (12 smoke + 7 static-pages + 3 homepage)
- [ ] Send a gift → Firestore `reputation` doc increments by `gift.naira_value`
- [ ] Cross 5,100 Reps threshold → level flips to 1, Basic Viewer plan unlocks, dull blue badge appears
- [ ] Attempt Pro Viewer subscription at Level 1 → `403 REPUTATION_GATE` returned
- [ ] Complete KYC with Level 1+ reps → `community_pool_eligible` flips to `true`
- [ ] Level 2+ user sends chat message → purple shield+lock appears next to name in live chat
- [ ] Viewer sends gift → gift overlay shows sender's badge icon
- [ ] Leaderboard → sorted desc by total_reps, current user row highlighted
- [ ] Profile screen → reputation card shows correct level, progress bar, health status, rank
- [ ] Plans screen → locked plans show lock overlay + "Requires Level X" label; unlocked plans are interactive
- [ ] Home screen → rep score subtitle visible below user name in top bar
- [ ] Wallet screen → reputation card tile visible after balance card

---

## Scope Exclusions
- Community pool distribution mechanism — **untouched**
- Creator plan subscription gating — **untouched**
- Reputation decay / refund reversals — out of scope
- Per-channel reputation — global only
- Admin panel reputation management — future scope
