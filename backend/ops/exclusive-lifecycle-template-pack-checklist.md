# Exclusive Lifecycle Template Pack Checklist (AV-EXC-073)

## Objective

Finalize and verify the exclusive lifecycle template pack for release readiness.

## Template Coverage Matrix

Required events:

1. user.purchase
2. user.reminder
3. user.expired
4. creator.purchase
5. creator.expiring
6. creator.expired
7. ops.alert

Required locale set:

1. en
2. pcm

## Checklist

## A) Content Completeness

- [ ] Every required event returns title/body/emailSubject/ctaLabel/type.
- [ ] Message type values align with downstream notification consumers.
- [ ] Renewal and expiry wording is unambiguous for users and creators.

## B) Localization Quality

- [ ] English copy is approved for production tone.
- [ ] Pidgin copy is reviewed for clarity and cultural readability.
- [ ] Locale resolver behavior (`pcm|pidgin` => `pcm`) is verified.
- [ ] Unsupported locales safely fallback to English.

## C) Operational Readiness

- [ ] Ops alert copy includes error and anomaly context.
- [ ] Creator-facing event copy maps to dashboard action intent.
- [ ] User-facing event copy maps to renewal/watch flow intent.

## D) Verification

- [ ] `node test/exclusive-lifecycle-messaging.test.js` passes.
- [ ] `node test/exclusive-lifecycle-template-approval.test.js` passes.
- [ ] Full backend test suite passes (`npm test`).

## E) Approval and Signoff

- [ ] Product signoff captured in `backend/ops/exclusive-lifecycle-template-approval-evidence.md`.
- [ ] Ops signoff captured in `backend/ops/exclusive-lifecycle-template-approval-evidence.md`.
- [ ] Final decision marked Approved.

## Final Status

- Owner:
- Date (UTC):
- Status: Pending / Approved / Blocked
- Notes:
