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

# media_kit / libmpv — JNI bindings resolve native methods by class/method
# name, so R8 renaming or stripping these breaks playback only in release
# builds (the prior playback validation was done on an unminified debug APK).
-keep class com.alexmercerind.media_kit_video.** { *; }
-keep class com.alexmercerind.media_kit_libs_android_video.** { *; }
-keep class com.arthenica.** { *; }
-dontwarn com.alexmercerind.**

# ExoPlayer / Media3 — used as a fallback player and referenced reflectively
# by several extractor/decoder implementations.
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# in_app_purchase / Google Play Billing — the billing client resolves some
# callback classes by name.
-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# Pangle Global ads SDK
-keep class com.bytedance.sdk.** { *; }
-keep class com.bykv.vk.** { *; }
-keep class com.pgl.** { *; }
-keep class ms.bd.c.Pgl.** { public *; }
-keep class com.bytedance.embedapplog.** { *; }
-keep class com.bytedance.embed_dr.** { *; }
-dontwarn com.bytedance.**
-dontwarn com.pgl.**
-dontwarn com.bykv.**

# flutter_local_notifications reads scheduled notifications through Gson
# TypeToken; R8 strips the generic signature otherwise ("TypeToken must be
# created with a type argument") and cancel()/schedule calls throw in release.
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken
-keep class com.dexterous.** { *; }
