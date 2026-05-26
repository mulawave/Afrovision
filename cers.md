# AfroVision — Community Content Classification, Enforcement & Reputation System

### Copilot Implementation Prompt (Refined End-to-End Specification)

Build a complete end-to-end **Content Classification & Community Enforcement System** for AfroVision Waves.

This system is designed to:

* Protect minors from accidental exposure to explicit content
* Create a self-regulating community moderation ecosystem
* Reward responsible moderation participation
* Penalize deliberate content mislabeling
* Preserve reporter anonymity completely
* Prevent abuse/spam reporting
* Maintain trust and platform safety
* Ensure all financial distributions are hidden from violating creators

The system must feel professional, silent, secure, and non-toxic.
No public shaming. No exposure of reporters. No “snitch culture.”
Everything should feel like a structured platform moderation system.

---

# 1. CONTENT AGE CLASSIFICATION SYSTEM

Every uploaded Wave MUST require a mandatory audience classification before publishing.

## Required Labels

### 1. Minor Safe

* Age Range: 12 years and below
* Label Color: Green
* Display Badge: `MINOR SAFE`

### 2. Teenage Range

* Age Range: 13–17 years
* Label Color: Amber/Orange
* Display Badge: `TEEN`

### 3. Adult Themed

* Age Range: 18+
* Label Color: Red
* Display Badge: `18+`

---

# 2. WAVE UPLOAD FLOW

During Wave upload:

## Required Upload Fields

* Title
* Description
* Thumbnail
* Video
* Category
* Age Classification (required)
* Has Explicit Language toggle
* Has Nudity toggle
* Has Violence toggle

These additional toggles help moderation decisions later.

User CANNOT publish without selecting a classification.

---

# 3. LABEL DISPLAY RULES

Every Wave must visibly display its classification label.

## Placement

* Top-right corner of video player
* Visible in:

  * Feed
  * Discovery
  * Wave detail page
  * Mini player
  * Shorts/Waves scroll mode

## Behavior

* Slight transparency
* Clean professional styling
* Never flashy
* Always visible

Example:

```text
[ MINOR SAFE ]
[ TEEN ]
[ 18+ ]
```

---

# 4. AGE ACCESS CONTROL

## Minor Safe

Accessible to everyone.

## Teenage Range

* Requires account age >= 13

## Adult Themed

Requires:

* User age >= 18
* KYC OR explicit 18+ confirmation
* Adult content consent acknowledgment

---

# 5. ADULT CONTENT WARNING SCREEN

Before entering any 18+ Wave:

Display full-screen warning modal.

## Warning Content

* This content is intended for adults only
* Viewer discretion advised
* By continuing, you confirm you are 18+
* AfroVision is not responsible for creator-uploaded content

## Buttons

* Leave
* Continue

## Session Logic

Do not ask repeatedly during same session.

---

# 6. COMMUNITY CLEANUP SERVICE

Create a hidden moderation ecosystem called:

# “Community Cleanup Service”

NEVER call it:

* Reporting rewards
* Moderator payout
* Snitch bonus

Always refer to earnings internally and externally as:

# “Community Service Rewards”

---

# 7. REPORTING SYSTEM

Only users meeting minimum reputation requirements can report classification violations.

## Minimum Requirements

Admin configurable:

* Minimum reputation score
* Minimum account age
* Minimum completed sessions
* No recent moderation abuse

---

# 8. REPORT TYPES

Users can report:

* Adult content labeled as Minor Safe
* Adult content labeled as Teen
* Graphic violence mislabeled
* Sexual content mislabeled
* Dangerous content for minors

---

# 9. REPORT FLOW

## Important Rules

* Creator NEVER sees reporter identity
* Creator NEVER sees distribution details
* Creator NEVER sees moderation participants

---

# 10. MODERATION REVIEW FLOW

When report is submitted:

## Create Moderation Case

Fields:

* Case ID
* Wave ID
* Creator ID
* Reporter ID (hidden/private)
* Report reason
* Original classification
* Suggested classification
* Status
* Review notes
* Fine level
* CreatedAt
* ReviewedAt

---

# 11. REVIEW OUTCOMES

## If Report INVALID

* No penalties
* Reporter reputation decreases slightly
* Abuse score increases

## If Report VALID

System automatically:

1. Deletes violating Wave
2. Applies creator fine
3. Locks account if insufficient balance
4. Runs silent financial distributions
5. Rewards reporter anonymously
6. Logs moderation event
7. Sends creator violation notice

---

# 12. DYNAMIC FINE ENGINE

Fine amounts MUST be fully admin-controlled.

Admin can define:

* Violation severity
* Fine amount
* Distribution percentages
* Lock thresholds

---

# 13. EXAMPLE FINE LEVELS

## Level 1

Teen content labeled Minor Safe
Fine:
₦1,000

## Level 2

Adult content labeled Teen
Fine:
₦5,000

## Level 3

Explicit adult content labeled Minor Safe
Fine:
₦25,000

## Level 4

Extreme repeated violation
Fine:
₦100,000 + permanent review

All values editable in admin panel.

---

# 14. DISTRIBUTION ENGINE

When fine succeeds:

## Distribution Rules

### Reporter

Receives:

* 40% cash equivalent
* 10% vPT

### Operations Pool

Receives:

* 20% cash

### Community Rewards Pool

Receives:

* 20% vPT

### Referral Tree

Receives:

* 10% vPT distributed across referral levels

Use existing creator referral distribution percentages.

---

# 15. DISTRIBUTION PRIVACY

CRITICAL REQUIREMENT:

The violating creator must NEVER know:

* Who reported them
* Who earned rewards
* How rewards were distributed
* Which wallets received funds

---

# 16. CREATOR TRANSACTION VISIBILITY

Violating creator ONLY sees:

```text
Community Standards Fine
-₦25,000
```

Nothing else.

No breakdowns.
No references to reports.
No distribution records.

---

# 17. REPORTER TRANSACTION VISIBILITY

Reporter sees:

```text
Community Service Reward
+₦10,000
```

No creator reference.
No content reference.
No report reference.

---

# 18. REFERRAL TREE VISIBILITY

Referral earners see:

```text
Community Service Bonus
+15 vPT
```

Nothing else.

---

# 19. ACCOUNT LOCK SYSTEM

If creator balance insufficient:

Immediately lock account.

---

# 20. LOCK SCREEN BEHAVIOR

After login:
User is redirected ONLY to violation lock screen.

Cannot:

* Close
* Skip
* Navigate away
* Access app content

All auth-gated routes blocked.

---

# 21. LOCK SCREEN CONTENT

Display:

* Violation notice
* Removed content thumbnail
* Rule violated
* Educational explanation
* Prevention guidance

Tone must remain calm and professional.

NEVER insulting.
NEVER aggressive.

---

# 22. PAYMENT REQUIREMENT

User must pay:

* Exact fine amount OR higher
* Never lower

Allowed:

* Wallet top-up
* Card payment
* Crypto/future methods

---

# 23. PAYMENT PROCESSING FLOW

After successful payment:

## System must:

1. Verify funds
2. Wait short countdown
3. Debit fine
4. Execute hidden distributions
5. Unlock account
6. Refresh auth state
7. Redirect creator into app

---

# 24. PUSH NOTIFICATIONS

## Creator

```text
A Wave violated AfroVision classification standards and has been removed.
```

## Reporter

```text
Your community service contribution has been processed.
```

## Referral Earners

```text
You received a community service bonus.
```

NEVER expose report details.

---

# 25. REPUTATION SYSTEM

Users gain reputation from:

* Accurate reports
* Positive account history
* Creator trust
* Session quality
* Account age

Users lose reputation from:

* False reports
* Spam reports
* Abuse patterns

---

# 26. REPORT ABUSE PREVENTION

Implement:

* Cooldowns
* Daily report limits
* Accuracy scoring
* Auto-suspension for abuse
* Reputation requirements

---

# 27. ADMIN PANEL REQUIREMENTS

Admin must control:

* Fine levels
* Percentages
* Reputation thresholds
* Lock durations
* Auto-ban rules
* Content rules
* Age classifications
* Review queue
* Moderator actions
* Appeal handling

---

# 28. AUDIT LOGGING

Every action must be recorded.

Log:

* Report submission
* Moderator review
* Fine applied
* Distribution execution
* Account lock
* Unlock
* Referral payouts

Must be immutable and exportable.

---

# 29. SECURITY REQUIREMENTS

Critical:

* Reporter identity encrypted/private
* No API leaks
* No frontend exposure
* No transaction traceability
* No creator visibility into distributions

All sensitive operations server-side only.

---

# 30. UX DIRECTION

System tone:

* Calm
* Professional
* Administrative
* Trustworthy

Avoid:

* Drama
* Punishment theatrics
* Aggressive warnings
* Public moderation feeds

AfroVision moderation should feel like:

# “Structured media governance”

not social media chaos.

---

# 31. REQUIRED MODULES

Build complete:

* Database schema
* APIs
* Wallet integration
* Fine engine
* Distribution engine
* Reputation engine
* Admin controls
* Push notifications
* Lock screen flow
* Review dashboard
* Audit logs
* Background jobs
* Referral payout integration

Everything must be fully production-ready and connected end-to-end.
