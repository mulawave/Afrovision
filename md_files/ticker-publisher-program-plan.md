# AfroVision Ticker — Publisher Program (Plan)

**Status:** Plan only — not scheduled for implementation. For review.
**Date:** 2026-09-27

## 1. Goal

Let website owners and app publishers earn by displaying the AfroVision Ticker (the platform marquee) on their own sites and apps.

A public page invites them in:

> **Are you a website owner, or do you have mobile apps you want to monetize?**
> Display the AfroVision Ticker on your website and mobile app to start earning.

Interested publishers sign up (or log in), then submit an application with:

1. **URL** of the site or app (web URL, or Play Store / App Store link)
2. **Total visitors per month**, backed by a Google Analytics screenshot
3. **Total page views per month**, backed by a Google Analytics screenshot
4. **Site or app description**

AfroVision reviews each application. Approved publishers get a personal embed code, and earnings are tracked against their verified ticker views.

## 2. What already exists (reuse, don't rebuild)

| Piece | Where | How it's reused |
|---|---|---|
| Embeddable ticker | `website/public/ticker.js` + `website/src/app/api/ticker/route.ts` | The widget publishers embed. It gains a publisher key and view tracking (§6). |
| Accounts / sign-in | Website `/register`, `/login` | Publishers apply with a normal AfroVision account. |
| Signed image uploads | `backend/src/ads` `POST /ads/upload-url` (jpg/png/webp) | The same pattern handles the two analytics screenshots. |
| Review queue pattern | Ads: `/ads/pending`, `/:id/approve`, `/:id/reject` | The same shape serves publisher applications. |
| Impression recording | Ads: `POST /ads/impression`, `/ads/click` | The model for ticker view beacons. |
| Wallet + withdrawals | `backend/src/wallet` (Paystack), ledger | Publisher payouts. |
| Audit log | `AuditService.logAction` | Every approval, rejection, earning credit and payout. |

## 3. Pages (website)

| Route | Purpose |
|---|---|
| `/ticker-publishers` | Public landing page: pitch, how it works, how earnings are calculated, requirements, FAQ, and an **Apply** button. |
| `/ticker-publishers/apply` | Application form (sign-in required). The 4 required fields plus contact details. |
| `/ticker-publishers/dashboard` | The applicant's status (pending / changes requested / approved / rejected). Once approved, it shows the embed code, verified views, earnings and payout history. |
| `/ticker-publisher-terms` | Program terms (see §9). Linked from the form; acceptance is required. |

The landing page is also linked from the footer and from `/advertiser` ("Earn with AfroVision").

### Application form fields

| Field | Type | Validation |
|---|---|---|
| Platform | Website / Android app / iOS app | required |
| URL | text | required. A valid `https://` URL, or a Play Store / App Store link matching the platform |
| Monthly visitors | number | required, integer > 0 |
| Visitors screenshot | image upload | required, jpg/png/webp, max 5 MB |
| Monthly page views | number | required, integer ≥ visitors |
| Page views screenshot | image upload | required, jpg/png/webp, max 5 MB |
| Description | textarea | required, 50–1,000 characters |
| Category / audience country | select | optional, helps review |
| Contact phone | text | optional (email comes from the account) |
| Accept program terms | checkbox | required |

There's one open application per URL. A rejected applicant can reapply after a cooldown (e.g. 30 days) or when asked for changes.

## 4. Data model (Firestore)

### `ticker_publisher_applications/{id}`
```
uid, platform, url, url_normalized (host, or package/bundle id)
monthly_visitors, monthly_pageviews
visitors_screenshot_path, pageviews_screenshot_path   // private GCS paths, not public URLs
description, category, audience_country, contact_phone
terms_accepted_at, terms_version
status: pending | changes_requested | approved | rejected
review_notes, reviewed_by, reviewed_at
created_at, updated_at
```

### `ticker_publishers/{publisherKey}`
```
uid, application_id, platform
allowed_hosts: [host, ...]        // for websites; views from other hosts aren't counted
app_id                            // for apps (package / bundle id)
status: active | suspended
rate_plan                         // see §7
created_at, suspended_reason
```
`publisherKey` is a random, non-guessable id. It's the only thing embedded on the publisher's page.

### `ticker_publisher_views/{publisherKey_yyyymmdd}`
Daily counters: `views`, `unique_sessions`, `rejected_views` (with reasons). Raw beacons aren't stored long-term.

### Earnings and payouts
Use the existing ledger (`type: TICKER_PUBLISHER_EARNING`) and withdrawal flow, and audit-log every credit.

## 5. Backend (sketch)

User routes, requiring `authenticateToken`:

- `POST /ticker-publishers/upload-url`: signed upload URL for a screenshot. Images only, 5 MB cap. Stored in a **private** path, because screenshots can contain business data.
- `POST /ticker-publishers/applications`: submit an application. Validates everything in §3 and enforces one open application per URL.
- `PATCH /ticker-publishers/applications/:id`: edit and resubmit when `changes_requested`.
- `GET /ticker-publishers/me`: the user's applications, their publisher record, and earnings summary.

Admin routes, behind the router-level admin check:

- `GET /admin/ticker-publishers/applications?status=`: the review queue, with short-lived signed URLs to view screenshots.
- `POST /admin/ticker-publishers/applications/:id/approve`: creates `ticker_publishers/{key}`, sets `allowed_hosts` / `app_id` and `rate_plan`, and notifies the applicant.
- `POST /admin/ticker-publishers/applications/:id/reject` and `…/request-changes`, each with a reason.
- `POST /admin/ticker-publishers/:key/suspend` and `/reinstate`.

Every approve, reject, suspend and earnings credit calls `writeAuditLog` / `AuditService.logAction`. Kill switch: add `ticker_publishers` to the feature flags, so the program can be paused.

> The admin panel (`admin/`, `backend/src/admin/`) is owned by the separate admin session. The admin UI (queue, publisher list, earnings, payouts) and the admin routes above should be built there.

## 6. Embed + view tracking

The publisher's embed code (websites):
```html
<div data-ticker data-publisher="PUBLISHER_KEY"></div>
<script src="https://afrovision.online/ticker.js" defer></script>
```

Changes to `ticker.js`:
- If `data-publisher` is present, send a lightweight view beacon to `https://afrovision.online/api/ticker/view`. It sends once per page view, only after the ticker has actually been visible on screen (IntersectionObserver, e.g. ≥ 50% visible for ≥ 2 s).
- It sends no cookies. It uses a per-tab random session id to de-duplicate.

`/api/ticker/view` (website route → backend) counts a view only if:
- the publisher is `active`;
- the request's `Origin` / `Referer` host is in `allowed_hosts`;
- it passes rate limits per IP / session / publisher, basic bot filtering (user agent, headless signals), and a cap of 1 counted view per session per page.

Everything that fails is counted as `rejected_views` with a reason, so publishers can see why.

**Mobile apps:** `ticker.js` is web-only. Two options:
1. **WebView embed (first):** a hosted page, `https://afrovision.online/ticker/embed?pub=KEY`, that renders only the ticker. The app shows it in a small WebView strip. Views are tied to `app_id` instead of a host.
2. **Native SDK (later):** small Android/iOS libraries that fetch `/api/ticker` and send the same beacon. This can wait for demand.

## 7. Earnings model — needs a decision

The request says "start earning" but doesn't define how. Options:

| Model | How | Pros | Cons |
|---|---|---|---|
| **CPM on verified views** | ₦X per 1,000 counted views | Pays for real exposure; scales with traffic | Needs solid fraud filtering (§6) |
| Flat monthly by tier | Tier set at approval from verified traffic (e.g. 10k / 50k / 250k+ monthly visitors) | Simple, predictable | Pays even if the ticker isn't shown much |
| Hybrid | Small monthly base + CPM | Balanced | More to explain |
| vPT rewards | Earnings in vPT via the existing pools | Uses existing token economy | Publishers may prefer cash |

Payouts would use the existing wallet and withdrawal flow, with a minimum payout threshold, monthly cycles and a hold period for fraud review. The source of funds (ads revenue share, marketing budget, a dedicated pool) must be decided so pools never go negative.

## 8. Review guidance (for admins)

- Visit the URL: live, real content, and nothing that breaches community rules.
- The screenshot numbers must match the declared numbers and period (last 30 days), and the GA property must be visibly for that site.
- Page views should be at least visitors, with a plausible ratio.
- Duplicate or recycled screenshots across applications lead to rejection.
- Optionally ask for GA read-only access for high-traffic applicants.

## 9. Program terms (to draft)

- The ticker must be shown unmodified: no hiding, no restyling to hide the text, no overlaying.
- No incentivized or automated views (bots, auto-refresh, forced views).
- AfroVision may suspend publishers and withhold earnings for invalid traffic.
- How long screenshots and traffic data are kept, and who can see them (admins only).
- Payment terms: thresholds, schedule, currency, tax information if needed.

## 10. Rollout phases

1. **Landing page + application + admin review** (no earnings yet). This validates demand.
2. **Approved embed codes + view tracking + publisher dashboard** (views only).
3. **Earnings + payouts** once the model in §7 is decided and fraud filtering has run for a few weeks.
4. **Mobile:** WebView embed first, native SDKs if needed.

## 11. Open questions

1. Earnings model and rates (§7), and the source of funds.
2. Minimum traffic to qualify (e.g. ≥ 5,000 monthly visitors?).
3. Payout currency: NGN cash, vPT, or both?
4. Is KYC required before payout? The platform already has KYC.
5. Content restrictions on publisher sites (e.g. no adult or gambling sites next to the ticker).
6. Should publishers choose ticker styles (colours) within brand limits, or always use the default look?
7. Is there a cap on publishers per country or category during early rollout?
