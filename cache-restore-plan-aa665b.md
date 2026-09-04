# Restore WIP Caching and Client Thumbnail System

This plan restores the cache, thumbnail, and video-caching implementations from `wips/lib` to the active `lib` tree so thumbnails, videos, and images are cached locally, channel content is not re-fetched on every visit, and thumbnail generation is moved off Cloud Run onto the client.

## Background

- Several cache-related files were moved to `wips/lib` and are no longer active.
- Active `lib/core/services/video_cache_service.dart` and `lib/features/vod/services/vod_cache_service.dart` already handle wave and VOD video caching.
- Active `lib/core/media/afrovision_video_controller.dart`, `NetworkProfileService`, and `MpvBufferConfig` are already live and should not be replaced.
- Missing from the active tree: `SectionCache`, `ChannelContentService`, `ThumbnailService`, and `WaveThumbnail`.
- The backend currently runs `ffmpeg` in the Cloud Run request path (`backend/src/utils/thumbnail-generator.js`) every time the feed needs a missing thumbnail.

## Files to restore from `wips/lib`

| Source (`wips/lib/...`) | Destination (`lib/...`) | Purpose |
|---|---|---|
| `core/services/section_cache.dart` | `core/services/section_cache.dart` | TTL'd SharedPreferences cache for API JSON payloads. |
| `features/channel/services/channel_content_service.dart` | `features/channel/services/channel_content_service.dart` | Stale-while-revalidate wrappers for `/channels/:id/movies` and `/channels/:id/series`. |
| `core/services/thumbnail_service.dart` | `core/services/thumbnail_service.dart` | Client-side thumbnail generation and upload to backend. |
| `core/widgets/wave_thumbnail.dart` | `core/widgets/wave_thumbnail.dart` | Reusable thumbnail widget with network cache, backend prefetch, and on-device fallback. |

## Proposed changes

### 1. JSON / API caching
- Restore `SectionCache`.
- Restore `ChannelContentService` and integrate it into `MediaCenterScreen` and `ChannelViewScreen` so channel movies and series are hydrated from cache first, then refreshed in the background.
- Optionally extend `SectionCache` to waves and library in `ChannelViewScreen`.

### 2. Image caching
- Continue using `CachedNetworkImage` (already in `pubspec.yaml`).
- Replace raw `Image.network` and ad-hoc `CachedNetworkImage` calls in wave lists with the restored `WaveThumbnail` widget.
- `WaveThumbnail` will:
  - Use the backend `thumbnail_url` if available (cached by `CachedNetworkImage`).
  - If missing, call `GET /wave/:id/thumbnail` to trigger a backend fetch/check.
  - If still missing and a `waveId` is supplied, show a placeholder (no heavy on-device work until `ThumbnailService` runs).
  - If a video URL is supplied but no `waveId`, fall back to on-device `video_thumbnail` generation and in-memory caching.

### 3. Client-side thumbnail generation (Cloud Run cost fix)
- Add `video_thumbnail` to `pubspec.yaml`.
- Restore `ThumbnailService` and call it from the wave feed preloader when `wave.thumbnailUrl.isEmpty`.
- `ThumbnailService` generates a JPEG on the device and uploads it to `POST /wave/:id/thumbnail`.

#### Thumbnail upload permission
The existing backend endpoint (`uploadWaveThumbnail`) currently restricts uploads to the channel owner or admin. For client-generated thumbnails to benefit all viewers, decide between:
- **Option A (recommended):** Change `uploadWaveThumbnail` to allow any authenticated user who can view the wave to upload a thumbnail. This is the only way thumbnails become visible to all users without Cloud Run ffmpeg.
- **Option B:** Keep the owner/admin restriction and make `ThumbnailService` local-only. Each device generates its own thumbnail and stores it in a local file cache; the wave record on the backend is not updated.

### 4. Backend thumbnail cost control
To prevent Cloud Run from running `ffmpeg` on every feed refresh:
- Remove or disable the `generateThumbnailAsync(...)` calls inside `wave.controller.js` for feed loads and create/update paths.
- Keep `regenerateMissingThumbnails` as an admin-only action.
- Optionally add a Cloud Run Job for bulk/admin generation later.

If backend changes are made, the user must run `deploy_all.ps1` to deploy them.

### 5. Video caching
- `VideoCacheService` and `VodCacheService` are already in the active tree.
- Verify they are initialized at app start and that `VodPlayerScreen` uses `getLocalPath()` when a download is cached.
- No wips files need to be restored for this part, but the existing wiring should be smoke-tested.

## New / restored API service methods

- `WaveService.getWaveThumbnailUrl(String waveId)` — calls `GET /wave/:id/thumbnail` and returns `thumbnail_url` or `null`.
- `ThumbnailService.ensureThumbnail(...)` — already in wips; needs to be called from the wave preloader.
- `SectionCache.readStale`, `write`, `remove` — used by `ChannelContentService`.

## Files to modify for integration

- `pubspec.yaml` — add `video_thumbnail` dependency.
- `lib/features/wave/services/wave_service.dart` — add `getWaveThumbnailUrl`.
- `lib/features/wave/screens/wave_screen.dart` — replace `_precacheThumbnail` with `WaveThumbnail`/`ThumbnailService`.
- `lib/features/channel/screens/channel_view_screen.dart` — use `ChannelContentService` for movies/series and `WaveThumbnail` for wave grid tiles.
- `lib/features/vod/screens/media_center_screen.dart` — use `ChannelContentService` for channel movies/series if exclusive section plan is not yet implemented.
- `lib/features/wave/screens/saved_waves_screen.dart` — use `WaveThumbnail` for saved wave tiles.
- `backend/src/wave/wave.controller.js` — remove feed-time `generateThumbnailAsync` calls or put them behind a feature flag.
- `backend/src/wave/wave.routes.js` — adjust `POST /:waveId/thumbnail` permission if Option A is chosen.

## Design decisions / open questions

1. **Thumbnail upload permission:** Should client-generated thumbnails be uploaded to the backend for all users to see (requires relaxing `uploadWaveThumbnail` permissions and a backend deploy), or kept local-only on each device?
2. **Scope of `SectionCache`:** Should it cache only channel movies/series, or also waves, library, and the home feed?
3. **Backend ffmpeg:** Should the backend stop generating thumbnails entirely on feed load, or keep it as a low-rate fallback for waves the client cannot process?
4. **Wave player:** The wips `wave_video_controller.dart` should **not** be restored into the wave feed unless you explicitly want to switch waves from `video_player` to `media_kit`. The current `video_player` wave player must not be disrupted.

## Testing checklist

- [ ] `SectionCache` writes and reads stale JSON for channel movies/series.
- [ ] `ChannelViewScreen` paints cached movies/series instantly, then refreshes.
- [ ] `WaveThumbnail` shows a network-cached thumbnail when `thumbnailUrl` is present.
- [ ] `ThumbnailService` generates a thumbnail on the device and uploads it (or caches locally per chosen option).
- [ ] After upload, the wave's `thumbnail_url` is returned and `WaveThumbnail` uses it.
- [ ] Cloud Run logs show no `ffmpeg` calls triggered by feed loads.
- [ ] `VideoCacheService` still caches wave videos; `VodCacheService` still caches downloaded movies/series.
- [ ] `flutter analyze` clean.
- [ ] If backend changed, user runs `deploy_all.ps1` to deploy.
