import os
import re
import subprocess
import sys

BASE = "https://raw.githubusercontent.com/phosphor-icons/core/main/assets"
OUT = "z:/Projects/Afrovision/tv/src/main/res/drawable"

ICONS = [
    # rail
    ("search", "regular", "magnifying-glass"),
    ("home", "fill", "house"),
    ("live_tv", "regular", "broadcast"),
    ("waves", "regular", "waveform"),
    ("movies_series", "regular", "film-strip"),
    ("library", "regular", "books"),
    ("exclusive", "regular", "crown-simple"),
    ("feed", "regular", "users-three"),
    ("messages", "regular", "envelope"),
    ("downloads", "regular", "download-simple"),
    ("profile", "regular", "user-circle"),
    ("settings", "regular", "gear-six"),
    # chrome / hero / media controls
    ("wifi_high", "fill", "wifi-high"),
    ("wifi_medium", "fill", "wifi-medium"),
    ("wifi_low", "fill", "wifi-low"),
    ("play", "fill", "play"),
    ("trophy", "fill", "trophy"),
    ("info", "regular", "info"),
    ("bookmark_simple", "regular", "bookmark-simple"),
    ("eye", "regular", "eye"),
    ("coins", "regular", "coins"),
    ("bell_simple", "regular", "bell-simple"),
    ("play_circle", "fill", "play-circle"),
    ("plus_circle", "regular", "plus-circle"),
    ("check", "regular", "check"),
    ("arrow_circle_up", "regular", "arrow-circle-up"),
    ("pause", "fill", "pause"),
    ("broadcast_fill", "fill", "broadcast"),
    ("check_circle", "fill", "check-circle"),
    ("book_open", "regular", "book-open"),
    ("speaker_high", "regular", "speaker-high"),
    ("gauge", "regular", "gauge"),
    ("rewind", "regular", "rewind"),
    ("fast_forward", "regular", "fast-forward"),
    ("subtitles", "regular", "subtitles"),
    # social / interactions
    ("heart", "regular", "heart"),
    ("heart_fill", "fill", "heart"),
    ("chat_circle", "regular", "chat-circle"),
    ("share_network", "regular", "share-network"),
    ("repeat", "regular", "repeat"),
    ("image", "regular", "image"),
    ("images", "regular", "images"),
    ("chat_teardrop_text", "regular", "chat-teardrop-text"),
    ("music_notes", "regular", "music-notes"),
    ("hand_waving", "regular", "hand-waving"),
    ("television_simple", "regular", "television-simple"),
    ("lock_simple", "fill", "lock-simple"),
    ("caret_right", "regular", "caret-right"),
    ("caret_left", "regular", "caret-left"),
    ("trash", "regular", "trash"),
    ("archive", "regular", "archive"),
    ("note_pencil", "regular", "note-pencil"),
    ("paper_plane_tilt", "regular", "paper-plane-tilt"),
    ("pencil_simple_line", "regular", "pencil-simple-line"),
    ("arrow_bend_up_left", "regular", "arrow-bend-up-left"),
    ("arrow_bend_up_right", "regular", "arrow-bend-up-right"),
    ("arrows_merge", "regular", "arrows-merge"),
    ("tray", "regular", "tray"),
    ("book_bookmark", "regular", "book-bookmark"),
    ("clock_counter_clockwise", "regular", "clock-counter-clockwise"),
    ("link_simple", "regular", "link-simple"),
    ("shield_check", "regular", "shield-check"),
    ("pause_circle", "fill", "pause-circle"),
    ("arrows_out_cardinal", "regular", "arrows-out-cardinal"),
    ("keyboard", "regular", "keyboard"),
]

os.makedirs(OUT, exist_ok=True)

for name, weight, icon in ICONS:
    suffix = f"-{weight}" if weight != "regular" else ""
    url = f"{BASE}/{weight}/{icon}{suffix}.svg"
    result = subprocess.run(["curl.exe", "-L", "-s", "--max-time", "15", url], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Failed to fetch {name}: {result.stderr}")
        continue
    svg = result.stdout
    if not svg.strip():
        print(f"Empty response for {name}")
        continue
    viewbox = re.search(r'viewBox="([^"]+)"', svg)
    if viewbox:
        parts = viewbox.group(1).split()
        w, h = parts[2], parts[3]
    else:
        w, h = "256", "256"
    paths = re.findall(r'<path[^>]*d="([^"]+)"', svg)
    if not paths:
        print(f"No path found for {name}")
        continue
    path_xml = "\n".join([f'  <path\n      android:fillColor="#FF000000"\n      android:pathData="{d}"/>' for d in paths])
    out = f"""<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="{w}"
    android:viewportHeight="{h}">
{path_xml}
</vector>
"""
    with open(os.path.join(OUT, f"ic_ph_{name}.xml"), "w", encoding="utf-8") as f:
        f.write(out)
    print(f"Wrote ic_ph_{name}.xml ({weight}/{icon})")

print("Done")
