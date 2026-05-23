# AfroVision Live Streaming and Challenge Audition Implementation Tickets

## Scope

This document breaks the approved implementation phases into ticket-sized tasks for delivery across the Flutter app, backend, website, and admin surfaces.

Workstreams covered:

- External link-based channel streaming for creators and imported channels.
- YouTube Live linking as the first real-time streaming bridge.
- Free-to-air channel import using direct playback links.
- Public versus auth-gated Challenge page split.
- Paid audition signup flow with payment, vPT allocation, segmented participant capture, and acknowledgement email readiness.

## Delivery Rules

- Do not ship public-facing CTAs without complete downstream flows.
- Do not accept arbitrary URLs; only approved and validated source types should be allowed.
- Payment, signup, vPT allocation, and participant capture must be atomic and idempotent.
- The public Challenge page remains unchanged in purpose and content direction.
- The auth-gated Challenge page becomes the operational audition signup surface.

## Suggested Delivery Order

1. `AV-STR-001` to `AV-STR-006`
2. `AV-STR-007` to `AV-STR-010`
3. `AV-CHL-001` to `AV-CHL-005`
4. `AV-CHL-006` to `AV-CHL-011`

## Critical Path

These tickets control the earliest date AfroVision can release each workstream.

### External Streaming Critical Path

1. `AV-STR-001` Approve supported source policy
2. `AV-STR-002` Extend channel schema and APIs
3. `AV-STR-004` Build source resolver and validation service
4. `AV-STR-003` Add channel setup UI for source links
5. `AV-STR-005` Integrate player playback paths
6. `AV-STR-006` Ship YouTube Live MVP
7. `AV-STR-009` Add health visibility and monitoring
8. `AV-STR-010` Complete QA and release gate

### Challenge Audition Critical Path

1. `AV-CHL-001` Split public and auth-gated challenge experience
2. `AV-CHL-002` Create paid audition signup model
3. `AV-CHL-003` Configure payment product and pricing logic
4. `AV-CHL-005` Implement atomic paid signup flow
5. `AV-CHL-006` Implement vPT and pool allocation engine
6. `AV-CHL-007` Build auth-gated audition signup UI
7. `AV-CHL-008` Expose paid participant management in admin
8. `AV-CHL-010` Execute end-to-end QA
9. `AV-CHL-011` Complete rollout controls and release readiness

## Parallel Delivery Waves

### Wave 0 Immediate Kickoff

These can begin immediately with minimal dependency conflict.

- `AV-STR-001`
- `AV-CHL-001`
- `AV-CHL-004`

### Wave 1 Foundation Build

These establish the shared data and routing foundations.

- `AV-STR-002`
- `AV-STR-004`
- `AV-CHL-002`
- `AV-CHL-003`

### Wave 2 User-Facing Build

These convert the foundations into usable creator and participant flows.

- `AV-STR-003`
- `AV-STR-005`
- `AV-STR-006`
- `AV-CHL-005`
- `AV-CHL-006`
- `AV-CHL-007`

### Wave 3 Ops and Launch Readiness

These complete operational control, observability, and release quality.

- `AV-STR-007`
- `AV-STR-008`
- `AV-STR-009`
- `AV-STR-010`
- `AV-CHL-008`
- `AV-CHL-009`
- `AV-CHL-010`
- `AV-CHL-011`

## Team-Split Execution View

Use this section when assigning team-specific delivery queues.

### Backend Queue

1. `AV-STR-002`
2. `AV-STR-004`
3. `AV-STR-006`
4. `AV-STR-008`
5. `AV-CHL-002`
6. `AV-CHL-003`
7. `AV-CHL-005`
8. `AV-CHL-006`
9. `AV-CHL-009`

### Flutter Queue

1. `AV-STR-003`
2. `AV-STR-005`
3. `AV-STR-006`

### Website Queue

1. `AV-CHL-001`
2. `AV-CHL-007`

### Admin Queue

1. `AV-STR-007`
2. `AV-STR-009`
3. `AV-CHL-008`

### Product And Operations Queue

1. `AV-STR-001`
2. `AV-CHL-004`
3. `AV-CHL-011`

### QA And Release Queue

1. `AV-STR-010`
2. `AV-CHL-010`

## First Assignment Pack

If delivery starts this week, assign these first without waiting for the rest of the board setup.

| Team | Start With | Why |
| --- | --- | --- |
| Product/Ops | `AV-STR-001`, `AV-CHL-004` | These unblock provider rules, segmentation scope, and later implementation certainty |
| Website | `AV-CHL-001` | This can start immediately and defines the public versus auth-gated challenge split |
| Backend | `AV-STR-002`, `AV-CHL-002`, `AV-CHL-003` | These create the storage and payment contracts other teams must integrate against |
| Flutter | Prep on `AV-STR-003` after `AV-STR-002` field contract is confirmed | This keeps channel setup UI aligned with the real backend schema |
| Admin | Prep on `AV-STR-007` and `AV-CHL-008` requirements while backend contracts stabilize | This reduces admin-surface rework later |
| QA/Ops | Draft test strategy for `AV-STR-010` and `AV-CHL-010` early | This prevents end-of-cycle QA blind spots |

## Dependency Map

| Ticket | Depends On |
| --- | --- |
| `AV-STR-001` | None |
| `AV-STR-002` | `AV-STR-001` |
| `AV-STR-003` | `AV-STR-002` |
| `AV-STR-004` | `AV-STR-002` |
| `AV-STR-005` | `AV-STR-003`, `AV-STR-004` |
| `AV-STR-006` | `AV-STR-004`, `AV-STR-005` |
| `AV-STR-007` | `AV-STR-002`, `AV-STR-004`, `AV-STR-005` |
| `AV-STR-008` | `AV-STR-002`, `AV-STR-007` |
| `AV-STR-009` | `AV-STR-005`, `AV-STR-006`, `AV-STR-007`, `AV-STR-008` |
| `AV-STR-010` | `AV-STR-009` |
| `AV-CHL-001` | None |
| `AV-CHL-002` | `AV-CHL-001` |
| `AV-CHL-003` | `AV-CHL-002` |
| `AV-CHL-004` | `AV-CHL-002` |
| `AV-CHL-005` | `AV-CHL-003`, `AV-CHL-004` |
| `AV-CHL-006` | `AV-CHL-003`, `AV-CHL-004`, `AV-CHL-005` |
| `AV-CHL-007` | `AV-CHL-003`, `AV-CHL-005` |
| `AV-CHL-008` | `AV-CHL-003`, `AV-CHL-005`, `AV-CHL-006` |
| `AV-CHL-009` | `AV-CHL-003`, `AV-CHL-008` |
| `AV-CHL-010` | `AV-CHL-008`, `AV-CHL-009` |
| `AV-CHL-011` | `AV-CHL-006`, `AV-CHL-007`, `AV-CHL-008`, `AV-CHL-009`, `AV-CHL-010` |

## Epic Mapping

| Epic | Description | Tickets |
| --- | --- | --- |
| `EPIC-STR-01` | External link-based streaming and imported channels | `AV-STR-001` to `AV-STR-010` |
| `EPIC-CHL-01` | Auth-gated challenge audition signup and paid participant operations | `AV-CHL-001` to `AV-CHL-011` |

## Tracker-Ready Register

Use this section when creating Jira, Linear, or GitHub issues.

| Ticket | Summary | Type | Priority | Primary Lane | Estimate | Target Sprint |
| --- | --- | --- | --- | --- | --- | --- |
| `AV-STR-001` ✅ | Approve supported external stream source policy and compliance rules | Spike | P0 | Product/Ops | 2 points | Sprint 1 |
| `AV-STR-002` ✅ | Extend channel schema and APIs for external stream sources | Story | P0 | Backend | 5 points | Sprint 1 |
| `AV-STR-003` ✅ | Add external stream source setup to channel create and edit flows | Story | P1 | Flutter | 5 points | Sprint 1 |
| `AV-STR-004` ✅ | Build backend source resolver and validation service | Story | P0 | Backend | 8 points | Sprint 1 |
| `AV-STR-005` ✅ | Integrate external source playback into AfroVision player flows | Story | P0 | Flutter | 8 points | Sprint 2 |
| `AV-STR-006` ✅ | Ship YouTube Live channel-linking MVP | Story | P0 | Backend + Flutter | 5 points | Sprint 2 |
| `AV-STR-007` ✅ | Add admin import and operations flow for free-to-air channels | Story | P1 | Admin + Backend | 8 points | Sprint 2 |
| `AV-STR-008` ✅ | Backfill existing channels for external-source compatibility | Task | P1 | Backend | 3 points | Sprint 2 |
| `AV-STR-009` ✅ | Add stream health states, monitoring, and ops visibility | Story | P1 | Admin + Backend | 5 points | Sprint 3 |
| `AV-STR-010` ✅ | Complete external streaming QA and release gate | Task | P0 | QA/Ops | 3 points | Sprint 3 |
| `AV-CHL-001` ✅ | Split public challenge experience from auth-gated audition experience | Story | P0 | Website | 5 points | Sprint 1 |
| `AV-CHL-002` ✅ | Create paid audition signup domain model and storage contract | Story | P0 | Backend | 5 points | Sprint 1 |
| `AV-CHL-003` ✅ | Configure audition payment product and dynamic vPT pricing logic | Story | P0 | Backend | 5 points | Sprint 1 |
| `AV-CHL-004` ✅ | Define participant segmentation fields and admin targeting requirements | Spike | P1 | Product/Ops | 2 points | Sprint 1 |
| `AV-CHL-005` ✅ | Implement atomic paid audition signup backend flow | Story | P0 | Backend | 8 points | Sprint 2 |
| `AV-CHL-006` ✅ | Implement vPT reward and pool allocation engine for audition signups | Story | P0 | Backend | 8 points | Sprint 2 |
| `AV-CHL-007` ✅ | Build auth-gated challenge audition signup UI and states | Story | P0 | Website or Flutter App Surface | 8 points | Sprint 2 |
| `AV-CHL-008` ✅ | Add admin management for paid audition signups | Story | P1 | Admin + Backend | 5 points | Sprint 3 |
| `AV-CHL-009` ✅ | Add acknowledgement email flow for completed audition signups | Story | P1 | Backend | 3 points | Sprint 3 |
| `AV-CHL-010` ✅ | Execute end-to-end audition signup QA across payment, rewards, and admin visibility | Task | P0 | QA/Ops | 3 points | Sprint 3 |
| `AV-CHL-011` ✅ | Complete rollout controls and release readiness for audition signup | Task | P0 | Product/Ops | 2 points | Sprint 3 |

## Lane Ownership Guide

| Lane | Responsibilities |
| --- | --- |
| Product/Ops | Policy approvals, legal constraints, rollout signoff, email content inputs, launch readiness |
| Backend | Schema, APIs, payment orchestration, vPT allocations, resolver logic, migrations, email triggers |
| Flutter | App channel setup, player integration, creator-facing channel management, in-app challenge entry points if used |
| Website | Public challenge page routing, auth-gated challenge signup experience, signed-in user flows |
| Admin | Imported channel operations, paid participant management, reporting, segmentation views |
| QA/Ops | Release checklist, end-to-end validation, rollback readiness, smoke and regression coverage |

## Definition Of Ready

- Ticket has a confirmed dependency state and no hidden upstream blocker.
- Required business inputs are attached or explicitly marked as pending.
- Target surface is named: backend, Flutter, website, admin, or mixed.
- Acceptance criteria are testable and environment-specific.
- Any compliance-sensitive provider or payment behavior is approved before build starts.

## Definition Of Done

- Code, UI, and data-layer changes are complete for the stated scope.
- Acceptance criteria are demonstrably satisfied.
- Logging, error states, and empty states are covered where relevant.
- Admin or ops visibility exists for any new managed content or financial flow.
- QA evidence exists for the affected path before release.

## Suggested Issue Template

Copy this block into your tracker when creating each ticket.

```md
Title: <Ticket ID> <Summary>

Type: Story | Task | Spike
Priority: P0 | P1 | P2
Epic: <Epic ID>
Primary Lane: Backend | Flutter | Website | Admin | Product/Ops | QA/Ops
Dependencies: <Ticket IDs or None>
Estimate: <Points>
Target Sprint: <Sprint>

Problem Statement
<Why this ticket exists>

Scope
- <What is included>
- <What is included>

Out Of Scope
- <What is not included>

Acceptance Criteria
- <Criterion>
- <Criterion>

Implementation Notes
- <Repo or surface notes>
- <Integration or rollout notes>

Validation
- <Test or QA step>
- <Test or QA step>
```

## Ready-To-Create Issue Drafts

Use these for the first assignment pack so teams can create the initial tickets without rewriting the plan.

### AV-STR-001 Approve Supported External Stream Source Policy and Compliance Rules

```md
Title: AV-STR-001 Approve supported external stream source policy and compliance rules

Type: Spike
Priority: P0
Epic: EPIC-STR-01
Primary Lane: Product/Ops
Dependencies: None
Estimate: 2 points
Target Sprint: Sprint 1

Problem Statement
AfroVision cannot safely implement link-based channel streaming until approved provider classes, legal boundaries, and validation rules are formally locked.

Scope
- Define the v1 support matrix for YouTube Live URLs, direct HLS manifests, direct DASH manifests, and any approved direct media streams.
- Define rejected inputs such as generic webpages, iframe-only sites, and sources without embed or rebroadcast rights.
- Record what playback behavior is allowed for each provider class.

Out Of Scope
- Backend resolver implementation.
- Channel UI implementation.

Acceptance Criteria
- A written support matrix exists for allowed and rejected source types.
- Validation rules are defined for each allowed source class.
- Legal and platform constraints are recorded for YouTube and free-to-air sources.
- Product, engineering, and operations agree on one approved v1 policy.

Implementation Notes
- This ticket is the policy input for AV-STR-002 and AV-STR-004.
- Output should be attachable to engineering tickets as the single approval source.

Validation
- Review output with product, engineering, and operations.
- Confirm downstream teams can identify allowed and disallowed source types without ambiguity.
```

### AV-CHL-004 Define Participant Segmentation Fields and Admin Targeting Requirements

```md
Title: AV-CHL-004 Define participant segmentation fields and admin targeting requirements

Type: Spike
Priority: P1
Epic: EPIC-CHL-01
Primary Lane: Product/Ops
Dependencies: AV-CHL-002
Estimate: 2 points
Target Sprint: Sprint 1

Problem Statement
Paid audition signups need to be usable for operations and future marketing campaigns, which requires early agreement on what participant attributes and admin filters must exist.

Scope
- Define required segmentation fields such as signup status, payment status, email status, consent flags, and campaign tags.
- Define admin list, filter, search, and export expectations.
- Confirm how paid audition participants must remain distinguishable from general users and later challenge stages.

Out Of Scope
- Admin UI implementation.
- Email template implementation.

Acceptance Criteria
- Required segmentation fields are documented and approved.
- Admin requirements for list, filter, and export are documented.
- Paid audition participants can be isolated from other user populations in the agreed design.
- The data shape supports future campaign use without needing a schema redesign.

Implementation Notes
- This output informs AV-CHL-005, AV-CHL-006, and AV-CHL-008.
- Include support, operations, and campaign stakeholders in the requirement signoff.

Validation
- Review the field list against intended admin workflows.
- Confirm backend can implement the agreed schema without follow-up discovery work.
```

### AV-CHL-001 Split Public Challenge Experience From Auth-Gated Audition Experience

```md
Title: AV-CHL-001 Split public challenge experience from auth-gated audition experience

Type: Story
Priority: P0
Epic: EPIC-CHL-01
Primary Lane: Website
Dependencies: None
Estimate: 5 points
Target Sprint: Sprint 1

Problem Statement
The current Challenge surface serves public marketing needs, but the paid audition flow must live behind authentication and must not leak payment CTAs onto the public page.

Scope
- Preserve the public challenge page for anonymous visitors.
- Add a separate authenticated challenge route for signed-in users.
- Update CTA routing so user intent is separated between marketing and audition signup.

Out Of Scope
- Payment orchestration.
- Participant storage and reward allocation.

Acceptance Criteria
- The public Challenge page remains unchanged for anonymous users.
- A separate auth-gated challenge surface exists for signed-in users.
- Route and CTA behavior clearly distinguish public information from participant actions.
- No audition-payment controls appear on the public marketing page.

Implementation Notes
- This ticket is the route and experience split required before the signup flow is attached.
- Coordinate with backend contracts only where auth-state routing depends on session behavior.

Validation
- Verify anonymous users only see the marketing page.
- Verify signed-in users can reach the auth-gated challenge route intentionally.
```

### AV-STR-002 Extend Channel Schema and APIs for External Stream Sources

```md
Title: AV-STR-002 Extend channel schema and APIs for external stream sources

Type: Story
Priority: P0
Epic: EPIC-STR-01
Primary Lane: Backend
Dependencies: AV-STR-001
Estimate: 5 points
Target Sprint: Sprint 1

Problem Statement
Channel records currently need a formal contract for link-based playback sources before creator UI, player behavior, and admin imports can be built safely.

Scope
- Extend the channel schema with external source fields.
- Update create and edit channel APIs to persist and return the new fields.
- Preserve backward compatibility for existing native or internal channel records.

Out Of Scope
- Playback resolver logic.
- Channel create and edit UI changes.

Acceptance Criteria
- Backend channel schema supports external stream configuration.
- Create and edit APIs can save and return external source settings.
- Existing channels remain functional with safe defaults.
- The response contract is usable by Flutter and admin clients.

Implementation Notes
- Include fields such as stream source mode, external provider, external URL, resolved playback URL, stream status, last checked at, and provider metadata.
- Coordinate the final response contract with AV-STR-003 and AV-STR-007 consumers.

Validation
- Exercise create and update flows with external-source payloads.
- Confirm legacy channel reads still work without manual data repair.
```

### AV-CHL-002 Create Paid Audition Signup Domain Model and Storage Contract

```md
Title: AV-CHL-002 Create paid audition signup domain model and storage contract

Type: Story
Priority: P0
Epic: EPIC-CHL-01
Primary Lane: Backend
Dependencies: AV-CHL-001
Estimate: 5 points
Target Sprint: Sprint 1

Problem Statement
The paid audition flow needs a dedicated storage model so successful signups, payment references, allocations, and marketing segmentation can be managed independently from the existing contestant registration records.

Scope
- Create a dedicated entity for paid audition signups.
- Define fields for participant identity, payment references, pricing and allocation data, communication status, and timestamps.
- Keep the new model distinct from existing challenge contestant progression data.

Out Of Scope
- Payment confirmation workflow.
- Admin UI delivery.

Acceptance Criteria
- A dedicated signup entity exists for paid audition enrollment.
- The model captures challenge ID, user ID, email, payment reference, payment status, vPT allocation values, and timestamps.
- The model supports admin filtering and segmented communications.
- Existing challenge contestant registration records are unaffected.

Implementation Notes
- This storage contract feeds AV-CHL-003, AV-CHL-005, AV-CHL-006, and AV-CHL-008.
- Keep the model extensible for later email and campaign status fields.

Validation
- Create and read a sample paid audition signup record through the model layer.
- Verify current challenge registration flows are unchanged.
```

### AV-CHL-003 Configure Audition Payment Product and Dynamic vPT Pricing Logic

```md
Title: AV-CHL-003 Configure audition payment product and dynamic vPT pricing logic

Type: Story
Priority: P0
Epic: EPIC-CHL-01
Primary Lane: Backend
Dependencies: AV-CHL-002
Estimate: 5 points
Target Sprint: Sprint 1

Problem Statement
Audition signup requires a backend-owned payment contract for the fixed N2,500 fee and a reliable method for calculating reward and pool allocations from the current live vPT price.

Scope
- Define the audition signup payment product or transaction type.
- Read the live vPT price from backend-owned configuration.
- Define payment references, retry handling, and webhook or callback confirmation behavior.

Out Of Scope
- Final signup persistence transaction.
- Frontend payment UI states.

Acceptance Criteria
- The backend exposes a clear audition-signup payment flow for N2,500.
- The current vPT price is read dynamically rather than hardcoded.
- Payment references can be correlated to a single signup attempt.
- Duplicate or replayed confirmations are handled safely.

Implementation Notes
- This ticket creates the contract that AV-CHL-005 and AV-CHL-006 depend on.
- Keep transaction metadata explicit enough for later audit and support handling.

Validation
- Verify the configured fee resolves to N2,500 in the payment initiation flow.
- Verify the current vPT price is read from server-side configuration during execution.
```

## External Streaming Tickets

### `AV-STR-001` ✅ Supported Source Policy and Compliance Guardrails

**Goal**

Define which external source types AfroVision will support in v1 and the validation rules for each source class.

**Dependencies**

- None

**Implementation Notes**

- Lock approved source types for v1: YouTube Live URLs, direct HLS manifests, direct DASH manifests, and approved direct media streams if needed.
- Define unsupported inputs such as generic webpages, iframe-only sites, and sources without rebroadcast or embed rights.
- Define what “play without their interface” means for each provider class.

**Acceptance Criteria**

- A written support matrix exists for allowed and rejected link types.
- Validation rules are documented for each source type.
- Legal and platform constraints are recorded for YouTube embeds and free-to-air sources.
- Product, engineering, and operations have a single approved v1 source policy.

### `AV-STR-002` ✅ Channel Schema and API Extension for External Sources

**Goal**

Extend the channel model and API contract to support link-based playback sources for new and existing channels.

**Dependencies**

- `AV-STR-001`

**Implementation Notes**

- Add fields such as `stream_source_mode`, `external_provider`, `external_url`, `resolved_playback_url`, `stream_status`, `last_checked_at`, and provider metadata.
- Preserve backward compatibility for existing native/internal channel flows.
- Ensure both create and update channel APIs can store and return the new fields.

**Acceptance Criteria**

- Backend channel schema supports external stream configuration.
- Flutter channel model supports the new source fields.
- Existing channels remain functional with defaults applied.
- Create and edit channel APIs can save and read external source settings.

### `AV-STR-003` ✅ Creator and Admin Channel Configuration UI

**Goal**

Expose link-based stream setup in channel creation and editing flows for creators and admins.

**Dependencies**

- `AV-STR-002`

**Implementation Notes**

- Add source-mode selection in create and edit channel screens.
- Allow pasting approved links with inline validation and error messaging.
- Show current source type and configured link status for existing channels.

**Acceptance Criteria**

- New channels can be configured to use external stream links.
- Existing channels can be updated to use external stream links.
- Unsupported or malformed links are blocked with clear messages.
- UI state persists and loads correctly from the backend.

### `AV-STR-004` ✅ Backend Source Resolver and Validation Service

**Goal**

Create a backend resolver that classifies approved URLs and returns a normalized playback contract.

**Dependencies**

- `AV-STR-002`

**Implementation Notes**

- Detect provider type from URL patterns and approved host rules.
- Normalize YouTube Live links and direct manifest URLs.
- Store validation outcome, playback type, and health metadata.

**Acceptance Criteria**

- The backend can classify supported source types reliably.
- The resolver returns a normalized source payload for the player layer.
- Rejected links produce explicit machine-readable and user-readable errors.
- Resolver results can be reused by channel save, playback, and monitoring flows.

### `AV-STR-005` ✅ Player Integration for External Stream Playback

**Goal**

Update the AfroVision player flow to choose the correct playback path for native, YouTube, and direct stream sources.

**Dependencies**

- `AV-STR-003`
- `AV-STR-004`

**Implementation Notes**

- Route playback based on normalized source type.
- Support graceful fallbacks for offline, unsupported, expired, or inaccessible streams.
- Preserve AfroVision overlays, channel presentation, and existing in-player behavior wherever compatible.

**Acceptance Criteria**

- Channels configured with supported external links can play from the channel player.
- Native/internal channels continue working without regression.
- Playback failures show actionable error states instead of broken or blank UI.
- Channel branding and AfroVision viewing context remain intact.

### `AV-STR-006` ✅ YouTube Live Linking MVP

**Goal**

Ship the first usable external live-stream path using YouTube Live URLs.

**Dependencies**

- `AV-STR-004`
- `AV-STR-005`

**Implementation Notes**

- Support scheduled, active, ended, private, and invalid YouTube live cases.
- Decide final embed versus resolved playback strategy in line with platform rules.
- Add creator-facing status feedback when a configured live link cannot be played.

**Acceptance Criteria**

- A creator can configure a supported YouTube Live URL on a channel.
- Viewers can open the AfroVision channel and watch the linked live event when it is valid and live.
- Invalid, ended, private, or inaccessible links are surfaced with accurate status.
- The implementation respects provider constraints instead of attempting unsupported stripping of YouTube behavior.

### `AV-STR-007` ✅ Free-to-Air Channel Import and Admin Operations

**Goal**

Allow operations to create and manage imported channels backed by approved external playback links.

**Dependencies**

- `AV-STR-002`
- `AV-STR-004`
- `AV-STR-005`

**Implementation Notes**

- Add admin create/import flow for external-source channels.
- Capture provider name, source link, channel branding metadata, and health state.
- Support repeatable import for multiple external channels from the same provider.

**Acceptance Criteria**

- Admins can create imported channels backed by external links.
- Imported channels play inside AfroVision without redirecting viewers to provider interfaces.
- Provider metadata and playback status are stored and visible to admins.
- Unsupported source links are blocked before import completes.

### `AV-STR-008` ✅ Existing Channel Migration and Backfill

**Goal**

Ensure all existing channels can adopt the new external-source mode without manual database intervention.

**Dependencies**

- `AV-STR-002`
- `AV-STR-007`

**Implementation Notes**

- Apply defaults for all current channels.
- Add backfill or migration logic for legacy records.
- Validate that channel edit screens handle missing legacy fields safely.

**Acceptance Criteria**

- Existing channel records are safe under the new schema.
- Existing channels can be switched to link mode from supported UI flows.
- No manual data patching is required for standard channel migration.
- Legacy channels still render and play correctly after deployment.

### `AV-STR-009` ✅ Stream Monitoring, Health States, and Operational Visibility

**Goal**

Provide operational feedback for broken, offline, or misconfigured external streams.

**Dependencies**

- `AV-STR-005`
- `AV-STR-006`
- `AV-STR-007`
- `AV-STR-008`

**Implementation Notes**

- Surface statuses such as valid, scheduled, live, offline, invalid, access-denied, and stale.
- Add admin and creator visibility into last validation time and current state.
- Make support and troubleshooting possible without direct database inspection.

**Acceptance Criteria**

- External-source channels show meaningful health states.
- Admins and creators can see when the last validation ran.
- Broken streams are distinguishable from unsupported streams and offline streams.
- Operational teams can identify affected channels quickly.

### `AV-STR-010` ✅ External Streaming QA and Release Gate

**Goal**

Complete validation and release readiness for external link-based streaming.

**Dependencies**

- `AV-STR-009`

**Implementation Notes**

- Test supported YouTube live links, direct manifests, invalid links, expired links, and offline streams.
- Verify channel create, edit, import, playback, and fallback flows.
- Confirm rollout strategy and feature flag behavior if used.

**Acceptance Criteria**

- A test checklist exists and is executed for all supported source types.
- No critical regression remains in current native channel playback.
- Playback failures degrade cleanly with user-visible explanation.
- The feature is approved for rollout with rollback or feature-flag control in place.

## Challenge Audition Tickets

### `AV-CHL-001` ✅ Public and Auth-Gated Challenge Experience Split

**Goal**

Separate the public marketing Challenge page from the logged-in audition signup experience.

**Dependencies**

- None

**Implementation Notes**

- Keep the public challenge page unchanged in purpose and messaging.
- Introduce a new authenticated challenge route for signed-in users.
- Update CTA routing so public visitors land on the public page and logged-in participants can reach the signup surface.

**Acceptance Criteria**

- The public Challenge page remains unchanged for anonymous users.
- A separate auth-gated Challenge surface exists for signed-in users.
- Route and CTA behavior clearly distinguish public information from participant actions.
- No audition-payment controls appear on the public marketing page.

### `AV-CHL-002` 🔄 Audition Signup Domain Model and Data Contract

**Goal**

Create a dedicated paid audition signup model instead of overloading the current challenge registration entity.

**Dependencies**

- `AV-CHL-001`

**Implementation Notes**

- Add a new table or collection for successful paid audition signups.
- Include participant, payment, allocation, and communication fields needed for operations and marketing.
- Keep this model distinct from later pitch or contestant progression data.

**Acceptance Criteria**

- A dedicated signup entity exists for paid audition enrollment.
- The model captures challenge ID, user ID, email, payment reference, payment status, vPT allocation values, and timestamps.
- The model supports admin filtering and segmented communications.
- The new entity does not break or replace existing challenge contestant registration records.

### `AV-CHL-003` Payment Product and Pricing Configuration

**Goal**

Define the payable audition product and pricing logic for the ₦2,500 enrollment fee.

**Dependencies**

- `AV-CHL-002`

**Implementation Notes**

- Configure the fee as a backend-owned product or transaction type.
- Read current vPT price from server-side configuration at execution time.
- Define how payment state, reference IDs, retries, and webhook confirmation are handled.

**Acceptance Criteria**

- The backend exposes a clear audition-signup payment flow for ₦2,500.
- The current vPT price is read dynamically rather than hardcoded into business logic.
- Payment references can be correlated to a single signup attempt.
- Duplicate or replayed payment confirmations are handled safely.

### `AV-CHL-004` Participant Segmentation and Marketing Capture Requirements

**Goal**

Define the data points and admin views required to target successful audition signups separately for campaigns and updates.

**Dependencies**

- `AV-CHL-002`

**Implementation Notes**

- Confirm required segmentation fields such as signup status, payment status, email status, consent flags, and campaign tags.
- Define admin filters and export needs.
- Ensure the stored data supports future hype, reminders, and challenge-specific communications.

**Acceptance Criteria**

- Required segmentation fields are defined and included in the signup schema.
- Admin requirements for list, filter, and export are documented.
- Paid audition participants can be isolated from general users and from later challenge stages.
- The data structure supports future campaign use without schema redesign.

### `AV-CHL-005` Atomic Audition Signup Backend Flow

**Goal**

Implement the core backend signup transaction that confirms payment and creates exactly one successful audition signup record.

**Dependencies**

- `AV-CHL-003`

- `AV-CHL-004`

**Implementation Notes**

- Create a signed-in endpoint for audition signup initiation and a confirmation path for successful payment.
- Persist the participant only after payment is confirmed.
- Enforce idempotency so a payment callback cannot create duplicates.

**Acceptance Criteria**

- A signed-in user can initiate audition signup and reach payment.
- Successful payment creates exactly one signup record for the user and challenge.
- Duplicate payment callbacks do not duplicate participant capture or rewards.
- Failed or abandoned payments do not mark the user as enrolled.

### `AV-CHL-006` vPT Reward and Pool Allocation Engine

**Goal**

Apply the required financial allocations after successful payment.

**Dependencies**

- `AV-CHL-003`

- `AV-CHL-004`

- `AV-CHL-005`

**Implementation Notes**

- Credit ₦1,000 worth of vPT to the participant using the current platform vPT price.
- Allocate ₦500 worth of vPT to the community pool.
- Allocate ₦1,000 worth of vPT to the operations pool.
- Record the exact computed vPT units and source pricing used at transaction time.

**Acceptance Criteria**

- Participant reward units are computed from the live vPT price.
- Community and operations pool allocations are computed and recorded correctly.
- Allocation writes are part of the same confirmed business flow as successful signup.
- Allocation records are auditable and traceable to the payment reference.

### `AV-CHL-007` Auth-Gated Challenge Audition UI

**Goal**

Build the signed-in challenge page that explains the audition signup offer and launches payment.

**Dependencies**

- `AV-CHL-003`

- `AV-CHL-005`

**Implementation Notes**

- Show fee, reward breakdown, eligibility messaging, and signup state.
- Present states for idle, processing, success, already-signed-up, and failure.
- Keep the public page and auth-gated page visually and behaviorally distinct.

**Acceptance Criteria**

- Signed-in users can reach a dedicated audition signup page.
- The page clearly shows the ₦2,500 fee and reward allocation summary.
- Clicking the signup button launches the payment process.
- Users see correct state after payment success, failure, or repeat visit.

### `AV-CHL-008` Admin Participant Management for Paid Audition Signups

**Goal**

Expose paid audition signups in admin for operations and marketing use.

**Dependencies**

- `AV-CHL-003`

- `AV-CHL-005`

- `AV-CHL-006`

**Implementation Notes**

- Add a dedicated admin view or tab for paid audition signups.
- Include filters, search, status, payment reference, and export-ready fields.
- Keep this dataset distinguishable from existing challenge contestant registration records.

**Acceptance Criteria**

- Admin can list successful paid audition signups.
- Admin can filter and search by challenge, user, payment status, and signup status.
- Participant records include enough data for campaign targeting and support handling.
- The view does not depend on direct database access.

### `AV-CHL-009` Acknowledgement Email Integration Readiness

**Goal**

Prepare and implement the post-signup acknowledgement email flow once final email details are provided.

**Dependencies**

- `AV-CHL-003`

- `AV-CHL-008`

**Implementation Notes**

- Trigger send only after payment and signup persistence succeed.
- Record send status and retry state.
- Keep template and destination details configurable for final business handoff.

**Acceptance Criteria**

- The system can send an acknowledgement email after confirmed signup.
- Email delivery status is stored on the participant signup record or a linked log.
- Failed sends do not invalidate the successful signup.
- The final recipient/template details can be inserted without redesigning the flow.

### `AV-CHL-010` Audition Signup End-to-End QA

**Goal**

Validate the full signed-in audition signup flow from page access through payment, allocation, participant capture, and communication.

**Dependencies**

- `AV-CHL-008`

- `AV-CHL-009`

**Implementation Notes**

- Test anonymous access, authenticated access, already-signed-up state, failed payment, duplicate callback, and success flow.
- Verify all allocation values against the configured vPT price.
- Verify admin visibility and participant segmentation results.

**Acceptance Criteria**

- End-to-end success flow works from signup button through participant capture.
- Failure paths do not create false enrollments or incorrect allocations.
- Duplicate events do not double-reward or duplicate signups.
- Admin data and communication status match the transaction outcome.

### `AV-CHL-011` Release Readiness and Rollout Controls

**Goal**

Prepare the challenge audition feature for safe release.

**Dependencies**

- `AV-CHL-006`

- `AV-CHL-007`

- `AV-CHL-008`

- `AV-CHL-009`

- `AV-CHL-010`

**Implementation Notes**

- Define deployment order across backend, website, and app surfaces.
- Add feature flags or controlled rollout if needed.
- Confirm operations readiness for monitoring, participant export, and support.

**Acceptance Criteria**

- Deployment order is documented and executable.
- Critical operational surfaces are available before public rollout.
- Rollback or feature-gated release strategy exists.
- Stakeholders have approved the feature as ready for launch.

## Recommended Sprint Grouping

### Sprint 1

- `AV-STR-001`
- `AV-STR-002`
- `AV-STR-003`
- `AV-STR-004`
- `AV-CHL-001`
- `AV-CHL-002`
- `AV-CHL-003`
- `AV-CHL-004`

### Sprint 2

- `AV-STR-005`
- `AV-STR-006`
- `AV-STR-007`
- `AV-STR-008`
- `AV-CHL-005`
- `AV-CHL-006`
- `AV-CHL-007`

### Sprint 3

- `AV-STR-009`
- `AV-STR-010`
- `AV-CHL-008`
- `AV-CHL-009`
- `AV-CHL-010`
- `AV-CHL-011`

## Open Business Inputs Still Needed

- Final approved source providers and legal/embed constraints for each provider.
- Final email template, sender details, and destination rules for signup acknowledgements.
- Final payment gateway behavior and callback contract if not already fixed.
- Final definition of whether later audition content submission remains part of the existing challenge registration flow or becomes a follow-up flow from paid signup.