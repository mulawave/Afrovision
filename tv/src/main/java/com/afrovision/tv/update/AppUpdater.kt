package com.afrovision.tv.update

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.util.Log
import androidx.core.content.FileProvider
import com.afrovision.tv.TV_APP_TAG
import java.io.File

/**
 * Downloads and installs the APK named by the heartbeat's `app_update.apk_url`
 * (see TvViewModel.appUpdate / backend/src/distribution/tv.controller.js
 * heartbeat). Uses DownloadManager for the transfer (handles retries and
 * exposes real progress) and the REQUEST_INSTALL_PACKAGES permission +
 * FileProvider already declared in AndroidManifest.xml / file_paths.xml to
 * hand the downloaded file to the system package installer.
 */
object AppUpdater {

    private const val FILE_NAME = "afrovision-tv-update.apk"

    fun startDownload(context: Context, apkUrl: String): Long {
        val target = File(context.getExternalFilesDir(null), FILE_NAME)
        if (target.exists()) target.delete()

        val request = DownloadManager.Request(Uri.parse(apkUrl))
            .setTitle("AfroVision TV update")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationUri(Uri.fromFile(target))
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        return manager.enqueue(request)
    }

    /** 0..100, or -1 if the download isn't found/failed. */
    fun queryProgress(context: Context, downloadId: Long): Int {
        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val cursor = manager.query(DownloadManager.Query().setFilterById(downloadId)) ?: return -1
        cursor.use {
            if (!it.moveToFirst()) return -1
            val statusIdx = it.getColumnIndex(DownloadManager.COLUMN_STATUS)
            val status = if (statusIdx >= 0) it.getInt(statusIdx) else -1
            if (status == DownloadManager.STATUS_FAILED) return -1
            val totalIdx = it.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
            val soFarIdx = it.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
            val total = if (totalIdx >= 0) it.getLong(totalIdx) else -1L
            val soFar = if (soFarIdx >= 0) it.getLong(soFarIdx) else 0L
            if (total <= 0) return if (status == DownloadManager.STATUS_SUCCESSFUL) 100 else 0
            return ((soFar * 100) / total).toInt().coerceIn(0, 100)
        }
    }

    fun isComplete(context: Context, downloadId: Long): Boolean {
        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val cursor = manager.query(DownloadManager.Query().setFilterById(downloadId)) ?: return false
        cursor.use {
            if (!it.moveToFirst()) return false
            val statusIdx = it.getColumnIndex(DownloadManager.COLUMN_STATUS)
            return statusIdx >= 0 && it.getInt(statusIdx) == DownloadManager.STATUS_SUCCESSFUL
        }
    }

    fun promptInstall(context: Context) {
        val file = File(context.getExternalFilesDir(null), FILE_NAME)
        if (!file.exists()) {
            Log.e(TV_APP_TAG, "AppUpdater: downloaded APK missing at ${file.path}")
            return
        }
        val uri = FileProvider.getUriForFile(context, "com.afrovision.tv.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(intent)
    }
}
