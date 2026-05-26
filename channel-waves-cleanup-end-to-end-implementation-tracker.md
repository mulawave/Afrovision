# Channel Waves Cleanup End-to-End Implementation Tracker

## 1. Feature Identity

- Feature Name: Channel Waves Tab Cleanup and Creator Management Controls
- Owner Team(s): Website + Backend
- Primary Surfaces: Backend, Website
- Related Tickets: Wave cleanup request (7 items)
- Linked Tracker File: channel-waves-cleanup-end-to-end-implementation-tracker.md

## 2. Objective

Implement complete channel waves tab cleanup for creator and viewer flows: bounded/scrollable wave grid, denser layout, in-tab fullscreen playback modal with next/prev review, fully wired single and bulk management actions (delete + hide from timeline), direct navigation links between waves surfaces, and replay metric visibility next to unique views.

## 3. Completion Contract

1. Entry points and discovery surfaces
- Waves tab remains discoverable on channel page.
- Add explicit links to Wave viewing page for creators and viewers.

2. Destination UX and interaction states
- Waves container uses fixed height and internal scroll.
- Grid density supports up to 5 cards per row on large screens.
- Clicking a wave opens fullscreen modal player with next/previous navigation.
- Single delete + hide actions expose loading/disabled states and immediate optimistic removal/update.
- Bulk selection supports bulk delete and bulk hide with completion/error state messaging.

3. Backend/API/storage/state wiring
- Channel waves API supports owner-only include-hidden retrieval.
- Wave API supports timeline visibility toggling and bulk operations.
- UI uses API methods and updates local state immediately after success.

4. Navigation and deep links
- Add prominent links/buttons from channel waves tab to wave viewing page.
- Keep creator and viewer navigation concerns separated in labels/placement.

5. Permissions, entitlement, validation, and edge cases
- Only owner/admin can delete/hide single or bulk.
- Viewer sees only active waves; creator can optionally see hidden waves in tab.
- Empty/loading/error states remain intact.

6. Operational controls and management tooling
- Per-item controls: delete, hide/unhide, selection toggle.
- Bulk controls: delete selected, hide selected, unhide selected, clear selection.

7. Notifications/alerts/analytics coverage
- Action toasts/messages for management actions.
- Replay metric rendered per wave card using existing repeat-play counter field.

8. QA and rollout readiness
- Website build and lint pass.
- Backend tests/lint relevant to wave module pass.

## 4. Business Rules (Source of Truth)

- Non-manager users cannot manage waves.
- Deleted waves are soft-deleted and excluded from viewer-facing surfaces.
- Hidden waves are excluded from timeline/feed surfaces but available to managers for control/recovery.
- Bulk actions must be partial-failure safe and return actionable result counts.
- Replay count and unique views must be displayed as separate metrics.

## 5. Domain Model Changes

- Updated entities:
- Wave status supports hidden in addition to active/deleted/reported.
- Wave keeps views_count (unique) and repeat_play_count (replays).

## 6. API Contracts

- Viewer APIs:
- GET /wave/channel/:channelId (active only by default).

- Creator/Admin APIs:
- GET /wave/channel/:channelId?include_hidden=true (owner/admin only).
- DELETE /wave/:waveId (existing, wired in UI).
- POST /wave/:waveId/timeline-visibility { hidden: boolean }.
- POST /wave/bulk-delete { wave_ids: string[] }.
- POST /wave/bulk-timeline-visibility { wave_ids: string[], hidden: boolean }.

- Auth and policy checks for every route:
- Manager role and channel ownership required for all management routes.

- Error contract and status code mapping:
- 400 invalid payload.
- 401 unauthenticated.
- 403 unauthorized/not owner.
- 404 wave/channel not found.
- 500 internal error.

## 7. End-to-End User Flows

1. Discovery flow
- User opens channel page and clicks Waves tab.

2. Primary success flow
- User views bounded grid, opens fullscreen wave modal, navigates next/prev.
- Creator selects waves and performs bulk hide/delete.

3. Failure and recovery flow
- Action failure keeps selection and displays actionable message.
- Creator retries with same selected set.

4. Follow-up action flow
- Creator can unhide previously hidden waves.

5. Lifecycle/renewal/state-transition flow
- Active -> hidden -> active transitions via timeline visibility action.
- Active/hidden -> deleted via single or bulk delete.

## 8. Frontend Scope

- Website UX scope
- ChannelProfile Waves tab layout, controls, modal playback, navigation links, metrics.

- Flutter UX scope
- None.

- Shared design rules and reusable components
- Existing website design tokens/components retained.

- Loading/empty/error/success/disabled states
- Add per-item and bulk loading/disabled states and status notices.

## 9. Backend/Jobs Scope

- Services
- Wave controller/model route additions for hide/bulk management.

- Workers/schedulers
- None.

- Idempotency and duplicate protection
- Bulk handlers tolerate duplicate IDs and return counts.

- Audit requirements
- Existing auth/ownership checks preserved.

## 10. Security and Compliance

- Trust boundaries
- Only authenticated manager can mutate wave management state.

- Sensitive data handling
- No new sensitive data introduced.

- Abuse resistance and rate limiting
- Existing auth path required; payload size bounded for bulk operations.

- Audit and legal requirements
- Existing wave moderation/reporting paths unchanged.

## 11. Observability and Analytics

- Product metrics
- Replay and unique views visible in UI.

- Operational metrics
- Bulk action success/failure counts returned to client.

- Logging/tracing needs
- Controller errors logged with wave context.

- Alert routing
- Existing backend monitoring channels unchanged.

## 12. Phased Delivery Plan

- Phase 1: Add backend APIs and policy checks.
- Phase 2: Wire website API client and Waves tab controls.
- Phase 3: Add fullscreen modal player flow and navigation links.
- Phase 4: Validate build/tests and finalize tracker completion marks.

## 13. Acceptance Criteria (Release Gate)

- [x] Waves tab grid is bounded by fixed height and internally scrollable.
- [x] Large screens render 5 wave cards per row.
- [x] Clicking a wave opens fullscreen player modal with next/prev.
- [x] Single delete has spinner/disabled state and immediate removal.
- [x] Bulk selection + bulk delete works end-to-end.
- [x] Hide from timeline action exists and works for single + bulk.
- [x] Creator can unhide hidden waves.
- [x] Channel Waves tab exposes smooth direct links to wave viewing page.
- [x] Wave cards display unique views and replay counts separately.
- [x] Desktop left-panel channel waves always keep Currently Playing and Up Next in the top two slots, rotating current to tail on completion.
- [x] Non-manager users cannot access management actions.

## 14. Test Matrix (Minimum)

- Persona tests
- Viewer can browse/open waves but cannot manage.
- Creator can delete/hide/unhide single and bulk.

- Success/failure tests
- Successful single and bulk actions update UI instantly.
- Failed actions keep state and show message.

- Security tests
- Unauthorized user receives 403 on manage APIs.

- Performance tests
- Dense grid rendering remains responsive with large lists.

- Regression tests
- Existing wave feed/player behavior remains unchanged.

## 15. Operational Runbook Requirements

- Incident classes
- API permission mismatch, bulk action failures, stale UI state.

- Recovery SOP
- Retry failed IDs and refresh channel waves list.

- Escalation paths
- Website and backend owners.

## 16. Release Checklist

- Feature flags
- None.

- Monitoring
- Existing logs and HTTP error monitoring.

- Compliance/approval signoffs
- N/A for this scope.

- Rollback readiness
- Revert wave management endpoint/UI changes.

- Post-launch monitoring window
- Verify channel waves tab actions during first release window.

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
5. Rollout and rollback playbooks are validated.

## Required Preparation Hook Checklist

- [x] A tracker file exists and follows this template.
- [x] Completion contract is explicitly written.
- [x] API and data contracts are documented.
- [x] Non-happy path behavior is documented.
- [x] Security and observability sections are filled.
- [x] Acceptance criteria and test matrix are present.
