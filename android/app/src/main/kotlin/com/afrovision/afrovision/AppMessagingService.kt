package com.afrovision.afrovision

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Native Firebase Messaging Service.
 *
 * Responsibilities:
 *  1. Create notification channels the FIRST time any FCM message arrives
 *     (even before the Flutter engine has started), so Android never silently
 *     drops a notification because the target channel doesn't exist yet.
 *  2. Display data-only FCM messages that arrive when the app is terminated
 *     (Flutter's background handler / local_notifications cannot run then).
 *  3. Log token refreshes (Flutter plugin handles the actual upload).
 *
 * For NOTIFICATION messages (notification + data) the FCM SDK automatically
 * displays the notification when the app is in background/terminated using the
 * channel metadata in the message payload, so we do NOT duplicate the display
 * from onMessageReceived to avoid double-banners when the app is in foreground.
 */
class AppMessagingService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_ID = "afrovision_main"
        const val CHANNEL_NAME = "AfroVision"
        const val CHANNEL_DESC =
            "Channel updates, gifts, admin alerts, and account notifications"

    }

    override fun onCreate() {
        super.onCreate()
        // Create channels immediately so they exist before FCM tries to post
        // a notification.  createNotificationChannels() is idempotent.
        createNotificationChannels()
    }

    /**
     * Called for EVERY inbound FCM message regardless of app state.
     *
     * • Foreground: Flutter's FirebaseMessaging.onMessage fires first and
     *   flutter_local_notifications shows the heads-up banner.  We must NOT
     *   also show a native notification here or the user sees it twice.
     *
     * • Background / Terminated + notification message: FCM SDK already auto-
     *   shows the notification from the notification field.  Skip native show.
     *
     * • Background / Terminated + DATA-ONLY message (no notification field):
     *   FCM SDK does NOT auto-display.  We show the notification natively.
     */
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        // Notification messages are auto-displayed by FCM in background/terminated.
        // Only handle DATA-ONLY messages here so we never duplicate banners.
        if (remoteMessage.notification != null) return

        val data = remoteMessage.data
        val title = data["title"] ?: return
        val body = data["body"] ?: ""

        showDataNotification(title, body)
    }

    // Not needed \u2014 the Flutter plugin handles token upload via onTokenRefresh stream.
    // override fun onNewToken(token: String) { }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private fun showDataNotification(
        title: String,
        body: String,
    ) {
        createNotificationChannels() // Idempotent - safe to call again

        val channelId = CHANNEL_ID

        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("from_notification", true)
        }

        val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        else
            PendingIntent.FLAG_UPDATE_CURRENT

        val pendingIntent = PendingIntent.getActivity(this, 0, intent, piFlags)

        // Resolve the monochrome notification icon; fall back to app icon.
        val iconRes = resourceId("ic_stat_notification", "drawable")
            .takeIf { it != 0 }
            ?: resourceId("ic_launcher", "mipmap")

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(iconRes)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        val manager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(System.currentTimeMillis().toInt(), builder.build())
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val soundUri: Uri = Settings.System.DEFAULT_NOTIFICATION_URI

        // Standard channel - high importance so heads-up banners appear.
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            val audioAttr = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build()
            val main = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = CHANNEL_DESC
                enableVibration(true)
                enableLights(true)
                setSound(soundUri, audioAttr)
            }
            manager.createNotificationChannel(main)
        }
    }

    private fun resourceId(name: String, type: String): Int =
        resources.getIdentifier(name, type, packageName)
}
