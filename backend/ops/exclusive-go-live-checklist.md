# Exclusive Go-Live Checklist (AV-EXC-093)

## Objective

Provide a final release gate checklist before enabling full exclusive-channel rollout in production.

## Pre-Go-Live Gates

1. Feature flags configured by environment
- EXCLUSIVE_ROLLOUT_ENABLED set explicitly for target environment.
- EXCLUSIVE_ROLLOUT_PERCENT and allowlist reviewed and approved.

2. Monitoring and dashboard validation
- /admin/dashboard/exclusive-ops returns valid metrics.
- Lifecycle summary freshness validated within expected run interval.

3. Notification and messaging readiness
- User/creator lifecycle notifications verified in staging.
- Ops alert routing recipients reviewed and reachable.

4. Finance and reconciliation signoff
- Split and entitlement variance report generated.
- Variance thresholds reviewed and signed off.

5. Compliance and audit readiness
- Audit logs confirmed for purchase, PIC verify, fee updates, and scheduler alerts.
- Legal/compliance review complete.

6. QA completion
- Backend suite green (including AV-EXC-081/082/090/091/092 coverage).
- No Sev-1 or unmitigated Sev-2 issues open.

## Canary Rollout Steps

1. Set rollout percent to 5% with controlled allowlist.
2. Monitor for 60 minutes:
- purchase failures
- scheduler error/anomaly rates
- ops alerts
3. Increase to 25% if stable for one full reminder/expiry cycle window.
4. Increase to 50%, then 100% with explicit approval checkpoints.

## Go/No-Go Decision

Go only if all are true:
- No Sev-1 incidents in canary window.
- Scheduler error rate <= 1% and anomaly rate <= 3%.
- Purchase success rate >= 99.5%.
- Ops, QA, and Product approve release.

No-Go triggers:
- Any Sev-1 incident.
- Persistent purchase degradation (< 95% success for 10+ minutes).
- Unresolved reconciliation variance above critical threshold.

## Signoff Record

- Backend On-Call:
- Ops On-Call:
- QA Lead:
- Product/Ops Manager:
- Date/Time (UTC):
