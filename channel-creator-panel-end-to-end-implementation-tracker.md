# Channel Creator Panel — End-to-End Implementation Tracker

## 1. Feature Identity

- **Feature Name**: Channel Creator Panel (Inline Channel Management from Channel Page)
- **Owner Team(s)**: Creator / Platform
- **Primary Surfaces**: Website (channel page)
- **Related Tickets**: N/A (user story)
- **Linked Tracker File**: `channel-creator-panel-end-to-end-implementation-tracker.md`

---

## 2. Objective

Creators should be able to manage their channel entirely from the channel page itself — without needing to navigate to Creator Studio. This includes uploading videos, managing the broadcast schedule, configuring the stream source, editing channel details, and managing the content library.

The goal is to make channel management smarter, faster, and more context-aware: the creator is already on the channel page, so the tools should be there with them.

---

## 3. Completion Contract

1. **Entry points**: A "Manage" tab appears on the channel page when the authenticated user is the channel owner or admin.
2. **Destination UX**: The Manage tab renders a full-featured creator panel: channel editor, stream source, upload, auto-schedule, broadcast schedule, and content library.
3. **Backend/API wiring**: All creator studio APIs are called directly from the panel (no new backend routes needed).
4. **Navigation**: Deep-links and quick-action links (Analytics, Live page, Library Studio) are present in the panel.
5. **Permissions**: The tab and panel are only rendered when `canManageChannel` is true. Non-owners cannot access it.
6. **Operational controls**: Full management — upload, delete, schedule, auto-schedule, clear all, cancel session, recheck stream health, edit channel, delete channel.
7. **Notifications**: Upload sessions status auto-refresh while active sessions exist.
8. **QA readiness**: TypeScript clean build required before deploy.

---

## 4. Business Rules

- Only the channel owner (`user.id === channel.owner_id`) or an admin (`user.role === "admin"`) can see and use the Manage tab.
- The Manage tab does NOT appear for viewers, subscribers, or followers.
- All tools are pre-scoped to the current channel — no channel selector is needed.
- After channel details are saved (name, description, category, logo, banner), the parent ChannelProfile state must be updated to reflect the changes immediately (no page reload).
- The existing "Channel Management" bar (delete channel only) is superseded by the Manage tab — it can be removed or kept minimal.
- Stream source tools, upload tools, schedule tools, and library tools all behave identically to Creator Studio.

---

## 5. Domain Model Changes

- No new entities or schema changes.
- No API contract changes.
- All existing creator/admin APIs are reused as-is.

---

## 6. API Contracts

All existing — no new routes:
- `getMyVideosApi()` — load all creator videos, filter by channelId client-side
- `getChannelScheduleApi(channelId)` — load schedule
- `getMyVideoUploadSessionsApi(channelId)` — load upload sessions
- `getVideoUploadUrlApi(...)` — get signed upload URL
- `uploadFileToGCS(...)` — upload to GCS
- `registerUploadedVideoApi(...)` — register video after upload
- `uploadVideoApi(...)` — legacy fallback
- `scheduleProgramApi(...)` — schedule single video
- `scheduleSequentialApi(...)` — auto-schedule multiple
- `deleteProgramApi(id)` — remove schedule slot
- `deleteVideoApi(id)` — delete video
- `updateChannelApi(id, ...)` — update channel details
- `uploadChannelMediaApi(id, type, file)` — upload logo/banner
- `updateExternalSourceApi(id, ...)` — save stream source
- `resolveSourceApi(url)` — validate stream URL
- `recheckStreamHealthApi(id)` — recheck health
- `cancelVideoUploadSessionApi(id)` — cancel session
- `deleteVideoUploadSessionApi(id)` — delete session
- `deleteChannelApi(id)` — delete channel

---

## 7. End-to-End User Flows

1. **Discovery**: Creator visits their channel page → sees "Manage" tab in the tab bar.
2. **Primary flow**: Click Manage → sees all tools panel → upload video → auto-schedule → done.
3. **Edit channel flow**: Click Manage → Edit Channel section → change name/description/logo/banner → Save → channel header updates immediately.
4. **Stream source flow**: Click Manage → Stream Source section → switch to HLS/YouTube/External URL → Validate → Save.
5. **Failure/recovery flow**: Upload fails → retry button appears. Session stuck → Cancel session. Error displayed inline with dismissal.
6. **Delete channel**: Manage tab → Delete Channel button → confirmation dialog → redirect to /channels.

---

## 8. Frontend Scope

- **New file**: `website/src/app/channel/[id]/ChannelCreatorPanel.tsx` — self-contained component with all creator tools scoped to a single channelId.
- **Modified file**: `website/src/app/channel/[id]/ChannelProfile.tsx` — add `"manage"` to `Tab` type, add tab to `TABS` array (conditional on `canManageChannel`), render `<ChannelCreatorPanel>` when active tab is "manage", pass `onChannelUpdated` callback to update local channel state.
- **Design rules**: Premium dark theme, same card/border/input styles as Creator Studio.
- All states: loading, empty, error, success, disabled, uploading progress, session status.

---

## 9. Backend/Jobs Scope

No backend changes needed.

---

## 10. Security and Compliance

- Tab is hidden for non-owners (UI check).
- All API calls carry the user's auth token via the existing `api.ts` fetch interceptor.
- No sensitive data exposed beyond what Creator Studio already provides.

---

## 11. Observability and Analytics

- No new metrics needed (creator studio already has analytics route).
- Quick link to channel analytics is present in the panel.

---

## 12. Phased Delivery Plan

- **Phase 1** (this task): Create `ChannelCreatorPanel.tsx`, add Manage tab to `ChannelProfile.tsx`, TypeScript verify, deploy.

---

## 13. Acceptance Criteria (Release Gate)

- [ ] "Manage" tab appears only for channel owner / admin on channel page
- [ ] All creator studio tools work from within the channel page panel
- [ ] Channel edit (name/desc/category/logo/banner) saves and immediately reflects in the channel header
- [ ] Stream source selector and save work correctly
- [ ] Multi-file upload with progress works
- [ ] Auto-schedule (uploads + library) works
- [ ] Broadcast schedule list with add/remove/select-all/clear-all works
- [ ] Content library with delete selected / delete all works
- [ ] TypeScript: 0 errors
- [ ] Deployed and live

---

## 14. Test Matrix

| Test | Expected |
|------|----------|
| Owner visits own channel | Manage tab visible |
| Viewer visits channel | Manage tab NOT visible |
| Owner clicks Manage | All tool sections render |
| Upload video | Progress bar, session status, success ✓ |
| Auto-schedule uploads | Schedules created sequentially |
| Edit channel name | Header updates without reload |
| Save stream source | Source persists, status badge updates |
| Delete single video | Removed from library |
| Delete all videos | Library emptied |
| Remove schedule slot | Slot removed |
| Clear all schedule | Schedule emptied |

---

## Completion Marks

- [x] Tracker created
- [x] `ChannelCreatorPanel.tsx` created — full creator tools panel (stream source, upload, schedule, library, channel edit, danger zone)
- [x] `ChannelProfile.tsx` updated with Manage tab — Tab type extended, TABS array conditional, manage tab renders ChannelCreatorPanel full-width, sidebar hidden, old minimal delete-only bar removed
- [x] TypeScript: 0 errors confirmed (`npx tsc --noEmit` clean)
- [x] Deployed — revision `afrovision-website-00066-gf7` live at https://afrovision.online
