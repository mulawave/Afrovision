package com.afrovision.afrovision

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageButton
import android.widget.TextView

/**
 * System-overlay floating video player.
 *
 * Shown above ALL apps (including the home screen) via
 * WindowManager.TYPE_APPLICATION_OVERLAY when the AfroVision app is sent
 * to the background while floating-mode is active.
 *
 * Requires the SYSTEM_ALERT_WINDOW permission (granted once by the user via
 * Settings → Apps → Special app access → Display over other apps).
 *
 * Intent extras expected by [onStartCommand]:
 *   "streamHtml"    – complete HTML page to load (YouTube embed or HLS video)
 *   "channelName"   – display name shown at the bottom of the window
 */
class FloatingVideoOverlayService : Service() {

    companion object {
        private const val NOTIFICATION_CHANNEL_ID = "afrovision_floating_overlay"
        private const val NOTIFICATION_ID = 9021
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null
    private var overlayWebView: WebView? = null

    // Touch tracking for drag
    private var dragStartX = 0f
    private var dragStartY = 0f
    private var winStartX  = 0
    private var winStartY  = 0

    override fun onBind(intent: Intent?): IBinder? = null

    @SuppressLint("InflateParams", "SetJavaScriptEnabled", "ClickableViewAccessibility")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // If already running, remove old view before recreating
        tearDown()

        val streamHtml   = intent?.getStringExtra("streamHtml")   ?: return START_NOT_STICKY
        val channelName  = intent.getStringExtra("channelName")    ?: ""

        startForeground(NOTIFICATION_ID, buildNotification(channelName))

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        val inflater = LayoutInflater.from(this)
        val view     = inflater.inflate(R.layout.floating_video_overlay, null)
        overlayView  = view

        // ── WebView setup ────────────────────────────────────────────────
        val webView: WebView = view.findViewById(R.id.overlay_webview)
        overlayWebView = webView
        webView.settings.apply {
            javaScriptEnabled             = true
            domStorageEnabled             = true
            allowFileAccess               = false
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode          = true
            useWideViewPort               = true
            mixedContentMode              = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        webView.webViewClient = WebViewClient()
        webView.loadDataWithBaseURL(
            "https://www.youtube-nocookie.com",
            streamHtml,
            "text/html",
            "utf-8",
            null,
        )

        // ── Channel name ─────────────────────────────────────────────────
        view.findViewById<TextView>(R.id.overlay_channel_name).text = channelName

        // ── Window layout params ─────────────────────────────────────────
        val w = dpToPx(200)
        val h = dpToPx(130)
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE

        val params = WindowManager.LayoutParams(
            w, h, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).also {
            it.gravity = Gravity.TOP or Gravity.START
            it.x = 20
            it.y = 300
        }
        layoutParams = params

        // ── Drag the window ──────────────────────────────────────────────
        view.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    dragStartX = event.rawX
                    dragStartY = event.rawY
                    winStartX  = params.x
                    winStartY  = params.y
                    false // let child views (buttons) receive clicks
                }
                MotionEvent.ACTION_MOVE -> {
                    params.x = (winStartX + (event.rawX - dragStartX)).toInt()
                    params.y = (winStartY + (event.rawY - dragStartY)).toInt()
                    windowManager?.updateViewLayout(view, params)
                    true
                }
                else -> false
            }
        }

        // ── Close button ─────────────────────────────────────────────────
        view.findViewById<ImageButton>(R.id.overlay_close).setOnClickListener {
            stopSelf()
        }

        // ── Expand: bring AfroVision to foreground ───────────────────────
        view.findViewById<ImageButton>(R.id.overlay_expand).setOnClickListener {
            val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
                )
            }
            if (launch != null) startActivity(launch)
            stopSelf()
        }

        windowManager?.addView(view, params)
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        tearDown()
    }

    private fun tearDown() {
        overlayWebView?.let {
            try {
                it.stopLoading()
                it.loadUrl("about:blank")
                it.onPause()
                it.pauseTimers()
                it.removeAllViews()
                it.destroy()
            } catch (_: Exception) {}
        }
        overlayWebView = null

        overlayView?.let {
            try { windowManager?.removeView(it) } catch (_: Exception) {}
        }
        overlayView = null

        try {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } catch (_: Exception) {}
    }

    private fun buildNotification(channelName: String): Notification {
        ensureNotificationChannel()

        val launchIntent =
            packageManager.getLaunchIntentForPackage(packageName)
                ?: Intent(this, MainActivity::class.java)
        launchIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
        )

        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            pendingIntentFlags,
        )

        val title = if (channelName.isBlank()) "AfroVision Mini Player" else channelName
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText("Mini-player is active")
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val existing = manager.getNotificationChannel(NOTIFICATION_CHANNEL_ID)
        if (existing != null) return

        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "AfroVision Floating Player",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Keeps the mini-player running above other apps"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()
}
