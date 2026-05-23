# Exclusive Rollback Plan (AV-EXC-093)

## Scope

Rollback strategy for exclusive-channel rollout issues affecting access, purchase, lifecycle scheduling, or financial correctness.

## Rollback Triggers

1. Critical purchase outage (Sev-1)
2. Sustained data integrity/reconciliation mismatch above critical threshold
3. Scheduler failure causing lifecycle drift with user impact
4. Security incident requiring immediate exposure reduction

## Immediate Containment (0-10 minutes)

1. Disable rollout access:
- Set EXCLUSIVE_ROLLOUT_ENABLED=false

2. Preserve evidence:
- Capture current /admin/dashboard/exclusive-ops payload
- Export relevant audit logs and ops summary snapshot

3. Announce incident channel:
- Backend On-Call opens incident thread and assigns owner

## Functional Rollback (10-30 minutes)

1. Keep existing entitlements readable; block new exclusive writes if needed.
2. Pause manual interventions until incident lead approves exact scope.
3. Run targeted health checks:
- lifecycle worker state
- purchase endpoint response quality
- alert pipeline

## Data Safety Rules

1. Never bulk-delete entitlement or ledger records.
2. Any corrective data action requires dual approval:
- Backend Lead + Ops approver
3. Record before/after snapshots and rationale in incident notes.

## Recovery and Re-Enable Criteria

1. Root cause identified and mitigated.
2. SLOs return to acceptable range for at least 60 minutes.
3. QA spot-check passes on key personas.
4. Controlled canary re-enable approved by Ops + Product.

## Communication Matrix

1. Internal:
- Backend On-Call, Ops On-Call, QA Lead, Product/Ops Manager
2. External (if needed):
- Support messaging prepared by Product/Ops

## Post-Rollback Actions

1. Publish incident summary with timeline and root cause.
2. Add permanent guardrails/tests.
3. Update runbook, SLOs, and this rollback plan.
