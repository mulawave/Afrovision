# Broadcast Resumable Upload QA Evidence

Date (UTC): 2026-05-23
Owner: GitHub Copilot session
Scope: Creator Studio resumable upload lifecycle (session create/progress/complete/list/cancel), race safety, and TTL expiry behavior.

## Objective

Capture concrete verification evidence for resumable upload hardening and define the remaining manual checks needed for full production confidence.

## Code Scope Covered

Backend:
- backend/src/broadcast/broadcast.controller.js
- backend/src/broadcast/broadcast.routes.js
- backend/src/utils/gcs.js
- backend/test/broadcast-resumable-upload.test.js

Website:
- website/src/lib/api.ts
- website/src/app/creator-studio/page.tsx

## Automated Verification (Completed)

1. Website lint
- Command: npm run lint (from website)
- Result: PASS

2. Targeted resumable lifecycle tests
- Command: node test/broadcast-resumable-upload.test.js (from backend)
- Result: PASS (4/4)
- Covered assertions:
  - expired progress update returns 410
  - expired completion returns 410
  - completion lock prevents duplicate video creation during finalizing
  - cancel session blocks completion

3. Full backend regression suite
- Command: npm test (from backend)
- Result: PASS
- Result summary: all listed backend suites passed with 0 failures.

4. Default test-chain guard (always-run smoke check)
- File: backend/test/smoke.test.js
- Guard: asserts backend package test script includes critical suites such as broadcast-resumable-upload.
- Verification: smoke suite passed with guard assertion enabled.

## Deployment Observation

Terminal history in this session context shows multiple deploy script executions with exit code 0. This artifact does not re-run deployment and does not claim post-deploy runtime smoke outcomes.

## Manual QA Checklist (Pending Execution)

The following checks require authenticated UI/API runtime verification in target environment:

1. Resume after interruption
- Start a large upload.
- Interrupt network temporarily.
- Restore network and reselect same file.
- Expected: existing upload session reused, upload continues from probed offset.

2. Refresh continuity
- Start upload and refresh Creator Studio page.
- Expected: upload session list repopulates, active status visible, resume possible.

3. Cancel behavior
- Start upload, cancel from session panel.
- Expected: status becomes canceled, completion endpoint blocked with 409 semantics.

4. Finalize race
- Trigger near-simultaneous finalize attempts for same session.
- Expected: one succeeds, duplicate creation prevented, conflict handled safely.

5. Expired session handling
- Force session beyond expires_at.
- Expected: progress and complete return 410; UI does not reuse expired sessions.

6. Fallback path
- Force resumable create/upload failure.
- Expected: direct upload fallback executes and succeeds where available.

## Signoff Template

- Backend QA owner:
- Website QA owner:
- Environment:
- Manual checklist completed: Yes/No
- Blocking issues:
- Final decision: Approved / Blocked
