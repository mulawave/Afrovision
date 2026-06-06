# Exclusive Wave KYC + PIC Gating End-to-End Implementation Tracker

## 1. Feature Identity
- Feature Name: Exclusive Wave Protection Gating
- Owner Team(s): Backend, Flutter
- Primary Surfaces: Backend, Flutter
- Related Tickets: Critical parity/security gap (exclusive content leakage in Waves)
- Linked Tracker File: exclusive-wave-kyc-pic-gating-end-to-end-implementation-tracker.md

## 2. Objective
Prevent any unauthorized user from consuming Waves that belong to exclusive channels. Access must be blocked unless the viewer satisfies exclusive policy gates: authenticated user, adult-KYC eligibility, active exclusive entitlement, and successful PIC verification for that channel.

## 3. Completion Contract
1. Entry points and discovery surfaces: Wave feed and direct wave/channel-waves APIs must enforce exclusive gating.
2. Destination UX and interaction states: Mobile wave player must respect access-check outcomes and react to blocked states.
3. Backend/API/storage/state wiring: Add persistent PIC verification unlock state and enforce it in wave access policy.
4. Navigation and deep links: Blocked users can be routed to exclusive access/KYC/login flows from wave playback context.
5. Permissions, entitlement, validation, and edge cases: Owner/admin bypass, rollout checks, missing channel fallback, expired access/unlock handling.
6. Operational controls and management tooling: Reuse existing exclusive access and PIC verification endpoints.
7. Notifications/alerts/analytics coverage: No new notifications required for this enforcement patch.
8. QA and rollout readiness: Syntax/analyzer checks pass for touched backend/mobile files.

## 4. Business Rules (Source of Truth)
- Exclusive-channel waves are never returned to viewers who are not authenticated.
- Exclusive-channel waves are never returned if viewer fails rollout/adult-KYC checks.
- Exclusive-channel waves are never returned if viewer lacks active entitlement.
- Exclusive-channel waves are never returned until PIC has been verified for that channel entitlement window.
- Channel owner and admins may always access their own managed content.
- Non-exclusive waves continue to use existing CERS age/access policy.

## 5. Domain Model Changes
- New entity: `exclusive_channel_pic_unlocks`
- Fields:
  - `id`: string (`channelId__userId`)
  - `user_uid`: string
  - `channel_id`: string
  - `access_id`: string
  - `verified_at`: number (epoch ms)
  - `expires_at`: number (epoch ms)
  - `created_at`: number (epoch ms)
  - `updated_at`: number (epoch ms)
- State:
  - active when `expires_at > now`
  - stale otherwise (treated as no unlock)

## 6. API Contracts
- Existing route behavior changes:
  - `GET /wave/feed` filters out exclusive waves when exclusive gate fails.
  - `GET /wave/:waveId` returns 403 when exclusive gate fails.
  - `GET /wave/channel/:channelId` returns 403 for unauthorized exclusive access.
  - `POST /wave/:waveId/access-check` returns exclusive gate denial codes/reasons before age-consent checks.
- Existing route extended:
  - `POST /channels/:id/exclusive/verify-pic` persists PIC unlock state on success.
- Error contract additions (code examples):
  - `EXCLUSIVE_LOGIN_REQUIRED`
  - `EXCLUSIVE_ROLLOUT_BLOCKED`
  - `EXCLUSIVE_KYC_REQUIRED`
  - `EXCLUSIVE_ENTITLEMENT_REQUIRED`
  - `EXCLUSIVE_PIC_REQUIRED`

## 7. End-to-End User Flows
1. Discovery flow: unauthorized viewer opens Waves feed -> exclusive waves absent.
2. Primary success flow: eligible + entitled + PIC-verified viewer opens Waves feed -> exclusive waves appear/play.
3. Failure and recovery flow: viewer with entitlement but no PIC verification -> denied with PIC-required reason; user verifies PIC, retries, access granted.
4. Follow-up action flow: mobile blocked state can route user to exclusive access screen/KYC/login.
5. Lifecycle/renewal/state-transition flow: entitlement expires -> unlock expires with it -> wave access denied again.

## 8. Frontend Scope
- Flutter UX scope:
  - Access-check runs for active wave.
  - Playback pauses/blocks on denied access.
  - Route cues for exclusive/KYC/login remediation.
- Loading/empty/error/success/disabled states:
  - Access-check failure/denial shown as in-app notice.

## 9. Backend/Jobs Scope
- Services:
  - Wave controller exclusive gate helper.
  - New model for exclusive PIC unlock persistence.
- Workers/schedulers: none.
- Idempotency and duplicate protection: unlock writes are idempotent upserts by `channelId__userId`.
- Audit requirements: existing exclusive audit remains; no new audit schema required.

## 10. Security and Compliance
- Trust boundaries: only backend decides exclusive visibility.
- Sensitive data: no PIC plaintext is persisted; only verification result/state is persisted.
- Abuse resistance: unlock tied to user+channel and expiry; invalid/expired unlock rejected.
- Compliance: enforces KYC-dependent access policy for adult/exclusive content.

## 11. Observability and Analytics
- Product metrics: optional future metric on denied reason distribution.
- Operational metrics: monitor 403 rates on wave routes post-deploy.
- Logging/tracing: reuse existing controller error logs.
- Alert routing: none added in this patch.

## 12. Phased Delivery Plan
1. Implement backend gate and PIC unlock persistence.
2. Implement Flutter access-check handling for active wave.
3. Validate syntax/analyzer and update tracker completion.

## 13. Acceptance Criteria (Release Gate)
- [x] Unauthorized users do not receive exclusive waves from feed.
- [x] `GET /wave/:waveId` denies unauthorized exclusive access.
- [x] `POST /wave/:waveId/access-check` returns exclusive denial before age checks where applicable.
- [x] Successful PIC verification persists unlock state.
- [x] Mobile wave player respects access-check and blocks denied wave playback.
- [x] Touched files pass syntax/analyzer checks.

## 14. Test Matrix (Minimum)
- Persona tests:
  - guest user
  - authenticated non-KYC user
  - KYC user without entitlement
  - entitled user without PIC unlock
  - entitled + PIC-verified user
  - channel owner/admin
- Success/failure tests:
  - verify PIC success/failure and lockout behavior unchanged
  - expired entitlement/unlock blocks access
- Security tests:
  - direct `GET /wave/:id` on exclusive wave when unauthorized -> 403
  - `GET /wave/channel/:id` for exclusive channel unauthorized -> 403
- Performance tests:
  - feed request remains within acceptable response latency with gate checks
- Regression tests:
  - non-exclusive waves and CERS consent flow still work

## 15. Operational Runbook Requirements
- Incident classes: accidental over-blocking, under-blocking.
- Recovery SOP: temporary feature rollback by reverting wave gate checks.
- Escalation paths: backend on-call + mobile owner.

## 16. Release Checklist
- [ ] Backend deployed.
- [ ] Flutter build with gating handling deployed.
- [ ] Post-deploy verification across personas.
- [ ] Rollback path validated.

## Implementation Log
- [x] Added persistent PIC unlock model: `backend/src/channels/exclusive_pic_unlock.model.js`
- [x] Persisted unlock on successful PIC verification in `backend/src/channels/exclusive_channel.controller.js`
- [x] Enforced exclusive gating in Wave feed/single/channel/access-check in `backend/src/wave/wave.controller.js`
- [x] Added mobile access-check-driven blocking/overlay actions in `lib/features/wave/screens/wave_screen.dart`
- [x] Verified syntax/analyzer checks for touched backend and Flutter files.

## 17. Definition of Ready
1. Dependencies are mapped.
2. Rules and contracts are approved.
3. Non-happy paths are specified.
4. Monitoring expectations are attached.
5. Acceptance criteria are testable.

## 18. Definition of Done
1. End-to-end behavior is complete across backend and Flutter touchpoints.
2. Supporting remediation flows are functional from blocked states.
3. Security/compliance requirements are satisfied.
4. Verification evidence exists via analyzer/syntax and manual checks.
5. Rollout/rollback notes are captured.

## Required Preparation Hook Checklist
- [x] A tracker file exists and follows this template.
- [x] Completion contract is explicitly written.
- [x] API and data contracts are documented.
- [x] Non-happy path behavior is documented.
- [x] Security and observability sections are filled.
- [x] Acceptance criteria and test matrix are present.
