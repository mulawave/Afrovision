package com.afrovision.afrovision

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews

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

        private fun updateSingle(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) { try {
            val prefs = context.getSharedPreferences(
                "AfroVisionWidgetPrefs",
                Context.MODE_PRIVATE,
            )

            val liveCount        = prefs.getInt("liveCount", 0)
            val nextChannel      = prefs.getString("nextShowChannel", "") ?: ""
            val nextShow         = prefs.getString("nextShowTitle", "")   ?: ""
            val nextTime         = prefs.getString("nextShowTime", "")    ?: ""
            val planName         = prefs.getString("planName", "Free Plan") ?: "Free Plan"
            val daysToRenewal    = prefs.getInt("daysToRenewal", 0)
            val notifCount       = prefs.getInt("notificationCount", 0)
            val wavesCount       = prefs.getInt("wavesCount", 0)
            val libraryUpdates   = prefs.getInt("libraryUpdates", 0)

            val views = RemoteViews(context.packageName, R.layout.afrovision_widget)

            // ── Live count ──────────────────────────────────────────────────
            views.setTextViewText(
                R.id.widget_live_count,
                if (liveCount > 0) "$liveCount LIVE" else "0 LIVE",
            )

            // ── Notification badge ──────────────────────────────────────────
            if (notifCount > 0) {
                views.setViewVisibility(R.id.widget_notif_count, View.VISIBLE)
                views.setTextViewText(
                    R.id.widget_notif_count,
                    if (notifCount > 99) "99+" else notifCount.toString(),
                )
            } else {
                views.setViewVisibility(R.id.widget_notif_count, View.GONE)
            }

            // ── Upcoming show ───────────────────────────────────────────────
            views.setTextViewText(
                R.id.widget_next_channel,
                nextChannel.ifEmpty { "No upcoming shows" },
            )
            views.setTextViewText(R.id.widget_next_show, nextShow)
            views.setTextViewText(R.id.widget_next_time, nextTime)

            // ── Plan ────────────────────────────────────────────────────────
            views.setTextViewText(R.id.widget_plan, planName)
            views.setTextViewText(
                R.id.widget_days,
                if (daysToRenewal > 0) "Renews in $daysToRenewal day${if (daysToRenewal == 1) "" else "s"}"
                else "",
            )

            // ── Waves ───────────────────────────────────────────────────────
            if (wavesCount > 0) {
                views.setViewVisibility(R.id.widget_waves_row, View.VISIBLE)
                views.setTextViewText(R.id.widget_waves, wavesCount.toString())
            } else {
                views.setViewVisibility(R.id.widget_waves_row, View.GONE)
            }

            // ── Library updates ─────────────────────────────────────────────
            if (libraryUpdates > 0) {
                views.setViewVisibility(R.id.widget_library, View.VISIBLE)
                views.setTextViewText(R.id.widget_library, "+$libraryUpdates New")
            } else {
                views.setViewVisibility(R.id.widget_library, View.GONE)
            }

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
        } catch (e: Exception) {
            // Main layout failed — use the completely separate bare fallback
            // so the widget slot shows something instead of "Can't load widget".
            try {
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
            } catch (_: Exception) { /* nothing more we can do */ }
        }
        }
    }
}
