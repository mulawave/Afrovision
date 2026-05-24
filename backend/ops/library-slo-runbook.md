# Library SLO Runbook

## Service Level Objectives

- Library list API availability: 99.9% monthly.
- Reader manifest availability: 99.9% monthly.
- P95 reader manifest latency: under 600ms at backend edge.
- Reader progress write success rate: at least 99.5%.

## Error Budget Policy

- Monthly error budget is 0.1% for list and manifest endpoints.
- If budget burn exceeds 50% in first 14 days, freeze non-critical deploys.
- If budget burn exceeds 80%, rollback last risky changes and open incident.

## Alert Conditions

- 5xx rate above 2% for 5 minutes on library endpoints.
- Reader manifest P95 above 1.2s for 10 minutes.
- Progress write failure rate above 5% for 10 minutes.
- Entitlement denial spike above baseline + 3 sigma for 15 minutes.

## Incident Response Flow

1. Declare incident and assign commander.
2. Validate scope by endpoint and persona impact.
3. Contain blast radius (disable rollout or route traffic fallback).
4. Restore service via rollback or hotfix.
5. Verify with synthetic checks and persona smoke tests.
6. Publish incident report and follow-up action items.
