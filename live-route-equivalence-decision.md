# Live Route Equivalence Decision (Web vs Mobile)

## Decision Summary
- Website canonical live playback route: `/live/[id]`
- Mobile canonical live playback route: `/channel-player`
- Decision type: Intentionally platform-specific route naming with capability-equivalent behavior.

## Equivalence Contract
1. Mobile must preserve live playback capabilities provided by web live route:
- open and render the target stream/channel session
- support stream status handling (live/offline/error)
- preserve viewer actions and overlays expected in mobile watch flow
2. Route-name parity is not required when capability parity is maintained.
3. Deep links or in-app navigation targeting web-style live destinations should resolve to mobile `/channel-player` flow using channel id payload mapping.

## Mapping Rules
- Web source: `/live/[id]`
- Mobile target: `/channel-player`
- Required payload mapping:
- `id` -> `channelId`

## Acceptance Notes
- This mapping is accepted for parity program Phase 4 ticket P4-03.
- Date: 2026-05-28
- Status: Accepted
