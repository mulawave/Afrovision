# Exclusive Channel Type End-to-End Implementation Tracker

## Objective

Deliver a production-ready `Exclusive` channel type with complete end-to-end behavior across Flutter app, website, backend, admin, billing, wallet distribution, security, notifications, analytics, QA, and rollout operations.

This implementation must satisfy all of the following:

- New channel type: `exclusive`.
- Visibility gate: only authenticated users with completed adult KYC can see exclusive channels in channel lists.
- Guests and non-KYC users cannot see exclusive channels in discovery/search/list responses.
- Access gate: KYC completion alone is not sufficient to access/watch an exclusive channel.
- Access requires an active personal identifier code (PIC) for that user-channel pair.
- If no active PIC exists, user must purchase PIC access by paying monthly entrance fee configured by channel owner.
- PIC expires exactly every 30 days; renewal requires payment at then-current fee.
- Only creators on premium subscription plan can create exclusive channels.
- Revenue split for PIC fee:
  - 50% cash to creator cash wallet.
  - 10% converted to vPT to community pool.
  - 20% cash to operations pool.
  - 10% converted to vPT distributed to creator referral tree (same default structure as creator subscription flow).
  - 10% converted to vPT to creator vPT wallet.

## Business Rules (Source of Truth)

1. Channel type enumeration includes `private`, `premium`, `exclusive`.
2. Exclusive channels are list-visible only to users who are:
   - authenticated, and
   - KYC status is `approved`, and
   - date-of-birth/adult check passes legal age threshold.
3. Exclusive channels must never appear in guest responses (app, website, API).
4. Exclusive channel detail/watch endpoints always enforce access policy server-side.
5. Access policy for exclusive channel is:
   - KYC approved adult AND active PIC entitlement.
6. PIC entitlement is scoped per user-channel and expires 30 days after issuance timestamp.
7. PIC issuance occurs only after successful monthly payment capture.
8. Renewal uses current fee at renewal time (not historically locked fee unless explicitly configured as fixed by future policy).
9. Creator eligibility to create/edit exclusive channels requires active creator premium subscription.
10. Channel owner can set and edit exclusive monthly entrance fee (with audit trail).
11. Revenue splitting is atomic and idempotent with ledger entries and wallet/pool updates.
12. All eligibility and entitlement checks must be enforced in backend even if frontend hides controls.

## Domain Model Changes

## New/Updated Entities

1. `channels`
   - add `channelType: enum(private, premium, exclusive)`
   - add `exclusiveSettings` object:
     - `monthlyFeeCashAmount`
     - `currency`
     - `isExclusiveEnabled`
     - `feeLastUpdatedAt`
     - `feeLastUpdatedBy`
2. `users`
   - ensure KYC fields are canonical and queryable:
     - `kycStatus`
     - `kycAdultVerified`
     - `kycApprovedAt`
3. `exclusive_access_entitlements` (new)
   - `id`
   - `userId`
   - `channelId`
   - `picHash` (never store raw code)
   - `status: active|expired|revoked`
   - `issuedAt`
   - `expiresAt`
   - `lastRenewedAt`
   - `originPaymentId`
4. `exclusive_access_transactions` (new)
   - payment and entitlement transaction metadata
   - `idempotencyKey`
   - split amounts (cash/vPT per destination)
   - status timeline
5. `wallet_ledger` (existing extension)
   - add transaction types for exclusive access split legs
6. `notifications` (existing extension)
   - templates and events for exclusive access lifecycle
7. `audit_logs` (existing extension)
   - channel fee updates, entitlement issuance, revocations

## API Contracts

## Public/Authenticated Channel APIs

1. `GET /channels`
   - apply visibility filter by auth + KYC state.
   - guests: exclude exclusive.
   - auth without adult KYC: exclude exclusive.
2. `GET /channels/:id`
   - for `exclusive`, return guarded response if not eligible:
     - `requiresKyc`, `requiresPic`, `requiresPayment` flags.
3. `GET /channels/:id/watch-token`
   - for `exclusive`, deny unless active entitlement.

## Exclusive Access APIs

1. `GET /channels/:id/exclusive/access-status`
   - returns `eligibleByKyc`, `hasActiveEntitlement`, `expiresAt`, `renewalRequired`.
2. `POST /channels/:id/exclusive/purchase`
   - validates creator fee config and user eligibility.
   - initiates/captures monthly charge.
   - creates/renews entitlement and PIC.
   - executes fee split.
3. `POST /channels/:id/exclusive/verify-pic`
   - validates user-submitted PIC and binds to entitlement if required by UX step.
4. `POST /channels/:id/exclusive/renew`
   - renews entitlement with current fee and new expiry.

## Creator/Admin APIs

1. `POST /creator/channels`
   - for `channelType=exclusive`, enforce premium creator subscription.
2. `PATCH /creator/channels/:id/exclusive-settings`
   - update monthly fee and currency.
   - validate min/max fee guardrails.
   - write audit log.
3. `GET /creator/channels/:id/exclusive/metrics`
   - subscriber count, active entitlements, renewals, churn, revenue split summary.

## End-to-End User Flows

## A. Channel Discovery

1. Guest user:
   - exclusive channels absent from list/search/recommendations.
2. Logged-in non-KYC user:
   - exclusive channels absent.
3. Logged-in KYC-approved adult user:
   - exclusive channels visible with badge.

## B. Attempted Channel Access (KYC Approved but No PIC)

1. User taps exclusive channel card.
2. Backend access-status check fails `hasActiveEntitlement`.
3. UI blocks detail/watch and opens access paywall modal/screen.
4. Show fee, billing period, split policy summary, terms.
5. User pays fee.
6. On success, system issues/renews entitlement and PIC, then grants access.
7. Success alert + notification + receipt.

## C. Access with Active PIC

1. User taps channel.
2. Access-status returns active entitlement.
3. Detail/watch access granted.

## D. Expiry and Renewal

1. Scheduler marks entitlement expired at `expiresAt`.
2. Access blocked on next attempt.
3. Renewal flow prompts payment and issues renewed entitlement.

## E. Creator Flow

1. Creator attempts exclusive channel creation.
2. System checks premium creator plan.
3. If eligible, allow creation and fee setup.
4. If not eligible, show upgrade plan CTA and block creation.

## Payment and Distribution Engine

## Fee Split Execution (Atomic)

For gross payment amount `P`:

- Creator cash wallet: `0.50P`
- Community pool vPT conversion: `0.10P`
- Operations pool cash: `0.20P`
- Referral tree vPT conversion: `0.10P`
- Creator vPT wallet conversion: `0.10P`

Requirements:

1. Distribution transaction runs in one atomic orchestrated operation.
2. Use idempotency key per payment event to prevent duplicate splits.
3. If any split leg fails, execute compensating action or keep in pending-reconciliation queue with hard alerts.
4. Persist detailed ledger entries for each leg.
5. Reuse default creator-subscription referral tree distribution logic for the referral 10% leg.

## vPT Conversion Rules

1. Conversion rate source must be deterministic per transaction.
2. Store conversion rate snapshot with transaction.
3. Record both source cash amount and resulting vPT amount.

## Security and Compliance

1. Never trust frontend for visibility/access enforcement.
2. PIC stored hashed with strong one-way hash + salt.
3. Rate limit PIC verify endpoint and lockout on repeated failures.
4. Mandatory audit trail for:
   - fee changes
   - entitlement issue/renew/revoke
   - failed payment/split incidents
5. KYC status consumed from authoritative verified source only.
6. Ensure legal-age checks are jurisdiction-aware if required by policy.
7. Ensure exclusive channels are excluded from all unauthenticated cache keys and CDN variants.

## Notifications and Alerts (Mandatory)

## User Notifications

1. On successful purchase:
   - in-app notification
   - email receipt
2. Renewal reminders:
   - T-7 days, T-3 days, T-1 day before expiry
3. Expiry alert:
   - immediate notification at expiry
4. Payment failure alerts:
   - in-app + email with retry CTA

## Creator Notifications

1. New exclusive access purchase event.
2. Renewal event.
3. Monthly settlement summary for exclusive access revenue.
4. Fee change confirmation.

## Operations/Admin Alerts

1. Split-processing failure alert (P1).
2. Reconciliation mismatch alert (P1).
3. Unusual entitlement issuance spike (fraud anomaly alert).
4. Scheduler failure for expiry job (P1).

## Frontend Implementation Scope

## Flutter App

1. Channel list filtering behavior by auth/KYC state.
2. Exclusive badge and access state labels.
3. Exclusive paywall screen/modal with full states:
   - loading
   - requires login
   - requires KYC
   - no entitlement
   - purchase in progress
   - purchase success
   - purchase failure
4. PIC entry and verification UX.
5. Renewal UX from profile/subscription center.
6. Notification center entries and deep links.

## Website

1. Match app behavior for visibility and gating.
2. Ensure SSR/CSR data fetching respects exclusive filtering.
3. Avoid exposing exclusive channel data in page source for ineligible users.

## Creator/Admin Surfaces

1. Channel create/edit forms add `exclusive` option.
2. Fee configuration controls with validation and confirmation dialog.
3. Premium-plan enforcement messaging.
4. Metrics and entitlement management dashboard.
5. Operations panel for failed payments, split exceptions, manual review.

## Backend Services and Jobs

1. `exclusive-access-policy-service`
   - centralized policy decisions for visibility and access.
2. `exclusive-entitlement-service`
   - issue, renew, expire, revoke entitlement lifecycle.
3. `exclusive-billing-service`
   - charge orchestration and idempotent retries.
4. `exclusive-split-engine`
   - distribution and ledger posting.
5. Scheduler jobs:
   - entitlement expiry processor
   - renewal reminder dispatcher
   - reconciliation checker

## Observability and Analytics

## Metrics

1. Exclusive channels created (daily/weekly/monthly).
2. Eligible viewers count vs total active users.
3. Purchase conversion rate from access paywall.
4. Renewal rate and churn rate.
5. Split success/failure rate.
6. PIC verification failure rate.

## Logging and Tracing

1. Correlation ID across payment, entitlement, and split operations.
2. Structured logs for policy denials and reasons.
3. Redaction policy for sensitive fields.

## Phased Delivery Plan

## Phase 0 - Product, Policy, and Compliance Lock

Tickets:

- `AV-EXC-001` Finalize exclusive feature policy and legal/compliance approvals.
- `AV-EXC-002` Confirm KYC adult-verification source-of-truth and edge cases.
- `AV-EXC-003` Approve PIC lifecycle policy, expiry, and renewal reminders.

Exit Criteria:

- Signed policy document.
- Legal text for paywall and terms approved.

## Phase 1 - Data and Contract Foundation

Tickets:

- `AV-EXC-010` Add channel type enum and exclusive settings fields.
- `AV-EXC-011` Create entitlement and transaction data models.
- `AV-EXC-012` Add wallet ledger transaction types.
- `AV-EXC-013` Add audit log taxonomy for exclusive events.

Exit Criteria:

- Migrations complete.
- Backward compatibility verified.

## Phase 2 - Access Policy and Visibility Enforcement

Tickets:

- `AV-EXC-020` Implement channel list/search visibility filter.
- `AV-EXC-021` Implement detail/watch access enforcement middleware.
- `AV-EXC-022` Add exclusive access-status endpoint.
- `AV-EXC-023` Add cache/CDN filtering safeguards.

Exit Criteria:

- Guests/non-KYC never receive exclusive channels from API.
- Direct URL access blocked when not entitled.

## Phase 3 - Billing, PIC, and Entitlement Lifecycle

Tickets:

- `AV-EXC-030` Build purchase endpoint with payment capture.
- `AV-EXC-031` Build PIC issue/verify flow with secure hashing.
- `AV-EXC-032` Build renewal endpoint and lifecycle updates.
- `AV-EXC-033` Build expiry scheduler and status transitions.
- `AV-EXC-034` Add idempotency and duplicate protection.

Exit Criteria:

- Successful payment grants entitlement.
- Expired entitlement blocks access until renewal.

## Phase 4 - Fee Split and Wallet Distribution

Tickets:

- `AV-EXC-040` Implement split engine with 50/10/20/10/10 distribution.
- `AV-EXC-041` Integrate vPT conversion snapshots.
- `AV-EXC-042` Integrate creator referral tree distribution logic.
- `AV-EXC-043` Add reconciliation and exception handling pipeline.

Exit Criteria:

- Ledger and wallet balances reconcile exactly.
- Failure recovery and alerts operational.

## Phase 5 - Creator and Admin Experience

Tickets:

- `AV-EXC-050` Restrict exclusive channel creation to premium creators.
- `AV-EXC-051` Add creator fee configuration UI and validations.
- `AV-EXC-052` Add creator metrics for exclusive subscriptions.
- `AV-EXC-053` Add admin operations panel for incidents and overrides.

Exit Criteria:

- Non-premium creators blocked with upgrade path.
- Fee edits auditable and effective.

## Phase 6 - App and Website UX Completion

Tickets:

- `AV-EXC-060` Flutter exclusive card badge and gated access flows.
- `AV-EXC-061` Flutter paywall + payment + PIC UX complete states.
- `AV-EXC-062` Website parity for discovery and access-gating flows.
- `AV-EXC-063` Deep links and route guards for exclusive channels.

Exit Criteria:

- No dead-end states.
- Full UX for login/KYC/payment/PIC/renewal paths.

## Phase 7 - Notifications, Alerts, and Messaging

Tickets:

- `AV-EXC-070` Add user lifecycle notifications and reminder cadence.
- `AV-EXC-071` Add creator business event notifications.
- `AV-EXC-072` Add ops alert routing for failures/anomalies.
- `AV-EXC-073` Add email templates and multilingual content support.

Exit Criteria:

- All required events trigger reliably with retries and dead-letter handling.

## Phase 8 - QA, Security Hardening, and Performance

Tickets:

- `AV-EXC-080` Unit/integration tests for policy, billing, split, entitlement.
- `AV-EXC-081` E2E tests for guest, non-KYC, KYC-no-PIC, active-PIC, expired-PIC.
- `AV-EXC-082` Security tests for bypass, brute force, replay, and idempotency abuse.
- `AV-EXC-083` Load tests for peak purchase and renewal windows.

Exit Criteria:

- Test pass thresholds met.
- Security findings remediated.

## Phase 9 - Rollout and Production Readiness

Tickets:

- `AV-EXC-090` Feature flags and gradual rollout plan.
- `AV-EXC-091` Data migration/backfill for existing channels if needed.
- `AV-EXC-092` Dashboard, SLOs, and on-call runbook finalization.
- `AV-EXC-093` Go-live checklist, rollback plan, and post-launch monitoring.

Exit Criteria:

- Controlled rollout completed with no Sev-1 regressions.
- Post-launch validation signed off.

## Dependency Sequence (Critical Path)

1. `AV-EXC-001` -> `AV-EXC-010` -> `AV-EXC-020`
2. `AV-EXC-020` -> `AV-EXC-030` -> `AV-EXC-040`
3. `AV-EXC-030` -> `AV-EXC-060` -> `AV-EXC-081`
4. `AV-EXC-040` -> `AV-EXC-043` -> `AV-EXC-090`

## Acceptance Criteria (Release Gate)

1. Exclusive channels invisible to guests and non-adult-KYC users across all entry points.
2. Exclusive direct access denied without active entitlement regardless of client behavior.
3. Purchase flow reliably issues entitlement and grants access on success.
4. Expiry after 30 days is enforced and renewal works.
5. Revenue split ledger entries match configured percentages exactly.
6. Creator premium-only creation restriction enforced server-side and UI-side.
7. Notification/alert matrix is fully operational.
8. Audit logs available for all compliance-critical actions.
9. End-to-end tests pass for all major personas and error conditions.
10. Rollback and incident runbooks are approved by engineering and operations.

## Test Matrix (Minimum)

1. Persona tests:
   - guest
   - authenticated non-KYC
   - KYC pending/rejected
   - KYC approved adult no entitlement
   - KYC approved adult active entitlement
   - KYC approved adult expired entitlement
2. Payment tests:
   - success
   - decline
   - timeout
   - duplicate callback
3. Split tests:
   - all legs success
   - partial failure and reconciliation
4. Security tests:
   - direct endpoint bypass attempts
   - PIC brute force
   - replay with same idempotency key
5. Regression tests:
   - private and premium channel behavior unchanged.

## Operational Runbook Requirements

1. Incident classification for failed purchases, split mismatches, scheduler outages.
2. Manual entitlement revoke/restore SOP with approval steps.
3. Reconciliation report generation and variance thresholds.
4. Alert escalation path and on-call ownership map.

## Suggested File/Module Touchpoints (Implementation Planning)

1. Flutter app:
   - channel listing and channel detail access gates.
   - creator channel creation/edit forms.
   - notification center.
2. Backend:
   - channel controllers/services/repositories.
   - billing/payment webhooks.
   - wallet and referral distribution services.
   - scheduler/cron modules.
3. Website:
   - channel list/query server routes.
   - channel detail gating middleware.
4. Admin:
   - creator subscription eligibility views.
   - exclusive analytics and incident tooling.

## Release Checklist

1. Feature flags configured by environment.
2. Monitoring dashboards live and validated.
3. Notification templates approved.
4. Finance reconciliation signoff.
5. Legal/compliance signoff.
6. Support playbook and FAQ published.
7. Canary rollout complete.
8. Full rollout complete with 48-hour enhanced monitoring.

## Notes for Implementation Teams

1. Do not expose exclusive channel metadata in any unauthenticated payload.
2. Keep all policy logic in a single backend policy service to avoid drift.
3. Reuse existing creator subscription referral distribution code path for consistency.
4. Implement idempotency at payment intake and split execution boundaries.
5. Treat this tracker as the delivery baseline for 100% completion before marking feature done.

## Suggested Delivery Order

1. `AV-EXC-001` to `AV-EXC-013`
2. `AV-EXC-020` to `AV-EXC-034`
3. `AV-EXC-040` to `AV-EXC-053`
4. `AV-EXC-060` to `AV-EXC-073`
5. `AV-EXC-080` to `AV-EXC-093`

## Parallel Delivery Waves

## Wave 0 - Immediate Kickoff

- `AV-EXC-001`
- `AV-EXC-002`
- `AV-EXC-003`

## Wave 1 - Foundation Build

- `AV-EXC-010`
- `AV-EXC-011`
- `AV-EXC-012`
- `AV-EXC-013`
- `AV-EXC-020`
- `AV-EXC-021`
- `AV-EXC-022`
- `AV-EXC-023`

## Wave 2 - Revenue and Entitlement Core

- `AV-EXC-030`
- `AV-EXC-031`
- `AV-EXC-032`
- `AV-EXC-033`
- `AV-EXC-034`
- `AV-EXC-040`
- `AV-EXC-041`
- `AV-EXC-042`
- `AV-EXC-043`

## Wave 3 - Surface Completion

- `AV-EXC-050`
- `AV-EXC-051`
- `AV-EXC-052`
- `AV-EXC-053`
- `AV-EXC-060`
- `AV-EXC-061`
- `AV-EXC-062`
- `AV-EXC-063`
- `AV-EXC-070`
- `AV-EXC-071`
- `AV-EXC-072`
- `AV-EXC-073`

## Wave 4 - Hardening and Launch

- `AV-EXC-080`
- `AV-EXC-081`
- `AV-EXC-082`
- `AV-EXC-083`
- `AV-EXC-090`
- `AV-EXC-091`
- `AV-EXC-092`
- `AV-EXC-093`

## Team-Split Execution View

## Backend Queue

1. `AV-EXC-010`
2. `AV-EXC-011`
3. `AV-EXC-012`
4. `AV-EXC-013`
5. `AV-EXC-020`
6. `AV-EXC-021`
7. `AV-EXC-022`
8. `AV-EXC-023`
9. `AV-EXC-030`
10. `AV-EXC-031`
11. `AV-EXC-032`
12. `AV-EXC-033`
13. `AV-EXC-034`
14. `AV-EXC-040`
15. `AV-EXC-041`
16. `AV-EXC-042`
17. `AV-EXC-043`
18. `AV-EXC-070`
19. `AV-EXC-071`
20. `AV-EXC-072`

## Flutter Queue

1. `AV-EXC-060`
2. `AV-EXC-061`
3. `AV-EXC-063`

## Website Queue

1. `AV-EXC-062`
2. `AV-EXC-063` (web route parity)

## Admin Queue

1. `AV-EXC-051`
2. `AV-EXC-052`
3. `AV-EXC-053`

## Product/Ops Queue

1. `AV-EXC-001`
2. `AV-EXC-002`
3. `AV-EXC-003`
4. `AV-EXC-090`
5. `AV-EXC-092`
6. `AV-EXC-093`

## QA/Security Queue

1. `AV-EXC-080`
2. `AV-EXC-081`
3. `AV-EXC-082`
4. `AV-EXC-083`

## Dependency Map

| Ticket | Depends On |
| --- | --- |
| `AV-EXC-001` | None |
| `AV-EXC-002` | None |
| `AV-EXC-003` | `AV-EXC-001` |
| `AV-EXC-010` | `AV-EXC-001`, `AV-EXC-002` |
| `AV-EXC-011` | `AV-EXC-010` |
| `AV-EXC-012` | `AV-EXC-010` |
| `AV-EXC-013` | `AV-EXC-010` |
| `AV-EXC-020` | `AV-EXC-010`, `AV-EXC-011` |
| `AV-EXC-021` | `AV-EXC-020` |
| `AV-EXC-022` | `AV-EXC-020` |
| `AV-EXC-023` | `AV-EXC-020` |
| `AV-EXC-030` | `AV-EXC-011`, `AV-EXC-020`, `AV-EXC-022` |
| `AV-EXC-031` | `AV-EXC-030` |
| `AV-EXC-032` | `AV-EXC-030`, `AV-EXC-031` |
| `AV-EXC-033` | `AV-EXC-011`, `AV-EXC-032` |
| `AV-EXC-034` | `AV-EXC-030` |
| `AV-EXC-040` | `AV-EXC-030`, `AV-EXC-034` |
| `AV-EXC-041` | `AV-EXC-040` |
| `AV-EXC-042` | `AV-EXC-040` |
| `AV-EXC-043` | `AV-EXC-040`, `AV-EXC-041`, `AV-EXC-042` |
| `AV-EXC-050` | `AV-EXC-010`, `AV-EXC-020` |
| `AV-EXC-051` | `AV-EXC-010`, `AV-EXC-050` |
| `AV-EXC-052` | `AV-EXC-011`, `AV-EXC-040` |
| `AV-EXC-053` | `AV-EXC-043`, `AV-EXC-052` |
| `AV-EXC-060` | `AV-EXC-020`, `AV-EXC-022` |
| `AV-EXC-061` | `AV-EXC-030`, `AV-EXC-031`, `AV-EXC-032` |
| `AV-EXC-062` | `AV-EXC-020`, `AV-EXC-022` |
| `AV-EXC-063` | `AV-EXC-021`, `AV-EXC-060`, `AV-EXC-062` |
| `AV-EXC-070` | `AV-EXC-030`, `AV-EXC-032`, `AV-EXC-033` |
| `AV-EXC-071` | `AV-EXC-040`, `AV-EXC-051` |
| `AV-EXC-072` | `AV-EXC-043`, `AV-EXC-033` |
| `AV-EXC-073` | `AV-EXC-070`, `AV-EXC-071`, `AV-EXC-072` |
| `AV-EXC-080` | `AV-EXC-021`, `AV-EXC-030`, `AV-EXC-040` |
| `AV-EXC-081` | `AV-EXC-060`, `AV-EXC-061`, `AV-EXC-062`, `AV-EXC-063` |
| `AV-EXC-082` | `AV-EXC-021`, `AV-EXC-031`, `AV-EXC-034` |
| `AV-EXC-083` | `AV-EXC-030`, `AV-EXC-040` |
| `AV-EXC-090` | `AV-EXC-080`, `AV-EXC-081`, `AV-EXC-082` |
| `AV-EXC-091` | `AV-EXC-010`, `AV-EXC-020` |
| `AV-EXC-092` | `AV-EXC-043`, `AV-EXC-072` |
| `AV-EXC-093` | `AV-EXC-090`, `AV-EXC-091`, `AV-EXC-092` |

## Tracker-Ready Register

| Ticket | Summary | Type | Priority | Primary Lane | Estimate | Target Sprint |
| --- | --- | --- | --- | --- | --- | --- |
| `AV-EXC-001` | Finalize exclusive policy and legal approvals | Spike | P0 | Product/Ops | 2 points | Sprint 1 |
| `AV-EXC-002` | Lock KYC adult verification source and rules | Spike | P0 | Product/Ops + Backend | 2 points | Sprint 1 |
| `AV-EXC-003` | Finalize PIC lifecycle and reminder policy | Spike | P1 | Product/Ops | 1 point | Sprint 1 |
| `AV-EXC-010` ✅ | Add exclusive channel schema and settings fields | Story | P0 | Backend | 5 points | Sprint 1 |
| `AV-EXC-011` ✅ | Create entitlement and transaction storage contracts | Story | P0 | Backend | 5 points | Sprint 1 |
| `AV-EXC-012` ✅ | Extend wallet ledger types for exclusive split legs | Story | P0 | Backend | 3 points | Sprint 1 |
| `AV-EXC-013` | Add audit events for exclusive operations | Story | P1 | Backend | 3 points | Sprint 1 |
| `AV-EXC-020` ✅ | Implement exclusive visibility filter across list/search APIs | Story | P0 | Backend | 5 points | Sprint 2 |
| `AV-EXC-021` ✅ | Enforce exclusive detail/watch access policy middleware | Story | P0 | Backend | 5 points | Sprint 2 |
| `AV-EXC-022` ✅ | Add exclusive access status endpoint | Story | P0 | Backend | 3 points | Sprint 2 |
| `AV-EXC-023` | Add cache and CDN safeguards for exclusive payloads | Task | P1 | Backend + Ops | 3 points | Sprint 2 |
| `AV-EXC-030` ✅ | Build purchase flow for monthly exclusive access | Story | P0 | Backend | 8 points | Sprint 2 |
| `AV-EXC-031` ✅ | Build PIC issuance and verification service | Story | P0 | Backend | 5 points | Sprint 2 |
| `AV-EXC-032` ✅ | Implement renewal endpoint and lifecycle handling | Story | P0 | Backend | 5 points | Sprint 2 |
| `AV-EXC-033` | Implement entitlement expiry scheduler | Story | P1 | Backend | 3 points | Sprint 2 |
| `AV-EXC-034` | Add idempotency and duplicate-event protection | Story | P0 | Backend | 5 points | Sprint 2 |
| `AV-EXC-040` ✅ | Implement 50/10/20/10/10 split engine | Story | P0 | Backend | 8 points | Sprint 3 |
| `AV-EXC-041` ✅ | Add deterministic vPT conversion snapshots | Story | P1 | Backend | 3 points | Sprint 3 |
| `AV-EXC-042` ✅ | Integrate referral tree split distribution | Story | P0 | Backend | 5 points | Sprint 3 |
| `AV-EXC-043` ✅ | Build reconciliation and split exception handling | Story | P0 | Backend + Ops | 5 points | Sprint 3 |
| `AV-EXC-050` ✅ | Restrict exclusive channel creation to premium creators | Story | P0 | Backend + Creator UX | 5 points | Sprint 3 |
| `AV-EXC-051` ✅ | Add creator fee configuration controls and validation | Story | P1 | Admin + Backend | 5 points | Sprint 3 |
| `AV-EXC-052` | Add creator metrics for entitlement and revenue | Story | P1 | Admin + Backend | 5 points | Sprint 3 |
| `AV-EXC-053` | Add admin incident tooling for payments/splits | Story | P1 | Admin + Backend | 5 points | Sprint 3 |
| `AV-EXC-060` ✅ | Add app exclusive discovery badges and gating states | Story | P0 | Flutter | 5 points | Sprint 4 |
| `AV-EXC-061` ✅ | Add app paywall, payment, and PIC screens with full states | Story | P0 | Flutter | 8 points | Sprint 4 |
| `AV-EXC-062` ✅ | Implement website parity for exclusive visibility and gating | Story | P0 | Website | 8 points | Sprint 4 |
| `AV-EXC-063` ✅ | Add deep-link route guards for exclusive channels | Story | P1 | Flutter + Website | 3 points | Sprint 4 |
| `AV-EXC-070` ✅ | Implement user reminders, receipts, and expiry notifications | Story | P0 | Backend + App/Web | 5 points | Sprint 4 |
| `AV-EXC-071` ✅ | Implement creator business event notifications | Story | P1 | Backend + Admin | 3 points | Sprint 4 |
| `AV-EXC-072` ✅ | Implement operations alerts for failures and anomalies | Story | P0 | Backend + Ops | 3 points | Sprint 4 |
| `AV-EXC-073` ✅ | Add and approve message templates for exclusive lifecycle | Task | P1 | Product/Ops + Backend | 2 points | Sprint 4 |
| `AV-EXC-080` ✅ | Add unit and integration coverage for exclusive backend services | Task | P0 | Backend QA | 5 points | Sprint 5 |
| `AV-EXC-081` ✅ | Add end-to-end persona and lifecycle test coverage | Task | P0 | QA | 8 points | Sprint 5 |
| `AV-EXC-082` ✅ | Run security hardening and abuse-path testing | Task | P0 | Security + Backend | 5 points | Sprint 5 |
| `AV-EXC-083` ✅ | Run performance/load tests for billing and renewal peaks | Task | P1 | QA + Backend | 3 points | Sprint 5 |
| `AV-EXC-090` ✅ | Execute feature-flagged staged rollout | Task | P0 | Ops | 3 points | Sprint 6 |
| `AV-EXC-091` ✅ | Run any required backfill/migration steps safely | Task | P1 | Backend + Ops | 3 points | Sprint 6 |
| `AV-EXC-092` ✅ | Finalize dashboards, SLOs, and on-call runbook | Task | P0 | Ops + Backend | 3 points | Sprint 6 |
| `AV-EXC-093` ✅ | Complete go-live and 48-hour enhanced monitoring | Task | P0 | Ops + QA + Product | 2 points | Sprint 6 |

## Current Baseline Status

Completed in the committed baseline:

- Backend exclusive channel foundation, access gating, purchase/renewal, and split logic.
- Creator-side exclusive fee setup and validation.
- Flutter exclusive channel creation, metadata, list/view/studio labeling, edit fee management, and dedicated exclusive paywall/PIC verification flow.
- Flutter route-guard parity added across home, search, channel-number access, notifications, and subscriptions entry points.
- Website exclusive channel parity delivered: gated profile/live flows, dedicated exclusive access page, and deep-link protection.
- Backend exclusive lifecycle worker added for T-7/T-3/T-1 reminders, automatic expiry notifications, creator lifecycle events, and ops alert routing.

Still pending:

- Production go-live execution window and 48-hour live signoff (operational event outside local codebase).

## Definition of Ready

1. Ticket includes all dependent ticket IDs and confirmed sequence.
2. API contract and data fields are documented and approved.
3. Error states and non-happy path behavior are explicitly stated.
4. Monitoring and alert expectations are attached for production-impacting flows.
5. Acceptance criteria are testable in lower and staging environments.

## Definition of Done

1. Feature behavior is complete across backend + relevant surfaces.
2. Required notifications/alerts are wired and validated.
3. Ledger, payouts, and reconciliation checks pass for financial flows.
4. Security and audit requirements for touched scope are validated.
5. QA evidence is attached and rollback path is verified before release.