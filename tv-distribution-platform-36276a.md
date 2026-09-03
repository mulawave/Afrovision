# AfroVision TV Distribution & Activation Platform

Transform the Android TV app from free QR-pairing into a distributor-licensed, server-activated product with a distributor web portal, a marketer Flutter app, full admin control, TV messaging, and remote kill-switch — monetized via a hybrid model (1-year license fee + per-activation split, global one-time activation price set by admin).

## Current State (verified in code)

- **TV app**: native Android TV Compose app at `android/tv` — boots into free QR pairing (`PairingScreen.kt`, `SessionManager.kt`), gets a normal user JWT
- **Backend**: Node/Express + Firestore — `tv_sessions` pairing endpoints in `backend/src/auth/tv_session.controller.js` (public, unrestricted)
- **Admin**: Next.js panel (`admin/src/app/(admin)/…`) with established page patterns
- **Website**: Next.js (`website/`) — will host the distributor portal
- **Mobile**: Flutter app (`lib/`) — marketer app will be a NEW separate lightweight Flutter project

## Business Rules (confirmed)

- Hybrid money flow: upfront 1-year license fee + per-activation percentage split (admin/distributor), remittance tracked (due vs received)
- Global activation price set in admin; **one-time activation, lifetime** (never expires, never needs reactivation)
- One code = one TV, forever bound to that device ID; TV owner keeps the code for re-activation after e.g. factory reset
- Distributors are **admin-created**; marketers are created by their distributor
- TV messaging is **two-way**: broadcast down (program updates, PSAs, marketing) + simple replies/acknowledgements up
- Free QR pairing becomes privilege-gated (owner/admin + admin-granted whitelist only)

---

## Phase 1 — Backend: Distribution Module (`backend/src/distribution/`)

**New Firestore collections**
- `distributors` — company/contact info, hashed password, license: `{ issued_at, expires_at }`, status (`active|frozen|banned`), quota: `{ total_allocated, used, remaining }`, split override %, financial totals
- `marketers` — belongs to distributor, name/phone, hashed password/PIN, status, activation counts
- `activation_codes` — code (crypto-random, e.g. `AV-XXXX-XXXX-XXXX`), distributor_id, marketer_id, status (`issued|activated|revoked`), issued_at, activated_at, bound `device_id` (immutable once set)
- `tv_devices` — device_id, activation_code, owner user_id, model/name, location (geo-IP at activation + heartbeats), app version, status (`active|disabled`), disabled_reason/by, last_seen
- `remittances` — per-distributor ledger: activation revenue events, split computation, payments received (admin-recorded), running balance
- `tv_messages` / `tv_message_replies` — broadcasts with targeting (all TVs / distributor's TVs / single device), type (`program_update|psa|marketing|critical`), and TV replies/acks
- `distribution_settings` (in admin settings) — global activation price ₦, default split %, license fee ₦, QR-pairing whitelist (user IDs)

**TV users**: activation creates a document in the existing `users` collection with `account_type: 'tv'` (explicit flag distinguishing TV users from app users) + owner email, full name, phone, device_id. Supports later data-merge with a regular app account.

**Key endpoints**
- Distributor auth + dashboard APIs (marketer CRUD, activations feed, financials, top marketers, request-device-disable)
- Marketer auth + `POST /distribution/codes/request` — real-time validation chain: marketer valid → distributor active + license unexpired + quota remaining → mint fresh code, decrement quota, log
- TV activation: `POST /distribution/tv/activate` — code + owner details + device_id → validate code unused OR already bound to this same device (re-activation path) → create TV user, bind code, issue long-lived device token, record revenue event + split
- TV runtime: `POST /distribution/tv/heartbeat` — returns `{ enabled, config_version, app_update: {version, apk_url}, unread_messages }`; server-side kill switch honored here and on every authenticated call
- Messaging: list/read/reply for TVs; compose/target/replies-view for admin
- Admin APIs: distributor CRUD + ban/freeze/delete (cascades to marketers, codes, and disables portal access), license renewal, quota grants, financial summaries (remittance due/received, split), device registry (device IDs, locations, validity), per-device disable/enable, QR-whitelist management

**Lockdown**: existing `/auth/tv/session*` pairing endpoints gated — confirm step requires owner/admin role or presence on the QR whitelist.

## Phase 2 — Admin Panel: "TV Distribution" section (`admin/src/app/(admin)/tv-distribution/`)

- **Overview dashboard**: total distributors/marketers/activated TVs, revenue, remittance due vs received, activations trend
- **Distributors**: create (generates credentials), list with license validity countdown, quota, financial split, actions — ban / freeze / delete / renew license / grant quota / record remittance payment
- **Distributor detail**: marketers list, activation history, device list (device IDs, owner info, locations, last seen), financial ledger with admin/distributor split breakdown
- **Devices**: global registry, search by device ID/owner/location, one-click disable/enable (kill switch) with reason
- **Messaging**: composer (type, targeting, schedule), sent history, replies/acknowledgement viewer
- **Settings**: global activation price, default split %, license fee, QR-pairing whitelist manager

## Phase 3 — Distributor Web Portal (`website/src/app/distributor/`)

Separate branded login (distributor credentials, not user accounts). Premium dark dashboard:
- KPIs: quota remaining, license days left, total activations, revenue, amount owed to AfroVision
- **Marketers**: register/deactivate marketers, per-marketer install counts, anomaly flags (e.g., burst requests), top-selling marketer leaderboard
- **Activations**: live feed (marketer, device, owner, location, time)
- **Financials**: earnings after split, remittance due, payment history
- **Device actions**: request AfroVision to disable a specific TV (flows to admin)

## Phase 4 — Marketer Flutter App (new project `marketer_app/`)

Deliberately simple, 4 screens, shares AfroVision design language:
1. **Login** — marketer credentials (issued by distributor); device-bound session
2. **Home** — distributor name, quota remaining (live), personal activation count
3. **Request Activation Code** — one tap → server validates distributor channel in real time → shows fresh code full-screen with copy + expiry-of-issuance note; code request logged and attributed
4. **History** — codes requested, which were activated, device/owner summary

## Phase 5 — TV App: Activation, Persistence, Kill Switch (`android/tv`)

- Replace boot-time QR pairing with an **Activation flow**: enter activation code + owner full name, email, phone; device ID auto-collected (`ANDROID_ID`, fallback to generated UUID persisted in app-private storage); submit → server binds code ↔ device, returns device token
- **Never reactivate**: device token + activation record persisted; app restores silently forever. If wiped, the owner re-enters their same code (valid only for that device ID)
- **Heartbeat** on launch + periodic: enforces admin/distributor disable (full-screen "Service Disabled — contact your distributor" lock screen), reports location/app version/last seen
- **Auto-refresh**: channels always fetched live from server; server-driven config (layout hints, theming tokens) applied on config_version change
- **Self-update**: heartbeat advertises newest APK version + GCS-hosted APK URL; TV downloads and prompts install (sideload update path since we're off Play Store)
- QR account-sync screen removed from the default flow; data-merge with an app account available from TV Profile/Settings only

## Phase 6 — TV App: Messaging Center

- Inbox with unread badge on the TV home nav; message types styled distinctly (program update / PSA / marketing / critical)
- Critical messages take over the screen until acknowledged
- Two-way: quick replies / acknowledgements sent back to admin

## Phase 7 — TV App: Premium UI/UX Overhaul

- World-class VOD/cable aesthetic: cinematic hero carousel, channel rails with focus-scale animations, glass/gradient cards, custom iconography, smooth D-pad focus traversal, ambient backgrounds, refined typography
- Redesigned screens: Activation (elegant onboarding wizard), Home, Channel Grid/Guide, Player overlay, Library, Messages, Profile/Settings
- Consistent AfroVision brand (deep navy `#050A30`, orange/gold gradients) elevated to 10-ft TV design standards

## Copy-Protection Reality (important)

An APK on a flash drive can always be file-copied — that cannot be prevented. Protection is that **a copy is worthless**:
- App is inert until a live, server-minted, single-use code activates it — codes only mint through a validated marketer → distributor → server chain in real time
- Activation binds to the device ID server-side; token checked on every API call; kill switch on heartbeat
- APK signature + package integrity check at runtime (tampered/re-signed builds refuse to run)
- All entitlement logic lives server-side; the APK contains no secrets that unlock content offline

## Sequencing & Deliverables

| Phase | Deliverable | Depends on |
|---|---|---|
| 1 | Backend distribution module + gated QR pairing | — |
| 2 | Admin TV Distribution section | 1 |
| 3 | Distributor web portal | 1 |
| 4 | Marketer Flutter app | 1 |
| 5 | TV activation + kill switch + persistence | 1 |
| 6 | TV messaging center | 1, 5 |
| 7 | TV UI overhaul | 5 |

Deployment stays on the user's `deploy_all.ps1` path for backend/website/admin; TV APK + marketer APK are built and distributed out-of-store (APK hosted on GCS for TV self-update).

## Open Items (defaults chosen, flag if wrong)

- License fee, activation price, and default split % — left as admin-configurable settings with placeholder defaults
- Marketer login: username + PIN issued by distributor (simple for field use)
- Location tracking: geo-IP based (no GPS permission needed on TVs)
