# Wave Mobile Parity — End-to-End Implementation Tracker

## 1. Feature Identity

- Feature Name: Wave Mobile Website-Parity Alignment
- Owner Team(s): Product, Flutter Engineering
- Primary Surfaces: Flutter
- Related Tickets: WV-MOB-PARITY-01..08
- Linked Tracker File: `wave-mobile-parity-end-to-end-implementation-tracker.md`

## 2. Objective

Bring Flutter Wave screen behavior and visuals to parity with the website Wave experience for the mobile context: responsive vertical scrolling feed, correct iconography/order/colors, ECG pulse timeline with duration and playhead tracking, complete action rail, comments flow, options flow, and stable non-happy states.

## 3. Completion Contract

1. Entry points and discovery surfaces
2. Destination UX and interaction states
3. Backend/API/storage/state wiring
4. Navigation and deep links
5. Permissions, entitlement, validation, and edge cases
6. Operational controls and management tooling
7. Notifications/alerts/analytics coverage
8. QA and rollout readiness

## 4. Business Rules (Source of Truth)

- Wave feed must scroll naturally on mobile using vertical gestures.
- Right action rail order must match website: views, pulse, repeat, comments, bookmark, options.
- Pulse actions must write moment timestamp and support intensity 1..3.
- ECG pulse timeline must render pulse moments and allow seek tracking against duration.
- Age classification badges and labels must remain consistent with website semantics.
- Options panel must include fullscreen, autoscroll toggle, interested, not interested, and report actions.

## 5. Domain Model Changes

- Updated `WaveModel` fields:
  - `duration` (seconds)
  - `viewCount`
  - `repeatPlayCount`
- New `WavePulseMomentModel`:
  - `second`
  - `intensitySum`

## 6. API Contracts

- Viewer APIs consumed by Flutter:
  - `GET /wave/feed`
  - `POST /wave/:waveId/pulse`
  - `GET /wave/:waveId/pulses/moments`
  - `GET /wave/:waveId/comments`
  - `POST /wave/:waveId/comments`
  - `POST /wave/:waveId/bookmark`
  - `POST /wave/:waveId/interest`
  - `POST /wave/:waveId/report`
- Error contract:
  - Display user-facing snackbars and panel-level fallback states.

## 7. End-to-End User Flows

1. Discovery flow: open Wave screen -> feed loads -> active item auto-plays.
2. Primary success flow: scroll between waves -> interact with pulse/comments/bookmark/options.
3. Failure and recovery flow: API errors -> snackbars/retry with no crash.
4. Follow-up action flow: options -> interest/report/autoscroll/fullscreen behavior updates.
5. Lifecycle/state-transition flow: video progress drives ECG playhead and autoscroll end-state transitions.

## 8. Frontend Scope

- Flutter UX scope:
  - Vertical `PageView` wave feed.
  - Website-parity icon order and action rail presentation.
  - ECG timeline painter with seek and duration labels.
  - Comments sheet with load/post states.
  - Options sheet with full action set.
- State coverage:
  - Loading / empty / error / success
  - Disabled interaction on unauthenticated actions via guarded API results.

## 9. Backend/Jobs Scope

- No backend contract changes required.
- Consume existing wave endpoints only.

## 10. Security and Compliance

- Auth-gated writes remain server-enforced.
- Report endpoint uses existing moderation pathway.
- Comment payload remains bounded by backend validation.

## 11. Observability and Analytics

- Preserve existing backend counters and pulse moments.
- Track repeat play state locally for UI parity display.

## 12. Phased Delivery Plan

- Phase 1: Model/service parity upgrades.
- Phase 2: UI parity (scroll, rail icons/order/colors, ECG timeline).
- Phase 3: Comments/options panel parity and validation.

## 13. Acceptance Criteria (Release Gate)

- Wave cards respond correctly to vertical scroll gestures.
- Right rail icon order matches website.
- ECG pulse timeline renders moments and updates playhead with duration labels.
- Options sheet includes fullscreen, autoscroll, interested, not interested, report.
- Comments panel loads and posts comments successfully.
- Analyzer passes for touched files.

## 14. Test Matrix (Minimum)

- Persona tests: authenticated and anonymous viewers.
- Success/failure tests: feed load, pulse, bookmark, comments, report.
- Security tests: unauthenticated write attempt behavior.
- Performance tests: smooth page transition and video playback.
- Regression tests: no breakage to existing wave route.

## 15. Operational Runbook Requirements

- Incident classes: feed load failure, write action failures, playback regressions.
- Recovery SOP: retry feed, fallback snackbars, route back to home.
- Escalation paths: Flutter Engineering -> Backend if endpoint contract mismatch.

## 16. Release Checklist

- Feature ready in Flutter route `/wave`.
- Analyzer checks executed.
- Rollback path: restore previous `wave_screen.dart` and wave model/service revisions.

## 17. Definition of Ready

1. Dependencies are mapped.
2. Rules and contracts are approved.
3. Non-happy paths are specified.
4. Monitoring expectations are attached.
5. Acceptance criteria are testable.

## 18. Definition of Done

1. End-to-end behavior is complete across touched Flutter layers.
2. Supporting flows and controls are functional.
3. Security/compliance requirements are satisfied.
4. QA evidence exists.
5. Rollout and rollback playbooks are validated.

## Required Preparation Hook Checklist

- [x] A tracker file exists and follows this template.
- [x] Completion contract is explicitly written.
- [x] API and data contracts are documented.
- [x] Non-happy path behavior is documented.
- [x] Security and observability sections are filled.
- [x] Acceptance criteria and test matrix are present.

## Implementation Tickets

- [x] WV-MOB-PARITY-01 Update wave model/service for moments + counters parity
- [x] WV-MOB-PARITY-02 Replace non-responsive wave gesture logic with vertical page scrolling
- [x] WV-MOB-PARITY-03 Implement website-parity icon rail order, labels, and colors
- [x] WV-MOB-PARITY-04 Add ECG pulse timeline with duration and seek tracker
- [x] WV-MOB-PARITY-05 Implement comments panel flow (load/post/close)
- [x] WV-MOB-PARITY-06 Implement options panel flow (fullscreen/autoscroll/interest/report)
- [x] WV-MOB-PARITY-07 Validate loading/empty/error states for parity flow
- [x] WV-MOB-PARITY-08 Run analyzer checks for touched files and update completion marks

## Refinement Tickets (May 28, 2026)

- [x] WV-MOB-REFINE-01 Remove right-side transparent rail background
- [x] WV-MOB-REFINE-02 Remove back button and wave counter from header
- [x] WV-MOB-REFINE-03 Make wave surface fully fill viewport with transparent top overlay
- [x] WV-MOB-REFINE-04 Reduce ECG timeline vertical height by approximately 50%
- [x] WV-MOB-REFINE-05 Reposition options icon to top-right as vertical three-dots
- [x] WV-MOB-REFINE-06 Keep wave title hidden in rendering
- [x] WV-MOB-REFINE-07 Reduce read pressure by loading pulse moments only for active wave
- [x] WV-MOB-REFINE-08 Reduce lag by throttling playback progress UI updates
- [x] WV-MOB-REFINE-09 Improve smoothness by preloading next wave video and thumbnail
- [x] WV-MOB-REFINE-10 Reposition age badge beside options menu in top-right safe area
- [x] WV-MOB-REFINE-11 Increase rail icon separation and vertical offset above ECG timeline
- [x] WV-MOB-REFINE-12 Add pull-to-refresh for Wave feed with safe controller cleanup

## Refinement Tickets (May 29, 2026)

- [x] WV-MOB-REFINE-13 Prevent decoder NO_MEMORY by pruning off-screen video controllers and disposing stale instances aggressively
- [x] WV-MOB-REFINE-14 Add backend-level feed novelty filtering (exclude seen + not_interested) and client exclude-id hints for unseen-first ordering
