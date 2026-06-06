# Home Dashboard Instant Actions and Subscription Entry End-to-End Implementation Tracker

## 1. Feature Identity
- Feature Name: Home Dashboard Instant Actions, Recently Visited Channels, and Subscription Entry Flow
- Owner Team(s): Flutter, Product, Subscription UX
- Primary Surfaces: Flutter
- Related Tickets: DASHHOME-01..08
- Linked Tracker File: home-dashboard-instant-actions-and-subscription-entry-end-to-end-implementation-tracker.md

## 2. Objective
Repurpose the Home dashboard channel strip to show the logged-in user’s most recently visited channel logos, add a premium instant-actions grid with the requested card order and badge states, improve footer navigation presentation, and add a subscription entry flow that cleanly separates active-plan details from new-plan activation options.

## 3. Completion Contract
1. Entry points and discovery surfaces
- Home shows Recently Visited Channels instead of public channels in the former public-channel strip position.
- Home exposes an Instant Actions section with the requested 3x3 card order.
- Add Waves opens a wave upload flow that requires channel selection when needed.
2. Destination UX and interaction states
- My Plan opens a subscription details page for both creator and viewer accounts.
- No-plan users see a Start Here state that leads to a Select Your Options screen.
- Select Your Options explains creator activation and viewer activation in plain language and routes to the correct plan tab.
3. Backend/API/storage/state wiring
- Watch history is recorded locally when a channel is opened so the home strip can show the top 10 recently visited channels.
- Upload flow uses existing broadcast upload APIs and channel lookup APIs.
4. Navigation and deep links
- Home cards route to the existing channel, browse, live, creator, ads, assets, reminders, plan, and waves surfaces.
- Subscription activation routes from Select Your Options into the existing plans screen.
5. Permissions, entitlement, validation, and edge cases
- My Plan reflects active/inactive states from the authenticated profile.
- Upload flow blocks publishing until a channel has been selected.
6. Operational controls and management tooling
- Home exposes visible counters for days left and reminder count.
- Footer labels render below icons for improved scanability.
7. Notifications/alerts/analytics coverage
- Existing channel view analytics remain intact.
- No new external telemetry dependencies are introduced.
8. QA and rollout readiness
- Changed files must analyze cleanly.
- Route changes and upload behavior must be exercised through the app flow.

## 4. Business Rules (Source of Truth)
- Recently Visited Channels always shows the authenticated user’s local watch history, not public inventory.
- The home action grid order is fixed exactly as requested.
- My Plan is a status-aware entry point, not a direct subscription purchase shortcut.
- Creator activation and viewer activation must explain themselves in plain, simple language.
- Add Waves must allow the user to choose a channel before uploading.

## 5. Domain Model Changes
- No backend schema changes.
- Local watch history becomes the source for the Recently Visited Channels strip.
- Home state gains counters for subscription days remaining and reminder count.
- Upload flow supports an optional initial channel context and a user-selected channel context.

## 6. API Contracts
- Viewer APIs used:
  - `GET /channels/me`
  - `GET /broadcast/reminders/me`
  - Existing profile and channel-view endpoints
- Upload APIs used:
  - Existing broadcast upload, register, and schedule endpoints
- Error contract:
  - Missing channel selection blocks upload with an inline user-facing prompt
  - Empty history and empty reminders render harmless empty states

## 7. End-to-End User Flows
1. Discovery flow
- User opens Home and sees Recently Visited Channels, Instant Actions, and the footer redesign.
2. Primary success flow
- User taps My Plan and lands on subscription details if already subscribed, or on the start path if not.
- User taps Add Waves, selects a channel if needed, uploads media, and publishes.
3. Failure and recovery flow
- Missing channel selection or no channels available surfaces an empty state with recovery actions.
4. Follow-up action flow
- Select Your Options routes into the appropriate plan tab for subscription purchase.
5. Lifecycle/renewal/state-transition flow
- Days-left counter updates from the profile subscription expiry date and switches to Start Here when no plan exists.

## 8. Frontend Scope
- Flutter UX scope:
  - Home dashboard card ordering, section labels, badges, and footer redesign.
  - New subscription details and activation choice screens.
  - Upload screen channel-selection mode.
- Shared design rules and reusable components:
  - Use `AppColors.primaryGradient`.
  - Use only brand palette colors from `app_colors.dart`.
  - Prefer premium card treatments and centered icon/label footer layout.
- Required states:
  - loading, empty, error, success, disabled, and selection-needed states.

## 9. Backend/Jobs Scope
- No backend job changes.
- No queue or scheduler changes.

## 10. Security and Compliance
- No new trust boundaries introduced.
- Existing profile, channel, and upload permission checks remain authoritative.
- No sensitive data is persisted beyond the existing local watch history store.

## 11. Observability and Analytics
- Preserve existing channel view recording.
- Keep local debug logging limited to current app patterns.
- No new analytics or alerting dependencies.

## 12. Phased Delivery Plan
- Phase A: Prepare tracker and map current Home/Plan/Upload surfaces.
- Phase B: Add Home strip, action grid, and footer redesign.
- Phase C: Add subscription details and activation choice flows.
- Phase D: Add channel-selection mode to upload flow.
- Phase E: Validate analyzer and end-to-end navigation.

## 13. Acceptance Criteria (Release Gate)
- Home shows Recently Visited Channels in the former public-channel strip location.
- The Instant Actions section has the requested order and row coloring.
- My Plan shows a days-left badge when a subscription is active.
- My Plan shows Start Here when no subscription exists.
- Select Your Options routes to the correct creator/viewer plan tab.
- Add Waves can publish only after a channel is selected.
- Footer labels appear under icons and look materially more premium.

## 14. Test Matrix (Minimum)
- Persona tests:
  - Subscriber viewer
  - Creator account
  - User without an active plan
- Success/failure tests:
  - Recent history populated
  - Recent history empty
  - No reminders
  - Channel selection missing in Add Waves
- Security tests:
  - Existing route gating remains enforced
- Performance tests:
  - Home renders with 10 visited channels and 9 action cards
- Regression tests:
  - Existing channel view, live, and reminders routes still open correctly

## 15. Operational Runbook Requirements
- Incident classes:
  - Wrong dashboard data source
  - Upload flow blocked by missing channel context
- Recovery SOP:
  - Re-record watch history by opening a channel
  - Select a channel from the upload picker and retry
- Escalation paths:
  - Flutter UX issues to product/design

## 16. Release Checklist
- [x] Route changes registered
- [x] Home dashboard updated
- [x] Subscription entry screens added
- [x] Upload channel-selection mode validated
- [x] Analyzer clean
- [ ] Visual regression review complete

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
- [x] DASHHOME-01 Repurpose the public-channel strip into Recently Visited Channels.
- [x] DASHHOME-02 Add the Instant Actions 3x3 grid with the requested ordering and colors.
- [x] DASHHOME-03 Redesign the footer icons and labels to be centered and premium.
- [x] DASHHOME-04 Add local watch-history recording when channels open.
- [x] DASHHOME-05 Add subscription details and Start Here entry flow.
- [x] DASHHOME-06 Add Select Your Options screen with creator/viewer explanations.
- [x] DASHHOME-07 Route Add Waves into a channel-selection upload flow.
- [x] DASHHOME-08 Validate routes and run analyzer on touched files.

## Verification Evidence
- Pending