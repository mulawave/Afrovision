package com.afrovision.afrovision

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Downloads small images (avatar, channel logos, channel covers) for the home-screen
 * widget and stores them as circular or rectangular PNGs in the cache directory.
 * RemoteViews cannot clip an [android.widget.ImageView] to a circle, so we pre-round
 * the bitmap here.
 */
object WidgetImageLoader {

    private const val TARGET_PX = 96
    private const val COVER_WIDTH_PX = 512
    private const val COVER_HEIGHT_PX = 192
    private const val TIMEOUT_MS = 10_000

    /**
     * Downloads [url], crops it to a centered circle, writes it to a cache file
     * named after [pathKey], and returns the absolute file path (or null on
     * failure).
     */
    fun downloadCircularToCache(context: Context, url: String, pathKey: String): String? {
        return try {
            val source = downloadBitmap(url) ?: return null
            val circular = toCircularBitmap(source, TARGET_PX)
            if (circular !== source) source.recycle()

            val file = File(context.cacheDir, "widget_$pathKey.png")
            FileOutputStream(file).use { out ->
                circular.compress(Bitmap.CompressFormat.PNG, 100, out)
            }
            circular.recycle()
            file.absolutePath
        } catch (e: Exception) {
            android.util.Log.e("WidgetImageLoader", "Failed to load $url", e)
            null
        }
    }

    /**
     * Downloads a channel cover/banner, center-crops to a wide rectangle, and
     * writes it to a cache file. Returns the absolute path or null on failure.
     */
    fun downloadCoverToCache(context: Context, url: String, pathKey: String): String? {
        return try {
            val source = downloadBitmap(url) ?: return null
            val cover = toRectangularBitmap(source, COVER_WIDTH_PX, COVER_HEIGHT_PX)
            if (cover !== source) source.recycle()

            val file = File(context.cacheDir, "widget_$pathKey.png")
            FileOutputStream(file).use { out ->
                cover.compress(Bitmap.CompressFormat.PNG, 90, out)
            }
            cover.recycle()
            file.absolutePath
        } catch (e: Exception) {
            android.util.Log.e("WidgetImageLoader", "Failed to load cover $url", e)
            null
        }
    }

    /**
     * Center-crops [source] to [width] x [height] using a Lanczos-style filter.
     */
    private fun toRectangularBitmap(source: Bitmap, width: Int, height: Int): Bitmap {
        // Center-crop the source to the target aspect ratio.
        val srcAspect = source.width.toFloat() / source.height
        val dstAspect = width.toFloat() / height
        val srcWidth: Int
        val srcHeight: Int
        val left: Int
        val top: Int
        if (srcAspect > dstAspect) {
            srcHeight = source.height
            srcWidth = (srcHeight * dstAspect).toInt()
            left = (source.width - srcWidth) / 2
            top = 0
        } else {
            srcWidth = source.width
            srcHeight = (srcWidth / dstAspect).toInt()
            left = 0
            top = (source.height - srcHeight) / 2
        }
        val srcRect = Rect(left, top, left + srcWidth, top + srcHeight)
        val dstRect = Rect(0, 0, width, height)

        val output = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        canvas.drawBitmap(source, srcRect, RectF(dstRect), paint)
        return output
    }

    private fun downloadBitmap(url: String): Bitmap? {
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
                instanceFollowRedirects = true
                doInput = true
                connect()
            }
            if (connection.responseCode != HttpURLConnection.HTTP_OK) return null
            connection.inputStream.use { BitmapFactory.decodeStream(it) }
        } catch (e: Exception) {
            android.util.Log.e("WidgetImageLoader", "Download error for $url", e)
            null
        } finally {
            connection?.disconnect()
        }
    }

    private fun toCircularBitmap(source: Bitmap, sizePx: Int): Bitmap {
        // Center-crop to a square first.
        val dimension = minOf(source.width, source.height)
        val left = (source.width - dimension) / 2
        val top = (source.height - dimension) / 2
        val srcRect = Rect(left, top, left + dimension, top + dimension)
        val dstRect = Rect(0, 0, sizePx, sizePx)

        val output = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { isFilterBitmap = true }

        val radius = sizePx / 2f
        canvas.drawCircle(radius, radius, radius, paint)
        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        canvas.drawBitmap(source, srcRect, RectF(dstRect), paint)
        return output
    }
}
