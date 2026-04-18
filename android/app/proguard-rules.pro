# Flutter / R8 — suppress missing-class warnings for optional
# androidx.window.sidecar API (not bundled but referenced by
# androidx.window.layout.adapter)
-dontwarn androidx.window.sidecar.**
-dontwarn androidx.window.extensions.**

# Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Kotlin
-keep class kotlin.Metadata { *; }
-keepclassmembers class * extends java.lang.Enum { *; }

# Socket.io
-keep class io.socket.** { *; }
-dontwarn io.socket.**

# Keep Flutter plugins
-keep class io.flutter.** { *; }
-dontwarn io.flutter.**

# OkHttp (used by various plugins)
-dontwarn okhttp3.**
-dontwarn okio.**
