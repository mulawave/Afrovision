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
import androidx.media3.exoplayer.trackselection.AdaptiveTrackSelection
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.exoplayer.upstream.DefaultBandwidthMeter
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

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
    private val httpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    // Matches mobile's validated baseline: fast-starting min buffer, deep max
    // buffer for anti-rebuffer headroom (well above ExoPlayer's 50s/50s
    // stock default), small pre-roll before first playback, slightly larger
    // pre-roll after a rebuffer so playback doesn't immediately stall again.
    // Slow-network profile: keep refilling until 40s is buffered (not the
    // 15s that let short dips drain it), start quickly, but after a stall wait
    // for a real cushion so playback doesn't stutter straight back into
    // another rebuffer.
    private const val MIN_BUFFER_MS = 40_000
    private const val MAX_BUFFER_MS = 120_000
    private const val BUFFER_FOR_PLAYBACK_MS = 2_500
    private const val BUFFER_FOR_PLAYBACK_AFTER_REBUFFER_MS = 8_000

    // Start at a modest bitrate so the first frame arrives fast on a weak
    // link; ABR only steps quality up once throughput has held for a while,
    // and uses 60% of measured bandwidth so short dips don't empty the buffer.
    private const val INITIAL_BITRATE_ESTIMATE = 800_000L
    private const val MIN_DURATION_FOR_QUALITY_INCREASE_MS = 15_000
    private const val MAX_DURATION_FOR_QUALITY_DECREASE_MS = 25_000
    private const val MIN_DURATION_TO_RETAIN_AFTER_DISCARD_MS = 25_000
    private const val BANDWIDTH_FRACTION = 0.6f

    // Segment/playlist fetches are retried this many times before the load
    // surfaces as an error (ExoPlayer's default is 3).
    private const val LOAD_RETRY_COUNT = 8

    fun create(context: Context): ExoPlayer {
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                MIN_BUFFER_MS,
                MAX_BUFFER_MS,
                BUFFER_FOR_PLAYBACK_MS,
                BUFFER_FOR_PLAYBACK_AFTER_REBUFFER_MS
            )
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()

        val dataSourceFactory = DefaultDataSource.Factory(
            context,
            OkHttpDataSource.Factory(httpClient)
        )

        val bandwidthMeter = DefaultBandwidthMeter.Builder(context)
            .setInitialBitrateEstimate(INITIAL_BITRATE_ESTIMATE)
            .build()

        val trackSelector = DefaultTrackSelector(
            context,
            AdaptiveTrackSelection.Factory(
                MIN_DURATION_FOR_QUALITY_INCREASE_MS,
                MAX_DURATION_FOR_QUALITY_DECREASE_MS,
                MIN_DURATION_TO_RETAIN_AFTER_DISCARD_MS,
                BANDWIDTH_FRACTION
            )
        )

        val mediaSourceFactory = DefaultMediaSourceFactory(dataSourceFactory)
            .setLoadErrorHandlingPolicy(DefaultLoadErrorHandlingPolicy(LOAD_RETRY_COUNT))

        return ExoPlayer.Builder(context)
            .setLoadControl(loadControl)
            .setBandwidthMeter(bandwidthMeter)
            .setTrackSelector(trackSelector)
            .setMediaSourceFactory(mediaSourceFactory)
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
