package com.afrovision.tv.ui.screens

import android.net.Uri
import android.util.Log
import android.view.KeyEvent
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.afrovision.tv.BASE_URL
import com.afrovision.tv.R
import com.afrovision.tv.TV_APP_TAG
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.PlayerMedia
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.toMediaCard
import com.afrovision.tv.player.PlayerFactory
import com.afrovision.tv.ui.focus.autoRequestFocus
import com.afrovision.tv.ui.components.rememberCacheableImageRequest
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.navigation.Screen
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun PlayerScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val context = LocalContext.current
    val media = viewModel.playerMedia ?: return run { viewModel.closePlayer() }

    if (media.mediaType == "trailer" || isYouTubeUrl(media.externalUrl) || isYouTubeUrl(media.streamUrl)) {
        TrailerPlayer(viewModel, media)
        return
    }

    val player = remember { PlayerFactory.create(context) }
    var isPlaying by remember { mutableStateOf(true) }
    var showOverlay by remember { mutableStateOf(true) }
    var showSurfer by remember { mutableStateOf(false) }
    var position by remember { mutableLongStateOf(0L) }
    var duration by remember { mutableLongStateOf(0L) }
    var isTuning by remember { mutableStateOf(true) }
    // Native channel with nothing scheduled right now.
    var offAir by remember { mutableStateOf(false) }
    // Initial-tune failure handling. A stream that never starts (dead link,
    // 403, source down) used to sit on the tuning screen forever: every error
    // triggered another retry, each waiting on slow timeouts. Once a stream
    // has played at least once, errors are still retried indefinitely as
    // before - that is what rides out network hiccups mid-programme.
    var everReady by remember(media) { mutableStateOf(false) }
    var tuneFailures by remember(media) { mutableIntStateOf(0) }
    var unavailable by remember(media) { mutableStateOf(false) }
    var tuneAttempt by remember(media) { mutableIntStateOf(0) }
    val playbackScope = rememberCoroutineScope()
    // Native channels have no URL of their own: they air whatever the
    // broadcast scheduler has on now, joined at the scheduled position.
    val isScheduledChannel = media.isLive && media.mediaType == "channel" &&
        media.streamUrl.isNullOrBlank() && media.externalUrl.isNullOrBlank()

    // Re-applied whenever the user changes Settings > Default quality, or
    // when the network's metered-ness might differ (new media = fresh
    // ConnectivityManager read), not just once at player creation.
    LaunchedEffect(viewModel.settings.defaultQuality, media) {
        PlayerFactory.applyQualityCap(player, context, viewModel.settings.defaultQuality)
    }

    // The in-flight now-playing lookup for a scheduled channel. Cancelled on
    // every new tune so a slow answer for a channel already left can't start.
    var scheduleJob by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }

    fun startPlayback() {
        scheduleJob?.cancel()
        // Drop the previous stream (and its last frame) straight away.
        // Otherwise the old channel stays on screen, often still playing,
        // until the new stream renders a frame - on slow sources that is
        // 10s+, while the overlay already shows the new channel's name.
        player.stop()
        player.clearMediaItems()
        if (isScheduledChannel) {
            val tunedId = media.id
            scheduleJob = playbackScope.launch {
                val now = viewModel.getNowPlaying(tunedId)
                if (viewModel.playerMedia?.id != tunedId) return@launch
                if (now == null) {
                    offAir = true
                    isTuning = false
                    return@launch
                }
                offAir = false
                // Pre-transcoded HLS is served by the backend itself under a
                // relative /broadcast/hls/ path.
                val nowUrl = if (now.videoUrl.startsWith("/")) BASE_URL + now.videoUrl else now.videoUrl
                player.repeatMode = Player.REPEAT_MODE_OFF
                player.setMediaItem(MediaItem.fromUri(nowUrl), now.position * 1000L)
                player.prepare()
                player.playWhenReady = true
            }
            return
        }
        val url = media.streamUrl ?: media.externalUrl ?: return
        // Matches mobile: a Wave loops by default (autoscroll-to-next is a
        // Waves-screen concept, not a thing this single-item full player
        // does), everything else plays through once.
        player.repeatMode = if (media.mediaType == "wave") Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
        player.setMediaItem(MediaItem.fromUri(url))
        player.prepare()
        player.playWhenReady = true
        if (media.progress > 0 && !media.isLive) player.seekTo(media.progress)
    }

    fun markUnavailable() {
        scheduleJob?.cancel()
        player.stop()
        player.clearMediaItems()
        isTuning = false
        unavailable = true
    }

    fun retryTune() {
        unavailable = false
        tuneFailures = 0
        isTuning = true
        tuneAttempt += 1
        startPlayback()
    }

    // Give up on an initial tune that shows no picture within the limit.
    LaunchedEffect(media, tuneAttempt) {
        delay(TUNE_TIMEOUT_MS)
        if (!everReady && !unavailable && !offAir) {
            Log.e(TV_APP_TAG, "${media.title} showed no picture in ${TUNE_TIMEOUT_MS}ms, marking unavailable")
            markUnavailable()
        }
    }

    LaunchedEffect(media) {
        isTuning = true
        TvSoundManager.play("tune")
        startPlayback()
        if (media.mediaType == "wave") viewModel.trackWaveView(media.id)
    }

    // Second and later view-tracking hit: a wave looping back to the start,
    // same trigger as the Waves screen's inline preview.
    DisposableEffect(player, media) {
        if (media.mediaType != "wave") return@DisposableEffect onDispose {}
        val loopListener = object : Player.Listener {
            override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) {
                if (reason == Player.DISCONTINUITY_REASON_AUTO_TRANSITION) viewModel.trackWaveView(media.id)
            }
        }
        player.addListener(loopListener)
        onDispose { player.removeListener(loopListener) }
    }

    // Keyed on media too: the listener calls startPlayback(), which closes
    // over the current media. Keyed on player alone, a retry after channel
    // surfing re-tuned the first channel instead of the one on screen.
    DisposableEffect(player, media) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) {
                    isTuning = false
                    everReady = true
                    unavailable = false
                }
                // A scheduled program finished: tune to whatever airs next.
                if (playbackState == Player.STATE_ENDED && isScheduledChannel) {
                    isTuning = true
                    startPlayback()
                }
            }

            // Without this, a playback error (a dropped segment request, a
            // manifest reload failing, etc.) leaves ExoPlayer sitting in
            // STATE_IDLE forever - the video surface keeps showing its last
            // rendered frame and nothing ever calls prepare() again, which is
            // exactly the "player just freezes and won't recover" bug. Retry
            // by re-setting the same media item and re-preparing.
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                if (!everReady) {
                    tuneFailures += 1
                    if (tuneFailures >= MAX_TUNE_FAILURES) {
                        Log.e(TV_APP_TAG, "${media.title} failed to start $tuneFailures times, marking unavailable", error)
                        markUnavailable()
                        return
                    }
                }
                Log.e(TV_APP_TAG, "Player error for ${media.title}, retrying", error)
                isTuning = true
                startPlayback()
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }

    // Second line of defense: some stalls never surface as a PlaybackException
    // (the loader just quietly stops making progress on a bad connection) -
    // watch for playback position not advancing while ExoPlayer thinks it
    // should be playing, and force a fresh prepare() if it's stuck too long.
    LaunchedEffect(player, media) {
        var lastPosition = -1L
        var stuckSinceMs = 0L
        while (true) {
            delay(5000)
            if (unavailable) {
                stuckSinceMs = 0L
                continue
            }
            val stalled = player.playWhenReady &&
                (player.playbackState == Player.STATE_BUFFERING || player.playbackState == Player.STATE_READY) &&
                !player.isPlaying
            val pos = player.currentPosition
            if (stalled && pos == lastPosition) {
                if (stuckSinceMs == 0L) stuckSinceMs = System.currentTimeMillis()
                else if (System.currentTimeMillis() - stuckSinceMs > 20_000) {
                    Log.e(TV_APP_TAG, "Player stalled at $pos for 20s+ with no error, forcing retry")
                    isTuning = true
                    startPlayback()
                    stuckSinceMs = 0L
                }
            } else {
                stuckSinceMs = 0L
            }
            lastPosition = pos
        }
    }

    LaunchedEffect(showOverlay, showSurfer) {
        if (showOverlay && !showSurfer) {
            delay(4200)
            showOverlay = false
        }
    }

    LaunchedEffect(player) {
        while (true) {
            delay(1000)
            position = player.currentPosition.coerceAtLeast(0L)
            duration = player.duration.coerceAtLeast(0L)
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            player.release()
        }
    }

    // Continue Watching: save position every 15s while playing and once on
    // exit. `position`/`duration` are the 1s-polled copies above, so the
    // exit save doesn't touch the player after it's released.
    LaunchedEffect(player, media) {
        while (true) {
            delay(15_000)
            if (player.isPlaying) viewModel.saveWatchProgress(media, position, duration)
        }
    }
    DisposableEffect(media) {
        onDispose { viewModel.saveWatchProgress(media, position, duration) }
    }

    // Off air: check the schedule again every minute.
    LaunchedEffect(offAir) {
        while (offAir) {
            delay(60_000)
            startPlayback()
        }
    }

    BackHandler { viewModel.closePlayer() }

    // Channel up/down, number dialing and the surfer all read liveChannels.
    // If its load failed (e.g. a timeout at launch), nothing retried until an
    // app restart - retry whenever the player opens without it.
    LaunchedEffect(Unit) {
        if (viewModel.liveChannels !is LoadState.Success) viewModel.loadLiveChannels()
    }

    val liveChannelCards = (viewModel.liveChannels as? LoadState.Success)?.data?.map { it.toMediaCard() } ?: emptyList()
    var dialBuffer by remember { mutableStateOf("") }

    // Channel the viewer is stepping to with Up/Down/CH+/-, shown on screen
    // and only tuned once they stop pressing. Tuning on every press started
    // a stream per step on slow sources, and the screen could keep showing
    // an earlier channel while the overlay named a later one.
    var pendingSurf by remember(media.id) { mutableStateOf<com.afrovision.tv.data.MediaCard?>(null) }

    fun surfChannel(step: Int) {
        if (liveChannelCards.isEmpty()) return
        val fromId = pendingSurf?.id ?: media.id
        val currentIndex = liveChannelCards.indexOfFirst { it.id == fromId }
        if (currentIndex < 0) return
        val nextIndex = (currentIndex + step + liveChannelCards.size) % liveChannelCards.size
        TvSoundManager.play("chan")
        pendingSurf = liveChannelCards[nextIndex]
    }

    LaunchedEffect(pendingSurf) {
        val target = pendingSurf ?: return@LaunchedEffect
        delay(SURF_CONFIRM_DELAY_MS)
        if (target.id != media.id) viewModel.playChannel(target)
        pendingSurf = null
    }

    LaunchedEffect(dialBuffer) {
        if (dialBuffer.isNotEmpty()) {
            delay(1500)
            val number = dialBuffer.toIntOrNull()
            val match = number?.let { n -> liveChannelCards.firstOrNull { it.channelNumber == n } }
            dialBuffer = ""
            if (match != null) {
                TvSoundManager.play("chan")
                viewModel.playChannel(match)
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .onKeyEvent { event ->
                // Compose delivers both key-down and key-up as separate
                // KeyEvents here; without this filter every action below ran
                // twice per physical button press (the "channel up skips two"
                // bug) since nothing distinguished the two.
                if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                showOverlay = true
                val digit = event.nativeKeyEvent.keyCode.let { code ->
                    if (code in KeyEvent.KEYCODE_0..KeyEvent.KEYCODE_9) code - KeyEvent.KEYCODE_0 else null
                }
                if (media.isLive && digit != null && !showSurfer) {
                    dialBuffer = (dialBuffer + digit).takeLast(4)
                    return@onKeyEvent true
                }
                when (event.nativeKeyEvent.keyCode) {
                    KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_I -> {
                        if (media.isLive) {
                            showSurfer = !showSurfer
                            TvSoundManager.play(if (showSurfer) "surfer" else "close")
                        }
                        true
                    }
                    KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                        if (unavailable && !showSurfer) {
                            retryTune()
                            true
                        } else if (showSurfer || media.isLive) {
                            false
                        } else {
                            if (player.isPlaying) player.pause() else player.play()
                            true
                        }
                    }
                    KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_CHANNEL_UP -> {
                        if (!showSurfer && media.isLive) surfChannel(-1)
                        !showSurfer && media.isLive
                    }
                    KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_CHANNEL_DOWN -> {
                        if (!showSurfer && media.isLive) surfChannel(1)
                        !showSurfer && media.isLive
                    }
                    KeyEvent.KEYCODE_DPAD_RIGHT -> {
                        when {
                            // Surfer already open: let the event fall through
                            // unhandled so Compose's normal focus traversal
                            // moves it to the next card - handling it here
                            // unconditionally (the old bug) closed the surfer
                            // on every Right press instead of browsing it.
                            media.isLive && showSurfer -> false
                            media.isLive -> {
                                showSurfer = true
                                TvSoundManager.play("surfer")
                                true
                            }
                            else -> { player.seekForward(); true }
                        }
                    }
                    KeyEvent.KEYCODE_DPAD_LEFT -> {
                        when {
                            media.isLive && showSurfer -> false
                            media.isLive -> {
                                showSurfer = true
                                TvSoundManager.play("surfer")
                                true
                            }
                            else -> { player.seekBack(); true }
                        }
                    }
                    else -> false
                }
            }
    ) {
        AndroidView(
            factory = {
                PlayerView(it).apply {
                    this.player = player
                    useController = false
                    setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        val overlayAlpha by animateFloatAsState(if (showOverlay) 1f else 0f, label = "overlay")

        Box(modifier = Modifier.fillMaxSize().alpha(overlayAlpha)) {
            // Top strip: LIVE pill + title + duration/position.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 48.dp, vertical = 40.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (media.isLive) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(nocturne.accent)
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(text = "LIVE", color = Color.Black, fontSize = 14.sp)
                    }
                }
                Text(
                    text = media.title,
                    color = Color.White,
                    fontSize = 32.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (!media.isLive) {
                    Text(
                        text = "${formatTime(position)} / ${formatTime(duration)}",
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 18.sp
                    )
                }
            }

            // Bottom controls: progress bar with handle, then transport buttons.
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .padding(horizontal = 48.dp, vertical = 40.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                if (!media.isLive && duration > 0) {
                    val fraction = (position.toFloat() / duration.coerceAtLeast(1L)).coerceIn(0f, 1f)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(Color.White.copy(alpha = 0.25f))
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(fraction)
                                .fillMaxHeight()
                                .background(nocturne.accent)
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(28.dp), verticalAlignment = Alignment.CenterVertically) {
                        if (!media.isLive) {
                            PlayerIconRes(icon = R.drawable.ic_ph_rewind, onClick = { player.seekBack() })
                            PlayerIcon(
                                icon = if (player.isPlaying) null else Icons.Filled.PlayArrow,
                                iconRes = if (player.isPlaying) R.drawable.ic_ph_pause else null,
                                onClick = { if (player.isPlaying) player.pause() else player.play() }
                            )
                            PlayerIconRes(icon = R.drawable.ic_ph_fast_forward, onClick = { player.seekForward() })
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalAlignment = Alignment.CenterVertically) {
                        PlayerIconRes(icon = R.drawable.ic_ph_subtitles, onClick = {})
                        PlayerIconRes(icon = R.drawable.ic_ph_gauge, onClick = {})
                        if (media.isLive) {
                            PlayerIconRes(
                                icon = R.drawable.ic_ph_television_simple,
                                onClick = {
                                    showSurfer = !showSurfer
                                    TvSoundManager.play(if (showSurfer) "surfer" else "close")
                                }
                            )
                        }
                        Text(
                            text = if (media.isLive) "LIVE" else "VOD",
                            color = nocturne.accent,
                            fontSize = 18.sp
                        )
                    }
                }
            }
        }

        if (showSurfer && media.isLive) {
            ChannelSurferOverlay(
                viewModel = viewModel,
                currentMedia = media,
                onDismiss = { showSurfer = false },
                modifier = Modifier.fillMaxSize()
            )
        }

        if (isTuning) {
            TuningOverlay(channelName = media.title, modifier = Modifier.fillMaxSize())
        } else if (unavailable) {
            Column(
                modifier = Modifier.align(Alignment.Center),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "${media.title} isn't available right now",
                    color = Color.White,
                    fontSize = 26.sp
                )
                Text(
                    text = if (media.isLive) "Press OK to try again, or change channel" else "Press OK to try again",
                    color = nocturne.textMuted,
                    fontSize = 18.sp
                )
            }
        } else if (offAir) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    text = "Nothing is airing on ${media.title} right now",
                    color = nocturne.textMuted,
                    fontSize = 24.sp
                )
            }
        }

        pendingSurf?.let { target ->
            Row(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 40.dp, end = 48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFF0A0B12).copy(alpha = 0.85f))
                    .border(2.dp, nocturne.gold, RoundedCornerShape(12.dp))
                    .padding(horizontal = 24.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = target.channelNumber?.toString()?.padStart(2, '0') ?: "--",
                    color = nocturne.goldLight,
                    fontSize = 30.sp
                )
                Text(
                    text = target.title,
                    color = Color.White,
                    fontSize = 24.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        if (dialBuffer.isNotEmpty()) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 40.dp, end = 48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFF0A0B12).copy(alpha = 0.85f))
                    .border(2.dp, nocturne.gold, RoundedCornerShape(12.dp))
                    .padding(horizontal = 28.dp, vertical = 16.dp)
            ) {
                Text(text = dialBuffer, color = nocturne.goldLight, fontSize = 32.sp)
            }
        }
    }
}

@Composable
private fun TuningOverlay(channelName: String, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    val infiniteTransition = rememberInfiniteTransition(label = "tuning")
    val barFraction by infiniteTransition.animateFloat(
        initialValue = 0.1f,
        targetValue = 0.9f,
        animationSpec = infiniteRepeatable(tween(1400), RepeatMode.Reverse),
        label = "tuningBar"
    )

    // Pulsing broadcast-signal ring (expands and fades, loops every 1.6s)
    // plus a slower rotating dashed ring - the animated broadcast signal
    // called for around the tuning icon.
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.72f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(tween(1600, easing = FastOutSlowInEasing), RepeatMode.Restart),
        label = "tuningPulseScale"
    )
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.65f,
        targetValue = 0.0f,
        animationSpec = infiniteRepeatable(tween(1600, easing = FastOutSlowInEasing), RepeatMode.Restart),
        label = "tuningPulseAlpha"
    )
    val dashRotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(6000, easing = LinearEasing), RepeatMode.Restart),
        label = "tuningDashRotation"
    )

    Box(
        modifier = modifier.background(Color(0xFF0A0B12)),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(modifier = Modifier.size(180.dp), contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(180.dp)
                        .scale(pulseScale)
                        .alpha(pulseAlpha)
                        .clip(CircleShape)
                        .border(1.dp, nocturne.accent, CircleShape)
                )
                androidx.compose.foundation.Canvas(
                    modifier = Modifier
                        .size(152.dp)
                        .graphicsLayer { rotationZ = dashRotation }
                ) {
                    drawCircle(
                        color = nocturne.accent700,
                        radius = size.minDimension / 2f,
                        style = androidx.compose.ui.graphics.drawscope.Stroke(
                            width = 1.dp.toPx(),
                            pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(8f, 10f))
                        )
                    )
                }
                Box(
                    modifier = Modifier
                        .size(150.dp)
                        .clip(CircleShape)
                        .background(nocturne.accent.copy(alpha = 0.06f))
                )
                Icon(
                    painter = painterResource(R.drawable.ic_ph_broadcast_fill),
                    contentDescription = null,
                    tint = nocturne.accentLight,
                    modifier = Modifier.size(56.dp)
                )
            }
            Text(
                text = "TUNING IN",
                color = nocturne.accentLight,
                fontSize = 17.sp,
                modifier = Modifier.padding(top = 30.dp)
            )
            Text(
                text = channelName,
                color = Color.White,
                fontSize = 46.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 12.dp)
            )
            Text(
                text = "Opening the stream…",
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 18.sp,
                modifier = Modifier.padding(top = 10.dp)
            )
            Box(
                modifier = Modifier
                    .padding(top = 30.dp)
                    .width(400.dp)
                    .height(3.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(Color.White.copy(alpha = 0.14f))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(barFraction)
                        .fillMaxHeight()
                        .background(nocturne.accent)
                )
            }
        }
    }
}

private val SURFER_CARD_WIDTH = 190.dp
private val SURFER_CARD_HEIGHT = 268.dp

// Left detail panel for the focused channel, over a scrim dark enough on the
// left (for the panel) and at the bottom (for the card row) to stay legible
// against a bright scene, while the rest of the live picture keeps showing
// through. A horizontal row of vertical channel cards sits at the bottom;
// the currently-playing channel starts centered and focused, and the
// focused card rises slightly above its neighbours. Opened with D-pad
// Left/Right (or the Channels button / "i"/Menu key) while a live channel is
// playing; Left/Right while already open browses the row instead of closing it.
@Composable
private fun ChannelSurferOverlay(viewModel: TvViewModel, currentMedia: PlayerMedia, onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    val channels = viewModel.liveChannels
    val items = (channels as? LoadState.Success)?.data?.map { it.toMediaCard() } ?: emptyList()
    val listState = rememberLazyListState()
    // Opened with no channels loaded (failed earlier): try again, rather
    // than showing an empty surfer.
    LaunchedEffect(Unit) {
        if (channels is LoadState.Error) viewModel.loadLiveChannels()
    }
    val density = androidx.compose.ui.platform.LocalDensity.current
    val scope = rememberCoroutineScope()

    val startIndex = remember(items) { items.indexOfFirst { it.id == currentMedia.id }.coerceAtLeast(0) }
    // The row never begins or ends - it wraps around like a dial. We fake
    // that with a very large virtual index space (a big multiple of the
    // real channel count) and map every virtual position back onto the
    // actual list with modulo, so scrolling past the last channel simply
    // continues into the first one again, and vice versa.
    val virtualMid = remember(items) { if (items.isEmpty()) 0 else 50_000 * items.size }
    fun actualIndexOf(virtual: Int): Int =
        if (items.isEmpty()) 0 else ((virtual % items.size) + items.size) % items.size
    var centeredIndex by remember(items) { mutableStateOf(virtualMid + startIndex) }
    val focusedChannel = items.getOrNull(actualIndexOf(centeredIndex))

    fun centerOn(virtualIndex: Int) {
        scope.launch {
            val viewportPx = listState.layoutInfo.viewportSize.width
            if (viewportPx <= 0) return@launch
            val cardPx = with(density) { SURFER_CARD_WIDTH.toPx() }
            val offset = -((viewportPx - cardPx) / 2f).toInt()
            listState.animateScrollToItem(virtualIndex, scrollOffset = offset)
        }
    }

    BackHandler(onBack = onDismiss)

    LaunchedEffect(items) {
        if (items.isEmpty()) return@LaunchedEffect
        // Wait one layout pass so viewportSize is known before centering.
        kotlinx.coroutines.delay(16)
        listState.scrollToItem(virtualMid + startIndex)
        centerOn(virtualMid + startIndex)
    }

    Box(
        modifier = modifier.fillMaxSize()
    ) {
        // One backdrop for the whole surfer. It used to be two separate
        // scrims (left panel 72% tall, bottom strip 42% tall) whose edges
        // showed where they met. Both gradients now span the full screen
        // and are drawn together, so the left and bottom darkening blend
        // into a single L-shaped shade with no seams.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .drawBehind {
                    drawRect(
                        Brush.horizontalGradient(
                            0f to Color.Black.copy(alpha = 0.9f),
                            0.28f to Color.Black.copy(alpha = 0.72f),
                            0.5f to Color.Black.copy(alpha = 0.25f),
                            0.68f to Color.Transparent
                        )
                    )
                    drawRect(
                        Brush.verticalGradient(
                            0.45f to Color.Transparent,
                            0.7f to Color.Black.copy(alpha = 0.6f),
                            1f to Color.Black.copy(alpha = 0.92f)
                        )
                    )
                }
        )

        // Details for whichever card is centred.
        focusedChannel?.let { channel ->
            Column(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .width(600.dp)
                    .padding(start = 64.dp, top = 72.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color.White.copy(alpha = 0.08f))
                            .border(1.dp, Color.White.copy(alpha = 0.14f), RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        val logo = rememberCacheableImageRequest(channel.imageUrl)
                        if (logo != null) {
                            AsyncImage(
                                model = logo,
                                contentDescription = null,
                                contentScale = ContentScale.Fit,
                                modifier = Modifier.fillMaxSize().padding(8.dp)
                            )
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(nocturne.gold.copy(alpha = 0.16f))
                                    .border(1.dp, nocturne.gold.copy(alpha = 0.6f), RoundedCornerShape(6.dp))
                                    .padding(horizontal = 10.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    text = "CH " + (channel.channelNumber?.toString()?.padStart(2, '0') ?: "--"),
                                    color = nocturne.goldLight,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    letterSpacing = 0.08.em
                                )
                            }
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color(0xFFE2543F).copy(alpha = 0.18f))
                                    .padding(horizontal = 10.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Box(modifier = Modifier.size(7.dp).clip(RoundedCornerShape(50)).background(Color(0xFFE2543F)))
                                Text(text = "LIVE", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.1.em)
                            }
                            if (channel.id == currentMedia.id) {
                                Text(text = "Now watching", color = Color.White.copy(alpha = 0.55f), fontSize = 14.sp)
                            }
                        }
                        Text(
                            text = channel.title,
                            color = Color.White,
                            fontSize = 36.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                if (channel.subtitle.isNotBlank()) {
                    Text(
                        text = channel.subtitle,
                        color = Color.White.copy(alpha = 0.74f),
                        fontSize = 17.sp,
                        lineHeight = 25.sp,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Box(
                    modifier = Modifier
                        .padding(top = 4.dp)
                        .width(56.dp)
                        .height(2.dp)
                        .background(nocturne.gold.copy(alpha = 0.7f))
                )

                Row(horizontalArrangement = Arrangement.spacedBy(22.dp), verticalAlignment = Alignment.CenterVertically) {
                    SurferKeyHint(key = "OK", label = "Watch")
                    SurferKeyHint(key = "\u25C0 \u25B6", label = "Browse")
                    SurferKeyHint(key = "BACK", label = "Close")
                }
            }
        }

        // Horizontal row of vertical channel cards fixed at the bottom. The
        // list is a huge virtual index space wrapping around the real
        // channels (see actualIndexOf above), so it has no beginning or end -
        // scrolling past the last channel continues into the first one.
        if (items.isNotEmpty()) {
            LazyRow(
                state = listState,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .padding(bottom = 44.dp),
                horizontalArrangement = Arrangement.spacedBy(18.dp)
            ) {
                items(count = virtualMid * 2, key = { it }) { index ->
                    val channel = items[actualIndexOf(index)]
                    val distance = kotlin.math.abs(index - centeredIndex)
                    SurferChannelCard(
                        channel = channel,
                        isPlaying = channel.id == currentMedia.id,
                        isCentered = index == centeredIndex,
                        distanceFromCenter = distance,
                        requestInitialFocus = index == virtualMid + startIndex,
                        onFocused = { centeredIndex = index; centerOn(index) },
                        onClick = {
                            TvSoundManager.play("chan")
                            onDismiss()
                            viewModel.playChannel(channel)
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun SurferChannelCard(
    channel: com.afrovision.tv.data.MediaCard,
    isPlaying: Boolean,
    isCentered: Boolean,
    distanceFromCenter: Int,
    requestInitialFocus: Boolean,
    onFocused: () -> Unit,
    onClick: () -> Unit
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val focusRequester = remember { androidx.compose.ui.focus.FocusRequester() }
    LaunchedEffect(focused) {
        if (focused) {
            TvSoundManager.play("move")
            onFocused()
        }
    }
    val riseOffset by animateDpAsState(if (isCentered) (-18).dp else 0.dp, label = "surferRise")
    // Only the focused card sits at full size; neighbours shrink and fade
    // the further they are from center, so the row reads as a radial focal
    // point instead of a flat strip of equal cards.
    val scale by animateFloatAsState(
        when (distanceFromCenter) {
            0 -> 1f
            1 -> 0.84f
            2 -> 0.7f
            3 -> 0.6f
            else -> 0.55f
        },
        label = "surferScale"
    )
    val cardAlpha by animateFloatAsState(
        when (distanceFromCenter) {
            0 -> 1f
            1 -> 0.85f
            2 -> 0.6f
            3 -> 0.4f
            else -> 0.28f
        },
        label = "surferAlpha"
    )

    Box(
        modifier = Modifier
            .width(SURFER_CARD_WIDTH)
            .height(SURFER_CARD_HEIGHT)
            .offset(y = riseOffset)
            .graphicsLayer { scaleX = scale; scaleY = scale; alpha = cardAlpha }
            .clip(RoundedCornerShape(14.dp))
            .background(nocturne.surface)
            .border(
                if (isCentered) 2.dp else 1.dp,
                if (isCentered) nocturne.gold else if (isPlaying) nocturne.accent700 else nocturne.borderCard,
                RoundedCornerShape(14.dp)
            )
            .autoRequestFocus(focusRequester, enabled = requestInitialFocus)
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
    ) {
        if (!channel.imageUrl.isNullOrBlank()) {
            AsyncImage(
                model = rememberCacheableImageRequest(channel.imageUrl),
                contentDescription = channel.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Brush.linearGradient(listOf(nocturne.surfaceRaised, nocturne.surface, nocturne.background))),
                contentAlignment = Alignment.Center
            ) {
                Text(text = channel.title.take(2).uppercase(), color = Color.White.copy(alpha = 0.12f), fontSize = 36.sp)
            }
        }

        if (isPlaying) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(10.dp)
                    .size(9.dp)
                    .clip(RoundedCornerShape(50))
                    .background(nocturne.gold)
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomStart)
                .background(
                    Brush.verticalGradient(
                        0f to Color.Transparent,
                        0.4f to Color.Black.copy(alpha = 0.55f),
                        1f to Color.Black.copy(alpha = 0.92f)
                    )
                )
                .padding(12.dp)
        ) {
            Text(
                text = buildString {
                    channel.channelNumber?.let { append(it.toString().padStart(2, '0')); append(" · ") }
                    append(channel.title)
                },
                color = if (isCentered) nocturne.goldLight else Color.White,
                fontSize = 15.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (isPlaying) {
                Text(text = "Now playing", color = nocturne.accentLight, fontSize = 13.sp, modifier = Modifier.padding(top = 3.dp))
            }
        }
    }
}

@Composable
private fun PlayerIcon(
    icon: androidx.compose.ui.graphics.vector.ImageVector?,
    iconRes: Int? = null,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(64.dp)
            .clip(RoundedCornerShape(50))
            .background(Color(0xFF0A0B12).copy(alpha = 0.55f))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (iconRes != null) {
            Icon(painter = painterResource(iconRes), contentDescription = null, tint = Color.White, modifier = Modifier.size(32.dp))
        } else if (icon != null) {
            Icon(imageVector = icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(36.dp))
        }
    }
}

@Composable
private fun PlayerIconRes(icon: Int, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(RoundedCornerShape(50))
            .background(Color(0xFF0A0B12).copy(alpha = 0.55f))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(painter = painterResource(icon), contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
    }
}

private fun formatTime(ms: Long): String {
    val total = ms / 1000
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
}

@Composable
private fun TrailerPlayer(viewModel: TvViewModel, media: PlayerMedia) {
    val nocturne = LocalNocturne.current
    val url = media.externalUrl ?: media.streamUrl ?: return run { viewModel.closePlayer() }
    val html = remember(url) { buildEmbedHtml(url) }

    BackHandler { viewModel.closePlayer() }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.mediaPlaybackRequiresUserGesture = false
                    settings.userAgentString =
                        "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 " +
                        "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
                    settings.domStorageEnabled = true
                    webViewClient = WebViewClient()
                    loadDataWithBaseURL(
                        "https://www.youtube-nocookie.com",
                        html,
                        "text/html",
                        "UTF-8",
                        null
                    )
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(nocturne.background.copy(alpha = 0.45f))
                .padding(28.dp)
        ) {
            Text(
                text = media.title,
                color = Color.White,
                fontSize = 24.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

private fun isYouTubeUrl(url: String?): Boolean {
    val lower = url?.lowercase() ?: return false
    return lower.contains("youtube.com") ||
        lower.contains("youtube-nocookie.com") ||
        lower.contains("youtu.be")
}

private fun extractYouTubeVideoId(url: String): String? {
    return try {
        val parsed = Uri.parse(url)
        val host = parsed.host?.lowercase() ?: ""
        val segments = parsed.pathSegments

        if (host.contains("youtu.be") && segments.isNotEmpty()) {
            segments.first()
        } else {
            parsed.getQueryParameter("v")
                ?: segments.indexOf("embed").takeIf { it >= 0 && it + 1 < segments.size }
                    ?.let { segments[it + 1] }
                ?: segments.takeIf { it.size >= 2 && (it[0] == "live" || it[0] == "shorts") }
                    ?.let { it[1] }
        }
    } catch (_: Exception) {
        null
    }
}

private fun buildNocookieEmbedUrl(videoId: String): String {
    return Uri.Builder()
        .scheme("https")
        .authority("www.youtube-nocookie.com")
        .path("/embed/$videoId")
        .appendQueryParameter("autoplay", "1")
        .appendQueryParameter("controls", "1")
        .appendQueryParameter("mute", "0")
        .appendQueryParameter("playsinline", "1")
        .appendQueryParameter("enablejsapi", "1")
        .appendQueryParameter("rel", "0")
        .appendQueryParameter("iv_load_policy", "3")
        .appendQueryParameter("modestbranding", "1")
        .appendQueryParameter("origin", "https://www.youtube-nocookie.com")
        .build()
        .toString()
}

private fun buildEmbedHtml(url: String): String {
    val videoId = extractYouTubeVideoId(url)
    val src = if (!videoId.isNullOrBlank()) {
        buildNocookieEmbedUrl(videoId)
    } else if (isYouTubeUrl(url)) {
        url
    } else {
        url
    }

    return """<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
        iframe { width: 100%; height: 100%; border: 0; }
    </style>
</head>
<body>
    <iframe src="$src" allowfullscreen allow="autoplay; encrypted-media; fullscreen; picture-in-picture"></iframe>
</body>
</html>"""
}

/** How long Up/Down must be idle before the stepped-to channel is tuned. */
private const val SURF_CONFIRM_DELAY_MS = 700L

/** Failed attempts before a stream that never started is shown as unavailable. */
private const val MAX_TUNE_FAILURES = 3

/** Longest an initial tune may show no picture before it's shown as unavailable. */
private const val TUNE_TIMEOUT_MS = 45_000L

@Composable
private fun SurferKeyHint(key: String, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(5.dp))
                .border(1.dp, Color.White.copy(alpha = 0.35f), RoundedCornerShape(5.dp))
                .padding(horizontal = 8.dp, vertical = 2.dp)
        ) {
            Text(text = key, color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(text = label, color = Color.White.copy(alpha = 0.6f), fontSize = 14.sp)
    }
}
