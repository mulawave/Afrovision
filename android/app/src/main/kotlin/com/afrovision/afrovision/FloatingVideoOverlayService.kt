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
import android.os.PowerManager
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

        // Broadcast sent when the user taps Close on the cross-app overlay, so
        // the Flutter side can fully terminate playback and release audio focus.
        const val ACTION_OVERLAY_USER_CLOSED =
            "com.afrovision.afrovision.OVERLAY_USER_CLOSED"
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null
    private var overlayWebView: WebView? = null
    private var wakeLock: PowerManager.WakeLock? = null

    // Touch tracking for drag
    private var dragStartX = 0f
    private var dragStartY = 0f
    private var winStartX  = 0
    private var winStartY  = 0

    // Touch tracking for pinch-to-zoom
    private var initialDistance = 0f
    private var baseWidth = 0
    private var baseHeight = 0
    private var currentScale = 1f
    private val minScale = 0.5f
    private val maxScale = 3f

    override fun onBind(intent: Intent?): IBinder? = null

    @SuppressLint("InflateParams", "SetJavaScriptEnabled", "ClickableViewAccessibility")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        android.util.Log.d("FloatingOverlay", "onStartCommand called")
        // If already running, remove old view before recreating
        tearDown()

        val streamHtml   = intent?.getStringExtra("streamHtml")   ?: return START_NOT_STICKY
        val channelName  = intent.getStringExtra("channelName")    ?: ""

        android.util.Log.d("FloatingOverlay", "Received: streamHtml length=${streamHtml.length}, channelName=$channelName")

        // Acquire partial wake lock to keep CPU running for WebView playback
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "AfroVision:FloatingOverlayWakeLock"
        ).apply {
            setReferenceCounted(false)
            acquire(10*60*1000L) // 10 minutes max
        }

        startForeground(NOTIFICATION_ID, buildNotification(channelName))

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        val inflater = LayoutInflater.from(this)
        val view     = inflater.inflate(R.layout.floating_video_overlay, null)
        overlayView  = view

        // ── Window layout params (declared early so touch lambdas capture it) ──
        val w = dpToPx(200)
        val h = dpToPx(130)
        baseWidth = w
        baseHeight = h
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

        // ── WebView setup ────────────────────────────────────────────────
        val webView: WebView = view.findViewById(R.id.overlay_webview)
        overlayWebView = webView
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        // pauseTimers()/resumeTimers() are PROCESS-GLOBAL across all WebViews.
        // A previous overlay teardown (or an in-app WebView) may have paused
        // them, which would freeze hls.js/JS playback here. Resume on start.
        webView.onResume()
        webView.resumeTimers()
        webView.settings.apply {
            javaScriptEnabled             = true
            domStorageEnabled             = true
            databaseEnabled               = true
            allowFileAccess               = false
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode          = true
            useWideViewPort               = true
            mixedContentMode              = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode                     = WebSettings.LOAD_DEFAULT
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                // Resume playback after page loads in the overlay
                view?.evaluateJavascript(
                    """(function(){try{var v=document.querySelector('video');if(v)v.play();}catch(e){}})();""",
                    null
                )
            }
        }
        webView.loadDataWithBaseURL(
            "https://www.youtube-nocookie.com",
            streamHtml,
            "text/html",
            "utf-8",
            null,
        )

        // ── Drag: WebView consumes all touch events, so we intercept ───
        // on the WebView itself for drag; the root view handles drag on
        // areas outside the WebView (buttons, label bar).
        webView.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    dragStartX = event.rawX
                    dragStartY = event.rawY
                    winStartX  = params.x
                    winStartY  = params.y
                    false
                }
                MotionEvent.ACTION_POINTER_DOWN -> {
                    // Start pinch gesture
                    initialDistance = getDistance(event)
                    if (initialDistance > 10f) {
                        baseWidth = params.width
                        baseHeight = params.height
                        currentScale = 1f
                    }
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    if (event.pointerCount == 2) {
                        // Pinch zoom
                        val distance = getDistance(event)
                        if (initialDistance > 10f) {
                            val scale = (distance / initialDistance).coerceIn(minScale, maxScale)
                            if (scale != currentScale) {
                                currentScale = scale
                                params.width = (baseWidth * scale).toInt()
                                params.height = (baseHeight * scale).toInt()
                                windowManager?.updateViewLayout(view, params)
                            }
                        }
                        true
                    } else {
                        // Single finger drag
                        params.x = (winStartX + (event.rawX - dragStartX)).toInt()
                        params.y = (winStartY + (event.rawY - dragStartY)).toInt()
                        windowManager?.updateViewLayout(view, params)
                        true
                    }
                }
                else -> false
            }
        }

        // ── Channel name ─────────────────────────────────────────────────
        view.findViewById<TextView>(R.id.overlay_channel_name).text = channelName

        // ── Drag the window (root view, outside WebView area) ────────────
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
        val closeBtn = view.findViewById<ImageButton>(R.id.overlay_close)
        closeBtn.setOnClickListener {
            android.util.Log.d("FloatingOverlay", "Close button clicked")
            // Tell the app to fully terminate playback (release audio focus),
            // otherwise the paused in-app controller resumes on next foreground.
            sendBroadcast(
                Intent(ACTION_OVERLAY_USER_CLOSED).setPackage(packageName),
            )
            stopSelf()
        }
        closeBtn.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> true
                MotionEvent.ACTION_UP -> {
                    closeBtn.performClick()
                    true
                }
                else -> false
            }
        }

        // ── Return to app (without stopping overlay) ─────────────────────
        val returnBtn = view.findViewById<ImageButton>(R.id.overlay_return_to_app)
        returnBtn.setOnClickListener {
            android.util.Log.d("FloatingOverlay", "Return to app button clicked")
            val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
                )
            }
            if (launch != null) startActivity(launch)
        }
        returnBtn.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> true
                MotionEvent.ACTION_UP -> {
                    returnBtn.performClick()
                    true
                }
                else -> false
            }
        }

        // ── Channel surfer: bring app to foreground and open surfer ───────
        val surferBtn = view.findViewById<ImageButton>(R.id.overlay_channel_surfer)
        surferBtn.setOnClickListener {
            android.util.Log.d("FloatingOverlay", "Channel surfer button clicked")
            val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
                )
                putExtra("openChannelSurfer", true)
            }
            if (launch != null) startActivity(launch)
        }
        surferBtn.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> true
                MotionEvent.ACTION_UP -> {
                    surferBtn.performClick()
                    true
                }
                else -> false
            }
        }

        windowManager?.addView(view, params)
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        tearDown()
    }

    private fun tearDown() {
        // Release wake lock
        wakeLock?.let {
            try {
                if (it.isHeld) it.release()
            } catch (_: Exception) {}
        }
        wakeLock = null

        overlayWebView?.let {
            try {
                it.stopLoading()
                it.loadUrl("about:blank")
                it.onPause()
                // NOTE: do NOT call pauseTimers() here — it is process-global
                // and would freeze the in-app WebView and the next overlay.
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

    private fun getDistance(event: MotionEvent): Float {
        val dx = event.getX(0) - event.getX(1)
        val dy = event.getY(0) - event.getY(1)
        return kotlin.math.sqrt(dx * dx + dy * dy)
    }
}
