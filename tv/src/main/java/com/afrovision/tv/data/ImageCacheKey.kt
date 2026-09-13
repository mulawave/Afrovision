package com.afrovision.tv.data

import android.net.Uri

/**
 * Returns a stable cache key for an image URL.
 *
 * Firebase / GCS signed URLs may carry a `token` query parameter that
 * changes on every API call. Using the full URL (Coil's default model) as
 * the cache key makes the app re-download the same image every time that
 * token rotates. This strips the query string and keeps only scheme, host,
 * and path so the same underlying asset always maps to the same cache
 * entry - mirrors lib/core/utils/image_cache_key.dart on mobile exactly.
 */
fun imageCacheKey(url: String?): String? {
    if (url.isNullOrEmpty()) return null
    return try {
        val uri = Uri.parse(url)
        "${uri.scheme}://${uri.host}${uri.path}"
    } catch (_: Exception) {
        url
    }
}
