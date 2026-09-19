package com.afrovision.tv.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import coil.request.ImageRequest
import com.afrovision.tv.data.imageCacheKey

/**
 * An [ImageRequest] with a stable memory/disk cache key (see
 * com.afrovision.tv.data.imageCacheKey) instead of Coil's default of using
 * the full URL - including any query-string auth token - as the cache key.
 * Pass this as `AsyncImage`'s `model` in place of a raw URL string.
 */
@Composable
fun rememberCacheableImageRequest(url: String?): ImageRequest? {
    val context = LocalContext.current
    return remember(url) {
        if (url.isNullOrBlank()) return@remember null
        val key = imageCacheKey(url)
        ImageRequest.Builder(context)
            .data(url)
            .apply {
                if (key != null) {
                    memoryCacheKey(key)
                    diskCacheKey(key)
                }
            }
            .build()
    }
}
