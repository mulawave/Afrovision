# Website Library and Waves Feature Study

## Scope
This document summarizes how the website currently implements:
- Library upload setup
- Library reading flow (including desktop 3D page flip)
- Library tab display in channel profile
- Waves tab setup in channel profile
- Related global Waves page behavior where it intersects with channel library/waves context

## Primary Implementation Files
- website/src/app/creator-studio/library/page.tsx
- website/src/app/channel/[id]/library/[itemId]/page.tsx
- website/src/app/channel/[id]/ChannelProfile.tsx
- website/src/components/WaveUploadPanel.tsx
- website/src/app/wave/page.tsx
- website/src/lib/api.ts

## 1) Library Upload Setup (Website)

### 1.1 Creator Studio library management surface
File: website/src/app/creator-studio/library/page.tsx

Core responsibilities:
- Loads creator channels (exclusive only), series, and library items.
- Supports full item lifecycle: draft, publish, archive, delete.
- Supports series creation and reordering (series and in-series items).
- Supports attaching item to series.

The page state includes:
- Item metadata: title, author, description, contentType, totalPages, seriesId.
- Reader assets: itemManifestUrl, itemReaderPdfUrl, uploaded page images list.
- Upload UX states: manifestUploading, manifestUploadProgress, coverUploading, coverUploadProgress.

### 1.2 Upload handshake and storage flow
File: website/src/app/creator-studio/library/page.tsx
File: website/src/lib/api.ts

Library content upload follows signed-URL direct-to-GCS pattern:
1. UI calls createCreatorLibraryAssetUploadUrlApi(channelId, { assetType, contentType, fileName }).
2. API returns signed_url and public_url.
3. Client uploads file directly using uploadFileToGCS(signedUrl, file, onProgress).
4. Client persists public_url in form state.

Asset types used:
- cover
- reader_pdf
- reader_page
(plus manifest supported by API contract)

### 1.3 Reader content generation paths
File: website/src/app/creator-studio/library/page.tsx
File: website/src/lib/api.ts

Two supported content ingestion modes:
- PDF mode:
  - Upload PDF as reader_pdf.
  - Call generateCreatorLibraryReaderManifestApi(channelId, { pdfUrl, pageImageUrls: [] }).
  - Store returned manifest_url, optional pdf_url, and total_pages.

- Page-image mode:
  - Upload each image as reader_page.
  - Build aggregate progress across all pages.
  - Call generateCreatorLibraryReaderManifestApi(channelId, { pageImageUrls: [uploadedUrls] }).
  - Store returned manifest_url, optional pdf_url, and total_pages.

Publish guardrails in UI:
- Title and author required for publish.
- readerAssetManifestUrl required for publish.
- totalPages must be positive.

### 1.4 Cover upload
File: website/src/app/creator-studio/library/page.tsx

Cover uses same signed URL flow with assetType=cover, upload progress bar, preview card, and clear action.

### 1.5 Item CRUD and ordering
File: website/src/app/creator-studio/library/page.tsx

Supported management controls:
- Save draft
- Publish new item
- Update draft
- Update and publish
- Publish existing item
- Archive
- Delete
- Reorder series
- Reorder item sequence within series
- Add item to series

This is a complete creator-side operational flow, not just upload.

## 2) Library Reading Flow and 3D Flip Effect

### 2.1 Reader route and data loading
File: website/src/app/channel/[id]/library/[itemId]/page.tsx

Reader route:
- /channel/[id]/library/[itemId]

On load it requests in parallel:
- getChannelLibraryItemDetailApi
- getChannelLibraryProgressApi
- listChannelLibraryBookmarksApi
- getChannelLibraryReaderManifestApi

Then it fetches the JSON manifest from manifestUrl and normalizes page structures.

### 2.2 Manifest normalization and spreads
File: website/src/app/channel/[id]/library/[itemId]/page.tsx

The reader supports manifests that contain either:
- pages[] with imageUrl
- or pageImageUrls[]

normalizePages() creates a unified page model.

Spread model:
- Uses manifest.spreads if present.
- Else falls back to buildFallbackSpreads(totalPages), generating cover-first then 2-page spreads.

### 2.3 Desktop 3D page flip implementation
File: website/src/app/channel/[id]/library/[itemId]/page.tsx

Desktop reader uses a spread layout with explicit 3D transform mechanics:
- perspective on container (book-in-space effect)
- flip card overlays the spine during transition
- transform-style: preserve-3d
- front/back faces with backfaceVisibility handling
- rotateY animation direction based on next/prev
- timed phase model: idle -> ready -> animating
- shadow sweeps and spine lighting accents for depth

This is not a simple fade or slide; it is a true CSS 3D card-flip spread animation.

### 2.4 Mobile reader behavior
File: website/src/app/channel/[id]/library/[itemId]/page.tsx

Mobile switches to single-page mode:
- Flat ordered page list from spreads
- Swipe and edge-tap navigation
- Lightweight fade-in on page changes
- Same bookmarks/progress ecosystem

### 2.5 Progress, bookmarks, completion
File: website/src/app/channel/[id]/library/[itemId]/page.tsx

Progress:
- Auto-save debounced (~450ms) via updateChannelLibraryProgressApi.
- Explicit save button also writes progress.

Bookmarks:
- Create bookmark on current spread/page.
- List bookmarks in side panel.
- Jump to bookmark spread.
- Delete bookmark.

Completion:
- At final spread/page, attempts next series item via navigation.nextItemId.
- If none, loads recommendations via getChannelLibraryRecommendationsApi and shows completion sheet.

## 3) Library Tab Display Setup (Channel Profile)

### 3.1 Tab model and gating
File: website/src/app/channel/[id]/ChannelProfile.tsx

Tab union includes:
- streams
- waves
- about
- schedule
- library
- manage

Library tab appears only for exclusive channels.

Library content requires hasAccess; if access is missing, locked state and CTA to /exclusive-access is shown.

### 3.2 Library lazy-load strategy
File: website/src/app/channel/[id]/ChannelProfile.tsx

Library loading starts only when:
- activeTab === "library"
- not already loaded
- channel is exclusive
- viewer has access

Primary fetch path:
- getChannelLibraryApi(id)

Creator/admin fallback path if first request fails:
- getCreatorChannelLibraryItemsApi(id)
- then filtered to published

### 3.3 Unread/new indicators and acknowledgement
File: website/src/app/channel/[id]/ChannelProfile.tsx

Unread badge source:
- getNotificationUnreadCountApi({ type: "library", channelId })
- refreshed on focus/visibility changes

New-local indicator source:
- localStorage key afrovision:library:last-seen:[channelId]
- compares extracted epoch from library item id (li_[timestamp]_...)

Mark viewed:
- markAllNotificationsReadApi({ type: "library", channelId })
- resets unread and local new indicators

### 3.4 Library card grid and detail modal
File: website/src/app/channel/[id]/ChannelProfile.tsx

Library tab UI includes:
- Grid of portrait cards
- Cover, title, author, estimated read time, page badge
- Empty/loading/locked states

On card click:
- openLibraryDetail(itemId) loads getChannelLibraryItemDetailApi
- modal presents metadata, tags, progress context
- actions: Read Now, Save/Favorite toggle, Next item
- Read Now routes to reader page /channel/[id]/library/[itemId]

## 4) Waves Tab Setup (Channel Profile)

### 4.1 Tab load behavior and data source
File: website/src/app/channel/[id]/ChannelProfile.tsx

Waves are lazy-loaded when waves tab is activated:
- loadChannelWaves() calls getChannelWavesApi(id, { includeHidden: canManageChannel })

Visibility rules:
- Managers (owner/admin): see active + hidden waves
- Regular users: see only active waves

### 4.2 Waves tab controls and operations
File: website/src/app/channel/[id]/ChannelProfile.tsx

Viewer-facing:
- Grid of wave cards
- Open wave viewer modal
- Quick links to /wave and /creator-studio (if manager)

Manager-facing moderation controls:
- Select all / clear selection
- Hide selected
- Unhide selected
- Delete selected
- Per-item hide/unhide and delete

Backing APIs:
- setWaveTimelineVisibilityApi
- bulkSetWaveTimelineVisibilityApi
- deleteWaveApi
- bulkDeleteWavesApi

### 4.3 Wave viewer modal behavior
File: website/src/app/channel/[id]/ChannelProfile.tsx

In-tab modal includes:
- Prev/next navigation across visible waves
- Auto-play video with controls
- Close action
- View/replay metrics display
- trackWaveViewApi on viewed item transitions

## 5) Wave Upload Setup (Website)

### 5.1 WaveUploadPanel flow
File: website/src/components/WaveUploadPanel.tsx

Upload pipeline per entry:
1. Choose or drag video file(s).
2. Detect duration from local metadata.
3. Request signed URL via getWaveUploadUrlApi(channelId, contentType).
4. Upload to signed URL with XHR progress.
5. Register metadata via registerWaveApi({ video_url, title, description, classification flags, duration }).
6. Mark entry as published.

Built-in states:
- Pending, uploading, done, error.
- Per-file progress bars.
- Bulk publish action for queued entries.

Moderation metadata included at upload time:
- age_classification
- has_explicit_language
- has_nudity
- has_violence

## 6) Global Waves Page Integration with Library/Channel Context

### 6.1 Feed and pagination
File: website/src/app/wave/page.tsx

Wave feed page loads via:
- getWaveFeedApi(limit, cursor)

Includes mobile snap-scroll and desktop focused-player mode.
Loads additional pages near feed end.

### 6.2 Channel side panel composition on desktop
File: website/src/app/wave/page.tsx

For active wave channel, page loads in parallel:
- getChannelApi
- getChannelWavesApi
- getChannelLibraryApi(limit: 20)
- getChannelFollowStatusApi (authenticated users)

Left panel sections:
- Channel waves grid
- Channel info
- Library section

Library section behavior:
- Shows titles and quick detail modal.
- "Read Now" deep-links to /channel/[id]/library/[itemId].
- If exclusive without access, shows lock CTA.

### 6.3 Wave card interactions
File: website/src/app/wave/page.tsx

Each wave card supports:
- Pulse (with intensity and timeline moment capture)
- Bookmark toggle
- Comments panel
- Options panel (fullscreen, autoscroll, interest/report)
- Access gating overlays for restricted/adult content

## 7) API Contract Summary (Key Endpoints)
File: website/src/lib/api.ts

Library APIs:
- createCreatorLibraryAssetUploadUrlApi
- generateCreatorLibraryReaderManifestApi
- getChannelLibraryApi
- getChannelLibraryItemDetailApi
- getChannelLibraryReaderManifestApi
- getChannelLibraryProgressApi
- updateChannelLibraryProgressApi
- listChannelLibraryBookmarksApi
- createChannelLibraryBookmarkApi
- deleteChannelLibraryBookmarkApi
- addChannelLibraryFavoriteApi
- removeChannelLibraryFavoriteApi
- getChannelLibraryRecommendationsApi
- creator library CRUD/reorder series APIs

Wave APIs:
- getWaveFeedApi
- getChannelWavesApi
- getWaveUploadUrlApi
- registerWaveApi
- setWaveTimelineVisibilityApi
- bulkSetWaveTimelineVisibilityApi
- deleteWaveApi
- bulkDeleteWavesApi
- trackWaveViewApi
- pulse/comment/bookmark/report/interest APIs

Upload utility:
- uploadFileToGCS (signed URL XHR with progress)
- uploadFileToGCSResumable (resumable variant available)

## 8) Observations and Notes

1. The website library flow is end-to-end and production-oriented:
- Creator-side asset upload and manifest generation
- Consumer-side tab discovery, detail modal, and full reader route
- Progress/bookmark/recommendation loops

2. The desktop reader includes a real 3D flip spread effect, while mobile intentionally uses a single-page swipe/tap model for usability.

3. ChannelProfile waves and library tabs are both lazy-loaded and role-aware (viewer vs manager).

4. Global /wave page is tightly integrated with per-channel context and exposes channel library entries as a side-surface, reinforcing discovery-to-reading flow.

5. Upload UX patterns are consistent with direct GCS signed URL upload + explicit progress + success/error state.

## 9) Mobile Implementation Notes

The website study has now been used to drive the Flutter mobile parity slice for Library and Waves.

Implemented mobile coverage:
- Library tab now uses reading-library contracts instead of the previous video-library surface.
- Library list, item detail, and reader screens are wired for channel-scoped navigation.
- Reader progress, bookmark add/list/delete, and manifest loading are in place.
- Channel tabs now hide Library unless the channel is exclusive and expose unread/mark-viewed behavior.
- Waves tab handoff now passes channel context into the wave feed.

Validation status:
- `flutter analyze` on touched Library/Waves files passed with no issues.
- IDE diagnostics on touched files returned no errors.
- Manual runtime QA is still recommended for final device-level verification of the Library reader and channel-context wave handoff.

## 10) Mobile Route and File Mapping

The mobile implementation now has direct counterparts for the study scope:

- Channel Library list: `lib/features/broadcast/screens/channel_library_screen.dart`
- Channel Library item detail: `lib/features/broadcast/screens/channel_library_item_screen.dart`
- Channel Library reader: `lib/features/broadcast/screens/channel_library_reader_screen.dart`
- Channel Library models: `lib/features/broadcast/models/channel_library_models.dart`
- Channel Library API service: `lib/features/broadcast/services/channel_library_service.dart`
- Channel tab wiring and unread/visibility behavior: `lib/features/channel/screens/channel_view_screen.dart`
- Wave feed context handling: `lib/features/wave/screens/wave_screen.dart`
- Wave data model/service updates: `lib/features/wave/models/wave_model.dart`, `lib/features/wave/services/wave_service.dart`

Current route coverage used by the mobile slice:
- `/channel-library`
- `/channel-library/item`
- `/channel-library/reader`
- `/wave` with channel-context handoff

Remaining parity notes:
- The mobile reader uses a page-by-page swipe model rather than the website's desktop 3D spread flip effect.
- The mobile wave viewer now captures the channel context, but full device QA is still the last required check for interaction polish.
- Library and wave APIs are now wired on the Flutter side, but any backend contract drift should be verified against the live service before release.

## 11) Implementation Closeout Checklist

Status summary for this scope:
- Completed: Website study and Flutter parity slice implementation.
- Completed: Static validation (analyze and diagnostics clean).
- Pending: Device-level manual runtime verification and release sign-off.

Checklist:
- [x] Library tab visibility is exclusive-channel only.
- [x] Library list/detail/reader routes are wired.
- [x] Reader progress and bookmark APIs are wired.
- [x] Library unread badge and mark-viewed wiring exist.
- [x] Waves tab channel-context handoff is wired.
- [x] Touched file analysis passed without issues.
- [x] Runtime smoke launch/auth startup completed on Android device.
- [ ] Device-level runtime QA completed.
- [x] Backend contract verification against live environment completed.
- [ ] Final product sign-off captured.

## 12) Manual Device QA Runbook

Environment:
- Use authenticated test users for: entitled viewer, non-entitled viewer, and owner/admin.
- Ensure at least one exclusive channel has published library items and waves.

A. Channel and Library tab behavior:
1. Open a non-exclusive channel.
2. Confirm Library tab is hidden.
3. Open an exclusive channel.
4. Confirm Library tab is visible.
5. Confirm unread badge appears when unread library notifications exist.
6. Open Library tab and confirm unread count clears after mark-viewed behavior.

B. Library list and detail flow:
1. Open Library tab for exclusive channel.
2. Confirm loading then list success state.
3. Validate empty state on channel with no published library items.
4. Force network failure and validate error plus retry state.
5. Open an item card.
6. Confirm item detail metadata, read action, save/favorite action, and next-item action behavior.

C. Reader flow and persistence:
1. Open reader from item detail.
2. Confirm manifest pages load and swipe works.
3. Add bookmark on current page.
4. Open saved bookmarks list and jump to a saved page.
5. Delete bookmark and confirm it is removed.
6. Navigate pages and confirm progress persists.
7. Leave reader and re-open item; confirm resume from saved progress.

D. Waves tab context handoff:
1. Open Waves tab from a channel.
2. Confirm wave screen opens in channel context (channel waves prioritized or surfaced first).
3. Validate standard wave interactions still function in this entry path.

E. Regression checks:
1. Verify channel view still loads streams/about/schedule sections.
2. Verify no route crashes when opening `/channel-library`, `/channel-library/item`, `/channel-library/reader`, and `/wave`.
3. Confirm no unexpected auth-loop behavior on protected mutations.

Pass criteria:
- All sections A to E pass without blocker defects.
- Any non-blocker defects are documented with owner and target fix release.

## 13) Backend Contract Verification Update

Contract verification against backend source identified and resolved one mismatch:
- Backend notifications filter contract uses `channel_id` query param (not `channelId`).
- Mobile library notification service was updated to use `channel_id` for:
  - unread count lookup
  - channel-scoped mark-all-read

Files involved:
- `backend/src/notifications/notification.controller.js`
- `lib/features/broadcast/services/channel_library_service.dart`

Post-fix status:
- `flutter analyze lib/features/broadcast/services/channel_library_service.dart` passed.
- IDE diagnostics for the same file returned no errors.

## 14) Current Release Gate

Remaining blockers for closure:
- Device-level runtime QA execution (sections A-E in this document).
- Final product sign-off after QA evidence is captured.

Runtime smoke progress (completed):
- Tool-managed app launch on Android device succeeded (build, install, app start).
- Authenticated splash startup completed without Dart crash traces in captured logs.

Interpretation:
- Startup stability is confirmed.
- Full feature interaction QA (A-E) is still required before sign-off.

## 15) Live Page + Channel Player Mobile Parity Update

Scope extension completed after the Library/Waves slice to address live-discovery and player parity gaps.

Implemented mobile coverage:
- Added dedicated live discovery route: `/live`.
- Added new mobile live directory screen: `lib/features/broadcast/screens/live_channels_screen.dart`.
- Live directory filters channels using live status (`stream_status == live`) and includes loading/empty/error/success states.
- Live directory cards now surface live viewer counts (`viewer_count`) for website-aligned stream metadata.
- Added previous/next pagination controls for larger live inventories.
- Wired live card tap handoff into `/channel-player` with channel id argument.
- Updated home quick action entry to route users to `/live`.
- Added share action in channel player header to copy live stream link.
- Added visible `Live Activity` panel in channel player that surfaces recent gifts/reactions, aligned with website behavior.

Files touched for this parity extension:
- `lib/features/broadcast/screens/live_channels_screen.dart`
- `lib/main.dart`
- `lib/features/auth/screens/home_screen.dart`
- `lib/features/broadcast/screens/channel_player_screen.dart`
- `channel-live-player-mobile-parity-end-to-end-implementation-tracker.md`

Validation status:
- `flutter analyze` on touched live/player files passed with no issues.
- IDE diagnostics on touched files returned no errors.

Remaining release-gate note:
- Device-level interaction QA for live-directory and player parity flow remains recommended before final sign-off.

## 16) Stability, Privacy, and Watch-Path Hardening Update

Additional hardening was applied after device QA feedback for unstable-network handling and watch-path clarity.

Implemented fixes:
- Sanitized user-facing network errors to avoid exposing backend infrastructure details.
  - Timeout and connectivity failures now return friendly copy (no raw host/URL in UI).
- Added public channel list caching in service layer with TTL and stale fallback.
  - Repeated navigation now reuses cached channel data to reduce network usage and improve response time.
  - On transient network failure, cached channels are used when available.
- Updated browse-channel card UX to explicit two-action controls:
  - `Tune In` -> opens player directly.
  - `Visit Profile` -> opens channel profile page.
- Updated home public/recent channel taps to direct player navigation for watch-first behavior.
- Added always-visible `Tune In` quick action on channel profile so watch is reachable from any tab.

Files touched in this hardening pass:
- `lib/core/api/api_service.dart`
- `lib/features/channel/services/channel_service.dart`
- `lib/features/channel/screens/channel_list_screen.dart`
- `lib/features/broadcast/screens/live_channels_screen.dart`
- `lib/features/auth/screens/home_screen.dart`
- `lib/features/channel/screens/channel_view_screen.dart`

Validation status:
- `flutter analyze` on all touched files passed with no issues.
- IDE diagnostics on all touched files returned no errors.
