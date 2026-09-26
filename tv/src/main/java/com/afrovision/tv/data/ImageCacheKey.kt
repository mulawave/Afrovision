package com.afrovision.tv.data

import android.net.Uri

// Query parameters that only carry access/signing data. They change between
// API calls for the same file, so they're dropped from the cache key.
private val VOLATILE_PARAMS = setOf("token", "expires", "signature", "googleaccessid")

/**
 * Returns a stable cache key for an image URL.
 *
 * Firebase / GCS signed URLs carry access parameters (`token`, `X-Goog-*`,
 * `Expires`, `Signature`, `GoogleAccessId`) that change on every API call
 * for the same file, so those are removed to avoid re-downloading. Every
 * other query parameter is kept: for some hosts the query IS the image
 * identity (e.g. Google image thumbnails, `images?q=tbn:...`). Stripping the
 * whole query made all such images share one key, so a series showed another
 * title's cached poster. Mirrors lib/core/utils/image_cache_key.dart.
 */
fun imageCacheKey(url: String?): String? {
    if (url.isNullOrEmpty()) return null
    return try {
        val uri = Uri.parse(url)
        val kept = uri.queryParameterNames
            .filter { name ->
                val lower = name.lowercase()
                lower !in VOLATILE_PARAMS && !lower.startsWith("x-goog-")
            }
            .sorted()
            .flatMap { name -> uri.getQueryParameters(name).map { "$name=$it" } }
        val base = "${uri.scheme}://${uri.host}${uri.path}"
        if (kept.isEmpty()) base else "$base?${kept.joinToString("&")}"
    } catch (_: Exception) {
        url
    }
}
