# AfroVision Backend — Security & Deployment Readiness Audit

**Audit Date:** 2026-04-04
**Scope:** `backend/src/` — all route handlers, middleware, models, services, utilities
**Auditor:** Automated deep-code review

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| WARNING  | 12 |
| INFO     | 7 |

---

## CRITICAL Findings

### C1. `register()` has no try/catch — unhandled async errors crash the route

**File:** [auth.controller.js](backend/src/auth/auth.controller.js#L14-L55)
**Issue:** The `register` function is `async` but has no try/catch block. If `bcrypt.hash()`, `User.create()`, `generateToken()`, or any Firestore persist call throws, the error propagates to Express as an unhandled rejection. Unlike `login()` which has `try/catch`, `register()` relies entirely on the global error handler — but Express 4 (and early Express 5) does NOT automatically catch rejected promises from async route handlers without `express-async-errors` or a wrapper.
**Impact:** A Firestore transient failure during registration will return an HTML error page (or crash the process in older Express versions) instead of a JSON error.
**Fix:** Wrap the body of `register()` in try/catch, or use an async error wrapper middleware.

---

### C2. `forgotPassword()` returns reset token in response — credential leak

**File:** [auth.controller.js](backend/src/auth/auth.controller.js#L88-L100)
**Lines:** 96-97
```js
// DEV MODE: returning token in response (in production, send via email)
res.json({ message: 'Reset token generated', resetToken });
```
**Issue:** The password reset token is returned directly in the HTTP response. Any client calling this endpoint gets the actual reset token, enabling account takeover by anyone who knows a user's email address.
**Impact:** **Account takeover vulnerability.** An attacker sends a forgot-password request for any email, receives the reset token, and changes the password.
**Fix:** Remove `resetToken` from the response. Implement email delivery (e.g., via SendGrid, Mailgun, or Firebase Email). Return only `{ message: 'If that email exists, a reset link has been sent' }`.

---

### C3. `forgotPassword()` reveals email existence — user enumeration

**File:** [auth.controller.js](backend/src/auth/auth.controller.js#L93-L95)
```js
if (!user) {
  return res.status(404).json({ error: 'No account with that email' });
}
```
**Issue:** Returns a distinct 404 when the email doesn't exist vs. 200 when it does. The code comment even acknowledges this: _"Don't reveal whether email exists — but for dev, we return error."_
**Impact:** Attackers can enumerate valid email addresses.
**Fix:** Always return 200 with a generic message regardless of whether the email exists.

---

### C4. Race condition in gift-wallet balance operations (non-transactional writes)

**File:** [gift-wallet.model.js](backend/src/interactions/gift-wallet.model.js#L42-L56)
**Also affects:** [premium_stream.controller.js](backend/src/channels/premium_stream.controller.js#L82-L86), [creator_subscription.controller.js](backend/src/subscriptions/creator_subscription.controller.js#L60-L70), [renewal.worker.js](backend/src/subscriptions/renewal.worker.js#L35-L48)

```js
async function adjustVptUnits(uid, delta) {
  const wallet = await ensureWallet(uid);
  wallet.vpt_units += delta;     // ← in-memory read-modify-write
  wallet.updated_at = Date.now();
  await persist(wallet);          // ← Firestore set (not transactional)
  return wallet;
}
```
**Issue:** The `adjustVptUnits()` and `adjustNgnBalance()` functions perform a read-modify-write on in-memory state, then persist to Firestore with a simple `set()`. Under concurrent requests (user rapidly double-tapping "send gift" or "pay for access"), the second request reads the old balance before the first write completes, causing a **double-spend**.
**Impact:** Users can spend more balance than they have. Financial data integrity loss.
**Contrast:** The withdrawal approval flow (`withdrawal.controller.js` L60-79) correctly uses `db.runTransaction()`. The gift/subscription payment flows do not.
**Fix:** Use Firestore transactions (`db.runTransaction()`) for all balance-modifying operations, similar to how `approveWithdrawal` is already implemented.

---

### C5. CORS allows all origins by default — overly permissive in production

**File:** [app.js](backend/src/app.js#L49-L53)
```js
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',
}));
```
**Issue:** If `ALLOWED_ORIGINS` is not set (which the `.env.example` instructs to leave unset during development), CORS allows `*` — every origin can make authenticated API requests. This is safe only if the server is unreachable from the public internet.
**Impact:** In a production deployment where someone forgets to set `ALLOWED_ORIGINS`, any website can make API calls on behalf of authenticated users (CSRF via CORS).
**Fix:** In production, fail to start if `ALLOWED_ORIGINS` is not set, or default to a restrictive list instead of `*`.

---

## WARNING Findings

### W1. No rate limiting on most routes — only auth and interactions are covered

**Coverage map:**

| Route prefix | Rate limited? | Mechanism |
|---|---|---|
| `/auth/*` | ✅ Yes | `authRateLimit` (10 req/min per IP) |
| `/interactions/reactions` | ✅ Yes | Per-user (5/5s) |
| `/interactions/gifts/send` | ✅ Yes | Per-user (5/5s) |
| `/interactions/chat:send` (WS) | ✅ Yes | Per-user (6/10s) |
| `/admin/*` | ❌ No | — |
| `/channels/*` | ❌ No | — |
| `/broadcast/*` | ❌ No | — |
| `/subscriptions/*` | ❌ No | — |
| `/wallet/*` | ❌ No | — |
| `/withdrawals/*` | ❌ No | — |
| `/vpt/*` | ❌ No | — |
| `/notifications/*` | ❌ No | — |
| `/referrals/*` | ❌ No | — |
| `/home/*` | ❌ No | — |

**Impact:** An attacker with a valid JWT can flood the subscription endpoint, trigger mass wallet operations, or exhaust Firestore quotas.
**Fix:** Add a global rate limiter (e.g., `express-rate-limit`) with a reasonable default (100 req/min per IP), with stricter limits on financial endpoints.

---

### W2. Admin routes rely on controller-level checks, not middleware — inconsistent enforcement

**File:** [admin.routes.js](backend/src/admin/admin.routes.js)
**Issue:** Admin routes use `authenticateToken` middleware (JWT auth) but admin role verification happens inside each controller function via `requireAdmin()`. This means:
1. Every new admin endpoint must remember to call `requireAdmin()` — easy to forget.
2. Some admin endpoints in other files (e.g., VPT admin routes, withdrawal admin routes) implement their own `requireAdmin` check independently.

**Also:** The `GET /analytics/creator/admin/:uid/stats` route in [creator_analytics.routes.js](backend/src/analytics/creator_analytics.routes.js#L10) is accessible by **any authenticated user** — the admin check needs to be verified in the controller.

**Fix:** Create a reusable `requireAdmin` middleware and apply it at the router level for all admin routes.

---

### W3. PAK login uses user-supplied `pak` value as Firestore document ID — potential injection

**File:** [auth.controller.js](backend/src/auth/auth.controller.js#L252)
```js
const pakSnap = await db.collection('paks').doc(trimmedPak).get();
```
**Issue:** The `trimmedPak` value comes from user input and is used directly as a Firestore document ID. While Firestore document IDs don't allow `/` (preventing path traversal), they do accept any other string. The input validation only checks `pak.trim().length < 5`.
**Impact:** Low — Firestore is not SQL and doc IDs are sandboxed to the collection. But extremely long PAK values or values with special characters could cause unexpected behavior.
**Fix:** Validate PAK format more strictly (e.g., alphanumeric only, max 64 chars).

---

### W4. Static file serving exposes uploads directory without auth

**File:** [app.js](backend/src/app.js#L55)
```js
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
```
**Issue:** All uploaded files (channel logos, banners, videos, thumbnails, homepage assets) are publicly accessible without authentication. Anyone with a valid filename can access any uploaded file.
**Impact:** Private channel media and user-uploaded content is publicly accessible. Directory listing is disabled by default in `express.static`, but sequential UUID guessing or URL leaking exposes files.
**Fix:** For sensitive content, serve through an authenticated endpoint. For public content (logos, banners), this is acceptable but should be documented as intentional.

---

### W5. Video upload allows 500MB files with no virus/malware scanning

**File:** [video.upload.js](backend/src/broadcast/video.upload.js#L30-L34)
```js
const videoUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 },  // 500 MB
});
```
**Issue:** 500MB file uploads with only extension-based validation (no MIME type or magic-byte checking). A malicious file with a `.mp4` extension could contain anything.
**Impact:** Storage exhaustion (a single creator can upload many 500MB files), and potentially serving malicious content.
**Fix:** Add MIME type validation (`file.mimetype` check), consider cloud-based virus scanning, and enforce per-user upload quotas.

---

### W6. Image upload validates only by extension, not MIME type

**File:** [upload.js](backend/src/utils/upload.js#L18-L24)
```js
const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  ...
};
```
**Issue:** Extension can be spoofed. A PHP webshell renamed to `malware.jpg` would pass the filter.
**Impact:** Low on its own (express.static serves files by extension, not execution), but defense-in-depth is missing.
**Fix:** Also check `file.mimetype` against an allowed list (`image/jpeg`, `image/png`, `image/webp`).

---

### W7. In-memory rate limiter state is per-process — ineffective with multiple instances

**Files:** [auth.routes.js](backend/src/auth/auth.routes.js#L8-L23), [interactions.controller.js](backend/src/interactions/interactions.controller.js#L16-L29), [chat.service.js](backend/src/interactions/chat.service.js#L10-L23)
**Issue:** All rate limiters use in-memory `Map` objects. In a multi-instance deployment (Cloud Run auto-scaling), each instance maintains its own state. An attacker can bypass rate limiting by having requests routed to different instances.
**Impact:** Rate limiting becomes ineffective at scale.
**Fix:** Use a shared store (Redis, Firestore) for rate limiting state, or rely on Cloud Run's built-in request concurrency limits + API gateway rate limiting.

---

### W8. `updateSetting()` calls `requireAdmin()` twice

**File:** [admin.controller.js](backend/src/admin/admin.controller.js#L160-L163)
```js
async function updateSetting(req, res) {
  if (!requireAdmin(req, res)) return;
  const caller = requireAdmin(req, res);  // ← called twice
```
**Issue:** `requireAdmin` is called twice — once for the guard check and once to get the caller object. The second call sends a duplicate 403 response if the user is not admin (but `return` after the first already prevents reaching it). It's a bug that happens to be masked.
**Impact:** Low — functionally harmless but confusing, and the second call wastes a user lookup.
**Fix:** Use `const caller = requireAdmin(req, res); if (!caller) return;` once.

---

### W9. `GET /channels/` is public — leaks owner emails

**File:** [channel.routes.js](backend/src/channels/channel.routes.js#L10), [channel.controller.js](backend/src/channels/channel.controller.js#L133)
```js
router.get('/', ctrl.getPublicChannels);  // no authenticateToken

// In enrichChannel():
owner_name: owner?.name || owner?.email || 'Unknown',
```
**Issue:** The public channels endpoint returns `owner_name` which falls back to `owner?.email` when no display name is set. This leaks user email addresses to unauthenticated callers.
**Impact:** User email enumeration without authentication.
**Fix:** Change fallback to `'Creator'` or `'Unknown'` instead of `owner?.email`.

---

### W10. Admin seed password logged to console in plaintext

**File:** [app.js](backend/src/app.js#L104-L105)
```js
if (isGeneratedPassword) {
  console.log(`[Seed]   Password: ${adminPassword}`);
```
**Issue:** When no `ADMIN_PASSWORD` env var is set, the auto-generated admin password is written to stdout. In Cloud Run, these logs are visible in Cloud Logging to anyone with `logging.viewer` role.
**Impact:** Admin credential exposure via log inspection.
**Fix:** Write the password to Secret Manager or display only once via a secure channel.

---

### W11. `GET /broadcast/time` is public — server clock exposed

**File:** [broadcast.routes.js](backend/src/broadcast/broadcast.routes.js#L9)
**Issue:** Server time endpoint is public. While by design for sync, it reveals the server clock.
**Impact:** Low — useful for sync but provides reconnaissance information. Acceptable; document as intentional.

---

### W12. Subscription payment has no idempotency protection

**File:** [subscription.controller.js](backend/src/subscriptions/subscription.controller.js#L14-L30)
**Issue:** The `subscribe()` function doesn't check if the user already has an active subscription before charging. A rapid double-submit results in double-charging and double role/premium assignments.
**Impact:** Financial loss for users through accidental double-payment.
**Fix:** Check for existing active subscription before processing payment. Return existing subscription if one exists.

---

## INFO Findings

### I1. No TODO/FIXME/HACK comments found

All `backend/src/` files are clean — no incomplete work markers detected.

---

### I2. Dockerfile is well-structured

**File:** [Dockerfile](backend/Dockerfile)
- ✅ Multi-stage build (deps → runtime)
- ✅ Non-root user (`appuser`)
- ✅ Production deps only (`--omit=dev`)
- ✅ `node:20-alpine` (minimal attack surface)
- ⚠️ Minor: `uploads/` directory is ephemeral on Cloud Run (acknowledged in comments; production needs GCS)

---

### I3. Environment variable dependency map

| Variable | Source | Required? | Used in |
|---|---|---|---|
| `PORT` | Cloud Run auto-injects | Optional (default: 3000) | `app.js:46` |
| `ALLOWED_ORIGINS` | Env var | **Recommended** for production | `app.js:50`, `socket.service.js:9` |
| `FIREBASE_PROJECT_ID` | Env var | **Yes** (or `GCLOUD_PROJECT`) | `firestore.js:6` |
| `GCLOUD_PROJECT` | Cloud Run auto-injects | Fallback for above | `firestore.js:6` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Env var | **Yes** (local dev only) | Firebase Admin SDK |
| `ADMIN_EMAIL` | Env var | Optional (default: admin@afrovision.com) | `app.js:89` |
| `ADMIN_PASSWORD` | Env var | **Recommended** | `app.js:90` |

**Firestore-stored settings** (managed via admin panel, not env vars):
`JWT_SECRET`, `WALLET_SECRET`, `TREASURY_PRIVATE_KEY`, `BSC_RPC`, `VPT_TOKEN_ADDRESS`, `PANCAKE_ROUTER`, `WBNB_ADDRESS`, `NGN_TO_BNB_RATE`, `COMMUNITY_POOL_PERCENT`, `VPT_EXTRACTION_PERCENT`, `VPT_PRICE_NGN`, `BATCH_SIZE`, `MAX_RETRY_ATTEMPTS`, `ENVIRONMENT`

---

### I4. Helmet is configured with defaults — acceptable

`app.use(helmet())` provides CSP, DNS prefetch control, frameguard, HSTS, X-Content-Type-Options, referrer policy, XSS filter. Adequate for an API server.

---

### I5. JSON body size limit is set appropriately

`express.json({ limit: '1mb' })` — prevents large payload DoS. Adequate for API payloads.

---

### I6. No hardcoded secrets found in source code

All secrets (JWT_SECRET, WALLET_SECRET, TREASURY_PRIVATE_KEY) are loaded from Firestore at runtime via `SettingsService.get()`. No API keys, passwords, or tokens are hardcoded. The `.env` file is properly gitignored. `.env.example` contains only a project ID (public information).

---

### I7. Firestore writes are generally validated

Most Firestore writes go through model functions that validate data before persisting. The `user.model.js` creates well-structured documents. The `persistUser()` pattern (in-memory → Firestore set) is consistent across all models.

---

## Priority Remediation Order

1. **C2** — Remove reset token from response (account takeover — fix immediately)
2. **C4** — Add Firestore transactions to gift-wallet balance operations (double-spend)
3. **C1** — Add try/catch to `register()` (crashes under Firestore failure)
4. **C5** — Enforce `ALLOWED_ORIGINS` in production
5. **C3** — Fix user enumeration in `forgotPassword()`
6. **W1** — Add global rate limiting
7. **W2** — Create admin middleware for consistent role enforcement
8. **W12** — Add idempotency to subscription payment
9. **W5/W6** — Add MIME type validation to uploads
10. **W10** — Stop logging admin passwords
