package com.afrovision.tv.data

import android.content.Context
import android.util.Log
import com.afrovision.tv.TV_APP_TAG
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Keeps the last successful copy of slow list responses (channels, movies,
 * series, library) on disk, so the TV can show them immediately on launch
 * and keep working while the network is slow, then replace them with fresh
 * data. Stored under filesDir, which Android doesn't clear on low storage.
 * Every failure is swallowed: a missing or unreadable cache just means the
 * screen waits for the network as before.
 */
class ApiResponseCache(context: Context) {
    private val dir = File(context.filesDir, "api_cache")
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    suspend fun <T> read(key: String, serializer: KSerializer<T>): T? = withContext(Dispatchers.IO) {
        try {
            val file = File(dir, "$key.json")
            if (!file.exists()) null else json.decodeFromString(serializer, file.readText())
        } catch (e: Exception) {
            Log.w(TV_APP_TAG, "api cache read failed for $key", e)
            null
        }
    }

    suspend fun <T> write(key: String, serializer: KSerializer<T>, value: T) = withContext(Dispatchers.IO) {
        try {
            dir.mkdirs()
            // Write then rename, so a crash mid-write can't leave a torn file.
            val tmp = File(dir, "$key.json.tmp")
            tmp.writeText(json.encodeToString(serializer, value))
            tmp.renameTo(File(dir, "$key.json"))
        } catch (e: Exception) {
            Log.w(TV_APP_TAG, "api cache write failed for $key", e)
        }
    }
}
