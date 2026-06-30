package com.afrovision.afrovision

import android.app.AppOpsManager
import android.app.PictureInPictureParams
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.SharedPreferences
import android.media.AudioAttributes
import android.media.AudioManager
import android.os.Build
import android.graphics.Color
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import android.util.Rational
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    private val INTEGRITY_CHANNEL = "com.afrovision.afrovision/integrity"
    private val PIP_CHANNEL       = "com.afrovision.afrovision/pip"
    private val WIDGET_CHANNEL    = "com.afrovision.afrovision/widget"

    private var pipMethodChannel: MethodChannel? = null
    private var _autoPipEnabled = false

    // ── onCreate ──────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        // Allow screen recorders (MediaProjection) to capture this app's audio.
        // Enable edge-to-edge layout and avoid deprecated Window color setters on Android 15+
        try {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            if (Build.VERSION.SDK_INT < 35) {
                // For older platforms, keep making system bars transparent where appropriate
                window.statusBarColor = Color.TRANSPARENT
                window.navigationBarColor = Color.TRANSPARENT
                if (Build.VERSION.SDK_INT >= 28) {
                    window.navigationBarDividerColor = Color.TRANSPARENT
                }
            } else {
                // Android 15+ deprecates direct color setters; use WindowInsetsControllerCompat
                val controller = WindowInsetsControllerCompat(window, window.decorView)
                // leave appearance control to the controller or Flutter host; no direct color setters here
                controller.isAppearanceLightStatusBars = false
            }
        } catch (_: Exception) { /* best-effort, continue startup */ }

        // Allow screen recorders (MediaProjection) to capture this app's audio.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.setAllowedCapturePolicy(AudioAttributes.ALLOW_CAPTURE_BY_ALL)
        }
    }

    // ── Single-task: forward new intents to Flutter ───────────────────────

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        // Forward to Flutter so deep links / notification taps are handled.
        // FlutterActivity already handles this via MethodChannel, but we must
        // set the new intent so Flutter's navigation plugins see it.
        setIntent(intent)
    }

    // ── PiP lifecycle ─────────────────────────────────────────────────────

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (_autoPipEnabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val builder = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    builder.setAutoEnterEnabled(true)
                           .setSeamlessResizeEnabled(true)
                }
                enterPictureInPictureMode(builder.build())
            } catch (_: Exception) { /* device may not support PiP */ }
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: android.content.res.Configuration,
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        pipMethodChannel?.invokeMethod(
            "onPiPModeChanged",
            mapOf("isInPiP" to isInPictureInPictureMode),
        )
    }

    private fun enterPiP(aspectWidth: Int, aspectHeight: Int) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val builder = PictureInPictureParams.Builder()
            .setAspectRatio(Rational(aspectWidth, aspectHeight))

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled(true)
            builder.setSeamlessResizeEnabled(true)
        }

        enterPictureInPictureMode(builder.build())
    }

    private fun isPiPSupported(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        val appOps = getSystemService(APP_OPS_SERVICE) as? AppOpsManager ?: return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_PICTURE_IN_PICTURE,
                android.os.Process.myUid(),
                packageName,
            ) == AppOpsManager.MODE_ALLOWED
        } else {
            true
        }
    }

    // ── Widget helpers ────────────────────────────────────────────────────────

    private fun updateHomeWidget(data: Map<String, Any>) {
        android.util.Log.d("MainActivity", "updateHomeWidget called with data: $data")
        val prefs: SharedPreferences =
            getSharedPreferences("AfroVisionWidgetPrefs", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putInt("liveCount",          (data["liveCount"] as? Int) ?: 0)
            putString("nextShowChannel", (data["nextShowChannel"] as? String) ?: "")
            putString("nextShowTitle",   (data["nextShowTitle"] as? String) ?: "")
            putString("nextShowTime",    (data["nextShowTime"] as? String) ?: "")
            putString("planName",        (data["planName"] as? String) ?: "Free Plan")
            putInt("daysToRenewal",      (data["daysToRenewal"] as? Int) ?: 0)
            putInt("notificationCount",  (data["notificationCount"] as? Int) ?: 0)
            putInt("wavesCount",         (data["wavesCount"] as? Int) ?: 0)
            putInt("libraryUpdates",     (data["libraryUpdates"] as? Int) ?: 0)
            putString("avatarInitial",   (data["avatarInitial"] as? String) ?: "")
            putString("recentChannel1",  (data["recentChannel1"] as? String) ?: "")
            putString("recentChannel2",  (data["recentChannel2"] as? String) ?: "")
            putString("recentChannel3",  (data["recentChannel3"] as? String) ?: "")
            putString("recentChannelId1", (data["recentChannelId1"] as? String) ?: "")
            putString("recentChannelId2", (data["recentChannelId2"] as? String) ?: "")
            putString("recentChannelId3", (data["recentChannelId3"] as? String) ?: "")
            putString("notification1",   (data["notification1"] as? String) ?: "")
            putString("notification2",   (data["notification2"] as? String) ?: "")
            putString("notification3",   (data["notification3"] as? String) ?: "")
            putString("assetCash",       (data["assetCash"] as? String) ?: "₦0.00")
            putString("assetVpt",        (data["assetVpt"] as? String) ?: "0.00")
            putString("assetRavens",     (data["assetRavens"] as? String) ?: "0")
            putString("avatarUrl",          (data["avatarUrl"] as? String) ?: "")
            putString("recentChannelLogo1", (data["recentChannelLogo1"] as? String) ?: "")
            putString("recentChannelLogo2", (data["recentChannelLogo2"] as? String) ?: "")
            putString("recentChannelLogo3", (data["recentChannelLogo3"] as? String) ?: "")
            putString("recentChannelCover1", (data["recentChannelCover1"] as? String) ?: "")
            putString("recentChannelCover2", (data["recentChannelCover2"] as? String) ?: "")
            putString("recentChannelCover3", (data["recentChannelCover3"] as? String) ?: "")
            apply()
        }
        android.util.Log.d("MainActivity", "Widget data saved to SharedPreferences")

        // Notify all pinned widget instances to redraw (text first, images follow).
        val manager = AppWidgetManager.getInstance(applicationContext)
        val ids = manager.getAppWidgetIds(
            ComponentName(applicationContext, AfroVisionWidgetProvider::class.java)
        )
        android.util.Log.d("MainActivity", "Widget IDs to update: ${ids.contentToString()}")
        if (ids.isNotEmpty()) {
            AfroVisionWidgetProvider.updateAll(applicationContext, manager, ids)
        }
        // Fetch avatar/channel images off the main thread and redraw when ready.
        // Runs regardless of whether the widget is currently pinned so the data
        // is cached for the next time the widget is shown.
        AfroVisionWidgetProvider.refreshImages(applicationContext)
    }

    // ── configureFlutterEngine ────────────────────────────────────────────────

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // ── Integrity token channel (existing) ──
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, INTEGRITY_CHANNEL)
            .setMethodCallHandler { call, result ->
                if (call.method == "requestIntegrityToken") {
                    val nonce           = call.argument<String>("nonce")
                    val projectNumberStr = call.argument<String>("cloudProjectNumber")
                    if (nonce == null || projectNumberStr == null) {
                        result.error("INVALID_ARGS", "Missing nonce or cloudProjectNumber", null)
                        return@setMethodCallHandler
                    }
                    val projectNumber = projectNumberStr.toLongOrNull() ?: run {
                        result.error("INVALID_ARGS", "cloudProjectNumber is not a valid long", null)
                        return@setMethodCallHandler
                    }
                    IntegrityManagerFactory.create(applicationContext)
                        .requestIntegrityToken(
                            IntegrityTokenRequest.builder()
                                .setNonce(nonce)
                                .setCloudProjectNumber(projectNumber)
                                .build()
                        )
                        .addOnSuccessListener { response ->
                            result.success(response.token())
                        }
                        .addOnFailureListener { e ->
                            result.error("INTEGRITY_ERROR", e.message, null)
                        }
                } else {
                    result.notImplemented()
                }
            }

        // ── Picture-in-Picture channel ──
        val pip = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, PIP_CHANNEL)
        pipMethodChannel = pip
        pip.setMethodCallHandler { call, result ->
            when (call.method) {
                "isPiPSupported" -> result.success(isPiPSupported())
                "enterPiP" -> {
                    val w = call.argument<Int>("aspectWidth")  ?: 16
                    val h = call.argument<Int>("aspectHeight") ?: 9
                    enterPiP(w, h)
                    result.success(null)
                }
                "setPipAutoEnter" -> {
                    val enabled = call.argument<Boolean>("enabled") ?: false
                    _autoPipEnabled = enabled
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        try {
                            setPictureInPictureParams(
                                PictureInPictureParams.Builder()
                                    .setAutoEnterEnabled(enabled)
                                    .build()
                            )
                        } catch (_: Exception) {}
                    }
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }

        // ── Home-screen widget channel ──
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, WIDGET_CHANNEL)
            .setMethodCallHandler { call, result ->
                if (call.method == "updateWidget") {
                    try {
                        @Suppress("UNCHECKED_CAST")
                        val data = call.arguments as? Map<String, Any> ?: emptyMap()
                        android.util.Log.d("MainActivity", "updateWidget method called")
                        updateHomeWidget(data)
                        result.success(null)
                    } catch (e: Exception) {
                        android.util.Log.e("MainActivity", "updateWidget error", e)
                        result.error("WIDGET_ERROR", e.message, null)
                    }
                } else {
                    result.notImplemented()
                }
            }
    }
}
