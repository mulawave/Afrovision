# Exclusive Ops SLO Runbook (AV-EXC-092)

## Purpose

This runbook defines the production SLOs, dashboard checks, and on-call procedures for Exclusive channel operations.

Primary dashboard endpoint:
- GET /admin/dashboard/exclusive-ops

## Ownership

- Primary: Backend On-Call
- Secondary: Ops On-Call
- Escalation: Product/Ops Manager (business-impact incidents)

## SLO Targets

1. Scheduler error rate: <= 1% per run
2. Scheduler anomaly rate: <= 3% per run
3. Purchase success rate: >= 99.5% (rolling daily)
4. Reminder dispatch success rate: >= 99% per run

## Key Dashboard Panels

1. Exclusive channels:
- total, active, disabled

2. Entitlements:
- active, expired

3. Lifecycle worker health:
- last run trigger/start/end
- scanned active records
- reminders sent
- expiry notifications sent
- error_count / anomaly_count / ops_alerts_sent

4. Rollout controls:
- enabled
- rollout percent
- allowlist count

5. SLO summary:
- target thresholds
- current scheduler error/anomaly rates

## Alerting Thresholds

P1 (Critical):
- scheduler_error_rate > 10%
- purchase success < 95% for 10+ minutes
- repeated lifecycle worker failures (3 consecutive runs)

P2 (High):
- scheduler_error_rate > 1%
- scheduler_anomaly_rate > 3%
- reminder dispatch success < 99%

P3 (Medium):
- sporadic anomalies with no customer impact
- stale summary updates (> 2 expected run intervals)

## Incident Classification

1. Failed purchases
- symptoms: INSUFFICIENT_NGN spikes, 500s on purchase endpoint
- impact: users blocked from new/renewed access

2. Split mismatches
- symptoms: reconciliation variance beyond thresholds
- impact: financial/audit risk

3. Scheduler outages
- symptoms: stale ops summary, reminders/expiry not progressing
- impact: entitlement lifecycle drift

## Triage Checklist

1. Confirm alert severity and incident scope.
2. Check /admin/dashboard/exclusive-ops for latest lifecycle run.
3. Review ops summary counts (error_count, anomaly_count).
4. Check recent audit actions for exclusive operations.
5. Verify rollout settings (enabled, percent, allowlist).
6. Determine if customer-facing impact exists (purchase/access failures).

## Immediate Mitigation Actions

1. Scheduler issue:
- Trigger manual lifecycle run with ops endpoint and valid secret.
- If failing repeatedly, disable rollout temporarily using settings.

2. Purchase/access issue:
- Verify rollout configuration is not unintentionally restrictive.
- Temporarily increase allowlist for affected priority users if needed.

3. Financial/reconciliation issue:
- Pause write-side interventions and collect evidence.
- Open finance reconciliation workflow before corrective writes.

## Manual Entitlement SOP (Approval Required)

1. Approval: one Backend Lead + one Ops approver.
2. Record reason, affected user/channel IDs, and expected outcome.
3. Perform minimal change and capture before/after snapshots.
4. Log action in admin audit trail.
5. Validate user access behavior post-change.

## Reconciliation Procedure

1. Generate ledger + entitlement variance report.
2. Apply threshold checks:
- warning: absolute variance > 1%
- critical: absolute variance > 3%
3. Escalate critical variance to finance + backend immediately.

## Escalation Map

1. P1 -> Backend On-Call + Ops On-Call + Product/Ops Manager
2. P2 -> Backend On-Call + Ops On-Call
3. P3 -> Backend On-Call (business hours follow-up)

## Post-Incident

1. Document timeline and root cause.
2. Add permanent guardrails/tests where missing.
3. Update this runbook and SLO thresholds if needed.
4. Link corrective actions to tracker tickets.
