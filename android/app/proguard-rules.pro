# Flutter / R8 — suppress missing-class warnings for optional
# androidx.window.sidecar API (not bundled but referenced by
# androidx.window.layout.adapter)
-dontwarn androidx.window.sidecar.**
-dontwarn androidx.window.extensions.**
