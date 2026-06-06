# Dashboard Pool + Floating PiP End-to-End Implementation Tracker

## 1. Feature Identity

- Feature Name: Dashboard Community Pool Parity + Floating PiP Lifecycle Recovery
- Owner Team(s): Flutter Mobile, Android Native Bridge, Backend API (reference parity)
- Primary Surfaces: Flutter, Android, Backend parity reference
- Related Tickets: User-reported dashboard mismatch and PiP lifecycle regressions (May 31, 2026)
- Linked Tracker File: dashboard-pool-and-floating-pip-end-to-end-implementation-tracker.md

## 2. Objective

Ensure the mobile dashboard community pool displays the exact same normalized value model as website, and deliver complete floating PiP lifecycle reliability: survive outside app, stop audio on close, provide persistent return-to-live entry points from dashboard and channels, support manual PiP trigger, and allow seamless expand-back into active watch screen.

## 3. Completion Contract

1. Entry points and discovery surfaces
- Add explicit manual PiP trigger in channel player header.
- Add dashboard and channel list/grid return-to-live indicator surfaces when floating session exists.

2. Destination UX and interaction states
- Return indicator supports loading-safe, visible-only-when-active behavior.
- Expand from floating/native overlay restores watch experience on active channel.
- Close stops playback and clears state in all modes.

3. Backend/API/storage/state wiring
- Use existing community pool payload fields from `/home/stats`.
- Add mobile-side normalization function equivalent to website logic.
- Add floating session state in service (active channel/session metadata + notifier).

4. Navigation and deep links
- Return indicator and expand actions navigate to `/channel-player` with active channel id.

5. Permissions, entitlement, validation, and edge cases
- Handle missing/invalid vpt rate safely.
- Keep overlay permission request path and degraded behavior when denied.

6. Operational controls and management tooling
- Provide in-app controls to enter PiP, return to live, and close/stop playback.

7. Notifications/alerts/analytics coverage
- No new analytics event required in this patch; preserve existing behavior.

8. QA and rollout readiness
- Analyzer and Kotlin compile must pass.
- Manual lifecycle matrix for background/foreground, close/expand, and navigation restore.

## 4. Business Rules (Source of Truth)

- Community pool displayed vPT on mobile must mirror website normalization:
  - display_vpt = max(total_vpt, total_ngn / vpt_rate) when vpt_rate > 0
  - fallback to total_vpt when rate <= 0 or ngn <= 0
- Naira equivalent display remains based on API naira value.
- Floating session is considered active when either Flutter overlay or native overlay is active.
- Close action must terminate audio/video in both Flutter and native overlay modes.
- Expand action must restore user to the active channel player context.

## 5. Domain Model Changes

- New entities
  - FloatingSessionSnapshot (service-level state object)

- Updated entities
  - FloatingPlayerService: add session metadata/notifier and native overlay active flag.

- Field definitions
  - channelId: string
  - channelName: string?
  - externalMode: string
  - isNativeOverlayActive: bool

- State machines/status values
  - inactive -> flutter_overlay_active -> native_overlay_active -> inactive
  - flutter_overlay_active -> inactive (close)
  - flutter_overlay_active -> inactive (expand and resume page)

## 6. API Contracts

- Viewer APIs
  - Existing `/home/stats` payload fields used:
    - community_pool.total_vpt
    - community_pool.total_ngn
    - community_pool.vpt_rate
    - community_pool.naira_equivalent

- Creator/Admin APIs
  - No contract changes.

- Auth and policy checks for every route
  - Existing auth behavior remains unchanged.

- Error contract and status code mapping
  - Keep current fallback/default values on stats fetch failures.

## 7. End-to-End User Flows

1. Discovery flow
- User sees return-to-live indicator on dashboard/channels when floating session exists.

2. Primary success flow
- User starts channel playback -> taps manual PiP -> floating mini-player appears -> app background triggers native overlay -> user returns/expands into player.

3. Failure and recovery flow
- Overlay permission denied -> in-app floating remains, native overlay does not start.
- Stats payload missing values -> fallback formatting without crashes.

4. Follow-up action flow
- User taps return-to-live from dashboard/channels and resumes current channel page.

5. Lifecycle/renewal/state-transition flow
- Close from floating/native overlay clears session and stops all playback/audio.

## 8. Frontend Scope

- Website UX scope
  - No direct website changes (website parity used as source-of-truth).

- Flutter UX scope
  - Home screen community pool normalization parity.
  - Manual PiP trigger on channel player.
  - Return-to-live indicator in dashboard + channel list/grid.

- Shared design rules and reusable components
  - Add reusable return-to-live widget in `lib/core/widgets/`.

- Loading/empty/error/success/disabled states
  - Return indicator hidden when no active session.
  - Community pool gracefully handles fallback values.

## 9. Backend/Jobs Scope

- Services
  - No backend code changes required.

- Workers/schedulers
  - None.

- Idempotency and duplicate protection
  - N/A for this feature.

- Audit requirements
  - N/A.

## 10. Security and Compliance

- Trust boundaries
  - Overlay control stays on existing method channels.

- Sensitive data handling
  - No PII additions.

- Abuse resistance and rate limiting
  - No new public endpoints.

- Audit and legal requirements
  - Existing Android overlay permission model retained.

## 11. Observability and Analytics

- Product metrics
  - Not added in this patch.

- Operational metrics
  - Compile/analyze + manual lifecycle checks.

- Logging/tracing needs
  - Existing debug logs preserved.

- Alert routing
  - No changes.

## 12. Phased Delivery Plan

- Phase 1: tracker gate completion
- Phase 2: community pool parity logic and display updates
- Phase 3: floating service state + manual trigger + return indicators
- Phase 4: native overlay teardown/audio hardening
- Phase 5: verification + tracker completion marks

## 13. Acceptance Criteria (Release Gate)

- Dashboard vPT and naira display align with website parity rules for same payload.
- Floating survives outside app when permission granted.
- Close from floating/native overlay stops all audio immediately.
- Dashboard and channel list/grid show one-tap return-to-live when session active.
- Expand from floating/native overlay restores active channel watch page.
- Dart analyzer and Android Kotlin compile pass for touched files.

## 14. Test Matrix (Minimum)

- Persona tests
  - Viewer with active playback and floating session.

- Success/failure tests
  - Success: permission granted, background/foreground transitions.
  - Failure: permission denied, API fallback values.

- Security tests
  - Overlay permission denied path does not crash.

- Performance tests
  - No noticeable UI jank when indicator appears/disappears.

- Regression tests
  - Back navigation from player still works.
  - Non-playing back exits normally.

## 15. Operational Runbook Requirements

- Incident classes
  - Audio leak after close
  - Failed return-to-live navigation
  - Stats parity mismatch

- Recovery SOP
  - Verify session state reset and native service stop.

- Escalation paths
  - Flutter Mobile -> Android bridge owner when native overlay issues persist.

## 16. Release Checklist

- Feature flags
  - Not used.

- Monitoring
  - Manual QA + compile checks.

- Compliance/approval signoffs
  - Standard mobile QA signoff.

- Rollback readiness
  - Revert touched files.

- Post-launch monitoring window
  - First 24h user validation.

## 17. Definition of Ready

Feature is ready to implement only when:

1. Dependencies are mapped. ✅
2. Rules and contracts are approved. ✅
3. Non-happy paths are specified. ✅
4. Monitoring expectations are attached. ✅
5. Acceptance criteria are testable. ✅

## 18. Definition of Done

Feature is done only when:

1. End-to-end behavior is complete across all touched layers.
2. Supporting flows and controls are functional.
3. Security/compliance requirements are satisfied.
4. QA evidence exists.
5. Rollout and rollback playbooks are validated.

## Required Preparation Hook Checklist

Before coding starts, all answers must be YES:

- [x] A tracker file exists and follows this template.
- [x] Completion contract is explicitly written.
- [x] API and data contracts are documented.
- [x] Non-happy path behavior is documented.
- [x] Security and observability sections are filled.
- [x] Acceptance criteria and test matrix are present.

## Implementation Tickets and Completion Marks

- [x] A1: Implement community pool normalization parity on mobile dashboard.
- [x] A2: Add floating session metadata + notifier in floating service.
- [x] A3: Add manual PiP trigger in channel player header.
- [x] A4: Add return-to-live indicator on dashboard.
- [x] A5: Add return-to-live indicator on channel list screen.
- [x] A6: Add return-to-live indicator on channel grid screen.
- [x] A7: Harden native overlay close teardown to stop audio.
- [ ] A8: Validation pass (analyze + Kotlin compile + lifecycle checks).
