# Website vs Mobile Full Discrepancy Report

## Scope
This is a full cross-platform discrepancy audit (not limited to audition).

## Implementation Directive (Read First)
1. Do not force website structural design onto mobile.
2. Do not align mobile pagination to website pagination.
3. Keep mobile pagination exactly as-is (PageView/swipe/dots behavior stays).
4. Keep mobile's sophisticated design language, structural arrangement, premium component styling, and brand color system.
5. Implementation target: add missing website features/functions to mobile while preserving mobile UX architecture.
6. Any discrepancy that is purely layout/structure/presentation-pattern difference is informational unless it blocks feature parity.

## Final Unbendable Instruction (Warning)
1. This execution is mobile-facing only.
2. The following services are forbidden from edits, changes, or tampering for the entirety of this fix program:
- website/
- admin/
- backend/
3. If a change is needed in any forbidden service, do not implement it. Document the need only under "Forbidden-Service Change Request Log" in this file.
4. Forbidden-service changes require explicit user review and approval before any implementation.
5. Autopilot mode is strictly forbidden from approving forbidden-service changes.
6. Autopilot approvals are valid only for mobile-app related changes.
7. Keep edits tightly scoped to the exact mobile page/screen/function being worked on; do not disrupt unrelated mobile areas.

## Enforcement Hook (Active Policy Guard)
Hook file:
- .githooks/pre-commit
- .githooks/pre-push

Activation:
1. git config core.hooksPath .githooks

What it blocks:
1. Any staged change under website/, admin/, or backend/.
2. Any out-of-scope staged mobile changes when strict scope mode is enabled via .mobile-scope-allowlist.txt.
3. Any push containing website/, admin/, or backend/ file changes.

Strict scope mode:
1. Fill .mobile-scope-allowlist.txt with one approved mobile file/path prefix per line.
2. During commit, any staged file outside those prefixes is blocked.

Operational rule:
1. Do not bypass hook checks.
2. If blocked due to forbidden services, add a documentation entry in the log below and request explicit user approval.

## Forbidden-Service Change Request Log
Use this section to record needed website/admin/backend changes without implementing them.

| ID | Date | Requested by | Service | File/Area | Reason | Proposed Change (No Implementation) | User Approval Status |
|---|---|---|---|---|---|---|---|
| FSR-001 | TBD | TBD | TBD | TBD | TBD | TBD | Pending |

## Phase Execution Plan

Status legend:
- [ ] Not started
- [~] In progress
- [x] Completed
- [!] Blocked

### Phase 0 - Guardrails and Baseline
Goal: lock the implementation rules so feature parity work does not regress mobile UX architecture.

Completion tracker:
- [ ] P0.1 Confirm team alignment on "feature/function parity only" scope
- [ ] P0.2 Confirm "mobile pagination stays as-is" as non-negotiable requirement
- [ ] P0.3 Confirm "no website structural cloning" requirement in implementation tickets
- [ ] P0.4 Freeze baseline route parity snapshot (46 web / 42 mobile)
- [ ] P0.5 Enable and validate pre-commit policy guard (.githooks/pre-commit)
- [ ] P0.6 Define active mobile scope in .mobile-scope-allowlist.txt for each work item

Exit criteria:
- All downstream tasks reference this directive.
- No task requests replacing mobile PageView pagination with website-style pagination.
- Commits are blocked automatically for website/admin/backend staged changes.

### Phase 1 - Channels and Channel List Feature Parity
Goal: implement website channel-list capabilities missing on mobile without changing mobile structure.

Completion tracker:
- [ ] P1.1 Add category taxonomy loading in mobile channel list flow
- [ ] P1.2 Add category filtering controls using existing premium mobile component patterns
- [ ] P1.3 Add owner identity display behavior parity (hide_owner, brand_only, by-name)
- [ ] P1.4 Add private channel access by channel number in mobile UX pattern
- [ ] P1.5 Add followers count visibility in mobile channel cards/details where appropriate
- [ ] P1.6 Keep bottom-sheet search modal unchanged
- [ ] P1.7 Keep PageView swipe/dot pagination unchanged

Exit criteria:
- All missing website channel features are available on mobile.
- Mobile layout hierarchy and pagination behavior remain unchanged.

### Phase 2 - Watch/Live Feature Parity
Goal: add missing website watch capabilities to mobile player experience using mobile-native premium UI structure.

Completion tracker:
- [ ] P2.1 Add follow/unfollow capability in mobile watch flow
- [ ] P2.2 Add live followers count display in mobile watch flow
- [ ] P2.3 Add channel-view recording parity behavior for analytics where missing
- [ ] P2.4 Add channel surfer access flow inside/alongside player using mobile-native presentation
- [ ] P2.5 Preserve existing mobile overlays (gift, flash, ad-break, timer)

Exit criteria:
- Mobile watch supports all target website watch features.
- Existing mobile premium player structure and overlays remain intact.

### Phase 3 - Channel Surfer Capability Parity
Goal: bring website channel surfer functions to mobile without reproducing website panel layout.

Completion tracker:
- [ ] P3.1 Add quick next/previous channel switching capability
- [ ] P3.2 Add surfer list/grid style browsing capability in mobile interaction pattern
- [ ] P3.3 Add pending/loading state parity for channel switching
- [ ] P3.4 Validate surfer feature works from live watch entry points

Exit criteria:
- Channel surfer functional parity achieved on mobile.
- UI remains consistent with mobile design system and interaction conventions.

### Phase 4 - Creator Studio Capability Parity
Goal: close capability gaps between website creator studio and mobile creator flows.

Completion tracker:
- [ ] P4.1 Add multi-upload queue capability on mobile creator side
- [ ] P4.2 Add sequential scheduling capability parity
- [ ] P4.3 Add bulk-selection and bulk-delete operations parity
- [ ] P4.4 Add external stream source configure/recheck capabilities parity
- [ ] P4.5 Preserve mobile's split-screen studio architecture where desired

Exit criteria:
- Feature parity reached for creator operations.
- Mobile structural arrangement remains premium and mobile-native.

### Phase 5 - Route and Naming Parity Decisions
Goal: resolve route/naming mismatches based on product intent, not forced URL symmetry.

Completion tracker:
- [ ] P5.1 Review web-only routes and classify: required on mobile / web-only by intent
- [ ] P5.2 Review mobile-only routes and classify: mobile-only / cross-platform candidate
- [ ] P5.3 Resolve conceptual naming mismatches (privacy, referral(s), edit/delete profile)
- [ ] P5.4 Publish final parity map of "implemented", "intentionally platform-specific", "deferred"

Exit criteria:
- Platform differences are explicitly intentional and documented.
- No accidental missing critical user flows remain.

### Phase 6 - Challenge Copy and Micro-Parity Cleanup
Goal: finish strict copy-level parity items where required.

Completion tracker:
- [ ] P6.1 Resolve spot/slot wording decision and apply consistently
- [ ] P6.2 Reconcile missing thank-you clause and email guidance phrasing
- [ ] P6.3 Reconcile watch-this-space and journey micro-copy deltas
- [ ] P6.4 Verify final copy parity matrix for challenge audition states

Exit criteria:
- Approved challenge copy parity achieved at required strictness level.

## Master Completion Tracker

| Phase | Name | Owner | Status | Progress | Target Date | Notes |
|---|---|---|---|---|---|---|
| 0 | Guardrails and Baseline | Unassigned | [ ] Not started | 0% | TBD | Directive lock |
| 1 | Channels and Channel List | Unassigned | [ ] Not started | 0% | TBD | Keep mobile pagination |
| 2 | Watch/Live | Unassigned | [ ] Not started | 0% | TBD | Preserve mobile overlays |
| 3 | Channel Surfer | Unassigned | [ ] Not started | 0% | TBD | Mobile-native surfer UX |
| 4 | Creator Studio | Unassigned | [ ] Not started | 0% | TBD | Capability parity only |
| 5 | Route/Naming Decisions | Unassigned | [ ] Not started | 0% | TBD | Intentional platform deltas |
| 6 | Challenge Copy Cleanup | Unassigned | [ ] Not started | 0% | TBD | Strict copy pass |

## Weekly Update Block (Fill During Execution)

- Week of: YYYY-MM-DD
- Overall status: [ ] Not started [~] In progress [x] Completed [!] Blocked
- Completed this week:
	- 
- In progress:
	- 
- Blockers:
	- 
- Next week focus:
	- 

Compared surfaces include:
- Route coverage and entry points (website app routes vs mobile registered routes)
- Channels / channel list
- Watch / live viewing flow
- Channel surfer
- Creator studio and related channel operations
- Challenge audition (prior section retained and expanded context)

Main sources:
- Website app routes in [website/src/app](website/src/app)
- Mobile routes in [lib/main.dart](lib/main.dart#L96)
- Watch flow in [website/src/app/live/[id]/LiveStream.tsx](website/src/app/live/%5Bid%5D/LiveStream.tsx) and [lib/features/broadcast/screens/channel_player_screen.dart](lib/features/broadcast/screens/channel_player_screen.dart)
- Channels flow in [website/src/app/channels/page.tsx](website/src/app/channels/page.tsx) and [lib/features/channel/screens/channel_list_screen.dart](lib/features/channel/screens/channel_list_screen.dart)
- Creator studio flow in [website/src/app/creator-studio/page.tsx](website/src/app/creator-studio/page.tsx) and [lib/features/channel/screens/creator_studio_screen.dart](lib/features/channel/screens/creator_studio_screen.dart)
- Channel surfer in [website/src/components/ChannelSurfer.tsx](website/src/components/ChannelSurfer.tsx)

## Route Coverage Discrepancies

Counts:
- Website routes discovered: 46
- Mobile routes registered: 42
- Website-only routes: 29
- Mobile-only routes: 25

### Website-only routes (no direct mobile route with same path)
1. /
2. /about
3. /admin
4. /aml
5. /careers
6. /challenge/rules
7. /channel/[id]
8. /checkout/result
9. /contact
10. /cookies
11. /copyright
12. /download
13. /leaderboard
14. /live
15. /live/[id]
16. /press
17. /pricing
18. /privacy
19. /profile/delete-account
20. /profile/edit
21. /referrals
22. /refund
23. /report-copyright
24. /updates
25. /wallet
26. /wallet/convert
27. /wallet/transactions
28. /wallet/withdrawal
29. /wallet/withdrawal/history

### Mobile-only routes (no direct website route with same path)
1. /add-bank-account
2. /admin-panel
3. /channel-access
4. /channel-player
5. /channel-view
6. /checkout
7. /creator-subscription
8. /delete-account
9. /digital-assets
10. /edit-channel
11. /edit-profile
12. /gift-wallet
13. /home
14. /plans
15. /premium-stream
16. /privacy-policy
17. /referral
18. /reminders
19. /reputation
20. /reputation/leaderboard
21. /schedule
22. /splash
23. /video-upload
24. /withdrawal-history
25. /withdrawals

### Naming mismatches for conceptually similar routes
1. /privacy (website) vs /privacy-policy (mobile)
2. /referrals (website) vs /referral (mobile)
3. /profile/edit (website) vs /edit-profile (mobile)
4. /profile/delete-account (website) vs /delete-account (mobile)
5. /live/[id] (website) vs /channel-player (mobile)
6. /wallet/withdrawal (website) vs /withdrawals (mobile)
7. /wallet/withdrawal/history (website) vs /withdrawal-history (mobile)

## Channels / Channel List Discrepancies

### Website has features not present in mobile channel list
1. Category taxonomy loading and category-chip filtering on list page
- Evidence: [website/src/app/channels/page.tsx](website/src/app/channels/page.tsx#L8), [website/src/app/channels/page.tsx](website/src/app/channels/page.tsx#L45)

2. Owner identity display logic (hide_owner, brand_only, by-name prefix)
- Evidence: [website/src/app/channels/page.tsx](website/src/app/channels/page.tsx#L15), [website/src/app/channels/page.tsx](website/src/app/channels/page.tsx#L20)

3. Private channel access form block with typed channel-number input and auth-aware helper copy
- Evidence: [website/src/app/channels/page.tsx](website/src/app/channels/page.tsx#L129)

4. Explicit search scope text includes creator metadata
- Evidence: [website/src/app/channels/page.tsx](website/src/app/channels/page.tsx#L160)

5. Followers count rendered on every channel card
- Evidence: [website/src/app/channels/page.tsx](website/src/app/channels/page.tsx#L242)

### Mobile has intentional list behavior differences (keep as-is)
1. Dedicated bottom-sheet search modal experience
- Evidence: [lib/features/channel/screens/channel_list_screen.dart](lib/features/channel/screens/channel_list_screen.dart#L72), [lib/features/channel/screens/channel_list_screen.dart](lib/features/channel/screens/channel_list_screen.dart#L557)

2. PageView-based pagination UX (swipe pages + dot indicators) instead of classic numbered pager
- Evidence: [lib/features/channel/screens/channel_list_screen.dart](lib/features/channel/screens/channel_list_screen.dart#L276)
- Decision: preserve this mobile pagination pattern; this is not a parity bug and should not be replaced with website pagination.

3. Empty-state copy differs
- Website: “No public channels matched your search.” in [website/src/app/channels/page.tsx](website/src/app/channels/page.tsx#L212)
- Mobile: “No channels yet” in [lib/features/channel/screens/channel_list_screen.dart](lib/features/channel/screens/channel_list_screen.dart#L212)

## Watch / Live Discrepancies

### Website watch flow capabilities not mirrored in mobile player
1. Multi-tab right-side panel architecture (channels/chat/gifts)
- Evidence: [website/src/app/live/[id]/LiveStream.tsx](website/src/app/live/%5Bid%5D/LiveStream.tsx#L47), [website/src/app/live/[id]/LiveStream.tsx](website/src/app/live/%5Bid%5D/LiveStream.tsx#L720)

2. Follow/unfollow channel control with live followers count in watch UI
- Evidence: [website/src/app/live/[id]/LiveStream.tsx](website/src/app/live/%5Bid%5D/LiveStream.tsx#L34), [website/src/app/live/[id]/LiveStream.tsx](website/src/app/live/%5Bid%5D/LiveStream.tsx#L418), [website/src/app/live/[id]/LiveStream.tsx](website/src/app/live/%5Bid%5D/LiveStream.tsx#L631)

3. Explicit recordChannelView API call in web watch load path
- Evidence: [website/src/app/live/[id]/LiveStream.tsx](website/src/app/live/%5Bid%5D/LiveStream.tsx#L43), [website/src/app/live/[id]/LiveStream.tsx](website/src/app/live/%5Bid%5D/LiveStream.tsx#L231)

4. Channel surfer rendered as a right panel module in watch page
- Evidence: [website/src/app/live/[id]/LiveStream.tsx](website/src/app/live/%5Bid%5D/LiveStream.tsx#L758)

### Mobile watch flow capabilities not mirrored in website watch page
1. In-player fullscreen gift panel rendered in-tree
- Evidence: [lib/features/broadcast/screens/channel_player_screen.dart](lib/features/broadcast/screens/channel_player_screen.dart#L1910)

2. Explicit flash overlay and ad-break overlay widgets inside player tree
- Evidence: [lib/features/broadcast/screens/channel_player_screen.dart](lib/features/broadcast/screens/channel_player_screen.dart#L1407), [lib/features/broadcast/screens/channel_player_screen.dart](lib/features/broadcast/screens/channel_player_screen.dart#L1419)

3. Embedded timer overlay inside player
- Evidence: [lib/features/broadcast/screens/channel_player_screen.dart](lib/features/broadcast/screens/channel_player_screen.dart#L809), [lib/features/broadcast/screens/channel_player_screen.dart](lib/features/broadcast/screens/channel_player_screen.dart#L1428)

## Channel Surfer Discrepancies

1. Website has a dedicated, reusable ChannelSurfer component with:
- overlay mode
- sidebar mode
- prev/next channel controls
- list drawer and grid selector
- pending channel state
- Evidence: [website/src/components/ChannelSurfer.tsx](website/src/components/ChannelSurfer.tsx#L11), [website/src/components/ChannelSurfer.tsx](website/src/components/ChannelSurfer.tsx#L31), [website/src/components/ChannelSurfer.tsx](website/src/components/ChannelSurfer.tsx#L196)

2. Mobile has no dedicated channel-surfer component or equivalent import in watch player.
- Evidence by import set in mobile watch screen: [lib/features/broadcast/screens/channel_player_screen.dart](lib/features/broadcast/screens/channel_player_screen.dart#L1)
- Channel switching is route-driven from list/search, not in-player surfer UI.

## Creator Studio Discrepancies

### Website creator studio has advanced integrated tooling not present in mobile creator studio page
1. Multi-upload queue state and sequential upload orchestration
- Evidence: [website/src/app/creator-studio/page.tsx](website/src/app/creator-studio/page.tsx#L130), [website/src/app/creator-studio/page.tsx](website/src/app/creator-studio/page.tsx#L325)

2. Bulk selection states for videos and programs, plus bulk deletions
- Evidence: [website/src/app/creator-studio/page.tsx](website/src/app/creator-studio/page.tsx#L152), [website/src/app/creator-studio/page.tsx](website/src/app/creator-studio/page.tsx#L517)

3. In-page external stream source configuration and health recheck
- Evidence: [website/src/app/creator-studio/page.tsx](website/src/app/creator-studio/page.tsx#L21), [website/src/app/creator-studio/page.tsx](website/src/app/creator-studio/page.tsx#L693), [website/src/app/creator-studio/page.tsx](website/src/app/creator-studio/page.tsx#L710)

4. Unified in-page schedule operations (single and sequential) with direct API calls
- Evidence: [website/src/app/creator-studio/page.tsx](website/src/app/creator-studio/page.tsx#L422), [website/src/app/creator-studio/page.tsx](website/src/app/creator-studio/page.tsx#L456), [website/src/app/creator-studio/page.tsx](website/src/app/creator-studio/page.tsx#L484)

### Mobile creator studio is split across separate screens and has different management semantics
1. Creator studio acts as a channel launcher/manager linking out to videos/schedule/analytics screens
- Evidence: [lib/features/channel/screens/creator_studio_screen.dart](lib/features/channel/screens/creator_studio_screen.dart#L383), [lib/features/channel/screens/creator_studio_screen.dart](lib/features/channel/screens/creator_studio_screen.dart#L388), [lib/features/channel/screens/creator_studio_screen.dart](lib/features/channel/screens/creator_studio_screen.dart#L399), [lib/features/channel/screens/creator_studio_screen.dart](lib/features/channel/screens/creator_studio_screen.dart#L414)

2. Enable/disable logic uses delete-or-enable route at channel level in studio list actions
- Evidence: [lib/features/channel/screens/creator_studio_screen.dart](lib/features/channel/screens/creator_studio_screen.dart#L54), [lib/features/channel/screens/creator_studio_screen.dart](lib/features/channel/screens/creator_studio_screen.dart#L59), [lib/features/channel/screens/creator_studio_screen.dart](lib/features/channel/screens/creator_studio_screen.dart#L61)

3. No integrated external source editor block in creator studio screen
- Evidence: imports/state in [lib/features/channel/screens/creator_studio_screen.dart](lib/features/channel/screens/creator_studio_screen.dart#L1)

## Challenge Audition (already reported previously, retained)

The post-audition copy mismatches previously documented still apply, including:
1. spot vs slot wording
2. missing “as a thank-you for signing up” phrase on mobile
3. shorter email guidance on mobile
4. several phrase-level differences in watch-this-space cards and journey steps

Primary evidence:
- [website/src/app/challenge/audition/page.tsx](website/src/app/challenge/audition/page.tsx)
- [lib/features/challenge/screens/challenge_audition_screen.dart](lib/features/challenge/screens/challenge_audition_screen.dart)

## Important Clarification

This report now covers full surface-level parity for the areas you explicitly called out (channels, creator studio, watch/live, channel surfer, channel list) plus route-level product coverage.

Delivery intent for implementation work:
1. Prioritize missing feature/function parity from website to mobile.
2. Do not copy website layout structure into mobile.
3. Preserve mobile premium UI system (existing spacing, component hierarchy, animations, and brand colors) while adding capability.

If you want an even stricter pass (single-character copy diffs) across every overlapping screen route-by-route, I can generate a second markdown appendix with per-screen literal string deltas for all shared paths.