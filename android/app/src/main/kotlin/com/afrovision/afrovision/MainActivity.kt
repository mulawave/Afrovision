package com.afrovision.afrovision

import android.app.AppOpsManager
import android.app.ActivityManager
import android.content.ActivityNotFoundException
import android.app.PictureInPictureParams
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.SharedPreferences
import android.media.AudioAttributes
import android.media.AudioManager
import android.os.Build
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
    private val OVERLAY_CHANNEL   = "com.afrovision.afrovision/overlay"

    private var pipMethodChannel: MethodChannel? = null
    private var _autoPipEnabled = false

    // ── onCreate ──────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)

        // Allow screen recorders (MediaProjection) to capture this app's audio.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.setAllowedCapturePolicy(AudioAttributes.ALLOW_CAPTURE_BY_ALL)
        }
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

    @Suppress("DEPRECATION")
    private fun isOverlayRunning(): Boolean {
        val manager = getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            ?: return false
        return manager.getRunningServices(Int.MAX_VALUE)
            .any { it.service.className == FloatingVideoOverlayService::class.java.name }
    }

    // ── Widget helpers ────────────────────────────────────────────────────────

    private fun updateHomeWidget(data: Map<String, Any>) {
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
            apply()
        }

        // Notify all pinned widget instances to redraw.
        val manager = AppWidgetManager.getInstance(applicationContext)
        val ids = manager.getAppWidgetIds(
            ComponentName(applicationContext, AfroVisionWidgetProvider::class.java)
        )
        if (ids.isNotEmpty()) {
            AfroVisionWidgetProvider.updateAll(applicationContext, manager, ids)
        }
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

        // ── Cross-app overlay channel ──
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, OVERLAY_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "canDrawOverlays" -> {
                        val canDraw = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                            android.provider.Settings.canDrawOverlays(this)
                        else true
                        result.success(canDraw)
                    }
                    "requestDrawOverlaysPermission" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            try {
                                val intent = android.content.Intent(
                                    android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                    android.net.Uri.parse("package:$packageName"),
                                )
                                startActivity(intent)
                            } catch (_: ActivityNotFoundException) {}
                        }
                        result.success(null)
                    }
                    "startOverlay" -> {
                        val html        = call.argument<String>("streamHtml")  ?: ""
                        val channelName = call.argument<String>("channelName") ?: ""
                        val intent = android.content.Intent(this, FloatingVideoOverlayService::class.java).apply {
                            putExtra("streamHtml",  html)
                            putExtra("channelName", channelName)
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            startForegroundService(intent)
                        } else {
                            startService(intent)
                        }
                        result.success(null)
                    }
                    "stopOverlay" -> {
                        stopService(android.content.Intent(this, FloatingVideoOverlayService::class.java))
                        result.success(null)
                    }
                    "isOverlayRunning" -> {
                        result.success(isOverlayRunning())
                    }
                    else -> result.notImplemented()
                }
            }

        // ── Home-screen widget channel ──
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, WIDGET_CHANNEL)
            .setMethodCallHandler { call, result ->
                if (call.method == "updateWidget") {
                    @Suppress("UNCHECKED_CAST")
                    val data = call.arguments as? Map<String, Any> ?: emptyMap()
                    updateHomeWidget(data)
                    result.success(null)
                } else {
                    result.notImplemented()
                }
            }
    }
}
