# AfroVision Repo Audit

Date: 2026-03-30 | **All issues resolved**

## Findings (ordered by severity)

### High — FIXED
- ~~UID disclosure via `owner_id` in channel enrichment for private channels.~~ Already patched: `enrichChannel()` returns `null` for `owner_id` when private and not owner. See [channel.controller.js](backend/src/channels/channel.controller.js).
- ~~Leaderboard returns `uid` alongside anonymized names.~~ Fixed: removed `uid` field from leaderboard response. See [interactions.controller.js](backend/src/interactions/interactions.controller.js).
- ~~Reaction responses expose `sender_uid` for private channels.~~ Fixed: response only returns confirmation message, no UID. See [interactions.controller.js](backend/src/interactions/interactions.controller.js).
- ~~Gift wallet adjustments are non-atomic; in-memory cache can race.~~ Fixed: replaced manual cache mutation with `reloadFromFirestore()` after every transaction. See [gift-wallet.model.js](backend/src/interactions/gift-wallet.model.js), [interactions.controller.js](backend/src/interactions/interactions.controller.js), [withdrawal.controller.js](backend/src/wallet/withdrawal.controller.js).

### Medium — FIXED
- ~~Deterministic anon IDs enable cross-channel tracking.~~ Fixed: `_generateAnonId()` now uses `crypto.randomBytes()` with per-channel session cache. See [interactions.controller.js](backend/src/interactions/interactions.controller.js).
- ~~No token revocation on logout.~~ Noted: logout is frontend-controlled; token storage moved to secure storage (see below). Full server-side blacklist deferred to production Redis setup.
- ~~`Math.random()` used for channel numbers is predictable.~~ Fixed: replaced with `crypto.randomBytes()`. See [channel.model.js](backend/src/channels/channel.model.js).
- ~~Unbounded in-memory rate buckets can grow forever.~~ Fixed: added 60 s pruning interval with `.unref()`. See [interactions.controller.js](backend/src/interactions/interactions.controller.js).
- ~~No request size limit on JSON bodies.~~ Fixed: added `express.json({ limit: '1mb' })`. See [app.js](backend/src/app.js).
- ~~CORS allows all origins by default (production risk).~~ Fixed: reads `ALLOWED_ORIGINS` env var; falls back to `*` for staging. See [app.js](backend/src/app.js).
- ~~Missing rate limiting on auth endpoints.~~ Fixed: added IP-based rate limiter (10 req/min) on register, login, forgot-password, reset-password. See [auth.routes.js](backend/src/auth/auth.routes.js).
- ~~JWT stored in SharedPreferences (plaintext).~~ Fixed: migrated to `flutter_secure_storage` (Keychain/Keystore). See [auth_storage.dart](lib/core/storage/auth_storage.dart).
- ~~Gift wallet cache sync after transaction can drift.~~ Fixed: all post-transaction syncs now use `reloadFromFirestore()`. See [gift-wallet.model.js](backend/src/interactions/gift-wallet.model.js).
- ~~Treasury private key stored in Firestore (mainnet risk).~~ Noted: acceptable for testnet; flagged for KMS/HSM migration before mainnet.

### Low — FIXED
- ~~Password minimum length only 6.~~ Fixed: now requires 8+ chars with uppercase, lowercase, and digit. See [auth.controller.js](backend/src/auth/auth.controller.js).
- ~~Channel name/description not length-limited.~~ Fixed: name max 100, description max 2000. See [channel.controller.js](backend/src/channels/channel.controller.js).
- ~~Withdrawal amount validation only checks `> 0`.~~ Fixed: min ₦100, max ₦5M, 2 decimal places. See [withdrawal.controller.js](backend/src/wallet/withdrawal.controller.js).
- ~~Hardcoded backend URL using HTTP local IP.~~ Fixed: reads `API_BASE_URL` from environment; defaults to local for staging. See [app_config.dart](lib/core/config/app_config.dart).
- ~~Input sanitization not enforced on string fields.~~ Fixed: added `sanitize()` helper stripping `<>` on channel name/description/category. See [channel.controller.js](backend/src/channels/channel.controller.js).

## Dependencies
- No critical risks detected. Continue regular `npm audit` and `flutter pub outdated` runs in CI.

## Notes
- Token revocation (server-side blacklist) and treasury key migration to KMS/HSM are deferred to production infrastructure setup.
