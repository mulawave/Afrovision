# Afrovision Wave — End-to-End Implementation Tracker

## 1. Feature Identity

- **Feature Name**: Afrovision Wave (Short Video / Clip Feed)
- **Owner Team(s)**: Product, Engineering
- **Primary Surfaces**: Backend (Node.js), Website (Next.js)
- **Related Tickets**: See §12 ticket list
- **Linked Tracker File**: `afrovision-wave-end-to-end-implementation-tracker.md`

---

## 2. Objective

Introduce Afrovision Wave — a short-form vertical video feed (clips ≤ 3 min) with a
proprietary "Pulse" engagement system replacing likes. Creators upload waves from the
Creator Studio or Channel Manage tab. Viewers discover waves through the `/wave` feed page,
pulse them (with intensity and moment-tracking), comment, bookmark, and share.

---

## 3. Completion Contract

1. **Entry points**: `/wave` nav link on website; Wave tab in Creator Studio / Channel Manage panel
2. **Destination UX**: Full-screen vertical card feed; tap to pause/play; overlay controls
3. **Backend/API**: Wave CRUD, upload-URL flow, Pulse (intensity + moment), Comments, Bookmarks, Report, Interest signal
4. **Navigation**: `/wave` feed, `/wave/[waveId]` deep link
5. **Permissions**: Upload requires auth + channel ownership; view is public for non-exclusive waves
6. **Operational controls**: Creator can delete own wave; admin can delete any wave
7. **Analytics**: Pulse count, pulse moment heatmap, community pulse score
8. **QA**: TypeScript clean, ESLint clean, production build pass, deploy

---

## 4. Business Rules

- A Wave is a short video (max 180 s) attached to a channel
- Creators may only upload waves for channels they own
- Pulse intensity: 1 = normal tap, 2 = strong (hold 800 ms), 3 = heavy (hold 2 s)
- Multiple pulses from the same user on the same wave are allowed (up to 10/day to prevent spam)
- Pulse moment = video timestamp in seconds when the user pulsed
- Community Pulse Score = (total_pulses × intensity_weight) + (watch_completions × 2)
- Autoscroll advances to the next wave when video ends
- "Interested" / "Not Interested" feed signal adjusts future recommendations (stored as a signal)

---

## 5. Domain Model Changes

### New: `waves` collection (Firestore)
```
id: string
channel_id: string
creator_uid: string
title: string
description: string
video_url: string
thumbnail_url: string | null
duration: number           // seconds
pulse_count: number        // denormalized counter
comment_count: number      // denormalized counter
bookmark_count: number     // denormalized counter
pulse_score: number        // community pulse score
status: "active" | "deleted" | "reported"
created_at: number
```

### New: `wave_pulses` collection
```
id: string
wave_id: string
user_id: string
intensity: 1 | 2 | 3
moment_seconds: number    // timestamp in video when pulsed
created_at: number
```

### New: `wave_comments` collection
```
id: string
wave_id: string
user_id: string
display_name: string
avatar_url: string | null
text: string
created_at: number
```

### New: `wave_bookmarks` collection
```
id: string (composite: userId_waveId)
wave_id: string
user_id: string
created_at: number
```

### New: `wave_interest_signals` collection
```
id: string
wave_id: string
user_id: string
signal: "interested" | "not_interested"
created_at: number
```

---

## 6. API Contracts

### Public / Optional-Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | /wave/feed | Paginated wave feed (cursor-based) |
| GET | /wave/:waveId | Single wave detail |
| GET | /wave/:waveId/pulses/moments | Pulse moment heatmap |

### Authenticated Viewer
| Method | Path | Description |
|--------|------|-------------|
| POST | /wave/:waveId/pulse | Add pulse (body: { intensity, momentSeconds }) |
| GET | /wave/:waveId/comments | Get comments |
| POST | /wave/:waveId/comments | Post comment |
| DELETE | /wave/:waveId/comments/:commentId | Delete own comment |
| POST | /wave/:waveId/bookmark | Toggle bookmark |
| GET | /wave/:waveId/bookmark | Get bookmark status |
| GET | /wave/me/bookmarks | List my bookmarked waves |
| POST | /wave/:waveId/interest | Signal interested/not_interested |
| POST | /wave/:waveId/report | Report wave |

### Creator (owns channel)
| Method | Path | Description |
|--------|------|-------------|
| POST | /wave/upload-url | Get GCS signed upload URL |
| POST | /wave/register | Register wave after upload |
| DELETE | /wave/:waveId | Delete wave |
| GET | /wave/channel/:channelId | Get waves for channel |

---

## 7. End-to-End User Flows

1. **Discovery**: User visits `/wave` → paginated feed loads, videos autoplay one at a time
2. **Pulse**: Tap ⚡ button (normal) or hold for 800ms/2s (strong/heavy) → pulse recorded with video timestamp
3. **Comment**: Tap chat icon → slide-up comment panel → read + post
4. **Bookmark**: Tap bookmark icon → toggles; count updates
5. **Options**: Three-dot menu → fullscreen, autoscroll, interested, not interested, report
6. **Creator Upload**: Creator Studio → Wave tab → pick file → progress bar → thumbnail → publish
7. **Autoscroll**: After video ends (or user enables autoscroll) → next wave in feed

---

## 8. Frontend Scope

### Website (`/wave`, `/wave/[waveId]`)
- `WaveFeedPage` — full-screen snap-scroll container
- `WaveCard` — individual video card: video player, overlay controls
- `PulseButton` — tap/hold intensity detection + ripple animation
- `WavePulseTimeline` — ECG-style timeline showing pulse hot moments
- `WaveCommentsPanel` — slide-up panel with comment list + input
- `WaveOptionsPanel` — overlay panel: fullscreen, autoscroll, interested, not_interested, report
- API lib additions: all Wave API calls

### States
- Loading skeleton cards
- Empty feed (no waves yet)
- Error state
- Pulsed confirmation animation (⚡ burst)
- Comment submit loading/error
- Bookmark toggle optimistic update

---

## 9. Backend / Jobs Scope

- `backend/src/wave/` — wave.model, wave.pulse.model, wave.comment.model, wave.bookmark.model, wave.controller, wave.routes
- Pulse spam guard: max 10 pulses/user/wave/day via counter in Firestore
- Pulse score recalculation on pulse event
- Wave route registered in `app.js`

---

## 10. Security and Compliance

- Upload URL endpoint validates channel ownership before issuing signed URL
- Comment text sanitized (length ≤ 500 chars, no HTML)
- Report creates a moderation record for admin review
- Pulse rate limiting: 10 per user per wave per 24h
- All write endpoints require `authenticateToken`

---

## 11. Observability and Analytics

- `pulse_count`, `comment_count`, `bookmark_count` on wave document (denormalized)
- `pulse_score` updated on each pulse
- Pulse moment data queryable for creator analytics ("Most Pulsed Moment")

---

## 12. Ticket List

- [x] **W-01** Backend: wave.model.js
- [x] **W-02** Backend: wave.pulse.model.js
- [x] **W-03** Backend: wave.comment.model.js
- [x] **W-04** Backend: wave.bookmark.model.js
- [x] **W-05** Backend: wave.controller.js
- [x] **W-06** Backend: wave.routes.js
- [x] **W-07** Backend: register wave routes in app.js
- [x] **W-08** Website: API lib — Wave type + all wave API functions
- [x] **W-09** Website: `/wave` feed page with snap-scroll
- [x] **W-10** Website: WaveCard component
- [x] **W-11** Website: PulseButton (tap/hold intensity)
- [x] **W-12** Website: WavePulseTimeline (ECG-style)
- [x] **W-13** Website: WaveCommentsPanel
- [x] **W-14** Website: WaveOptionsPanel
- [x] **W-15** Website: Wave upload flow in Creator Studio + ChannelCreatorPanel
- [x] **W-16** Website: Add Wave nav link
- [x] **W-17** TypeScript + ESLint clean pass
- [x] **W-18** Deploy — backend revision afrovision-backend-00195-dvg, website revision afrovision-website-00068-rw9, live at https://afrovision.online
