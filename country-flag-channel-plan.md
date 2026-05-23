# Country Flag Channel Plan

## Goal
Add a required country flag to every channel so creators and viewers can identify channels faster by country across the website and mobile app.

## Core Decision
Use a normalized country code on each channel record, then render the flag from that code everywhere.

- Store `country_code` using ISO 3166-1 alpha-2 codes, for example `NG`, `GH`, `ZA`.
- Derive the visual flag from the code.
- Keep the display consistent on web and mobile by using the same backend field and the same country-to-flag mapping.

## Data Model
Add these channel fields:

- `country_code`: required, uppercase ISO alpha-2 code.
- `country_name`: optional cached display label, if needed for search and filtering.
- `country_flag`: derived display value, not the source of truth.

Recommended implementation:

- Backend validates `country_code` on create and update.
- Frontend sends only the selected country code.
- UI renders either a flag emoji or a small country chip from a maintained country map.

## Creation Flow
New channels must not be creatable without a country flag.

### Website
- Add a required country selector on the create channel form.
- Show a flag preview next to the selector.
- Block submission until a country is selected.
- Include the country field in the review step if the flow has one.

### Mobile
- Add the same required selector in the mobile channel creation flow.
- Use a searchable country list or picker with flags.
- Keep the validation identical to web.

## Existing Channels Migration
Existing channels must be forced to add a country flag.

### Migration Approach
- Backfill existing channels with `country_code = null` as incomplete records.
- Add a required-completion state for channel owners.
- On next channel edit, block saving until a country is selected.
- For channels that appear publicly, show a partial-completion prompt to owners until the field is set.

### Enforcement Options
Use both of these:

- Backend hard validation: refuse channel updates that remove or omit the country code.
- Frontend completion gate: show a blocking prompt in Creator Studio and mobile channel settings until the field is filled.

### Migration UX
- Show a modal or banner in Creator Studio and mobile channel settings that says country information is required.
- Prevent publishing or saving channel profile changes until the country is selected.
- Allow the owner to save other editable fields only after country selection is complete.

## Where the Flag Will Be Displayed

### Website
- Channels page: show the flag on each channel card and in channel list rows.
- Featured channels: show the flag badge on the featured card header or title row.
- Now viewing page: show the flag beside the channel name in the player header and in the channel info panel.

### Mobile
- Channels page: show the flag on each channel tile or row.
- Featured channels: show the flag in the featured carousel card and hero strip.
- Now viewing page: show the flag beside the live channel title, near the avatar, and in the metadata row.

## Display Rules

- Use a small pill or badge so the flag is visible but does not overpower the channel brand.
- Keep the flag aligned with the channel name, not detached from the label.
- Prefer a compact display in lists and a slightly larger badge on the now viewing page.
- If a country name is shown on hover or as secondary text, keep it subtle.
- If a channel has no country code during migration, show a temporary placeholder state only to owners; public surfaces should not show blank country badges.

## Website Surface Details

### Channels Page
- Show the flag at the top-left or inline with the channel title on each card.
- Keep the badge visible in both grid and list layouts.
- If the page supports sorting or filtering, add a country filter later as a follow-up, not in the first release.

### Featured Channels
- Add the flag to the featured card header, near the channel title.
- Keep it visible on desktop and mobile featured modules.
- Ensure the featured card still prioritizes the channel artwork and title, with the flag acting as a quick scan cue.

### Now Viewing Page
- Show the flag beside the channel name in the hero area.
- Also surface it in the metadata strip near the live status and category.
- If there is a channel profile header, repeat the flag there for consistency.

## Mobile Surface Details

### Channels Page
- Add the flag to each channel row or tile.
- Use a compact badge so the list remains scrollable and dense.

### Featured Channels
- Add the flag in the featured hero card and any horizontal carousel items.
- Keep tap targets large enough for mobile without crowding the artwork.

### Now Viewing Page
- Show the flag beside the live title and channel avatar.
- Use a slightly larger badge than list views so it is readable on small screens.

## Validation Rules
- Country is required on create.
- Country is required on channel edit.
- Country cannot be empty in backend writes.
- Only valid ISO alpha-2 codes are accepted.
- If the code is invalid, block save and show a clear error.

## Backfill and Release Plan
1. Add the backend field and validation.
2. Update create/edit channel forms on web and mobile.
3. Run the existing-channel migration and mark incomplete records.
4. Add the owner-facing completion gate.
5. Render the flag on channels, featured channels, and now viewing pages.
6. Verify both web and mobile layouts on desktop and small screens.

## Suggested Ticket Split
- Backend schema and validation
- Web channel creation and edit forms
- Mobile channel creation and edit forms
- Existing-channel migration and forced completion flow
- Channels page flag rendering
- Featured channels flag rendering
- Now viewing page flag rendering
- QA and release verification

## Acceptance Criteria
- New channels cannot be created without a country flag.
- Existing channels cannot remain indefinitely without a country flag.
- The flag is visible on channels pages, featured channels, and now viewing pages on web and mobile.
- The same country field powers every surface.
- Validation prevents invalid or missing country values from being saved.