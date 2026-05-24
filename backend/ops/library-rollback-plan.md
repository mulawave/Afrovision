# Library Rollback Plan

## Rollback Triggers

- Sustained 5xx > 5% for library endpoints over 10 minutes.
- Reader manifest failures causing broad content access disruption.
- Security regression allowing unauthorized reader access.
- Data integrity issues for progress, bookmarks, or favorites.

## Immediate Containment

1. Set rollout percent to 0 and keep allowlist limited to operators.
2. Disable new reader sessions while preserving existing progress records.
3. Route channel pages to non-library fallback messaging.

## Data Safety Rules

- Do not delete library content, progress, bookmarks, or favorites during rollback.
- Preserve audit logs for all moderation and rollout actions.
- Ensure queued notifications are paused, not dropped.

## Recovery and Re-Enable Criteria

- Root cause identified and fixed in staging.
- Persona smoke tests pass across gating, reader, and favorites flows.
- Two-hour burn-in with no critical alerts before re-enabling staged rollout.
