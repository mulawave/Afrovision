# Channel Live + Player Mobile Parity End-to-End Implementation Tracker

## 1. Feature Identity
- Feature Name: Channel Live Directory and Channel Player Parity (Website -> Flutter Mobile)
- Owner Team(s): Flutter, Backend Integration
- Primary Surfaces: Flutter, Website parity reference, Backend contracts
- Related Tickets: LIVEPAR-MOB-01..08
- Linked Tracker File: channel-live-player-mobile-parity-end-to-end-implementation-tracker.md

## 2. Objective
Close the parity gap between website live surfaces and Flutter mobile by adding a dedicated Live directory page and aligning key channel-player entry/interaction flows so viewers can discover live channels and start playback with equivalent states and controls.

## 3. Completion Contract
1. Entry points and discovery surfaces:
- Mobile app has a dedicated `/live` route for live channel discovery.
- Home surface exposes a clear entry into the live directory.
2. Destination UX and interaction states:
- Live directory includes loading, empty, error, and success states.
- Channel cards expose live status, category, and viewer metadata when available.
3. Backend/API/storage/state wiring:
- Reuse existing channels listing contract and filter by live stream status.
- Preserve channel-player playback/data fetching behavior.
4. Navigation and deep links:
- `/live` -> channel card tap -> `/channel-player` with channel id argument.
5. Permissions, entitlement, validation, and edge cases:
- If a channel is not accessible at playback time, existing paywall/entitlement behavior remains authoritative.
6. Operational controls and management tooling:
- Include refresh and pagination controls in mobile live directory for large channel lists.
7. Notifications/alerts/analytics coverage:
- Keep existing player view recording and follow/reaction/gift telemetry paths unchanged.
8. QA and rollout readiness:
- Analyzer and diagnostics must be clean for touched files.

## 4. Business Rules (Source of Truth)
- A channel is considered live when `stream_status == live`.
- Live directory lists only currently live channels.
- Channel player remains the canonical playback destination for live channels.
- Access checks and paywalls are enforced by existing channel-player contracts.

## 5. Domain Model Changes
- No new backend entities.
- No new persisted Flutter models.
- Existing `ChannelModel.streamStatus` and `ChannelModel.isStreamLive` are used as the source for live filtering.

## 6. API Contracts
- Viewer APIs used:
  - `GET /channels` (existing channel list contract, filtered client-side by `stream_status`)
- Playback/access APIs unchanged and already wired through channel player:
  - `GET /channels/:id`
  - `GET /channels/:id/now-playing`
  - Access-check and exclusive/premium flows already in place
- Error contract:
  - Channel listing failures: show retry state on `/live`
  - Playback failures remain handled by existing `/channel-player` logic

## 7. End-to-End User Flows
1. Discovery flow:
- User opens home and taps live discovery action, lands on `/live`.
2. Primary success flow:
- `/live` loads live channels, user taps one, app opens `/channel-player` for the selected channel.
3. Failure and recovery flow:
- `/live` network error shows inline retry action.
4. Follow-up action flow:
- From channel player, viewer uses existing follow, chat, reactions, and gifts.
5. Lifecycle/renewal/state-transition flow:
- Refresh and pagination keep live directory state consistent as live channels change.

## 8. Frontend Scope
- Website UX scope (reference): `/live` listing and `/live/[id]` playback entry behavior.
- Flutter UX scope:
  - New `LiveChannelsScreen` at `/live`.
  - Home quick-action entry update to point to `/live`.
  - Channel player remains playback destination with existing controls.
- Shared design rules and reusable components:
  - Use `AppColors.primaryGradient` and brand colors from `AppColors` only.
- Required states:
  - loading, empty, error, success, disabled pagination controls.

## 9. Backend/Jobs Scope
- No backend schema or worker changes.
- Consumer-only parity enhancement on Flutter using existing channels endpoint.

## 10. Security and Compliance
- No new trust boundaries introduced.
- No bypass of entitlement or exclusive/premium gating.
- No sensitive data persistence added.

## 11. Observability and Analytics
- Preserve existing player analytics hooks (`recordView`, interaction events).
- Add no new external analytics dependencies.
- Use existing logs and error surfacing patterns in Flutter.

## 12. Phased Delivery Plan
- Phase A: Implement preparation tracker and parity gap mapping.
- Phase B: Add Flutter `/live` screen with filtering, pagination, and states.
- Phase C: Wire route + home entry and validate channel-player handoff.
- Phase D: Run static validation and update completion evidence.

## 13. Acceptance Criteria (Release Gate)
- Mobile app provides a dedicated `/live` page showing only live channels.
- Loading, empty, error, and retry states are present on `/live`.
- Pagination controls work and disable appropriately at edges.
- Tapping a live channel opens `/channel-player` with correct channel id.
- Home includes a direct user path into `/live`.
- Analyzer and diagnostics are clean for changed files.

## 14. Test Matrix (Minimum)
- Persona tests:
  - Authenticated viewer
  - Unauthenticated viewer (discovery works, gated playback remains guarded)
- Success/failure tests:
  - Live channels available
  - No live channels
  - Channel API failure + retry
- Security tests:
  - Premium/exclusive channel still requires access from player
- Performance tests:
  - Pagination and scrolling remain smooth with > 12 live channels
- Regression tests:
  - Existing `/channels` and `/channel-player` routes remain functional

## 15. Operational Runbook Requirements
- Incident classes:
  - Live directory fetch failures
  - Empty live inventory confusion
- Recovery SOP:
  - Retry from live directory
  - Fallback navigation to `/channels`
- Escalation paths:
  - Flutter -> Backend API owners for channel stream status drift

## 16. Release Checklist
- [x] `/live` route added and reachable
- [x] Home action points to `/live`
- [x] Live directory states validated (loading/empty/error/success)
- [x] Player handoff validated
- [x] Analyzer/diagnostics clean

## 17. Definition of Ready
1. Dependencies are mapped.
2. Rules and contracts are approved.
3. Non-happy paths are specified.
4. Monitoring expectations are attached.
5. Acceptance criteria are testable.

## 18. Definition of Done
1. End-to-end behavior is complete across all touched layers.
2. Supporting flows and controls are functional.
3. Security/compliance requirements are satisfied.
4. QA evidence exists.
5. Rollout and rollback path are validated.

## Required Preparation Hook Checklist
- [x] A tracker file exists and follows this template.
- [x] Completion contract is explicitly written.
- [x] API and data contracts are documented.
- [x] Non-happy path behavior is documented.
- [x] Security and observability sections are filled.
- [x] Acceptance criteria and test matrix are present.

## Implementation Tickets
- [x] LIVEPAR-MOB-01 Create Flutter live directory screen with website-parity states.
- [x] LIVEPAR-MOB-02 Filter channels by live status and add pagination controls.
- [x] LIVEPAR-MOB-03 Add route mapping for `/live` in app router.
- [x] LIVEPAR-MOB-04 Wire home quick action to `/live`.
- [x] LIVEPAR-MOB-05 Ensure `/live` -> `/channel-player` handoff with channel id works.
- [x] LIVEPAR-MOB-06 Verify channel-player behavior parity remains intact after handoff.
- [x] LIVEPAR-MOB-07 Run analyzer/diagnostics for touched files.
- [x] LIVEPAR-MOB-08 Update tracker completion marks and verification evidence.

## Verification Evidence (2026-05-28)
- [x] IDE diagnostics (`get_errors`) returned `No errors found` for all touched files.
- [x] `flutter analyze` on touched files returned `No issues found!`.
- [x] New `/live` route is registered and points to `LiveChannelsScreen`.
- [x] Home action card now routes to `/live`.
- [x] Live directory cards navigate to `/channel-player` with channel id argument.
- [x] Channel player includes share action for the live stream link.
- [x] Channel player now renders a visible `Live Activity` feed sourced from interaction events.
- [x] Event polling now performs initial hydration plus incremental refreshes every 20 seconds.
- [x] Live directory now renders `viewer_count` metadata on cards to match website live-card behavior.
- [x] API/network failures now show sanitized user-friendly messages (no backend host/url leakage).
- [x] Public channel listing now uses TTL cache with stale-data fallback on temporary network failures.
- [x] Browse channels cards now provide explicit `Tune In` and `Visit Profile` actions.
- [x] Home public/recent channel tap now opens player directly for watch-first flow.
- [x] Channel profile now has always-visible `Tune In` quick action across tabs.
- [x] Channel player now starts external stream playback even when `now_playing` is null (prevents false standby when website stream is already live).
- [x] Channel player now routes `external_youtube` to in-app embedded YouTube playback (no redirect) using website-equivalent embed URL parameters, while `external_hls`/`external_dash` and upload/native streams continue through the internal player path.
- [x] Channel player runtime selection now mirrors website mode inference by considering both source mode and playback URL pattern (youtube/hls/dash/url).