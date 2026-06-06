# AfroVision CERS — End-to-End Implementation Tracker

## 1. Feature Identity

- **Feature Name**: Community Content Classification, Enforcement & Reputation System (CERS)
- **Owner Team(s)**: Product, Trust & Safety, Engineering, Ops
- **Primary Surfaces**: Backend, Website, Flutter, Admin, Ops
- **Related Tickets**: CERS-01 through CERS-40 (defined in this tracker)
- **Linked Tracker File**: `cers-end-to-end-implementation-tracker.md`

---

## 2. Objective

Ship a production-grade content classification and community enforcement system for Waves that prevents accidental minor exposure, enables anonymous abuse-resistant reporting, applies policy-based penalties, performs private reward distributions, and enforces lock/unlock lifecycle with auditability and admin governance.

---

## 3. Completion Contract

1. **Entry points and discovery surfaces**: Wave upload, Wave feed/detail/mini player, admin moderation queue, creator lock flow
2. **Destination UX and interaction states**: Mandatory upload classification, adult warning gate, moderation case UX, lock screen and pay-to-unlock
3. **Backend/API/storage/state wiring**: New classification/report/case/reward/reputation entities and policy-checked APIs
4. **Navigation and deep links**: Protected entry into 18+ content and forced lock redirect for penalized creators
5. **Permissions, entitlement, validation, and edge cases**: Reputation-gated reporting, age/KYC/consent checks, anti-abuse throttles, idempotent enforcement
6. **Operational controls and management tooling**: Fine matrix, distribution percentages, thresholds, review dashboard, appeals controls
7. **Notifications/alerts/analytics coverage**: Creator/reporter/referral notices, moderation metrics, abuse alerting
8. **QA and rollout readiness**: Automated tests, policy verification, staged rollout and rollback controls

---

## 4. Business Rules (Source of Truth)

- Every wave requires one of: `minor_safe`, `teen`, `adult` before publish.
- Upload must include explicit-content toggles: `has_explicit_language`, `has_nudity`, `has_violence`.
- Access control:
  - `minor_safe`: everyone
  - `teen`: account age >= 13
  - `adult`: account age >= 18 and (KYC verified or explicit adult-confirmation) and consent acknowledgment
- Reporter identity is private and never shown to creators.
- Violating creators see only aggregate fine line item, never distribution details.
- Report eligibility is policy-controlled by minimum reputation/account age/session count/abuse status.
- False reporting reduces reputation and increases abuse score.
- Valid reports trigger enforcement workflow: remove content, fine creator, lock if insufficient funds, private reward distribution, immutable audit log.
- Fine levels and percentage distributions are admin-editable.
- Enforcement system language is neutral/professional ("Community Service Rewards", "Community Standards Fine").

---

## 5. Domain Model Changes

### New/Updated Entities

- `waves` (updated)
  - `age_classification`: `minor_safe | teen | adult`
  - `has_explicit_language`: boolean
  - `has_nudity`: boolean
  - `has_violence`: boolean
  - `adult_gate_required`: boolean (derived for adult content)
- `wave_classification_reports` (new)
  - report payload, reason type, suggested classification, private reporter fields, abuse metadata
- `wave_moderation_cases` (new)
  - case status lifecycle: `open | under_review | resolved_valid | resolved_invalid | appealed`
- `community_service_reward_ledger` (new)
  - private distribution records (cash/vPT/referral allocations)
- `creator_violation_locks` (new)
  - lock state, fine amount, payment state, unlock metadata
- `reporter_reputation_state` (new/updated reputation integration)
  - score, abuse score, rate limits, suspension windows
- `cers_policy_config` (new)
  - admin-managed thresholds, fine matrix, percentages, lock thresholds
- `cers_audit_log` (new, immutable)
  - append-only governance trail

---

## 6. API Contracts

### Viewer APIs

- `POST /wave/register` (updated)
  - requires classification and explicit toggles
- `GET /wave/feed`, `GET /wave/:waveId` (updated)
  - returns classification metadata and gate signals
- `POST /wave/:waveId/access-consent` (new)
  - stores adult consent for session/user
- `POST /wave/:waveId/classification-report` (new)
  - requires reporter eligibility and cooldown checks

### Creator APIs

- `GET /creator/violation-lock` (new)
  - lock status + payable amount + content notice
- `POST /creator/violation-lock/pay` (new)
  - settle fine, trigger hidden distributions, unlock account

### Admin APIs

- `GET /admin/cers/cases` (new)
- `POST /admin/cers/cases/:caseId/review` (new)
- `GET/PUT /admin/cers/policies` (new)
- `GET /admin/cers/audit/export` (new)

### Auth/Policy and Error Mapping

- `401`: missing auth
- `403`: policy/age/reputation lockout
- `409`: idempotency conflict/in-flight lock action
- `422`: invalid classification contract payload
- `429`: abuse/cooldown/rate-limit hit

---

## 7. End-to-End User Flows

1. **Discovery flow**: user enters feed, sees classification badges, gated waves respect age/consent policy.
2. **Primary success flow**: creator uploads classified wave; eligible reporter files valid report; system enforces fine and private rewards.
3. **Failure and recovery flow**: invalid report lowers reporter reputation; creator appeals/recovery path; lock is removed after payment.
4. **Follow-up action flow**: admin reviews queue, adjusts outcome, triggers notifications.
5. **Lifecycle/state-transition flow**: repeated violations escalate fine levels/lock durations per policy.

---

## 8. Frontend Scope

### Website

- Upload UI: mandatory classification + explicit toggles + validation
- Wave card/feed/detail/mini player: always-visible classification badge
- Adult warning modal with session suppression
- Reporter flow: eligibility-aware report UI with cooldown feedback
- Creator lock screen: forced redirect and payment action

### Flutter

- Matching upload fields and badge visibility
- Gating and lock-screen parity with website

### Shared UX States

- loading/empty/error/success/disabled states for report and lock flows

---

## 9. Backend/Jobs Scope

- Classification-aware wave create/read filters
- Moderation case creation + review handlers
- Fine engine + hidden distribution engine + referral integration
- Reputation scoring and abuse throttling workers
- Idempotent lock/unlock and payout jobs
- Append-only audit logger

---

## 10. Security and Compliance

- Reporter identity only in protected/private fields; never exposed in creator-facing APIs.
- Sensitive moderation/distribution logic server-side only.
- Anti-spam controls: report limits, cooldowns, eligibility thresholds, abuse suspension.
- Immutable audit records for moderation and financial actions.
- Strict response shaping to prevent transaction traceability by violating creators.

---

## 11. Observability and Analytics

- Product metrics: report volumes, valid/invalid ratio, enforcement latency, badge coverage.
- Ops metrics: lock counts, unlock success, payout execution status, failed distributions.
- Security metrics: abuse suspensions, throttle hits, suspicious report clusters.
- Alerts: payout failures, case backlog, lock processing errors.

---

## 12. Phased Delivery Plan

- **Phase 1**: classification schema + upload enforcement + badge display + basic age gating
- **Phase 2**: report eligibility + moderation case creation + admin queue foundations
- **Phase 3**: enforcement engine + lock/unlock + hidden distributions + notifications
- **Phase 4**: reputation and anti-abuse automation + advanced analytics + appeals workflow
- **Phase 5**: rollout hardening, audits, load/perf/security tests, staged release

---

## 13. Acceptance Criteria (Release Gate)

- [ ] No wave can be published without valid classification and explicit toggles.
- [ ] Classification badge is visible across feed, detail, and mini-player surfaces.
- [ ] Teen/adult access controls enforce age and consent/KYC rules.
- [ ] Reporter identity is never exposed in creator-facing endpoints or UI.
- [ ] Valid report triggers enforcement pipeline with private distributions.
- [ ] Invalid reports adjust reputation/abuse counters.
- [ ] Lock screen blocks all auth-gated routes while lock is active.
- [ ] Creator sees only aggregate fine transaction label.
- [ ] Reporter/referral earners see sanitized reward labels only.
- [ ] Admin can configure fine/reputation/distribution policies from panel.
- [ ] Immutable audit export includes all key moderation and payout events.

---

## 14. Test Matrix (Minimum)

- Persona tests: guest/viewer/creator/admin, underage/18+/KYC states
- Success/failure tests: valid vs invalid report review outcomes
- Security tests: reporter anonymity, API response leakage, abuse throttling
- Performance tests: moderation queue and payout worker throughput
- Regression tests: existing wave upload/feed/comment/bookmark flows

---

## 15. Operational Runbook Requirements

- Incident classes: payout failure, lock deadlock, moderation backlog, abuse spikes
- Recovery SOP: replay-safe payout rerun, lock repair, case-state reconciliation
- Escalation paths: Trust & Safety -> Backend -> Ops on-call

---

## 16. Release Checklist

- Feature flags for CERS subsystems
- Monitoring + alert routes configured
- Compliance/policy signoff completed
- Rollback paths validated
- 48-hour post-launch monitoring plan scheduled

---

## 17. Definition of Ready

1. Dependencies and data contracts mapped.
2. Rules and policies approved.
3. Non-happy paths specified.
4. Monitoring expectations attached.
5. Acceptance criteria are testable.

---

## 18. Definition of Done

1. End-to-end behavior is complete across all touched layers.
2. Supporting controls are operational.
3. Security/compliance requirements pass verification.
4. QA evidence is attached.
5. Rollout and rollback playbooks are validated.

---

## Ticket Checklist

- [x] CERS-01 Create implementation tracker and completion contract
- [x] CERS-02 Backend wave schema: classification + explicit toggles
- [x] CERS-03 Website upload UX: mandatory classification + toggles + validation
- [x] CERS-04 Website wave badges: feed/detail/mini surfaces
- [x] CERS-05 Basic age gating and adult-warning session gate
- [x] CERS-06 Classification-report endpoint with eligibility guard scaffold
- [x] CERS-07 Moderation case schema and creation pipeline scaffold
- [x] CERS-08 Admin policy config schema scaffold
- [x] CERS-09 Reputation/abuse state scaffold
- [x] CERS-10 Lock-flow foundation scaffold
- [x] CERS-11 Moderation case adjudication executes enforcement outcomes
- [x] CERS-12 Hidden distribution engine for reporter, ops, community, and referral credits
- [x] CERS-13 Creator lock creation and lock-status guard
- [x] CERS-14 Reporter abuse escalation and reputation updates
- [x] CERS-15 Creator payment and unlock flow

---

## Required Preparation Hook Checklist

Before coding starts, all answers must be YES:

- [x] A tracker file exists and follows this template.
- [x] Completion contract is explicitly written.
- [x] API and data contracts are documented.
- [x] Non-happy path behavior is documented.
- [x] Security and observability sections are filled.
- [x] Acceptance criteria and test matrix are present.
