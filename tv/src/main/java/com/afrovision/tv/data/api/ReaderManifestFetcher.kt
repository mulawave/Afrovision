package com.afrovision.tv.data.api

import android.util.Log
import com.afrovision.tv.TV_APP_TAG
import com.afrovision.tv.data.api.model.ReaderManifest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * The reader-manifest endpoint only hands back a `manifestUrl` (a public GCS
 * JSON file, same as the website reader) - the actual page/spread list has
 * to be fetched from that URL directly, not through our API's base URL or
 * auth headers.
 */
object ReaderManifestFetcher {
    private val client = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    suspend fun fetch(manifestUrl: String): ReaderManifest? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder().url(manifestUrl).build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val body = response.body?.string() ?: return@withContext null
                json.decodeFromString<ReaderManifest>(body)
            }
        } catch (e: Exception) {
            Log.e(TV_APP_TAG, "ReaderManifestFetcher failed for $manifestUrl", e)
            null
        }
    }
}
