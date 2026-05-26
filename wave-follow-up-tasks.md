# Wave Follow-Up Tasks

1. Replace every placeholder `?` icon in the Wave UI with the intended icons.
2. Center the ECG PULSE timeline so the structure and alignment look correct.
3. Make interest and not-interested toasts auto-dismiss after showing acknowledgement.
4. Remove the dark transparent icon/stat strip from the Wave player.
5. Remove the wave name text from the feed player overlay.
6. Restore the play icon so it is no longer rendered as `?`.
7. Add a visible fullscreen exit control.
8. Allow fullscreen mode to keep scrolling through waves instead of freezing on one item.
9. Add a dedicated Waves tab on the channel page for published waves.
10. Move published waves out of the upload section and into the Waves tab.
11. Keep the upload section focused on uploading waves only.
12. Show wave thumbnails using the first frame of each video.
13. Hide the On-Demand coming-soon section on the Wave screen.
14. on the large screen view incread the width of the left panel holding the waves, channel info and library section stacks, make it at least double of its current width we have too many black spaces we aren't using. 
15. the views are not counting for the waves, every view must add to the count. add another view icon beneath the puls icon. this second view will count repeat plays by the same viewer, while the previous vieww will only count unique views. 

## What each task means

- The Wave screen currently has several placeholder characters where icons should render, so those controls need real icon assets or stable fallback icons.
- The ECG timeline should be centered in the player footer rather than sitting off-balance.
- The acknowledgement toast should disappear automatically after a short delay instead of staying pinned on screen.
- The right-side stat rail and dark gradient strip should be removed because it no longer matches the layout.
- The feed should show the video, controls, and playback state without displaying the wave title overlay.
- Fullscreen needs a way to exit, and it should still support advancing or scrolling between waves.
- The channel page should treat published waves like a real tabbed collection, separate from the upload workflow.
- Published waves should use the first frame of the video as the thumbnail so the preview matches the actual content.
- The On-Demand placeholder on Wave should be removed because it is only a stub and adds clutter.