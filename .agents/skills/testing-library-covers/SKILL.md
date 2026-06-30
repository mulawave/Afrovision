---
name: testing-library-covers
description: Test the AfroVision channel Library tab (comic covers, ordering, reader) end-to-end on a local web build vs prod. Use when verifying cover-display, library-ordering, or reader changes in website/src/app/channel/[id].
---

# Testing AfroVision channel Library / comic reader

## What this covers
The channel-profile **Library** tab (`website/src/app/channel/[id]/ChannelProfile.tsx`) and the
web comic reader (`website/src/app/channel/[id]/library/[itemId]/page.tsx`).

## Environment setup
- Local dev: `cd website && npm run dev` → http://localhost:3000. The site proxies API calls
  to the prod backend (`https://afrovision-backend-134538542038.us-central1.run.app`) via
  `/api/proxy`, so a local build still shows real channel data.
- Prod (the "before" baseline for UI changes): https://afrovision.online — same code as GitHub
  `main` minus any unmerged PR. Good for before/after contrast.
- Test channel: **Channel 31** (X-Lounge Extreme), id `e797e453-8c54-4e22-8cec-fa954f68ad1e`.
- Login (creator): `richard_obroh@yahoo.co.uk`. To get a JWT without solving reCAPTCHA, POST to
  `/api/proxy/auth/login` with `{email, password, client:"mobile"}`, then
  `localStorage.setItem('av_token', token)` and `localStorage.setItem('av_user', JSON.stringify(user))`.
  Run this from the page console (browser_console) so it hits the right origin.

## Gotchas (likely still true)
- **Auto-resume redirect:** navigating directly to `/channel/<id>` can auto-redirect into the
  last-read reader item (`/channel/<id>/library/<itemId>`) and show "Opening your book…".
  To reach the Library grid reliably: land on the channel page, click **← Back** if it opened the
  reader, then click the **Library** tab. The grid may render briefly before the redirect — the
  computer-tool screenshot can lag behind the DOM, so trust the screenshot for visuals but verify
  structure with browser_console.
- **Prod layout shift:** prod shows an app-update announcement banner that pushes the tab row down
  ~20px vs local, so tab click coordinates differ between local and prod.

## Verifying cover containment (object-fit) precisely
Visual diff alone is weak when covers are near the card aspect ratio. Measure instead — run in
browser_console on each environment:
```js
[...document.querySelectorAll('button img')].filter(i=>i.clientWidth>100)
  .map(i=>({fit:getComputedStyle(i).objectFit,
            natRatio:(i.naturalWidth/i.naturalHeight).toFixed(3),
            box:i.clientWidth+'x'+i.clientHeight}))
```
- `object-cover` + art wider-ratio than the box → left/right edges cropped (edge text/badges cut).
- `object-contain` → full art, letterbox bars; nothing cropped.
- Confirm the SAME natural dimensions + box on both envs so the only variable is `object-fit`.
- Zoom into a cover with text near the edges (e.g. "Story and Art / Daval3D") — cropped envs cut
  the first/last characters; contained envs show them whole.

## Not runtime-testable from this web env
- **Backend changes** (e.g. library ordering in `backend/src/library/library-viewer.controller.js`):
  the site talks to the deployed prod backend, so an unmerged backend change won't show. Mark
  UNTESTED unless the modified backend is deployed/run against Firestore.
- **Flutter reader** (`lib/features/broadcast/screens/channel_library_reader_screen.dart`): needs a
  device/emulator. Mark UNTESTED in web-only runs.

## Devin Secrets Needed
- None stored as secrets currently; creator credentials are provided in-session by the user.
