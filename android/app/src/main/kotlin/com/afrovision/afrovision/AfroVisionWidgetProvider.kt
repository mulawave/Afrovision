package com.afrovision.afrovision

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.view.View
import android.widget.RemoteViews
import java.io.File

/**
 * AfroVision home-screen widget.
 *
 * Shows a live-channel count, next upcoming show, active plan details,
 * notification badge, waves count, and library updates.
 *
 * Data is stored in SharedPreferences ("AfroVisionWidgetPrefs") by
 * MainActivity when Flutter calls the "widget/updateWidget" method channel.
 * Tapping any part of the widget launches the app.
 */
class AfroVisionWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        updateAll(context, appWidgetManager, appWidgetIds)
        // Ensure avatar/channel images are fetched and applied, regardless of
        // whether the update came from the app or the system.
        refreshImages(context.applicationContext)
    }

    companion object {

        fun updateAll(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetIds: IntArray,
        ) {
            for (id in appWidgetIds) {
                updateSingle(context, appWidgetManager, id)
            }
        }

        /**
         * Downloads the avatar + recent-channel logos (referenced by URL in
         * SharedPreferences) to cached circular bitmaps on a background thread,
         * then redraws the widget. Skips downloads whose source URL is already
         * cached, and clears stale paths when a URL is removed.
         */
        fun refreshImages(context: Context) {
            Thread {
                val prefs = context.getSharedPreferences(
                    "AfroVisionWidgetPrefs", Context.MODE_PRIVATE,
                )
                val jobs = listOf(
                    "avatarUrl" to "avatarPath",
                    "recentChannelLogo1" to "recentLogoPath1",
                    "recentChannelLogo2" to "recentLogoPath2",
                    "recentChannelLogo3" to "recentLogoPath3",
                )
                val coverJobs = listOf(
                    "recentChannelCover1" to "recentCoverPath1",
                    "recentChannelCover2" to "recentCoverPath2",
                    "recentChannelCover3" to "recentCoverPath3",
                )
                var changed = false
                for ((urlKey, pathKey) in jobs) {
                    val url = prefs.getString(urlKey, "") ?: ""
                    val cachedUrl = prefs.getString("${pathKey}_url", "") ?: ""
                    val existingPath = prefs.getString(pathKey, "") ?: ""

                    if (url.isEmpty()) {
                        if (existingPath.isNotEmpty()) {
                            prefs.edit().remove(pathKey).remove("${pathKey}_url").apply()
                            changed = true
                        }
                        continue
                    }

                    // Already downloaded this exact URL and the file is present.
                    if (url == cachedUrl && existingPath.isNotEmpty() &&
                        File(existingPath).exists()
                    ) {
                        continue
                    }

                    val path = WidgetImageLoader.downloadCircularToCache(context, url, pathKey)
                    if (path != null) {
                        prefs.edit()
                            .putString(pathKey, path)
                            .putString("${pathKey}_url", url)
                            .apply()
                        changed = true
                    }
                }
                for ((urlKey, pathKey) in coverJobs) {
                    val url = prefs.getString(urlKey, "") ?: ""
                    val cachedUrl = prefs.getString("${pathKey}_url", "") ?: ""
                    val existingPath = prefs.getString(pathKey, "") ?: ""

                    if (url.isEmpty()) {
                        if (existingPath.isNotEmpty()) {
                            prefs.edit().remove(pathKey).remove("${pathKey}_url").apply()
                            changed = true
                        }
                        continue
                    }

                    if (url == cachedUrl && existingPath.isNotEmpty() &&
                        File(existingPath).exists()
                    ) {
                        continue
                    }

                    val path = WidgetImageLoader.downloadCoverToCache(context, url, pathKey)
                    if (path != null) {
                        prefs.edit()
                            .putString(pathKey, path)
                            .putString("${pathKey}_url", url)
                            .apply()
                        changed = true
                    }
                }

                if (changed) {
                    val manager = AppWidgetManager.getInstance(context)
                    val ids = manager.getAppWidgetIds(
                        ComponentName(context, AfroVisionWidgetProvider::class.java),
                    )
                    if (ids.isNotEmpty()) updateAll(context, manager, ids)
                }
            }.start()
        }

        /**
         * Decodes a cached bitmap [path] and applies it to [imageViewId]. When
         * the path is empty or the file is missing/invalid, the ImageView is
         * hidden and any [fallbackViewId] is shown instead.
         */
        private fun applyImage(
            views: RemoteViews,
            path: String,
            imageViewId: Int,
            fallbackViewId: Int? = null,
        ) {
            val bitmap = if (path.isNotEmpty() && File(path).exists()) {
                try { BitmapFactory.decodeFile(path) } catch (_: Exception) { null }
            } else null

            if (bitmap != null) {
                views.setImageViewBitmap(imageViewId, bitmap)
                views.setViewVisibility(imageViewId, View.VISIBLE)
                fallbackViewId?.let { views.setViewVisibility(it, View.GONE) }
            } else {
                views.setViewVisibility(imageViewId, View.GONE)
                fallbackViewId?.let { views.setViewVisibility(it, View.VISIBLE) }
            }
        }

        private fun updateSingle(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) { try {
            android.util.Log.d("AfroVisionWidget", "Updating widget ID: $appWidgetId")

            val prefs = context.getSharedPreferences(
                "AfroVisionWidgetPrefs",
                Context.MODE_PRIVATE,
            )

            val liveCount        = prefs.getInt("liveCount", 0)
            val planName         = prefs.getString("planName", "Free Plan") ?: "Free Plan"
            val daysToRenewal    = prefs.getInt("daysToRenewal", 0)
            val notifCount       = prefs.getInt("notificationCount", 0)
            val wavesCount       = prefs.getInt("wavesCount", 0)
            val libraryUpdates   = prefs.getInt("libraryUpdates", 0)
            val avatarInitial    = prefs.getString("avatarInitial", "") ?: ""
            val recentCh1        = prefs.getString("recentChannel1", "") ?: ""
            val recentCh2        = prefs.getString("recentChannel2", "") ?: ""
            val recentCh3        = prefs.getString("recentChannel3", "") ?: ""
            val recentId1        = prefs.getString("recentChannelId1", "") ?: ""
            val recentId2        = prefs.getString("recentChannelId2", "") ?: ""
            val recentId3        = prefs.getString("recentChannelId3", "") ?: ""
            val notif1           = prefs.getString("notification1", "") ?: ""
            val notif2           = prefs.getString("notification2", "") ?: ""
            val notif3           = prefs.getString("notification3", "") ?: ""
            val assetCash        = prefs.getString("assetCash", "₦0.00") ?: "₦0.00"
            val assetVpt         = prefs.getString("assetVpt", "0.00") ?: "0.00"
            val assetRavens      = prefs.getString("assetRavens", "0") ?: "0"

            android.util.Log.d("AfroVisionWidget", "Data loaded: liveCount=$liveCount, planName=$planName, avatarInitial=$avatarInitial")

            val views = RemoteViews(context.packageName, R.layout.afrovision_widget)

            // ── Avatar initial (fallback) ─────────────────────────────────────
            views.setTextViewText(R.id.widget_avatar_initial,
                avatarInitial.ifEmpty { "?" })

            // ── Avatar photo overlay (if a bitmap was downloaded) ─────────────
            applyImage(
                views,
                prefs.getString("avatarPath", "") ?: "",
                R.id.widget_avatar_image,
                fallbackViewId = R.id.widget_avatar_initial,
            )

            // ── Live count ──────────────────────────────────────────────────
            views.setTextViewText(
                R.id.widget_live_count,
                if (liveCount > 0) "$liveCount LIVE" else "0 LIVE",
            )

            // ── Recently viewed channels (ViewFlipper slides) ───────────────
            views.setTextViewText(R.id.widget_recent_ch_1,
                recentCh1.ifEmpty { "No recent channels" })
            views.setTextViewText(R.id.widget_recent_ch_2,
                recentCh2.ifEmpty { "No recent channels" })
            views.setTextViewText(R.id.widget_recent_ch_3,
                recentCh3.ifEmpty { "No recent channels" })

            // Ensure at least slide 1 is always visible to prevent ViewFlipper malfunction
            views.setViewVisibility(R.id.widget_recent_slide_1, View.VISIBLE)
            views.setViewVisibility(R.id.widget_recent_slide_2,
                if (recentCh2.isNotEmpty()) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.widget_recent_slide_3,
                if (recentCh3.isNotEmpty()) View.VISIBLE else View.GONE)

            // ── Channel logos (downloaded bitmaps) ──────────────────────────
            applyImage(views, prefs.getString("recentLogoPath1", "") ?: "",
                R.id.widget_recent_logo_1)
            applyImage(views, prefs.getString("recentLogoPath2", "") ?: "",
                R.id.widget_recent_logo_2)
            applyImage(views, prefs.getString("recentLogoPath3", "") ?: "",
                R.id.widget_recent_logo_3)

            // ── Channel cover backgrounds (downloaded bitmaps) ───────────────
            applyImage(views, prefs.getString("recentCoverPath1", "") ?: "",
                R.id.widget_recent_cover_1)
            applyImage(views, prefs.getString("recentCoverPath2", "") ?: "",
                R.id.widget_recent_cover_2)
            applyImage(views, prefs.getString("recentCoverPath3", "") ?: "",
                R.id.widget_recent_cover_3)

            // ── Deep-link each recent channel slide ────────────────────────
            fun channelPendingIntent(channelId: String, requestCode: Int): PendingIntent {
                val intent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra("openChannelId", channelId)
                }
                return PendingIntent.getActivity(
                    context, requestCode, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            }
            if (recentId1.isNotEmpty()) views.setOnClickPendingIntent(
                R.id.widget_recent_slide_1, channelPendingIntent(recentId1, 101))
            if (recentId2.isNotEmpty()) views.setOnClickPendingIntent(
                R.id.widget_recent_slide_2, channelPendingIntent(recentId2, 102))
            if (recentId3.isNotEmpty()) views.setOnClickPendingIntent(
                R.id.widget_recent_slide_3, channelPendingIntent(recentId3, 103))

            // ── Notification previews ─────────────────────────────────────────
            views.setTextViewText(R.id.widget_notif_1,
                if (notif1.isNotEmpty()) notif1 else "No new notifications")
            views.setTextViewText(R.id.widget_notif_2, notif2)
            views.setTextViewText(R.id.widget_notif_3, notif3)
            views.setViewVisibility(R.id.widget_notif_2,
                if (notif2.isNotEmpty()) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.widget_notif_3,
                if (notif3.isNotEmpty()) View.VISIBLE else View.GONE)

            // ── Plan ────────────────────────────────────────────────────────
            views.setTextViewText(R.id.widget_plan, planName)
            views.setTextViewText(
                R.id.widget_days,
                if (daysToRenewal > 0) "Renews in $daysToRenewal day${if (daysToRenewal == 1) "" else "s"}"
                else "",
            )

            // ── Waves count (footer) ─────────────────────────────────────────
            views.setTextViewText(R.id.widget_waves, "$wavesCount waves")

            // ── Assets ────────────────────────────────────────────────────────
            views.setTextViewText(R.id.widget_asset_cash, assetCash)
            views.setTextViewText(R.id.widget_asset_vpt, assetVpt)
            views.setTextViewText(R.id.widget_asset_ravens, assetRavens)

            // ── Tap: open app ───────────────────────────────────────────────
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
            android.util.Log.d("AfroVisionWidget", "Widget updated successfully for ID: $appWidgetId")
        } catch (e: Exception) {
            android.util.Log.e("AfroVisionWidget", "Widget update failed for ID: $appWidgetId", e)
            // Main layout failed — use the completely separate bare fallback
            // so the widget slot shows something instead of "Can't load widget".
            try {
                android.util.Log.d("AfroVisionWidget", "Attempting fallback layout for ID: $appWidgetId")
                val launchIntent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val pi = PendingIntent.getActivity(
                    context, 0, launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
                val fallback = RemoteViews(context.packageName, R.layout.afrovision_widget_fallback)
                fallback.setOnClickPendingIntent(R.id.fallback_root, pi)
                appWidgetManager.updateAppWidget(appWidgetId, fallback)
                android.util.Log.d("AfroVisionWidget", "Fallback layout applied for ID: $appWidgetId")
            } catch (e2: Exception) {
                android.util.Log.e("AfroVisionWidget", "Fallback layout also failed for ID: $appWidgetId", e2)
            }
        }
        }
    }
}
