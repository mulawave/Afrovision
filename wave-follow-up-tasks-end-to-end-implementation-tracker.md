# Wave Follow-Up Tasks — End-to-End Implementation Tracker

## Completion Contract
All 15 tasks from `wave-follow-up-tasks.md` must be implemented fully. Each task must be tested by verifying the described behavior works end-to-end: visually (no ? glyphs), functionally (toast dismisses, fullscreen works, views count), and architecturally (channel Waves tab fully wired, backend view endpoint live, upload panel clean).

## Business Rules
- Every Wave play must increment `repeat_play_count` unconditionally
- The first play per user/IP per wave increments `views_count` (unique view)
- Icons must be encoding-safe (SVG inline) — no emoji/Unicode that can corrupt
- Title overlay must not appear in the Wave feed player
- The ECG timeline must span the full bottom width of the player
- Toast notifications must auto-dismiss after 2.5 seconds
- The right icon strip must have no dark gradient background
- Fullscreen must show exit button and prev/next navigation overlays
- Left panel must be ~double its current width (560px+)
- On-Demand coming-soon stub must be hidden
- Published Waves list moves from WaveUploadPanel to ChannelProfile Waves tab
- Waves tab is always shown (not limited to exclusive channels)
- First-frame thumbnail fallback: use `#t=0.1` video URL hint

## Domain Model Changes
- `wave.model.js`: add `views_count: 0` and `repeat_play_count: 0` to `create()`
- `wave.model.js`: add `trackView(waveId, userKey)` using Firestore subcollection `wave_view_logs`
- `Wave` TS interface: add `repeat_play_count?: number`

## API Contracts
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/wave/:waveId/view` | optional | Increments repeat_play_count always; increments views_count once per user/IP |

Frontend:
- `trackWaveViewApi(waveId: string)` → POST `/wave/:waveId/view`

## User Flows
1. User opens Wave → view counted → icons render correctly (no ?)
2. User replays → repeat_play_count incremented, views_count unchanged
3. User triggers option (bookmark/report) → toast shows → auto-dismisses after 2.5s
4. User enters fullscreen → exit button visible → next/prev buttons work
5. User visits Channel page → Waves tab visible → wave grid rendered with thumbnails
6. Creator opens Manage tab → WaveUploadPanel shows only upload form (no published list)
7. Creator publishes wave via Manage tab → wave appears in channel Waves tab

## Security and Observability
- View tracking uses `req.userId` (authenticated) or `req.ip` (anonymous) as dedup key
- IP is read from `req.ip` (set by express-request-ip or req.ip with trust proxy)
- No PII stored in view logs — only hashed userId/IP

## Acceptance Criteria and Test Matrix

| # | Task | Acceptance Criterion | Status |
|---|------|---------------------|--------|
| 1 | Fix broken ? icons (general) | No `?` glyphs in Wave UI; all icons render as proper SVG | [x] |
| 2 | Center ECG timeline | ECG spans full bottom width (right-0 not right-16) | [x] |
| 3 | Toast auto-dismiss | Toast disappears after 2.5s without user action | [x] |
| 4 | Remove dark icon strip gradient | Right icon strip has no dark gradient background | [x] |
| 5 | Remove wave name overlay | No title/description text displayed over video in feed | [x] |
| 6 | Fix play icon | Play indicator shows ▶ SVG correctly | [x] |
| 7 | Fullscreen exit button | Exit button visible when in fullscreen | [x] |
| 8 | Fullscreen scrolling | Next/prev buttons work inside fullscreen; autoscroll advances normally | [x] |
| 9 | Waves tab on channel page | Tab labeled "Waves" appears; wave grid loads with thumbnails | [x] |
| 10 | Channel waves with owner controls | Channel owner sees delete button per wave in channel Waves tab | [x] |
| 11 | Published Waves removed from upload panel | WaveUploadPanel shows only the upload form | [x] |
| 12 | First-frame thumbnails | Wave grid tiles with no thumbnail_url show video first frame | [x] |
| 13 | Hide On-Demand section | Left panel shows no On-Demand section | [x] |
| 14 | Widen left panel | Left panel is ~560px wide on desktop | [x] |
| 15 | Views counting | views_count and repeat_play_count increment; two stat rows shown in strip | [x] |

---

## Implementation Log

### Completed Tasks
- [x] 1: SVG icons added, all ? replaced — `website/src/app/wave/page.tsx`
- [x] 2: ECG right-0 — `website/src/app/wave/page.tsx`
- [x] 3: Toast auto-dismiss useEffect — `website/src/app/wave/page.tsx`
- [x] 4: Gradient removed from strip — `website/src/app/wave/page.tsx`
- [x] 5: Title/desc block removed — `website/src/app/wave/page.tsx`
- [x] 6: Play icon SVG — `website/src/app/wave/page.tsx`
- [x] 7: Fullscreen exit button — `website/src/app/wave/page.tsx`
- [x] 8: Fullscreen prev/next nav — `website/src/app/wave/page.tsx`
- [x] 9: Waves tab + grid — `website/src/app/channel/[id]/ChannelProfile.tsx`
- [x] 10: Delete button in waves tab — `website/src/app/channel/[id]/ChannelProfile.tsx`
- [x] 11: Published Waves removed from upload panel — `website/src/components/WaveUploadPanel.tsx`
- [x] 12: First-frame thumbnail fallback — `website/src/app/wave/page.tsx` + `ChannelProfile.tsx`
- [x] 13: OnDemandSection removed — `website/src/app/wave/page.tsx`
- [x] 14: LeftPanel width 560px — `website/src/app/wave/page.tsx`
- [x] 15: View tracking backend + frontend — `backend/src/wave/`, `website/src/lib/api.ts`, `wave/page.tsx`
