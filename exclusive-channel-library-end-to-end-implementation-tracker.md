# Exclusive Channel Library End-to-End Implementation Tracker

## Implementation Status (Compulsory Update Per Implementation)

Last Updated: 2026-05-25 (AV-LIB-075 library publish notifications + tab counter in progress)

### Completed

- [x] AV-LIB-010 Create series/item/progress/bookmark/favorite schemas.
- [x] AV-LIB-011 Add creator/admin CRUD APIs and validation.
- [x] AV-LIB-012 Add viewer list/detail/reader/progress/bookmark/favorite APIs.
- [x] AV-LIB-013 Add entitlement-aware favorites retrieval.
- [x] AV-LIB-020 Add Library tab and gated loading on exclusive channel page.
- [x] AV-LIB-021 Build premium responsive library grid and states.
- [x] AV-LIB-022 Build detail modal with Read Now, Save to Favorites, See Next.
- [x] AV-LIB-023 Implement See Next in-modal navigation and list bounds handling.
- [x] AV-LIB-030 Build fullscreen immersive reader scene.
- [x] AV-LIB-031 Implement two-page spread pagination and slick page-flip animation.
- [x] AV-LIB-032 Progress autosave, bookmarks, and resume behavior.
- [x] AV-LIB-033 Auto-next in series upon completion.
- [x] AV-LIB-040 Creator upload and content lifecycle controls.
- [x] AV-LIB-041 Series ordering and next-book sequencing controls.
- [x] AV-LIB-042 Admin moderation and audit tooling for library content.
- [x] AV-LIB-050 Bookmark reminder nudges.
- [x] AV-LIB-051 New-in-series and new-library-item notifications.
- [x] AV-LIB-052 Related-content recommendation service and UI integrations.
- [x] AV-LIB-060 Persona E2E tests for gating and full flows.
- [x] AV-LIB-061 Security abuse tests (direct URL bypass, token replay, unauthorized assets).
- [x] AV-LIB-062 Reader performance tests on low-end devices and web.
- [x] AV-LIB-070 Feature flag and staged rollout controls.
- [x] AV-LIB-071 SLO dashboard and runbook updates.
- [x] AV-LIB-072 Go-live checklist and 48-hour monitoring plan.
- [x] AV-LIB-073 Standardize library asset uploads to file picker + progress + instant preview (remove URL-input upload UX).
- [x] AV-LIB-074 Creator-friendly reader upload flow: PDF or ordered page images with auto PDF/manifest generation (no manual JSON upload).

### In Progress

- [ ] AV-LIB-075 Notify active PIC holders on library publishes and show unread badge on Library tab.

### Not Started

- [ ] None

## AV-LIB-075 Library publish notifications and tab badge

### Completion Contract

1. Publishing a new exclusive library item creates in-app notifications for all active PIC holders of that channel.
2. Notifications link back to the channel library and carry enough metadata to identify the channel and item.
3. The Library tab header shows an unread counter badge next to the Library label for the current channel.
4. The unread counter reflects unread library notifications for the signed-in user only and clears when the user marks them read or opens the notifications.
5. Subscribers without an active PIC must not receive library publish notifications.
6. The feature must preserve all existing library publish and reader behavior.

### Business Rules

1. Only active PIC holders are eligible for library publish notifications.
2. Library notifications are created only when an item transitions to published.
3. Notification counts are scoped per user and per channel.
4. Badge counters must not leak unread counts for other channels.

### Acceptance Criteria and Test Matrix

1. Publishing a new library item creates notifications for all active PIC holders of the channel.
2. A notified subscriber sees the Library tab counter increment on the channel page.
3. Opening/marking the notification read clears the badge for that channel.
4. Users without PIC entitlement receive no library publish notification.
5. Backend and frontend validation pass for the touched paths.

## Objective

Deliver a production-ready Exclusive Library capability for exclusive channels with complete end-to-end behavior across website, Flutter app, backend, admin, storage, notifications, personalization, analytics, QA, and rollout operations.

This implementation must satisfy all of the following:

- New channel page tab: Library, placed after Schedule.
- Library tab is visible only for channels with channelType = exclusive.
- Library content visibility and access are gated by active PIC entitlement for that user-channel pair.
- Channel owners can upload and manage readable content series (books, comics, magazines, and similar readable assets).
- Content cards are rendered in a premium grid layout with high-quality metadata presentation.
- Card tap opens a structured detail modal with full metadata and actions:
  - Read Now
  - Save to Favorites
  - See Next
- Read Now opens a fullscreen immersive reader with realistic page-flip behavior.
- Reader supports two-page spread behavior where progression moves spread-by-spread.
- Reader includes bookmarks and resume-from-last-position.
- Save to Favorites writes to user favorites and is constrained by exclusive entitlement gating.
- Favorites list must hide exclusive library items when user has no active PIC for their source channel.
- See Next loads next library item in modal without closing the modal.
- If user reaches end of a book in a series, automatically load next book in the series.
- System provides subtle engagement assistance: bookmark reminders, new-in-series nudges, related content suggestions, and discovery nudges.

## Business Rules (Source of Truth)

1. Library tab appears only when channelType is exclusive.
2. Non-exclusive channels must never show the Library tab.
3. Library list, detail metadata, and reader assets require:
   - authenticated user
   - KYC-approved adult status
   - active PIC entitlement for that channel
4. If entitlement expires, access to that channel's exclusive library content is revoked immediately.
5. Favorites storage may persist references, but retrieval must enforce active entitlement on read.
6. Series order is canonical and owner-controlled.
7. Auto-next-in-series only runs when user completes final readable page of the current item.
8. Reader progress and bookmark persistence are scoped by userId + channelId + contentId.
9. Owner uploads must validate file type, size, and virus-scan status before publish.
10. Draft content must not be visible to viewers.
11. Every critical action is auditable (upload, publish, unpublish, reorder, delete, metadata edits).

## Domain Model Changes

## New/Updated Entities

1. channels (existing)
   - ensure channelType enum supports exclusive (already present in baseline)
2. channel_library_items (new)
   - id
   - channelId
   - seriesId (nullable)
   - seriesOrderIndex
   - contentType (book|comic|magazine|other)
   - title
   - subtitle (optional)
   - author
   - description
   - tags[]
   - coverAssetUrl
   - readerAssetManifestUrl
   - totalPages
   - estimatedReadMinutes
   - status (draft|published|archived)
   - publishedAt
   - createdBy
   - updatedBy
3. channel_library_series (new)
   - id
   - channelId
   - title
   - description
   - coverAssetUrl
   - sortIndex
   - status (active|archived)
4. library_reader_progress (new)
   - id
   - userId
   - channelId
   - itemId
   - currentSpreadIndex
   - currentPageLeft
   - currentPageRight
   - lastReadAt
5. library_bookmarks (new)
   - id
   - userId
   - channelId
   - itemId
   - spreadIndex
   - page
   - note (optional)
   - createdAt
6. user_favorite_library_items (new)
   - id
   - userId
   - channelId
   - itemId
   - createdAt
7. library_engagement_events (new)
   - item-opened, modal-next, favorite-added, favorite-removed, read-start, read-finish, auto-next-series, bookmark-created, resume-used, recommendation-click

## API Contracts

## Viewer APIs

1. GET /channels/:id/library
   - returns published library grid for eligible user
   - supports pagination, search, type filter, series filter
2. GET /channels/:id/library/:itemId
   - returns full metadata for modal
   - includes previousItemId and nextItemId in filtered order
3. GET /channels/:id/library/:itemId/reader-manifest
   - returns signed reader asset manifest for entitled user
4. GET /channels/:id/library/:itemId/progress
   - returns latest progress + bookmark summary
5. PUT /channels/:id/library/:itemId/progress
   - upserts reading progress
6. POST /channels/:id/library/:itemId/bookmarks
   - creates bookmark
7. GET /channels/:id/library/:itemId/bookmarks
   - list bookmarks for user/item
8. DELETE /channels/:id/library/:itemId/bookmarks/:bookmarkId
   - delete bookmark
9. POST /channels/:id/library/:itemId/favorite
   - add to favorites
10. DELETE /channels/:id/library/:itemId/favorite
   - remove from favorites
11. GET /me/favorites/library
   - returns favorites filtered by active entitlement and visibility policy
12. GET /channels/:id/library/recommendations
   - related items based on recent reading and tags

## Creator/Admin APIs

1. POST /creator/channels/:id/library/series
2. PATCH /creator/channels/:id/library/series/:seriesId
3. POST /creator/channels/:id/library/items
4. PATCH /creator/channels/:id/library/items/:itemId
5. POST /creator/channels/:id/library/items/:itemId/publish
6. POST /creator/channels/:id/library/items/:itemId/archive
7. DELETE /creator/channels/:id/library/items/:itemId
8. PATCH /creator/channels/:id/library/order
9. POST /creator/channels/:id/library/items/:itemId/assets
   - staged upload, validation, and publish confirmation
10. GET /creator/channels/:id/library/metrics
11. POST /creator/channels/:id/library/upload-url
   - returns signed upload URL for cover image and reader manifest uploads
12. POST /creator/channels/:id/library/reader-assets/manifest
   - auto-generates reader manifest from uploaded PDF or ordered page images; creates PDF from images when needed

All APIs must enforce exclusive + PIC policy checks server-side.

## End-to-End User Flows

## A. Library Discovery in Channel Page

1. Eligible user opens exclusive channel page.
2. Tab bar shows Past Streams, About, Schedule, Library.
3. Library tab loads premium grid with skeleton state, empty state, and error state.
4. Ineligible user never sees library items and receives access-gated UX if directly routed.

## B. Item Detail Modal

1. User taps cover card.
2. Modal opens with complete metadata:
   - title, author, description, series context, length, tags
3. Actions:
   - Read Now: enters fullscreen reader
   - Save to Favorites: toggles favorite state
   - See Next: loads next item in same modal (no close)
4. Reaching end of list disables See Next gracefully.

## C. Fullscreen Reader Experience

1. Read Now opens fullscreen reading scene with:
   - dark ambient background
   - subtle warm lamp glow around reading surface
   - book-on-surface visual framing
2. Reader displays two-page spread where applicable.
3. Next action flips to next spread with smooth, realistic animation.
4. Progress autosaves per spread transition and periodic interval.
5. User can add manual bookmark at any point.
6. Resume loads from latest progress or selected bookmark.

## D. Auto-Next in Series

1. User reaches final spread of current item.
2. If next item exists in same series and is published/eligible, preload and transition.
3. Show short toast: "Up next in this series" with skip option.
4. If no next item in series, show completion sheet with related recommendations.

## E. Favorites and Entitlement Gating

1. User saves item to favorites.
2. Favorites list includes the item while entitlement remains active.
3. If entitlement becomes inactive, item is filtered from favorites retrieval.
4. If entitlement reactivates, item becomes visible again.

## F. Engagement Assistance

1. Subtle reminder toast after sustained reading: "Bookmark this page?"
2. New-in-series alert for recent series read by user.
3. Related-content suggestions from tags/content type/history.
4. Gentle discovery nudges for unread favorites and recently added channel items.

## Frontend Implementation Scope

## Website

1. Channel page tabs: add Library after Schedule for exclusive channels.
2. Library grid UI with premium card design and responsive layouts.
3. Modal detail viewer with Read Now, Save to Favorites, See Next.
4. Fullscreen reader with realistic page-flip interactions.
5. Bookmark controls and resume handling.
6. Favorites UI in account area with entitlement-filtered rendering.
7. Toasts and nudges for reminders and recommendations.

## Flutter

1. Match website parity for Library tab and gating.
2. Native premium card grid, detail sheet/modal, and immersive reader flow.
3. Bookmarks, favorites, resume, and recommendation surface parity.

## Creator/Admin Surfaces

1. Library series and item management screens.
2. Upload forms for title, author, cover, description, and reading assets.
3. Draft/publish/archive lifecycle controls.
4. Ordering controls for series and item sequence.
5. Metrics for reads, completion, favorites, and engagement.

## Backend Services and Jobs

1. exclusive-library-policy-service
   - access checks for list/detail/reader/favorites
2. library-content-service
   - CRUD, publish states, ordering, metadata validation
3. library-reader-service
   - manifest signing, progress sync, bookmark lifecycle
4. library-favorites-service
   - add/remove and entitlement-aware retrieval
5. library-recommendation-service
   - related content ranking
6. Scheduler jobs:
   - new-series notification dispatcher
   - stale-progress bookmark nudge dispatcher
   - recommendation refresh

## Security and Compliance

1. Never expose reader asset URLs without signed auth and entitlement check.
2. Entitlement checks required on every library/favorites/reader API.
3. Rate-limit write-heavy endpoints (progress/bookmarks/favorites toggles).
4. Validate and sanitize all creator-provided metadata.
5. Virus-scan and content validation for uploaded assets.
6. Audit log every creator/admin mutation.

## Observability and Analytics

## Metrics

1. Library tab open rate per exclusive channel.
2. Card-to-modal conversion rate.
3. Read-start and read-completion rates.
4. Average reading duration/session.
5. Bookmark creation rate.
6. Favorite add/remove rate.
7. Auto-next-in-series trigger and completion rate.
8. Recommendation click-through rate.

## Logging and Tracing

1. Correlation IDs from modal-open to read-finish events.
2. Structured denial logs for entitlement/policy blocks.
3. Reader performance traces (asset fetch latency, flip animation frame drops).

## Phased Delivery Plan

## Phase 0 - Product and Policy Lock

Tickets:

- AV-LIB-001 Finalize library product requirements and UX interaction spec.
- AV-LIB-002 Confirm legal and content policy constraints for readable uploads.
- AV-LIB-003 Confirm entitlement policy extension for favorites visibility.

## Phase 1 - Data and API Foundation

Tickets:

- AV-LIB-010 Create series/item/progress/bookmark/favorite schemas.
- AV-LIB-011 Add creator/admin CRUD APIs and validation.
- AV-LIB-012 Add viewer list/detail/reader/progress/bookmark/favorite APIs.
- AV-LIB-013 Add entitlement-aware favorites retrieval.

## Phase 2 - Website Viewer Experience

Tickets:

- AV-LIB-020 Add Library tab and gated loading on exclusive channel page.
- AV-LIB-021 Build premium responsive library grid and states.
- AV-LIB-022 Build detail modal with Read Now, Save to Favorites, See Next.
- AV-LIB-023 Implement See Next in-modal navigation and list bounds handling.

## Phase 3 - Reader Experience

Tickets:

- AV-LIB-030 Build fullscreen immersive reader scene.
- AV-LIB-031 Implement two-page spread pagination and slick page-flip animation.
- AV-LIB-032 Progress autosave, bookmarks, and resume behavior.
- AV-LIB-033 Auto-next in series upon completion.

## Phase 4 - Creator and Admin Operations

Tickets:

- AV-LIB-040 Creator upload and content lifecycle controls.
- AV-LIB-041 Series ordering and next-book sequencing controls.
- AV-LIB-042 Admin moderation and audit tooling for library content.

## Phase 5 - Engagement and Personalization

Tickets:

- AV-LIB-050 Bookmark reminder nudges.
- AV-LIB-051 New-in-series and new-library-item notifications.
- AV-LIB-052 Related-content recommendation service and UI integrations.

## Phase 6 - QA, Security, and Performance

Tickets:

- AV-LIB-060 Persona E2E tests for gating and full flows.
- AV-LIB-061 Security abuse tests (direct URL bypass, token replay, unauthorized assets).
- AV-LIB-062 Reader performance tests on low-end devices and web.

## Phase 7 - Rollout and Production Readiness

Tickets:

- AV-LIB-070 Feature flag and staged rollout controls.
- AV-LIB-071 SLO dashboard and runbook updates.
- AV-LIB-072 Go-live checklist and 48-hour monitoring plan.

## Acceptance Criteria (Release Gate)

1. Library tab appears only on exclusive channels.
2. Full library and reader access are blocked without active PIC entitlement.
3. Modal actions Read Now, Save to Favorites, and See Next function correctly.
4. Fullscreen reader page flips smoothly and preserves reading progress.
5. Bookmarks and resume function across sessions and devices.
6. Auto-next-in-series triggers at end-of-book when next item exists.
7. Favorites list hides exclusive items when entitlement is inactive.
8. Nudges and recommendations are delivered as specified without spammy behavior.
9. Creator upload and lifecycle management are operational and auditable.
10. E2E, security, and performance gates pass before rollout.

## Test Matrix (Minimum)

1. Persona tests:
   - guest
   - authenticated non-KYC
   - KYC approved without PIC
   - KYC approved with active PIC
   - active PIC expired mid-lifecycle
2. Reader tests:
   - open, flip, bookmark, resume, exit/re-enter
   - two-page spread transitions
   - end-of-book auto-next series handoff
3. Favorites tests:
   - add/remove
   - entitlement active/inactive filtering
4. Security tests:
   - unauthorized manifest fetch
   - signed URL expiry and replay
   - cross-channel entitlement misuse
5. Performance tests:
   - grid load time
   - reader first paint time
   - animation smoothness thresholds

## Operational Runbook Requirements

1. Incident handling for entitlement mismatch in library APIs.
2. Incident handling for failed asset processing/scan.
3. Reader outage and fallback behavior.
4. Alert thresholds for elevated policy-denial rates and asset failures.

## Suggested File/Module Touchpoints (Implementation Planning)

1. Website:
   - website/src/app/live/[id]/LiveStream.tsx
   - website/src/components/channel library and reader components
   - website/src/app/account/favorites surfaces
2. Backend:
   - backend/src/channels and exclusive policy services
   - backend/src/library services/controllers/routes
   - backend/src/jobs for reminders and recommendations
3. Flutter:
   - lib/features/live and channel detail surfaces
   - lib/features/account favorites and reader flows
4. Admin:
   - admin/src channel management and content moderation surfaces

## Release Checklist

1. Feature flags configured by environment.
2. Signed URL and entitlement checks validated in production-like staging.
3. Notifications and nudges rate-limited and validated.
4. Finance/legal/compliance approvals completed where required.
5. 48-hour post-launch monitoring complete with no Sev-1 regressions.

## Notes for Implementation Teams

1. Do not expose unreadable or unauthorized payloads in any ineligible response.
2. Keep entitlement checks centralized to avoid policy drift.
3. Implement reader UX with premium visual quality but maintain accessibility and performance.
4. Treat this tracker as the delivery baseline for 100 percent completion before marking feature done.
