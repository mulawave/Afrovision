# Autopulse Login with PAK Integration Guide

## Purpose
This guide explains how to integrate the same Login with PAK system used in AfroVision into Autopulse, end-to-end.

It is written as a developer handoff document and includes:
- Architecture and decision points
- Backend implementation contract
- Data model and Firestore dependencies
- Frontend integration patterns (Flutter and Web)
- Security, observability, and rollout checklist
- Test matrix and troubleshooting

## 1. What Login with PAK Means in This Ecosystem
PAK login in AfroVision is not a simple local credential check. It is an account import and identity resolution flow that:
1. Accepts a PAK value from the client
2. Attempts legacy CI3 wallet login lookup
3. Falls back to Firestore lookup chain using PAK mapping
4. Resolves a canonical user id
5. Merges required user fields into users collection
6. Rehydrates user cache in memory
7. Issues JWT token
8. Returns safe user payload for authenticated app session

Reference implementation files in AfroVision:
- backend/src/auth/auth.routes.js
- backend/src/auth/auth.controller.js
- backend/src/utils/jwt.js
- backend/src/users/user.model.js
- lib/features/auth/services/auth_service.dart
- lib/features/auth/screens/pak_login_screen.dart
- lib/features/auth/screens/login_screen.dart
- lib/main.dart
- lib/core/api/api_service.dart
- lib/core/storage/auth_storage.dart
- website/src/lib/api.ts
- website/src/lib/AuthContext.tsx
- website/src/app/pak-login/page.tsx

## 2. Integration Strategy for Autopulse
Choose one model before implementation.

### Model A: Shared Identity Backend (Recommended for same ecosystem)
Autopulse calls the same auth backend endpoint used by AfroVision:
POST /auth/pak-login

Pros:
- Exact parity in behavior and identity resolution
- Less drift and fewer bugs
- Single source of truth for PAK mapping

Cons:
- Requires cross-app trust in shared auth infrastructure
- Requires consistent token validation strategy across services

### Model B: Replicate PAK logic inside Autopulse backend
Autopulse backend implements the same endpoint and same lookup/merge logic.

Pros:
- Full service isolation

Cons:
- Higher long-term maintenance
- Risk of behavioral divergence from AfroVision

If Autopulse and AfroVision are part of one digital ecosystem, Model A is usually preferable.

## 3. Required Backend Contract

### Endpoint
Method: POST
Path: /auth/pak-login
Body:
- pak: string

Validation rule:
- pak must be non-empty string with trimmed length >= 5
- On invalid input return status 400 with error message

### Success Response
Status: 200
JSON shape:
- token: JWT string
- user: safe user object
- pak_login: true
- canonical_uid: resolved user id

### Error Responses
- 400 invalid PAK input
- 401 account not found or invalid user data
- 500 internal failure in sync or downstream lookup

Observed AfroVision messages include:
- Please enter a valid PAK
- ACCESS DENIED! Account not found
- Invalid user data: email is missing
- User sync failed after PAK login
- PAK login failed. Please try again.

## 4. Backend Processing Flow (must match)
Implement these steps in this exact order to preserve compatibility.

1. Input validation
- Read pak from request body
- Trim value
- Reject invalid format

2. CI3 legacy lookup
- Call POST https://vee-pin.com/app/api/v2/wallet_login
- Payload contains wallet_address equal to pak value
- If valid response includes email, map into internal profile object

3. Firestore fallback chain
If CI3 profile is missing:
- Read paks/{pak}
- Extract reservedByInvite
- Read invites/{reservedByInvite}
- Extract consumedByUid
- Read users/{consumedByUid}
- Convert into internal profile

4. Resolve canonical uid
- If fallback came from Firestore user doc, use that doc id
- Else query users by emailLower first
- If not found, query users by vpinId equal pak
- If still not found, derive deterministic uid using sha1 of raven:{pak}:{emailLower}

5. Read existing user doc
- Load users/{canonicalUid}
- Preserve existing fields where required

6. Build merge payload
- Include identity, financial, KYC, role, subscription, notification arrays, creator-follow arrays, and required safety fields
- Always set vpinId to current pak
- Ensure created_at exists
- Ensure role and other required fields exist for safe user serialization

7. Merge write
- Write set with merge true to users/{canonicalUid}

8. Reload user cache
- Reinitialize in-memory user cache so auth lookup uses latest data

9. Generate token and return
- Generate JWT signed using configured JWT_SECRET
- Return token and safe user payload

## 5. Firestore Data Requirements
Autopulse environment must have these collections and fields available.

### Collection: paks
Document id: pak value
Expected fields:
- reservedByInvite

### Collection: invites
Document id: invite id
Expected fields:
- consumedByUid

### Collection: users
Document id: canonical uid
Expected fields used by mapping logic:
- email or emailLower
- vpinId
- firstName, middleName, lastName
- profilePicture
- cash
- vpt
- coins or ravens
- role
- is_premium_creator
- kyc_status
- subscription_plan
- subscription_status
- subscription_expiry
- preferred_currency
- first_subscription_at
- following_creator_ids
- fcm_tokens
- created_at
- any additional app-specific fields

Important:
If your users collection schema differs from AfroVision, preserve AfroVision compatibility fields in addition to Autopulse fields. Do not remove required auth-safe fields.

## 6. JWT and Auth Middleware Requirements

1. Token generation
- JWT payload includes userId
- Token expiration is 7 days in AfroVision implementation

2. JWT secret source
- JWT secret comes from settings service key named JWT_SECRET
- If missing, auth middleware should return service-level error instead of silent fail

3. Auth middleware behavior
- Require Authorization: Bearer token
- Verify token
- Load user by payload userId
- Reject if user missing or token invalid

## 7. Frontend Integration (Flutter Pattern)
If Autopulse mobile client is Flutter, implement the same shape.

### A. API method
Add auth service method that calls:
POST /auth/pak-login with body containing pak

On success:
- Save token to secure storage
- Map user JSON into user model
- Register push token if Autopulse uses push notifications

### B. Route wiring
Add route for PAK login screen in main route map.
Example route name used in AfroVision:
- /pak-login

### C. Login page entry point
From primary login screen, add secondary action button:
- LOGIN WITH PAK
- Navigates to PAK login screen

### D. PAK login screen behavior
Required behavior:
- PAK input field with masked entry by default
- Minimum client-side length check before submit
- Loading spinner during network request
- Disabled submit button while loading
- Error banner with backend error message
- On success navigate to app home (or role-aware landing)

## 8. Frontend Integration (Web Pattern)
If Autopulse web client is Next.js or React, use same model.

1. API client method
- pakLoginApi(pak) calls POST /auth/pak-login

2. Auth context/store
- Expose pakLogin(pak) method
- On success store token and user in local storage/session state

3. Pak login page
- Form with pak input
- Input validation
- Submit loading state
- Error handling
- Redirect support via redirect query parameter

4. Auth route list
- Include /pak-login among auth routes where global bars or auth-only wrappers are suppressed

## 9. Required User Payload Compatibility
Ensure client user model can parse at least these fields from user object:
- id
- email
- role
- is_premium_creator
- kyc_status
- subscription_plan
- subscription_status
- preferred_currency
- vpt
- cash
- coins
- created_at

If Autopulse has additional user fields, keep this baseline intact.

## 10. Security and Compliance Checklist
- Validate PAK format before lookup
- Never log raw PAK in production logs
- Use HTTPS for all auth traffic
- Restrict CORS to known origins in production
- Ensure JWT_SECRET exists and is rotated per policy
- Rate-limit /auth/pak-login to mitigate brute-force probing
- Return generic failure for unknown account paths where needed
- Audit log successful and failed PAK logins with masked identifiers

## 11. Observability Checklist
Track these metrics from day one:
- pak_login_attempt_total
- pak_login_success_total
- pak_login_failure_total
- pak_login_failure_by_reason
- pak_login_latency_ms
- canonical_uid_resolution_source
  - ci3
  - firestore_chain
  - email_match
  - vpin_match
  - derived_uid

Alerting suggestions:
- Success rate drops below threshold
- CI3 dependency timeout spike
- Firestore lookup error spike
- JWT generation failures

## 12. Implementation Plan for Autopulse Developer

Phase 1: Infrastructure and contracts
1. Confirm auth backend model (shared or replicated)
2. Confirm Firestore access and schema compatibility
3. Confirm JWT secret configuration
4. Add or validate /auth/pak-login contract

Phase 2: Backend wiring
1. Implement endpoint and flow steps
2. Implement merge write and cache reinit
3. Implement safe user response
4. Add rate limiting and structured error handling

Phase 3: Client wiring
1. Add API method
2. Add auth store/context method
3. Add PAK login UI and route
4. Add login page entry action
5. Add role-aware success navigation

Phase 4: Validation and rollout
1. Run test matrix below
2. Observe metrics in staging
3. Roll out with feature flag if needed
4. Monitor first 24 to 72 hours

## 13. Test Matrix (must pass)

### Happy path
1. Valid PAK linked through CI3 returns token and user
2. Valid PAK resolved through Firestore chain returns token and user
3. Existing user fields are preserved after merge write

### Validation and failure
1. Empty PAK returns 400
2. Short PAK returns 400
3. Unknown PAK returns 401
4. Missing email in resolved profile returns 401
5. CI3 timeout still allows Firestore fallback path

### Session behavior
1. Token saved correctly in client storage
2. Authenticated requests include Bearer token
3. App restores session using /auth/me
4. Logout clears token and user state

### Role behavior
1. Admin user lands on admin area if role-aware redirect is enabled
2. Viewer/creator users land on correct default route

### Regression
1. Email/password login still works
2. Wallet login still works if present
3. Forgot/reset password unaffected

## 14. Troubleshooting Guide

Issue: PAK login returns 401 for known accounts
- Check paks and invites chain integrity
- Check reservedByInvite and consumedByUid values
- Check users emailLower and vpinId indices/data

Issue: Login succeeds but protected APIs return 401
- Verify token persistence in client
- Verify Authorization header format
- Verify JWT_SECRET consistency across backend instances

Issue: PAK login returns 500
- Check Firestore credentials and project id
- Check settings storage for JWT_SECRET
- Check User cache reinit path and user lookup after merge

Issue: Web or mobile receives HTML instead of JSON
- Verify API base URL points to backend origin
- Verify route is mounted under /auth in backend app

## 15. Minimal API and UI Snippets for Fast Adoption

### Backend route registration
Use an auth route registration equivalent to:
- POST /auth/pak-login mapped to pakLogin controller

### Client call payload
POST body:
{
  "pak": "user_pak_value"
}

### Success response expectation
{
  "token": "jwt",
  "user": { "id": "...", "email": "..." },
  "pak_login": true,
  "canonical_uid": "..."
}

## 16. Handoff Acceptance Criteria
This guide can be considered fully implemented in Autopulse when all are true:
1. Autopulse can log in a user using valid PAK end-to-end
2. Same account resolves to same canonical identity strategy as AfroVision
3. Client receives and stores JWT and user profile correctly
4. Protected Autopulse endpoints accept issued token
5. Error behavior matches defined contract
6. Test matrix passes in staging

## 17. Notes for Ecosystem Consistency
- Keep canonical uid derivation logic exactly aligned with AfroVision if replicating backend logic.
- Keep PAK fallback chain order unchanged to avoid account mismatch.
- Keep required safe user fields present to avoid downstream feature breakage.
- If possible, centralize auth in one service for both AfroVision and Autopulse to reduce drift.

---
Prepared for Autopulse developer handoff.
Source of truth implementation: AfroVision codebase in this repository.
