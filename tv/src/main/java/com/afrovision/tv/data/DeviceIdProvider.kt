package com.afrovision.tv.data

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.provider.Settings
import java.io.File
import java.util.UUID

object DeviceIdProvider {

    private const val FALLBACK_FILE = "device_id.txt"
    private const val KNOWN_BAD_ANDROID_ID = "9774d56d682e549c"

    @SuppressLint("HardwareIds")
    private fun androidId(context: Context): String? = try {
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
    } catch (_: Exception) {
        null
    }

    fun getDeviceId(context: Context): String {
        val id = androidId(context)
        if (!id.isNullOrBlank() && id != KNOWN_BAD_ANDROID_ID) return id

        val file = File(context.filesDir, FALLBACK_FILE)
        if (file.exists()) {
            val stored = file.readText().trim()
            if (stored.isNotBlank()) return stored
        }
        val generated = UUID.randomUUID().toString()
        file.writeText(generated)
        return generated
    }

    fun getDeviceName(): String =
        Build.MODEL?.takeIf { it.isNotBlank() } ?: Build.DEVICE?.takeIf { it.isNotBlank() } ?: "Android TV"

    fun getAppVersion(context: Context): String = try {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        val code = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
        "${info.versionName} ($code)"
    } catch (_: Exception) {
        "1.0"
    }

    fun getVersionCode(context: Context): Long = try {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
    } catch (_: Exception) {
        1L
    }
}
