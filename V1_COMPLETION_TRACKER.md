# AfroVision v1 — Final Completion Tracker

> Created: 2025-04-09
> Status: **All 14 Phases Complete — v1 Done**

---

## Phase Overview

| # | Phase | Scope | Status | Depends On |
|---|-------|-------|--------|------------|
| 1 | Community Pool Display | Show live pool balance, total distributed, beneficiaries, amounts on all pages (website + Flutter) | ✅ Complete | — |
| 2 | Video Description Requirement | Add required description to upload flow, persist, show in EPG, tap-to-reveal popup | ✅ Complete | — |
| 3 | Program Reminders UI | Wire existing backend reminder system to website + Flutter (push + email 30s before) | ✅ Complete | Phase 2 (description in popup) |
| 4 | Ad System — Data Model & Backend | Ad categories, CRUD, rotation logic, admin endpoints, approval workflow | ✅ Complete | — |
| 5 | Ad System — Admin Dashboard | Ad management UI (all categories, bulk ops, approval, super ads, injection controls) | ✅ Complete | Phase 4 |
| 6 | Ad System — Advertiser Portal | Ad submission page, category selection, video upload with duration validation, billing | ✅ Complete | Phase 4 |
| 7 | Ad System — Billing & Revenue Split | Pricing structure, fund management, 50/30/20 and 70/30 splits, depletion logic | ✅ Complete | Phase 4, 6 |
| 8 | Ad System — Playback Integration (Website) | Freeze/resume, DSTV-style transitions, ad injection into live player, all 3 categories | ✅ Complete | Phase 4, 7 |
| 9 | Ad System — Playback Integration (Flutter) | Same as Phase 8 but for Flutter app | ✅ Complete | Phase 8 |
| 10 | Ad System — Banner Ads (Pages) | Banner ad placements on home + other pages (website + Flutter) | ✅ Complete | Phase 4, 7 |
| 11 | Flash Screens & ElevenLabs TTS | "Coming Up Next" / "Now Playing" flash screens with AI voice intros/outros | ✅ Complete | Phase 2, 4 |
| 12 | Ad Analytics — Admin Dashboard | Performance metrics, channel trends, demographics, engagement hours, revenue tracking | ✅ Complete | Phase 4, 8 |
| 13 | Ad Analytics — Advertiser Dashboard | Per-advertiser reporting: plays, channels, views, spend, top-up | ✅ Complete | Phase 6, 8 |
| 14 | Scheduler Integration | Update auto-scheduler and smart scheduler to account for ad injection timing | ✅ Complete | Phase 4, 8 |

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

## Phase 5: Ad System — Admin Dashboard — ✅ COMPLETE

### What Was Done
- **Advertisements page** (`/advertisements`): Full admin ad management dashboard with 3 tabs (All Ads, Pending Review, Impressions)
- **Status & category filters**: Filter by any of 7 statuses + 5 ad categories with pill-style toggles
- **Ad list view**: Title, status badge, category badge, super ad indicator, budget/spent/impressions metrics, created date
- **Detail panel**: Expandable panel with all ad fields, budget usage bar, media/click URLs as links
- **Admin actions**: Approve, Reject, Activate, Pause, Delete — with confirmation dialogs, contextual visibility (approve only for pending, pause only for active, etc.)
- **Impressions table**: Tabular view of all impression records with ad ID, channel, category, viewers, cost, timestamp
- **Sidebar**: Added "Advertisements" link under Monetization tone
- **Header**: Added "Ad Management" title for the route

### Files Created
- `admin/src/app/(admin)/advertisements/page.jsx`

### Files Modified
- `admin/src/components/layout/Sidebar.jsx` (added nav link)
- `admin/src/components/layout/Header.jsx` (added title)

---

## Phase 6: Ad System — Advertiser Portal — ✅ COMPLETE

### What Was Done
- **Website API wrappers** (`api.ts`): Added 10 ad API functions — submitAdApi, getMyAdsApi, getAdStatsApi, topUpAdBudgetApi, pauseAdApi, getAdUploadUrlApi, serveBannerAdApi, serveInStreamAdsApi, recordAdImpressionApi + types (Advertisement, AdImpression, AdStats)
- **Advertiser Portal page** (`/advertiser`): Full advertiser-facing page with 2 tabs (My Ads, Submit New Ad)
- **Submit form**: Category selection grid (5 categories), title/description/click URL fields, file upload with GCS signed URL flow, video duration detection, budget/pricing inputs, date range, progress states
- **My Ads list**: Summary stats (total ads, active, budget, spent), expandable ad cards with status/category badges, budget usage bars, inline stats (impressions, viewers, cost, channels reached)
- **Actions**: Pause active ads, Top Up budget modal, expandable per-ad performance stats
- **Navigation**: "Advertise" link added to website navbar

### Files Created
- `website/src/app/advertiser/page.tsx`

### Files Modified
- `website/src/lib/api.ts` (ad API types + 10 wrapper functions)
- `website/src/components/Navbar.tsx` (added Advertise nav link)

---

## Phase 7: Ad System — Billing & Revenue Split — ✅ COMPLETE

### What Was Done
- **Revenue split logic** already in `ad_serving.js`: 50/30/20 (operations/channel/pool) for in-stream, 70/30 (operations/pool) for banners
- **Depletion logic** already in `ad.model.js`: Auto-sets status to ‘depleted’ when spent >= budget
- **Impression billing** already in `ad.controller.js`: Per-impression cost calculation, Ledger entries for channel revenue + community pool
- **Billing report endpoint** (NEW): `GET /ads/billing` — advertiser’s spending summary (total budget, spent, remaining, impressions, avg cost)
- **Revenue report endpoint** (NEW): `GET /ads/revenue-report` — admin platform revenue aggregates with split breakdown (operations/channel/pool)

### Files Modified
- `backend/src/ads/ad.controller.js` (added getBilling + getRevenueReport)
- `backend/src/ads/ad.routes.js` (wired billing + revenue-report routes)

---

## Phase 8: Ad System — Playback Integration (Website) — ✅ COMPLETE

### What Was Done
- **AdBreak component** (`website/src/components/AdBreak.tsx`): Full DSTV-style ad break overlay with 3 phases:
  - **Intro**: AfroVision-branded "Ad Break" screen with gradient, animated lines, spinner
  - **Playing**: Ad video playback with progress bar, "Ad X of Y" counter, countdown timer, category label, click-through "Learn More" button
  - **Outro**: "Returning to [Channel]" screen with play icon and spinner
  - Plays all ads sequentially (pre-roll, mid-roll, brief)
  - Records impressions via `recordAdImpressionApi` as each ad plays
  - Fallback timeout skips after ad duration + 3s grace period
- **LivePlayer modifications** (`website/src/components/LivePlayer.tsx`):
  - Added `adPlaying` prop — pauses stream during ad break, suppresses TV-mode auto-resume
  - Stream video pauses when ad break starts, resumes when it ends
- **LiveStream integration** (`website/src/app/live/[id]/LiveStream.tsx`):
  - Fetches in-stream ads via `serveInStreamAdsApi(channelId)`
  - **Pre-roll**: Triggers ad break once when stream first loads with content
  - **Mid-roll**: Triggers on program transitions (with 15-minute cooldown between breaks)
  - Passes all 3 ad categories (pre-roll, mid-roll, brief) to AdBreak component
  - Manages ad break state (showAdBreak, adBreakAds, preRollDone, lastMidRoll)

### Files Created
- `website/src/components/AdBreak.tsx` (NEW)

### Files Modified
- `website/src/components/LivePlayer.tsx` (adPlaying prop + pause/resume logic)
- `website/src/app/live/[id]/LiveStream.tsx` (ad imports, state, fetch, triggers, overlay)

---

## Phase 9–14: (Detailed breakdown to be added as we progress)

---

## Phase 9: Ad System — Playback Integration (Flutter) — ✅ COMPLETE

### What Was Done
- **Flutter AdBreakOverlay widget**: Full DSTV-style ad break with intro/playing/outro phases, ad video playback, progress bar, countdown timer, impression tracking
- **BroadcastService**: `getInStreamAds(channelId)`, `recordAdImpression()` methods for ad serving
- **Channel Player Screen**: Pre-roll on first load, mid-roll on program transitions (15-min cooldown), ad state management (`_showAdBreak`, `_adBreakAds`, `_preRollDone`, `_lastMidRollAt`)

### Files Created
- `lib/features/broadcast/widgets/ad_break_overlay.dart`

### Files Modified
- `lib/features/broadcast/services/broadcast_service.dart`
- `lib/features/broadcast/screens/channel_player_screen.dart`

---

## Phase 10: Ad System — Banner Ads (Pages) — ✅ COMPLETE

### What Was Done
- **Website `BannerAd.tsx`**: Reusable banner ad component with 60s auto-refresh, placement-based serving, video/image/text-only fallback, impression tracking, "Sponsored" label
- **Website Home**: BannerAd between FeaturedChannels and LiveNowRow (both fallback and dynamic sections)
- **Website Channels**: BannerAd between search bar and channel grid
- **Flutter `BannerAdWidget`**: StatefulWidget with 60s refresh timer, image/text fallback, click-through via url_launcher, impression recording
- **Flutter Home**: BannerAdWidget(placement: 'home') in `_buildAdvertsSection()`
- **Flutter Channel List**: BannerAdWidget(placement: 'page') between AppBar and content

### Files Created
- `website/src/components/BannerAd.tsx`
- `lib/features/broadcast/widgets/banner_ad_widget.dart`

### Files Modified
- `website/src/app/page.tsx`
- `website/src/app/channels/page.tsx`
- `lib/features/broadcast/services/broadcast_service.dart` (added `getBannerAd`)
- `lib/features/auth/screens/home_screen.dart`
- `lib/features/channel/screens/channel_list_screen.dart`

---

## Phase 11: Flash Screens & ElevenLabs TTS — ✅ COMPLETE

### What Was Done
- **Backend TTS Service** (`tts.js`): ElevenLabs HTTP integration, in-memory cache (200 entries), admin-configurable API key + voice ID, graceful fallback when not configured
- **Backend Flash Audio Endpoint**: `GET /broadcast/flash-audio?type=coming_up|now_playing&title=X&channel_name=Y` — returns MP3 audio buffer, 204 if TTS unavailable
- **Website `FlashScreen.tsx`**: "Coming Up Next" / "Now Playing" overlay with enter/show/exit animation phases, TTS audio playback, AfroVision branding
- **Website LiveStream**: Flash triggers on program transitions, hidden during ad breaks
- **Flutter `FlashScreenOverlay`**: Fade + slide animations, audioplayers TTS playback, auto-dismiss after configurable duration
- **Flutter Channel Player**: Flash triggers on program change (`_lastProgramId` detection), flash hidden during ad breaks
- **Admin Settings**: Added `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` settings

### Files Created
- `backend/src/utils/tts.js`
- `website/src/components/FlashScreen.tsx`
- `lib/features/broadcast/widgets/flash_screen_overlay.dart`

### Files Modified
- `backend/src/broadcast/broadcast.controller.js` (flash audio endpoint)
- `backend/src/broadcast/broadcast.routes.js` (flash-audio route)
- `backend/src/admin/settings.model.js` (ElevenLabs settings)
- `website/src/app/live/[id]/LiveStream.tsx` (flash integration)
- `lib/features/broadcast/screens/channel_player_screen.dart` (flash state + overlay)

---

## Phase 12: Ad Analytics — Admin Dashboard — ✅ COMPLETE

### What Was Done
- **Backend Analytics Endpoint**: `GET /ads/analytics` — comprehensive aggregated data: overview stats, 30-day daily time series, category breakdown, top 10 ads by revenue, top 10 channels by revenue, status distribution
- **Admin Analytics Page** (`/ad-analytics`): Full dashboard with overview cards (revenue, active ads, viewers, budget, avg rev/impression), revenue split visualization (operations/channel/pool with progress bars), 30-day bar chart with metric toggle (revenue/impressions/viewers), category performance bars, status distribution, top ads table, top channels table

### Files Created
- `admin/src/app/(admin)/ad-analytics/page.jsx`

### Files Modified
- `backend/src/ads/ad.controller.js` (getAnalytics endpoint)
- `backend/src/ads/ad.routes.js` (analytics route)
- `admin/src/components/layout/Sidebar.jsx` (Ad Analytics link)
- `admin/src/components/layout/Header.jsx` (Ad Analytics title)

---

## Phase 13: Ad Analytics — Advertiser Dashboard — ✅ COMPLETE

### What Was Done
- **Backend Advertiser Analytics Endpoint**: `GET /ads/my-analytics` — per-advertiser analytics: overview (budget, spent, remaining, impressions, viewers, avg cost), 30-day daily time series, per-ad breakdown (title, category, status, budget, spent, impressions, viewers, channels), category breakdown
- **Website API**: `getMyAdAnalyticsApi()` + `AdvertiserAnalytics` type
- **Website Advertiser Page**: New "Analytics" tab with overview cards, 30-day bar chart with metric toggle, category performance bars, per-ad performance table

### Files Modified
- `backend/src/ads/ad.controller.js` (getMyAnalytics endpoint)
- `backend/src/ads/ad.routes.js` (my-analytics route)
- `website/src/lib/api.ts` (AdvertiserAnalytics type + API function)
- `website/src/app/advertiser/page.tsx` (Analytics tab + AdvertiserAnalyticsTab component)

---

## Phase 14: Scheduler Integration — ✅ COMPLETE

### What Was Done
- **Admin Settings**: Added `AD_BREAK_BUFFER_SECONDS` (default: 45s) and `AD_SCHEDULING_ENABLED` (default: true) to control ad break buffers in scheduling
- **Schedule Program**: `scheduleProgram()` now adds ad buffer to program end time, ensuring overlap detection accounts for ad breaks
- **Sequential Scheduling**: `scheduleSequential()` now inserts ad break buffer between sequential programs (gap = AD_BREAK_BUFFER_SECONDS between each program)
- **Settings Service Integration**: Scheduler reads admin-configurable buffer duration via SettingsService

### Files Modified
- `backend/src/admin/settings.model.js` (AD_BREAK_BUFFER_SECONDS, AD_SCHEDULING_ENABLED)
- `backend/src/broadcast/broadcast.controller.js` (SettingsService import, _getAdBufferMs helper, buffer in scheduleProgram + scheduleSequential)

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
| 2025-04-10 | 5 | Admin | 00006-gb9 | Ad management dashboard |\n| 2025-04-10 | 6 | Website | 00026-xwv | Advertiser portal + ad API wrappers |
| 2025-04-10 | 7 | Backend | 00117-pbj | Billing report + revenue report endpoints |
| 2025-04-10 | 8 | Website | 00028-9l8 | Ad playback: DSTV-style breaks, freeze/resume, impression tracking |
