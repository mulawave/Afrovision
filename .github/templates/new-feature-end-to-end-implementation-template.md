# New Feature End-to-End Implementation Template (Mandatory)

Use this template before starting any new implementation task. This is a blocking preparation gate.

## 1. Feature Identity

- Feature Name:
- Owner Team(s):
- Primary Surfaces: (Backend, Website, Flutter, Admin, Ops)
- Related Tickets:
- Linked Tracker File:

## 2. Objective

Describe the full production objective and expected end-user/business outcome.

## 3. Completion Contract

Define what done means across all layers:

1. Entry points and discovery surfaces
2. Destination UX and interaction states
3. Backend/API/storage/state wiring
4. Navigation and deep links
5. Permissions, entitlement, validation, and edge cases
6. Operational controls and management tooling
7. Notifications/alerts/analytics coverage
8. QA and rollout readiness

## 4. Business Rules (Source of Truth)

List canonical rules and invariants that all implementations must obey.

## 5. Domain Model Changes

- New entities
- Updated entities
- Field definitions
- State machines/status values

## 6. API Contracts

- Viewer APIs
- Creator/Admin APIs
- Auth and policy checks for every route
- Error contract and status code mapping

## 7. End-to-End User Flows

At minimum:

1. Discovery flow
2. Primary success flow
3. Failure and recovery flow
4. Follow-up action flow
5. Lifecycle/renewal/state-transition flow

## 8. Frontend Scope

- Website UX scope
- Flutter UX scope
- Shared design rules and reusable components
- Loading/empty/error/success/disabled states

## 9. Backend/Jobs Scope

- Services
- Workers/schedulers
- Idempotency and duplicate protection
- Audit requirements

## 10. Security and Compliance

- Trust boundaries
- Sensitive data handling
- Abuse resistance and rate limiting
- Audit and legal requirements

## 11. Observability and Analytics

- Product metrics
- Operational metrics
- Logging/tracing needs
- Alert routing

## 12. Phased Delivery Plan

Define phase-by-phase rollout from policy lock to launch.

## 13. Acceptance Criteria (Release Gate)

List objective pass/fail criteria that must all be true.

## 14. Test Matrix (Minimum)

- Persona tests
- Success/failure tests
- Security tests
- Performance tests
- Regression tests

## 15. Operational Runbook Requirements

- Incident classes
- Recovery SOP
- Escalation paths

## 16. Release Checklist

- Feature flags
- Monitoring
- Compliance/approval signoffs
- Rollback readiness
- Post-launch monitoring window

## 17. Definition of Ready

Feature is ready to implement only when:

1. Dependencies are mapped.
2. Rules and contracts are approved.
3. Non-happy paths are specified.
4. Monitoring expectations are attached.
5. Acceptance criteria are testable.

## 18. Definition of Done

Feature is done only when:

1. End-to-end behavior is complete across all touched layers.
2. Supporting flows and controls are functional.
3. Security/compliance requirements are satisfied.
4. QA evidence exists.
5. Rollout and rollback playbooks are validated.

## Required Preparation Hook Checklist

Before coding starts, all answers must be YES:

- [ ] A tracker file exists and follows this template.
- [ ] Completion contract is explicitly written.
- [ ] API and data contracts are documented.
- [ ] Non-happy path behavior is documented.
- [ ] Security and observability sections are filled.
- [ ] Acceptance criteria and test matrix are present.

If any answer is NO, implementation must be blocked until resolved.
