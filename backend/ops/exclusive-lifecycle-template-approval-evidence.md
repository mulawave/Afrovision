# Exclusive Lifecycle Template Approval Evidence (AV-EXC-073)

## Purpose

Provide a standardized evidence record for Product/Ops approval of exclusive lifecycle templates and localized copy.

## Scope

Template family covered by `backend/src/channels/exclusive_lifecycle.messages.js`:

1. user.purchase
2. user.reminder
3. user.expired
4. creator.purchase
5. creator.expiring
6. creator.expired
7. ops.alert

Locales covered in baseline:

1. en (English)
2. pcm (Nigerian Pidgin)

## Approval Evidence Capture Format

## 1) Build + Test Evidence

- Commit SHA:
- Test command: `npm test`
- Result summary:
- Evidence links/log attachments:

## 2) Template Snapshot Evidence

For each event and locale, capture:

- Event key:
- Locale:
- Title:
- Body:
- Email subject:
- CTA label:
- Message type:

Required artifact location:
- Store screenshots or generated payload export under incident/release evidence storage and reference IDs below.

## 3) Product Review Evidence

- Reviewer name:
- Date (UTC):
- Readability/clarity checks passed: Yes/No
- Brand voice checks passed: Yes/No
- Legal/compliance sensitive phrasing reviewed: Yes/No
- Notes:

## 4) Ops Review Evidence

- Reviewer name:
- Date (UTC):
- Alert routing language clear: Yes/No
- Incident-action wording actionable: Yes/No
- Localization fallback behavior understood: Yes/No
- Notes:

## 5) Final Approval Record

- Product approval: Name / Date / Signature marker
- Ops approval: Name / Date / Signature marker
- Backend confirmation: Name / Date
- Final decision: Approved / Blocked
- Blocking issues (if any):

## Completion Criteria

1. All event keys reviewed in both locales (`en`, `pcm`).
2. Product + Ops approvals captured in this file.
3. Any copy changes merged with passing tests.
4. Tracker AV-EXC-073 marked complete only after criteria 1-3 are satisfied.
