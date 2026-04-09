# AfroVision v1 — Final Completion Tracker

> Created: 2025-04-09
> Status: **Phase 1–4 Complete — Starting Phase 5**

---

## Phase Overview

| # | Phase | Scope | Status | Depends On |
|---|-------|-------|--------|------------|
| 1 | Community Pool Display | Show live pool balance, total distributed, beneficiaries, amounts on all pages (website + Flutter) | ✅ Complete | — |
| 2 | Video Description Requirement | Add required description to upload flow, persist, show in EPG, tap-to-reveal popup | ✅ Complete | — |
| 3 | Program Reminders UI | Wire existing backend reminder system to website + Flutter (push + email 30s before) | ✅ Complete | Phase 2 (description in popup) |
| 4 | Ad System — Data Model & Backend | Ad categories, CRUD, rotation logic, admin endpoints, approval workflow | ✅ Complete | — |
| 5 | Ad System — Admin Dashboard | Ad management UI (all categories, bulk ops, approval, super ads, injection controls) | ⬜ Not Started | Phase 4 |
| 6 | Ad System — Advertiser Portal | Ad submission page, category selection, video upload with duration validation, billing | ⬜ Not Started | Phase 4 |
| 7 | Ad System — Billing & Revenue Split | Pricing structure, fund management, 50/30/20 and 70/30 splits, depletion logic | ⬜ Not Started | Phase 4, 6 |
| 8 | Ad System — Playback Integration (Website) | Freeze/resume, DSTV-style transitions, ad injection into live player, all 3 categories | ⬜ Not Started | Phase 4, 7 |
| 9 | Ad System — Playback Integration (Flutter) | Same as Phase 8 but for Flutter app | ⬜ Not Started | Phase 8 |
| 10 | Ad System — Banner Ads (Pages) | Banner ad placements on home + other pages (website + Flutter) | ⬜ Not Started | Phase 4, 7 |
| 11 | Flash Screens & ElevenLabs TTS | "Coming Up Next" / "Now Playing" flash screens with AI voice intros/outros | ⬜ Not Started | Phase 2, 4 |
| 12 | Ad Analytics — Admin Dashboard | Performance metrics, channel trends, demographics, engagement hours, revenue tracking | ⬜ Not Started | Phase 4, 8 |
| 13 | Ad Analytics — Advertiser Dashboard | Per-advertiser reporting: plays, channels, views, spend, top-up | ⬜ Not Started | Phase 6, 8 |
| 14 | Scheduler Integration | Update auto-scheduler and smart scheduler to account for ad injection timing | ⬜ Not Started | Phase 4, 8 |

---

## Phase 1: Community Pool Display — ✅ COMPLETE

### What Was Done
- **Backend**: Enhanced `GET /home/stats` — reads admin-configurable `VPT_PRICE_NGN`, calculates `total_distributed_vpt/ngn` from VPT_DISTRIBUTION ledger entries, `total_beneficiaries` (unique UIDs)
- **Website**: Created `CommunityPoolBar.tsx` — persistent bar in root layout with 60s auto-refresh, shows Pool Balance / Distributed / Beneficiaries in "xyz vPT (₦xxx)" format, auth-gated
- **Flutter**: Extended `HomeStats` model with distributed/beneficiaries fields, enhanced existing `_buildCommunityPoolBanner()` in HomeScreen with distributed/beneficiaries info section

### Files Modified
- `backend/src/channels/home.routes.js`
- `website/src/lib/api.ts`
- `website/src/components/CommunityPoolBar.tsx` (NEW)
- `website/src/app/layout.tsx`
- `lib/features/auth/services/home_service.dart`
- `lib/features/auth/screens/home_screen.dart`
- `lib/core/widgets/community_pool_bar.dart` (NEW — reusable widget)

---

## Phase 2: Video Description Requirement — ✅ COMPLETE

### What Was Done
- **Backend**: Added `description` field to video model, required validation in `registerUploadedVideo` and `uploadVideo`, added `video_description` to ALL 7 response locations across the broadcast controller
- **Website Creator Studio**: Description textarea in upload entries with orange border validation, blocked upload when empty
- **Website EPG**: Clickable program items (Now Playing + Upcoming) with tap-to-reveal description popup modal (backdrop blur, gradient header, close button)
- **Flutter Upload**: Description field in models, service layer, upload screen UI with inline TextField and validation
- **Flutter Channel Player**: Tap-to-reveal description popup on Now Playing title (info icon) and UP NEXT card (GestureDetector + Dialog)

### Files Modified
- `backend/src/broadcast/video.model.js`
- `backend/src/broadcast/broadcast.controller.js`
- `website/src/lib/api.ts`
- `website/src/app/creator-studio/page.tsx`
- `website/src/app/live/[id]/LiveStream.tsx`
- `lib/features/broadcast/models/video_model.dart`
- `lib/features/broadcast/models/program_model.dart`
- `lib/features/broadcast/services/broadcast_service.dart`
- `lib/features/broadcast/screens/video_upload_screen.dart`
- `lib/features/broadcast/screens/channel_player_screen.dart`

---

## Phase 3: Program Reminders UI — ✅ COMPLETE

### What Was Done
- **Backend**: Added SendGrid email service (`backend/src/utils/email.js`) with branded HTML template; wired email sending into existing reminder timer alongside FCM push notifications; graceful fallback when SENDGRID_API_KEY not set
- **Website EPG**: Reminder bell icon on each upcoming program row (filled=active, outline=inactive); toggle on/off with loading state; loads existing reminders on mount, filtered by current channel
- **Flutter Channel Player**: Added reminder API methods to BroadcastService (getMyReminders, setReminder, removeReminder); reminder state in channel player; animated bell icon on UP NEXT card with toggle

### Files Modified
- `backend/package.json` (added @sendgrid/mail)
- `backend/src/utils/email.js` (NEW)
- `backend/src/broadcast/broadcast.controller.js` (email import + wired into timer)
- `website/src/app/live/[id]/LiveStream.tsx` (reminder imports, bell UI, state management)
- `lib/features/broadcast/services/broadcast_service.dart` (reminder API methods)
- `lib/features/broadcast/screens/channel_player_screen.dart` (reminder state + bell on UP NEXT)

---

## Phase 4: Ad System — Data Model & Backend — ✅ COMPLETE

### What Was Done
- **Ad Model** (`ad.model.js`): Firestore + in-memory cache with 5 categories (banner_home, banner_page, in_stream_pre, in_stream_mid, in_stream_brief), 7 statuses (pending→active→depleted), max duration enforcement, CRUD, auto-deplete on budget exhaustion
- **Impression Model** (`ad_impression.model.js`): Records ad_id, channel_id, channel_owner_id, category, viewer_count, cost; query by ad/channel/advertiser; aggregated stats
- **Serving Engine** (`ad_serving.js`): Round-robin rotation with lowest-impression-count fairness, super ad priority, channel targeting, banner/in-stream helpers, revenue split calculator (50/30/20 in-stream, 70/30 banner)
- **Controller** (`ad.controller.js`): 17 endpoints — advertiser (submit, list own, stats, top up budget, upload URL), admin (list all, pending, approve, reject, activate, pause, super ad, update, delete, impressions), serving (banner, in-stream), impression recording with Ledger-based revenue distribution
- **Routes** (`ad.routes.js`): Express router with auth middleware, public serving endpoints, authenticated CRUD/admin routes
- **App wiring**: AdModel + AdImpressionModel initialized on boot, routes mounted at `/ads`

### Files Created
- `backend/src/ads/ad.model.js`
- `backend/src/ads/ad_impression.model.js`
- `backend/src/ads/ad_serving.js`
- `backend/src/ads/ad.controller.js`
- `backend/src/ads/ad.routes.js`

### Files Modified
- `backend/src/app.js` (imports, route mount, model init)

---

## Phase 5–14: (Detailed breakdown to be added as we progress)

---

## Open Questions (Awaiting User Input)

See conversation for questions asked before implementation begins.

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-04-09 | Created phased plan | User requested step-by-step approach with tracking |

---

## Deployment Log

| Date | Phase | Service | Revision | Notes |
|------|-------|---------|----------|-------|
| 2025-04-09 | 1-2 | Backend + Website | 00111-crr / 00022-xlr | Community pool + video description |
| 2025-04-09 | 3 | Backend + Website | 00113-hjn / 00024-shq | Program reminders (email + FCM + UI) |
| 2025-04-10 | 4 | Backend | 00115-fzs | Ad system data model & backend |
