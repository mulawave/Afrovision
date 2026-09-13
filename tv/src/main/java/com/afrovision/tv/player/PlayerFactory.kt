package com.afrovision.tv.player

import android.content.Context
import android.net.ConnectivityManager
import androidx.media3.common.TrackSelectionParameters
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import okhttp3.OkHttpClient

/**
 * Buffering / bitrate configuration for the TV video player, mirroring the
 * mobile app's validated MPV profile (see lib/core/utils/mpv_buffer_config.dart)
 * translated to ExoPlayer's equivalents:
 *   - MPV's byte-based cache-secs/demuxer-readahead-secs -> ExoPlayer's
 *     duration-based DefaultLoadControl min/max buffer.
 *   - MPV's network-aware hls-bitrate cap -> ExoPlayer's
 *     TrackSelectionParameters.maxVideoBitrate.
 * Not a byte-for-byte port (different player engines, different buffering
 * models) but the same intent: buffer generously ahead of playback so a
 * transient network dip doesn't stall it, and cap bitrate on a metered/
 * unknown connection (or the user's own quality choice) to save data.
 */
@UnstableApi
object PlayerFactory {

    // A dedicated client (not Retrofit's, which is scoped to API JSON calls
    // and our own base URL) so video requests get real HTTP connection
    // pooling/keep-alive instead of ExoPlayer's default per-request
    // HttpURLConnection stack - fewer TCP/TLS handshakes when a channel/VOD
    // session issues many segment requests, directly serving the "instant
    // response" goal.
    private val httpClient by lazy { OkHttpClient.Builder().build() }

    // Matches mobile's validated baseline: fast-starting min buffer, deep max
    // buffer for anti-rebuffer headroom (well above ExoPlayer's 50s/50s
    // stock default), small pre-roll before first playback, slightly larger
    // pre-roll after a rebuffer so playback doesn't immediately stall again.
    private const val MIN_BUFFER_MS = 15_000
    private const val MAX_BUFFER_MS = 120_000
    private const val BUFFER_FOR_PLAYBACK_MS = 2_500
    private const val BUFFER_FOR_PLAYBACK_AFTER_REBUFFER_MS = 5_000

    fun create(context: Context): ExoPlayer {
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                MIN_BUFFER_MS,
                MAX_BUFFER_MS,
                BUFFER_FOR_PLAYBACK_MS,
                BUFFER_FOR_PLAYBACK_AFTER_REBUFFER_MS
            )
            .build()

        val dataSourceFactory = DefaultDataSource.Factory(
            context,
            OkHttpDataSource.Factory(httpClient)
        )

        return ExoPlayer.Builder(context)
            .setLoadControl(loadControl)
            .setMediaSourceFactory(DefaultMediaSourceFactory(dataSourceFactory))
            .build()
    }

    /**
     * Bitrate ceiling in bits/sec for a given quality setting ("auto",
     * "480p", "720p", "1080p" - see SettingsScreen), or null for no cap.
     */
    private fun bitrateCapFor(qualitySetting: String): Int? = when (qualitySetting) {
        "480p" -> 1_000_000
        "720p" -> 3_000_000
        "1080p" -> 6_000_000
        else -> null // "auto"
    }

    /**
     * Applies the effective bitrate cap: the user's explicit quality choice
     * if they picked one, otherwise a conservative default-quality cap only
     * when the active connection is metered/unknown (mirrors mobile's
     * cellular-vs-unmetered-Wi-Fi split) - on a normal unmetered connection
     * "auto" really does mean unconstrained/best available.
     */
    fun applyQualityCap(player: ExoPlayer, context: Context, qualitySetting: String) {
        val explicitCap = bitrateCapFor(qualitySetting)
        val cap = explicitCap ?: run {
            val isMetered = try {
                val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                cm?.isActiveNetworkMetered ?: false
            } catch (_: Exception) {
                false
            }
            if (isMetered) 3_000_000 else null
        }

        val builder = player.trackSelectionParameters.buildUpon()
        if (cap != null) {
            builder.setMaxVideoBitrate(cap)
        } else {
            builder.setMaxVideoBitrate(Int.MAX_VALUE)
        }
        player.trackSelectionParameters = builder.build()
    }
}
