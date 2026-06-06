# Mobile vs Web Parity Report (May 27, 2026)

## Scope
Read-only parity audit between:
- Web app: `website/src/app/**`
- Flutter mobile app: `lib/**`

No fixes or implementations were made.

## Snapshot Summary
- Web page routes discovered: **50**
- Mobile named routes discovered: **43**
- Overall result: Mobile has strong coverage of core auth/channel/wallet flows, but there are major parity gaps in **Wave**, **channel tabbed experience**, **creator studio depth**, and **web-only static/legal surfaces**.

## Highest-Impact Mobile Gaps

### 1) Wave experience missing on mobile (major)
Web has a full dedicated Wave surface and interaction stack, while mobile has no `/wave` route/screen.

Evidence:
- Web Wave route exists: `website/src/app/wave/page.tsx`
- Web Wave action strip includes pulse/replay/comments/bookmark controls: `website/src/app/wave/page.tsx` (around icon strip block near right rail)
- Mobile route table has no `/wave`: `lib/main.dart` route map
- Mobile codebase has no Wave feature screen implementation under `lib/features/**` (no matching route/screen surfaced)

Impact:
- Mobile users cannot access the core short-form Wave feed and interaction loop available on web.

### 2) Channel profile tabs not at parity (major)
Web channel profile is tab-driven (`About`, `Past Streams`, `Library`, `Waves`, `Schedule`, `Manage` when allowed). Mobile channel view is a single long-form screen without equivalent tab surfaces.

Evidence:
- Web tab model: `website/src/app/channel/[id]/ChannelProfile.tsx` (`TABS` definition)
- Mobile channel view screen: `lib/features/channel/screens/channel_view_screen.dart`
- Mobile scan did not find tab constructs for channel profile (`TabBar`/equivalent) in channel view

Impact:
- Missing discoverability and functionality segmentation for library, waves, and manage experiences on mobile.

### 3) Creator Studio depth mismatch (major)
Mobile Creator Studio mostly acts as a launcher (Edit/View/Videos/Schedule/Analytics). Web Creator Studio includes richer in-page operations.

Web-only capabilities observed:
- Stream source mode editor (`native`, `external_url`, `external_youtube`, `external_hls`, `external_dash`)
- URL validate/save/recheck stream health controls
- Upload session status panel with refresh/cancel/delete
- Integrated Wave upload panel in studio
- Dedicated `creator-studio/library` route

Evidence:
- Web Creator Studio feature blocks: `website/src/app/creator-studio/page.tsx`
- Web library studio route: `website/src/app/creator-studio/library/page.tsx`
- Mobile Creator Studio action cards only: `lib/features/channel/screens/creator_studio_screen.dart` (Edit/Disable/View/Videos/Schedule/Analytics)

Impact:
- Mobile creators do not get the same consolidated operations surface available on web.

### 4) Channel library reading surface missing on mobile (major)
Web has channel library item reading route. Mobile has no equivalent route/screen exposed for channel library item consumption.

Evidence:
- Web route: `website/src/app/channel/[id]/library/[itemId]/page.tsx`
- Mobile route table lacks a library item route: `lib/main.dart`
- Minimal `library` references in mobile are tied to video upload icons/labels, not a library reader route

Impact:
- Library content journey available on web is not represented as a dedicated mobile surface.

### 5) Checkout result page parity differs (medium)
Web has a dedicated checkout result page. Mobile handles result via deep-link callback and in-flow logic, but no dedicated route/screen parity.

Evidence:
- Web route: `website/src/app/checkout/result/page.tsx`
- Mobile deep-link callback handler for `afrovision://checkout/result?...`: `lib/core/services/deep_link_service.dart`
- Mobile route map does not include `/checkout/result`: `lib/main.dart`

Impact:
- Different user feedback path after payment completion; parity gap in explicit result-page UX.

## Web Routes Missing Mobile Route Counterparts (Route-Level)
These are present on web and not exposed as equivalent named routes in mobile:
- `/wave`
- `/creator-studio/library`
- `/channel/[id]/library/[itemId]`
- `/challenge/rules`
- `/checkout/result`
- `/live/[id]` (mobile uses `/channel-player` pathway instead)
- `/wallet/convert` (mobile conversion appears embedded in wallet flow, not route-equivalent)
- `/wallet/transactions` (mobile appears to show wallet activity inside digital assets, not route-equivalent)
- `/about`
- `/careers`
- `/contact`
- `/cookies`
- `/copyright`
- `/download`
- `/press`
- `/pricing`
- `/refund`
- `/report-copyright`
- `/updates`
- `/aml`

Note:
- Some items may be intentionally app-specific design choices (embedded flows vs route parity), but they are still parity deltas versus web routing.

## Incomplete or At-Risk Implementations on Mobile

### A) Challenge fallback behavior exposed as “Coming Soon” state
Mobile challenge screen explicitly renders a “Challenge Coming Soon” state when active challenge is not found.

Evidence:
- `lib/features/challenge/screens/challenge_screen.dart` (404/no-active challenge branch and “Challenge Coming Soon” UI)

Risk:
- If backend challenge availability toggles unexpectedly, mobile can appear incomplete to users despite web updates.

### B) Creator operations split across screens, reducing feature parity confidence
Mobile creator operations are fragmented across `creator_studio_screen`, `video_upload_screen`, and `schedule_screen`, while web centralizes more operational controls in one place.

Evidence:
- `lib/features/channel/screens/creator_studio_screen.dart`
- `lib/features/broadcast/screens/video_upload_screen.dart`
- `lib/features/broadcast/screens/schedule_screen.dart`
- Web consolidated control surface: `website/src/app/creator-studio/page.tsx`

Risk:
- Mobile may lag whenever new creator capabilities are added to web-first studio pages.

## Areas Already Close to Parity
- Auth core flows: login/register/forgot/reset
- KYC surface present
- Notifications management present (filters, select all, bulk actions, archive/delete/read/unread)
- Channel analytics route present
- Wallet withdrawal/history present
- Profile/edit/delete flows present

## Recommended Next Planning Focus (No Implementation)
1. Wave parity should be the first mobile workstream. Define the exact mobile scope for feed loading, playback model, pulse/replay/comment/bookmark interactions, moderation and age-gating behavior, viewer metrics, and creator upload entry points.
2. Channel page parity should be the second workstream. Define whether mobile will mirror the web tab system directly or use a mobile-adapted information architecture, but it must still cover About, Past Streams, Library, Waves, Schedule, and Manage-equivalent surfaces.
3. Creator Studio parity should be treated as a dedicated creator-operations track. Define the mobile target for stream source editing, validation/recheck flows, upload session management, library management, schedule management, analytics entry points, and Wave publishing from creator tools.
4. Static and legal web pages should be explicitly classified instead of remaining implicit gaps. Decide page-by-page whether each surface will be built natively in Flutter, opened in an in-app webview, or intentionally remain web-only with clear handoff UX.
5. Payment completion flow should be standardized so mobile and web do not diverge in user feedback quality. Define whether mobile will gain a dedicated result screen, a result modal, or a callback-driven confirmation flow that reaches the same clarity and recovery level as web.
6. After scope definition, produce a parity matrix grouped by domain: viewer, creator, wallet/payments, legal/static content, notifications, and challenge. Each gap should be marked as native build, embedded web handoff, or intentionally deferred.

## Detailed Planning Roadmap (No Implementation)

### Planning Guardrails
- Mobile parity work must preserve the existing premium mobile UX language and should not force web layout structure onto Flutter screens.
- Route parity is not the same as UX parity. Some web routes can map to mobile-native flows if feature coverage is equivalent and clearly documented.
- Any web-only gap must be classified explicitly as one of: native mobile build, in-app webview handoff, or intentional website-only surface.
- All parity planning should be grouped by user domain: viewer, creator, wallet/payments, legal/static, notifications, and challenge.

### Workstream 1: Wave Parity Planning
Goal: define the complete mobile Wave feature target before any implementation starts.

Planning scope:
- Mobile Wave feed entry point and navigation model
- Full-screen viewer behavior and vertical progression model
- Interaction model for pulse, replay count, comments, bookmarks, and options
- Content restriction handling: classification, blur/obfuscation, age-gating, and consent states
- Viewer metrics behavior: unique views, replay tracking, pulse state, bookmark state
- Creator entry points for Wave publishing from mobile creator tools

Key planning decisions required:
- Whether Wave becomes a top-level mobile route or is embedded behind an existing home/discovery entry point
- Whether comments and options open as bottom sheets, overlays, or dedicated screens
- Whether creator upload to Wave lives inside Creator Studio, as a standalone mobile route, or both

Required planning output:
- A Wave parity scope doc covering user flows, states, API dependencies, moderation states, and success criteria

### Workstream 2: Channel Experience Parity Planning
Goal: define how the web channel profile model translates into a mobile-native information architecture.

Planning scope:
- About content parity
- Past Streams parity
- Library surface parity
- Waves surface parity
- Schedule surface parity
- Manage surface parity for channel owners/admins

Key planning decisions required:
- Whether mobile uses tabs, segmented controls, nested screens, or section-to-screen drill-down
- Which surfaces stay on the main channel screen versus opening secondary mobile pages
- How owner/admin management tools are revealed without degrading viewer UX

Required planning output:
- A channel parity map showing each web tab and its exact mobile destination pattern

### Workstream 3: Creator Studio Parity Planning
Goal: define the creator-operational parity target instead of treating the mobile studio as only a launcher.

Planning scope:
- Stream source mode configuration
- URL validation and stream health recheck flows
- Upload session monitoring, refresh, cancel, and delete controls
- Video/library management depth
- Schedule management depth
- Analytics and live page entry points
- Wave publishing from creator workflows

Key planning decisions required:
- Whether to keep the current split mobile creator architecture and deepen it, or introduce a more consolidated mobile creator shell
- Which creator operations need in-page management versus navigation into deeper tools
- Whether `creator-studio/library` should become a first-class mobile creator route or remain embedded inside upload/library management

Required planning output:
- A creator parity operations matrix with each web capability mapped to a mobile destination and ownership flow

### Workstream 4: Static and Legal Surface Classification
Goal: resolve all current static/legal route gaps with explicit product decisions.

Web surfaces currently needing classification:
- `/about`
- `/careers`
- `/contact`
- `/cookies`
- `/copyright`
- `/download`
- `/press`
- `/pricing`
- `/refund`
- `/report-copyright`
- `/updates`
- `/aml`

Planning decisions required for each:
- Native Flutter page
- In-app webview handoff
- External browser handoff
- Intentional website-only surface

Required planning output:
- A page-by-page classification table with rationale and final mobile behavior

### Workstream 5: Payments and Checkout Result Parity Planning
Goal: standardize post-payment completion UX between web and mobile.

Planning scope:
- Deep-link callback behavior after payment success/failure
- Confirmation state visibility
- Retry/recovery behavior
- User messaging clarity
- Return-to-origin navigation behavior

Key planning decisions required:
- Dedicated mobile result screen versus modal versus callback-driven toast/banner flow
- How the flow behaves on cold start, warm start, and interrupted app resume

Required planning output:
- A payment-result parity flow diagram covering success, failure, canceled payment, and unknown verification state

### Workstream 6: Final Parity Matrix and Delivery Sequencing
Goal: convert the planning outputs above into a single execution-ready parity map.

Matrix dimensions:
- Domain
- Web source surface
- Current mobile state
- Gap type
- Planned mobile target
- Delivery mode: native, webview handoff, or deferred
- Priority: critical, high, medium, low

Recommended delivery order:
1. Wave parity
2. Channel experience parity
3. Creator Studio parity
4. Payments/checkout result parity
5. Static/legal surface classification and handoff decisions
6. Final cross-domain parity matrix publication

### Minimum Planning Deliverables Before Any Mobile Parity Implementation
- A Wave planning document
- A channel experience parity map
- A creator operations parity map
- A static/legal classification table
- A payment completion parity decision record
- A master parity matrix with delivery order and priority labels

## Proceeding Plan: Execution Kickoff (Planning-Only)

### Step 1: 48-Hour Planning Kickoff Checklist
- [ ] Confirm two-person governance model (User = Product/Decision Owner, Copilot = Planning/Execution Support)
- [ ] Confirm workstream sequence lock: Wave -> Channel -> Creator Studio -> Payments -> Static/Legal -> Matrix publish
- [ ] Freeze parity baseline references for this cycle:
	- web pages: 50
	- mobile named routes: 43
- [ ] Approve mobile-first constraint: parity by capability, not forced web layout cloning
- [ ] Approve route-classification policy: native vs webview handoff vs intentionally web-only
- [ ] Open one planning ticket per workstream with explicit decision due dates

### Step 2: Workstream Planning Tickets (No Build)

#### WS-01 Wave Parity Planning Ticket
Owner: User + Copilot
Definition of ready:
- [x] Feed model selected
- [x] Interaction model selected (pulse/replay/comments/bookmark/options)
- [x] Restriction/moderation behavior defined
- [x] Creator Wave publish entry points defined
- [x] Success/error/empty/loading states listed

#### WS-02 Channel Experience Planning Ticket
Owner: User + Copilot
Definition of ready:
- [x] About/Past Streams/Library/Waves/Schedule/Manage mapping approved
- [x] Mobile IA pattern chosen (tabs/segmented/drill-down)
- [x] Owner/admin management reveal model approved
- [x] Navigation map and deep links defined

## Phase 0 Execution Addendum

### P0-01 Wave Non-Happy Paths Finalization

Restriction and moderation behavior (locked):
- Age-restricted Wave items: show blurred poster frame with "18+" badge, policy reason, and explicit continue action.
- Region/compliance-restricted items: block playback and show non-retryable compliance state with support entry.
- Moderated/removed items: preserve feed position but render unavailable tile with reason code and next-item action.
- Pending moderation items: creator sees pending state and cannot publicly share until approved.
- Repeat policy offenses: throttle interaction mutations and show temporary action lock state.

Wave state contract (required for mobile implementation):
- Loading state:
	- First load skeleton stack with shimmer and disabled interactions.
	- Next-page load footer spinner without collapsing current feed.
- Success state:
	- Playback starts only after media readiness check.
	- Interaction counters and toggles hydrate from authoritative server state.
- Empty state:
	- "No Waves yet" message, pull-to-refresh, and creator CTA when user has creator permissions.
- Error state:
	- Network/timeout: retry action and offline hint.
	- 401/403: auth recovery or policy message based on response code.
	- 5xx: generic transient error with retry and report issue action.
- Disabled state:
	- Interaction buttons disabled while mutation in-flight or account action-locked.

### P0-02 Channel Owner/Admin Reveal and Deep-Link Finalization

Owner/admin reveal model (locked):
- Viewer baseline: About, Past Streams, Library, Waves, Schedule sections visible.
- Owner/admin elevated surface:
	- Manage entry revealed only when authenticated user is channel owner/admin.
	- Manage entry appears as contextual action in segmented header plus overflow menu duplicate.
	- Unauthorized direct access to manage destination returns guarded fallback with "insufficient permissions" and back action.

Channel deep-link and navigation map (locked):
- Canonical entry: `/channel-view` with required `channelId` argument.
- Section query/deep-link contract:
	- `/channel-view?channelId={id}&section=about`
	- `/channel-view?channelId={id}&section=past-streams`
	- `/channel-view?channelId={id}&section=library`
	- `/channel-view?channelId={id}&section=waves`
	- `/channel-view?channelId={id}&section=schedule`
	- `/channel-view?channelId={id}&section=manage` (owner/admin only)
- Drill-down destinations:
	- Library item: `/channel-library-item?channelId={id}&itemId={itemId}`
	- Past stream detail: `/channel-player` with `channelId` and `streamId`
	- Schedule detail: `/schedule-view` with `channelId` and optional `scheduleId`
	- Manage tools: `/creator-studio` with `channelId` context
- Invalid section behavior:
	- Unknown section falls back to `about` and emits analytics event `channel_section_fallback_invalid`.

Completion note:
- P0-01 and P0-02 planning deliverables are now complete and unblocked for Phase 1 execution.

### P0-03 Analytics and Alert Contract Freeze

Event schema baseline (locked before Phase 1 build):
- Required global event envelope:
	- `event_name` (string)
	- `event_version` (string, start at `v1`)
	- `timestamp_ms` (number)
	- `platform` (`mobile` or `web`)
	- `app_version` (string)
	- `user_id` (nullable string)
	- `session_id` (string)
	- `trace_id` (string; required for payment callback to result resolution)
	- `surface` (string; example: `wave_feed`, `channel_shell`, `checkout_result`)

Frozen parity event set:
- Wave domain:
	- `wave_entry_opened`
	- `wave_feed_load_started`
	- `wave_feed_load_succeeded`
	- `wave_feed_load_failed`
	- `wave_interaction_submitted` (property: `interaction_type` = pulse/replay/comment/bookmark)
	- `wave_interaction_failed`
	- `wave_age_gate_presented`
	- `wave_age_gate_accepted`
	- `wave_age_gate_denied`
- Channel domain:
	- `channel_surface_opened`
	- `channel_section_viewed` (property: `section`)
	- `channel_manage_entry_shown`
	- `channel_manage_entry_blocked`
	- `channel_section_fallback_invalid`
- Creator/library domain:
	- `creator_library_opened`
	- `creator_upload_session_action` (property: refresh/cancel/delete)
	- `creator_upload_session_failed`
- Payments domain:
	- `checkout_result_opened`
	- `checkout_result_state_resolved` (property: success/failed/canceled/pending/unknown)
	- `checkout_result_retry_verification`
	- `checkout_result_resolution_failed`
- Legal/static domain:
	- `static_webview_opened`
	- `static_webview_failed`
	- `static_external_handoff_opened`

Alert thresholds baseline (locked):
- `wave_feed_load_failed_rate`:
	- Warn: > 5% over 15 minutes
	- Critical: > 10% over 15 minutes
- `wave_interaction_failed_rate`:
	- Warn: > 3% over 15 minutes
	- Critical: > 6% over 15 minutes
- `checkout_result_resolution_failed_rate`:
	- Warn: > 2% over 15 minutes
	- Critical: > 4% over 15 minutes
- `checkout_pending_verification_stuck_count`:
	- Warn: >= 25 unresolved for > 10 minutes
	- Critical: >= 75 unresolved for > 10 minutes
- `channel_manage_entry_blocked_spike`:
	- Warn: > 2x baseline for 30 minutes
	- Critical: > 4x baseline for 30 minutes
- `static_webview_failed_rate`:
	- Warn: > 3% over 30 minutes
	- Critical: > 6% over 30 minutes

Ownership and operations (locked):
- Product analytics owner: User
- Implementation and instrumentation owner: Copilot
- Review cadence:
	- Daily during Phase 1 rollout window
	- Weekly after stabilization
- Change control:
	- Any schema or threshold change requires tracker update and explicit decision-log entry before rollout.

Completion note:
- P0-03 deliverable is now complete and Phase 0 is fully closed.

#### WS-03 Creator Studio Planning Ticket
Owner: User + Copilot
Definition of ready:
- [x] Stream source editing target defined
- [x] Upload session controls target defined
- [x] Library/schedule/analytics parity target defined
- [x] Wave publishing from creator tools target defined

#### WS-04 Static and Legal Classification Ticket
Owner: User + Copilot
Definition of ready:
- [x] Every web-only static/legal page classified
- [x] Delivery mode per page approved (native/webview/external/web-only)
- [x] Handoff UX copy requirement approved

#### WS-05 Payments Result Parity Ticket
Owner: User + Copilot
Definition of ready:
- [x] Result UX model approved (screen/modal/callback)
- [x] Cold start/warm start/interrupted resume behavior defined
- [x] Failure/retry/unknown verification handling defined

#### WS-06 Final Parity Matrix Ticket
Owner: User + Copilot
Definition of ready:
- [x] All gaps mapped and classified
- [x] Priority levels assigned
- [x] Delivery sequencing approved
- [x] Deferred items explicitly tagged with rationale

## Decision Log (Planning)

| ID | Domain | Decision | Options Considered | Final Choice | Owner | Date | Notes |
|---|---|---|---|---|---|---|---|
| DEC-001 | Wave | Mobile Wave entry model | Top-level route / embedded entry / hybrid | Hybrid | User + Copilot | 2026-05-27 | Primary top-level mobile Wave route plus creator entry from Creator Studio |
| DEC-002 | Channel | Channel IA pattern | Tabs / segmented / drill-down | Segmented + drill-down hybrid | User + Copilot | 2026-05-27 | Keep mobile-native structure while preserving About/Streams/Library/Waves/Schedule/Manage capability coverage |
| DEC-003 | Creator | Creator Studio architecture | split-deepened / consolidated shell | Split-deepened | User + Copilot | 2026-05-27 | Preserve current mobile split architecture and deepen feature completeness rather than forcing a monolithic shell |
| DEC-004 | Legal | Static/legal delivery mode | native / in-app webview / web-only | In-app webview primary + selective web-only | User + Copilot | 2026-05-27 | Keep velocity by using in-app webview handoff for most legal/static pages and keep career/press as website-only |
| DEC-005 | Payments | Checkout result UX | screen / modal / callback-only enhanced | Dedicated result screen + callback fallback | User + Copilot | 2026-05-27 | Standardize outcome clarity with a first-class result screen while retaining deep-link callback as resilience path |

## Solo-Team Operating Mode (User + Copilot)
- Decision flow: you make final product calls; I translate them into structured plans, trackers, and execution steps.
- Cadence: one workstream at a time, with explicit sign-off before moving to the next.
- Scope discipline: no parallel implementation tracks until the active workstream planning checklist is complete.
- Evidence standard: each decision must map to a concrete gap row in the parity matrix.
- Completion standard: a workstream is only "planned complete" when its Definition of Ready checklist is fully checked.

## Master Parity Matrix (Expanded)

| Domain | Web Surface | Current Mobile State | Gap Type | Planned Mobile Target | Delivery Mode | Priority | Status |
|---|---|---|---|---|---|---|---|
| Viewer | `/wave` | Missing route/screen | Missing feature | Top-level Wave route + creator Wave publish entry from Creator Studio | Native | Critical | Decision Locked |
| Viewer | Channel tabs (`About/Streams/Library/Waves/Schedule/Manage`) | Single long-form channel view | IA mismatch | Segmented channel shell with drill-down destinations for each tab-equivalent surface | Native | Critical | Decision Locked |
| Creator | `/creator-studio/library` | No route-equivalent | Missing feature | Keep split mobile Creator Studio and add dedicated library-management surface plus deep links from creator hub | Native | High | Decision Locked |
| Viewer | `/channel/[id]/library/[itemId]` | No dedicated library item reading surface | Missing feature | Add mobile library item reading destination linked from channel library section | Native | High | Planned |
| Challenge | `/challenge/rules` | No dedicated rules route | Missing route-level surface | Add challenge rules destination from challenge flow | Native | Medium | Planned |
| Payments | `/checkout/result` | Deep-link callback only | UX parity gap | Dedicated payment result screen with callback-driven resume fallback | Native | High | Decision Locked |
| Wallet | `/wallet/convert` | Function exists in embedded wallet flow, not route-equivalent | Route parity delta | Keep embedded conversion UX and expose explicit entry path inside wallet | Native | Medium | Planned |
| Wallet | `/wallet/transactions` | Activity appears embedded in digital assets screen | Route parity delta | Keep embedded ledger model with direct transactions shortcut in wallet shell | Native | Medium | Planned |
| Viewer | `/live/[id]` | Uses `/channel-player` pathway | Route naming delta | Keep current mobile watch destination as canonical equivalent | Native | Low | Intentionally Platform-Specific |
| Legal/Static | `/about` | Unclassified previously | Classification gap | In-app webview handoff | In-app webview | Medium | Decision Locked |
| Legal/Static | `/contact` | Unclassified previously | Classification gap | In-app webview handoff | In-app webview | Medium | Decision Locked |
| Legal/Static | `/cookies` | Unclassified previously | Classification gap | In-app webview handoff | In-app webview | Medium | Decision Locked |
| Legal/Static | `/copyright` | Unclassified previously | Classification gap | In-app webview handoff | In-app webview | Medium | Decision Locked |
| Legal/Static | `/download` | Unclassified previously | Classification gap | In-app webview handoff | In-app webview | Low | Decision Locked |
| Legal/Static | `/pricing` | Unclassified previously | Classification gap | In-app webview handoff (subscription actions remain native) | In-app webview | Medium | Decision Locked |
| Legal/Static | `/refund` | Unclassified previously | Classification gap | In-app webview handoff | In-app webview | Medium | Decision Locked |
| Legal/Static | `/report-copyright` | Unclassified previously | Classification gap | In-app webview handoff | In-app webview | Medium | Decision Locked |
| Legal/Static | `/updates` | Unclassified previously | Classification gap | In-app webview handoff | In-app webview | Low | Decision Locked |
| Legal/Static | `/aml` | Unclassified previously | Classification gap | In-app webview handoff | In-app webview | Medium | Decision Locked |
| Legal/Static | `/careers` | No in-app equivalent | Intentional platform difference | Keep website-only with external browser handoff from mobile if surfaced | Web-only | Low | Decision Locked |
| Legal/Static | `/press` | No in-app equivalent | Intentional platform difference | Keep website-only with external browser handoff from mobile if surfaced | Web-only | Low | Decision Locked |
| Challenge | Mobile "Challenge Coming Soon" fallback | Shows empty-cycle fallback state | At-risk behavior parity | Keep fallback but require explicit copy/version alignment checks per release | Native | Medium | Planned |

Deferred items (explicit):
- None currently deferred. All known gaps are classified as Planned, Decision Locked, or Intentionally Platform-Specific.

## Static and Legal Route Classification (DEC-004)

| Web Route | Classification | Planned Mobile Behavior | Notes |
|---|---|---|---|
| `/about` | In-app webview | Open inside app webview container | Preserve brand storytelling without native build overhead |
| `/contact` | In-app webview | Open inside app webview container | Keep support/contact form behavior consistent with web |
| `/cookies` | In-app webview | Open inside app webview container | Legal copy parity via single web source |
| `/copyright` | In-app webview | Open inside app webview container | Policy parity via web-managed content |
| `/download` | In-app webview | Open inside app webview container | Keep cross-platform download messaging centralized |
| `/pricing` | In-app webview | Open inside app webview container | Pricing messaging parity while subscription UX remains native |
| `/refund` | In-app webview | Open inside app webview container | Legal process remains web-authored |
| `/report-copyright` | In-app webview | Open inside app webview container | Maintain legal workflow parity with minimal mobile overhead |
| `/updates` | In-app webview | Open inside app webview container | Content updates remain CMS/web managed |
| `/aml` | In-app webview | Open inside app webview container | Compliance content parity via web source |
| `/careers` | Web-only | External browser handoff | Recruitment funnel intentionally outside core in-app user journey |
| `/press` | Web-only | External browser handoff | Corporate/PR surface intentionally website-first |

Handoff copy standard for in-app webview entries:
- Title: "Opening secure web page"
- Subtitle: "This page is maintained on afrovision.online for policy and content accuracy."
- Fallback action: "Open in browser"

## Payment Outcome UX Model (DEC-005)

Chosen model: dedicated mobile result screen with callback fallback.

Behavior definition:
- Primary path: payment returns to a dedicated result screen with explicit states: success, failed, canceled, pending verification, and unknown.
- Cold start: deep link boots app and routes directly to the result screen with verification check.
- Warm start: deep link routes to result screen without dropping prior navigation context.
- Interrupted resume: app resumes to verification re-check and then lands on result screen.
- Fallback: if callback data is incomplete, show pending verification with retry and support actions.

Required result-screen actions:
- Retry verification
- Return to originating flow
- Open wallet/transaction context
- Contact support path

## Immediate Sequencing for Next Planning Review
1. Completed: Wave planning workshop and DEC-001 locked.
2. Completed: Channel IA workshop and DEC-002 locked.
3. Completed: Creator tools scope session and DEC-003 locked.
4. Completed: Static/legal classification and DEC-004 locked.
5. Completed: Payment outcome UX decision and DEC-005 locked.
6. Completed: fully expanded parity matrix published for all currently known gap items.

## All-Phase Implementation Ticket Pack
- Generated tracker: `mobile-parity-all-phases-end-to-end-implementation-tracker.md`
- Scope: all matrix rows mapped into phased implementation tickets (P0 to P5) with dependencies and release gates.

---
Report generated from repository scan on May 27, 2026.
