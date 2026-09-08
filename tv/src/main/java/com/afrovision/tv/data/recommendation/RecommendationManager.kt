package com.afrovision.tv.data.recommendation

import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.tvprovider.media.tv.TvContractCompat
import androidx.tvprovider.media.tv.WatchNextProgram
import com.afrovision.tv.TV_APP_TAG
import com.afrovision.tv.data.MediaCard

object RecommendationManager {

    fun sync(context: Context, items: List<MediaCard>) {
        val resolver = context.contentResolver
        try {
            resolver.delete(
                TvContractCompat.WatchNextPrograms.CONTENT_URI,
                "${TvContractCompat.WatchNextPrograms.COLUMN_PACKAGE_NAME} = ?",
                arrayOf(context.packageName)
            )

            items.forEach { item ->
                val builder = WatchNextProgram.Builder()
                    .setType(TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_CONTINUE)
                    .setInternalProviderId(item.id)
                    .setTitle(item.title)
                    .setDescription(item.subtitle)
                    .setPosterArtUri(item.imageUrl?.let { Uri.parse(it) })
                    .setDurationMillis(item.duration.toInt())
                    .setLastPlaybackPositionMillis((item.progress * item.duration).toLong().toInt())
                    .setLastEngagementTimeUtcMillis(System.currentTimeMillis())
                    .setIntentUri(buildIntentUri(item))

                val values = builder.build().toContentValues()
                resolver.insert(TvContractCompat.WatchNextPrograms.CONTENT_URI, values)
            }
        } catch (e: Exception) {
            Log.e(TV_APP_TAG, "Recommendation sync failed", e)
        }
    }

    private fun buildIntentUri(item: MediaCard): Uri {
        return when (item.mediaType) {
            "channel" -> Uri.parse("https://afrovision.tv/live?id=${item.id}")
            "wave" -> Uri.parse("https://afrovision.tv/wave?id=${item.id}")
            "movie", "series" -> Uri.parse("https://afrovision.tv/watch?url=${item.streamUrl ?: item.externalUrl ?: ""}")
            else -> Uri.parse("https://afrovision.tv/")
        }
    }

    fun findWatchNextId(context: Context, internalId: String): Long? {
        return try {
            val cursor = context.contentResolver.query(
                TvContractCompat.WatchNextPrograms.CONTENT_URI,
                arrayOf(TvContractCompat.WatchNextPrograms._ID),
                "${TvContractCompat.WatchNextPrograms.COLUMN_INTERNAL_PROVIDER_ID} = ? AND " +
                        "${TvContractCompat.WatchNextPrograms.COLUMN_PACKAGE_NAME} = ?",
                arrayOf(internalId, context.packageName),
                null
            )
            cursor?.use {
                if (it.moveToFirst()) it.getLong(0) else null
            }
        } catch (e: Exception) {
            Log.e(TV_APP_TAG, "find watch next failed", e)
            null
        }
    }

    fun updateProgress(context: Context, internalId: String, positionMs: Long, durationMs: Long) {
        val id = findWatchNextId(context, internalId) ?: return
        val uri = ContentUris.withAppendedId(TvContractCompat.WatchNextPrograms.CONTENT_URI, id)
        try {
            val values = WatchNextProgram.Builder()
                .setLastPlaybackPositionMillis(positionMs.toInt())
                .setDurationMillis(durationMs.toInt())
                .setLastEngagementTimeUtcMillis(System.currentTimeMillis())
                .build()
                .toContentValues()
            context.contentResolver.update(uri, values, null, null)
        } catch (e: Exception) {
            Log.e(TV_APP_TAG, "update watch next failed", e)
        }
    }
}
