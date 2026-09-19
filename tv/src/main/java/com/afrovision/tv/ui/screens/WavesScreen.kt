package com.afrovision.tv.ui.screens

import com.afrovision.tv.ui.components.rememberCacheableImageRequest

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.focusable
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.afrovision.tv.R
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.MediaCard
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.api.model.Wave
import com.afrovision.tv.data.api.model.WavePulseMoment
import com.afrovision.tv.data.toMediaCard
import com.afrovision.tv.data.toPlayerMedia
import com.afrovision.tv.player.PlayerFactory
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private val NOW_PLAYING_ASPECT = 180f / 320f
private val UP_NEXT_WIDTH = 150.dp
private val UP_NEXT_HEIGHT = 267.dp
private val ACTION_BAR_HEIGHT = 108.dp
private val COMPACT_CARD_WIDTH = 160.dp
private val COMPACT_CARD_HEIGHT = 90.dp
private val PULSE_TAP_COOLDOWN_MS = 350L
private val PLAYBACK_SPEEDS = listOf(1f, 1.25f, 1.5f, 2f)

@Composable
fun WavesScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    var selectedFilter by remember { mutableStateOf("Public") }
    val waves = if (selectedFilter == "Public") viewModel.waves else viewModel.favWaves

    // Not just Loading: loadAll() fires loadWaves() eagerly at app startup,
    // possibly before the network/auth token is fully ready, so the very
    // first attempt can land as a stuck LoadState.Error that this screen's
    // own mount effect would otherwise never retry - only a manual Retry tap
    // would. Landing on the screen should always attempt a fresh load
    // unless it already has real data.
    LaunchedEffect(Unit) { if (viewModel.waves !is LoadState.Success) viewModel.loadWaves() }
    LaunchedEffect(selectedFilter) {
        if (selectedFilter == "Fav" && viewModel.favWaves !is LoadState.Success) viewModel.loadFavWaves()
    }
    LaunchedEffect(Unit) { if (viewModel.marqueeTopics !is LoadState.Success) viewModel.loadMarqueeTopics() }

    val rawWaves = when (waves) {
        is LoadState.Success -> waves.data
        else -> emptyList()
    }

    val recentChannels = (viewModel.homeState.recentChannels as? LoadState.Success)?.data.orEmpty()
    val continueWatching = (viewModel.homeState.continueWatching as? LoadState.Success)?.data.orEmpty()
    val marqueeTopics = (viewModel.marqueeTopics as? LoadState.Success)?.data.orEmpty()

    Column(modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)) {
        Column(modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 40.dp)) {
            Text(text = "Waves", color = nocturne.text, fontSize = 44.sp)
            Text(
                text = "Vertical shorts from creators across the continent",
                color = nocturne.textHint,
                fontSize = 18.sp,
                modifier = Modifier.padding(top = 4.dp)
            )
            // Matches mobile exactly: a two-way "Public"/"Fav" segmented
            // toggle (wave_screen.dart's _buildFeedModeSwitch), not a row of
            // category chips - AfroVision Waves only ever had these two.
            // The marquee (same ticker endpoint mobile/website use) sits on
            // this same line, filling the rest of the width to its right -
            // IntrinsicSize.Min makes the marquee's height match the
            // Public/Fav pill's actual rendered height exactly, with no
            // hardcoded number to keep in sync.
            Row(
                modifier = Modifier
                    .padding(top = 16.dp)
                    .fillMaxWidth()
                    .height(IntrinsicSize.Min),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(999.dp))
                        .background(nocturne.surface)
                        .padding(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    listOf("Public", "Fav").forEach { mode ->
                        FeedModeTab(
                            label = mode,
                            selected = selectedFilter == mode,
                            onClick = { selectedFilter = mode }
                        )
                    }
                }
                if (marqueeTopics.isNotEmpty()) {
                    WaveMarquee(
                        topics = marqueeTopics,
                        modifier = Modifier
                            .padding(start = 24.dp)
                            .fillMaxHeight()
                            .weight(1f)
                    )
                }
            }
        }

        if (rawWaves.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                when (waves) {
                    is LoadState.Error -> com.afrovision.tv.ui.components.ConnectionErrorCard(
                        message = waves.message,
                        onRetry = { if (selectedFilter == "Public") viewModel.loadWaves() else viewModel.loadFavWaves() }
                    )
                    is LoadState.Success -> Text(
                        text = if (selectedFilter == "Fav") "No saved waves yet" else "No waves yet",
                        color = nocturne.textFaint,
                        fontSize = 22.sp
                    )
                    LoadState.Loading -> Text(text = "Loading waves…", color = nocturne.textFaint, fontSize = 22.sp)
                }
            }
        } else {
            WaveCarousel(
                viewModel = viewModel,
                rawWaves = rawWaves,
                paginated = selectedFilter == "Public",
                recentChannels = recentChannels,
                continueWatching = continueWatching,
                modifier = Modifier.weight(1f).padding(top = 18.dp)
            )
        }
    }
}

@Composable
private fun CompactRail(
    title: String,
    items: List<MediaCard>,
    onClick: (MediaCard) -> Unit,
    modifier: Modifier = Modifier,
    autoSlide: Boolean = false
) {
    val nocturne = LocalNocturne.current
    val listState = rememberLazyListState()

    // Gentle continuous auto-slide, like a marquee - purely a cosmetic
    // scroll of the list position, not a focus move, so it never steals or
    // fights D-pad focus elsewhere on the screen.
    if (autoSlide && items.size > 1) {
        LaunchedEffect(items) {
            while (isActive) {
                delay(2600)
                val next = (listState.firstVisibleItemIndex + 1) % items.size
                listState.animateScrollToItem(next)
            }
        }
    }

    Column(modifier = modifier) {
        Text(
            text = title,
            color = nocturne.text,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 10.dp)
        )
        LazyRow(
            state = listState,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            itemsIndexed(items, key = { _, item -> item.id }) { _, item ->
                CompactCard(item = item, onClick = { onClick(item) })
            }
        }
    }
}

@Composable
private fun CompactPlaceholderRow(note: String) {
    val nocturne = LocalNocturne.current
    Column {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            repeat(4) {
                Box(
                    modifier = Modifier
                        .width(COMPACT_CARD_WIDTH)
                        .height(COMPACT_CARD_HEIGHT)
                        .clip(RoundedCornerShape(10.dp))
                        .background(nocturne.surfaceRaised.copy(alpha = 0.5f))
                        .border(1.dp, nocturne.borderCard.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                )
            }
        }
        Text(
            text = note,
            color = nocturne.textFaint,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 10.dp)
        )
    }
}

private data class KeyMapEntry(val iconRes: Int, val title: String, val description: String)

private val WAVE_KEY_MAP_ENTRIES = listOf(
    KeyMapEntry(R.drawable.ic_ph_caret_left, "Back", "Go back to the previous wave"),
    KeyMapEntry(R.drawable.ic_ph_pause, "Pause", "Pause the wave that's playing - press again to resume"),
    KeyMapEntry(R.drawable.ic_ph_caret_right, "Next", "Skip ahead to the next wave"),
    KeyMapEntry(R.drawable.ic_ph_repeat, "Autoplay", "Automatically moves on to the next wave when one finishes"),
    KeyMapEntry(R.drawable.ic_ph_lightning_fill, "Pulse", "Mark your favorite moment on this wave - tap as many times as you like"),
    KeyMapEntry(R.drawable.ic_ph_gauge, "Speed", "Change how fast this wave plays"),
    KeyMapEntry(R.drawable.ic_ph_bookmark_simple, "Save", "Bookmark this wave to find it again later"),
    KeyMapEntry(R.drawable.ic_ph_arrows_out_cardinal, "Fullscreen", "Open this wave in the full-screen player")
)

// A minimal legend for the row of icons below - Waves is the first social-
// feed-style screen on this TV app, and icon-only controls that are obvious
// on a phone (where you can tap to find out) aren't obvious on a remote.
//
// Listing all five vertically the first time round squeezed the "Up next"
// rail beneath it down to almost nothing - this space is meant to be
// leftover room, not a fixed allocation. Showing one entry at a time in a
// small, fixed-height ticker (5s each, sliding up like a vertical marquee)
// gets the same information across without competing with the rail for
// height.
@OptIn(ExperimentalAnimationApi::class)
@Composable
private fun WaveKeyMapCard(modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    var index by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) {
        while (isActive) {
            delay(5000)
            index = (index + 1) % WAVE_KEY_MAP_ENTRIES.size
        }
    }
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.Black.copy(alpha = 0.45f))
            .padding(horizontal = 18.dp, vertical = 14.dp)
    ) {
        Text(
            text = "What the icons below do",
            color = nocturne.text,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 10.dp)
        )
        AnimatedContent(
            targetState = index,
            transitionSpec = {
                (slideInVertically(tween(400)) { height -> height } + fadeIn(tween(400))) togetherWith
                    (slideOutVertically(tween(400)) { height -> -height } + fadeOut(tween(400)))
            },
            label = "waveKeyMapTicker"
        ) { i ->
            val entry = WAVE_KEY_MAP_ENTRIES[i]
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    painter = painterResource(entry.iconRes),
                    contentDescription = entry.title,
                    tint = nocturne.gold,
                    modifier = Modifier.size(18.dp)
                )
                Column(modifier = Modifier.padding(start = 12.dp)) {
                    Text(text = entry.title, color = nocturne.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text(text = entry.description, color = nocturne.textFaint, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun CompactCard(item: MediaCard, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }

    Box(
        modifier = Modifier
            .width(COMPACT_CARD_WIDTH)
            .height(COMPACT_CARD_HEIGHT)
            .clip(RoundedCornerShape(10.dp))
            .background(nocturne.surface)
            .border(if (focused) 2.dp else 1.dp, if (focused) nocturne.gold else nocturne.borderCard, RoundedCornerShape(10.dp))
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
    ) {
        if (!item.imageUrl.isNullOrBlank()) {
            AsyncImage(
                model = rememberCacheableImageRequest(item.imageUrl),
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Brush.linearGradient(listOf(nocturne.surface, nocturne.surfaceRaised, nocturne.background)))
            )
        }
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomStart)
                .background(Brush.verticalGradient(0f to Color.Transparent, 1f to nocturne.background.copy(alpha = 0.92f)))
                .padding(horizontal = 8.dp, vertical = 6.dp)
        ) {
            Text(text = item.title, color = nocturne.text, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun FeedModeTab(label: String, selected: Boolean, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) nocturne.accent900 else Color.Transparent)
            .border(
                if (focused) 2.dp else if (selected) 1.dp else 0.dp,
                if (focused) nocturne.gold else nocturne.accent700,
                RoundedCornerShape(999.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 26.dp, vertical = 11.dp)
    ) {
        Text(
            text = label,
            color = if (focused) nocturne.goldLight else if (selected) nocturne.accentLight else nocturne.textMuted,
            fontSize = 18.sp
        )
    }
}

// Same public ticker feed the mobile app and website use (GET /home/marquee,
// via TvViewModel.loadMarqueeTopics) for announcements/updates - a dark blue
// bar to the right of the Public/Fav pills, height matched to them by the
// caller's IntrinsicSize.Min row rather than a hardcoded dp value.
@Composable
private fun WaveMarquee(topics: List<String>, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    val text = remember(topics) { topics.joinToString("      •      ") }
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFF060A22))
            .border(1.dp, nocturne.gold.copy(alpha = 0.25f), RoundedCornerShape(14.dp))
            .padding(horizontal = 20.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Text(
            text = text,
            color = nocturne.text,
            fontSize = 20.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier.basicMarquee(iterations = Int.MAX_VALUE)
        )
    }
}

private class WaveSlot(val player: ExoPlayer) {
    var waveId by mutableStateOf<String?>(null)
    var isReady by mutableStateOf(false)
    var errorRetries = 0
}

// Muting the standby player (volume = 0) still leaves it actively decoding
// AND outputting audio through its own AudioTrack/session - just silently.
// Two concurrent audio sessions, even with one at zero volume, is a real
// source of the kind of periodic glitching reported on real TV/soundbar
// hardware (the OS audio mixer is still juggling two live streams). The
// standby slot never needs audio at all until it's promoted - disabling its
// audio track entirely (not just muting it) means only one player is ever
// actually producing audio output at a time.
private fun WaveSlot.setAudioEnabled(enabled: Boolean) {
    player.trackSelectionParameters = player.trackSelectionParameters
        .buildUpon()
        .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, !enabled)
        .build()
}

// "Now playing" is a fixed, permanent panel on the left - it does not move
// or recenter. "Up next" is a plain forward-scrolling row of whatever comes
// after it; focusing (or selecting) an up-next card promotes it straight to
// "now playing". A real library can be 60+ waves, so this pages in more
// (loadMoreWaves) as the user approaches the end of what's loaded, and only
// wraps back to the start once the server confirms nothing is left to page
// in.
//
// Exactly two ExoPlayer instances ever exist (slotA/slotB): whichever wave
// is centered is "active" (visible, playing), the next one in line is
// "standby" (prepared muted/paused ahead of time). The PlayerView itself is
// mounted exactly once and stays mounted for the panel's entire lifetime -
// only its bound `.player` and visibility change - rather than being torn
// down and recreated on every card change, which is what caused both the
// blank-screen flash and the freeze-after-first-play.
@Composable
private fun WaveCarousel(
    viewModel: TvViewModel,
    rawWaves: List<Wave>,
    paginated: Boolean,
    recentChannels: List<MediaCard>,
    continueWatching: List<MediaCard>,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val items = remember(rawWaves) { rawWaves.map { it.toMediaCard() } }
    var centeredIndex by remember(rawWaves.size) { mutableStateOf(0) }
    var autoplayEnabled by remember { mutableStateOf(false) }
    var playbackSpeed by remember { mutableStateOf(1f) }
    val hasMore = paginated && viewModel.wavesNextCursor != null

    val centeredWave = rawWaves.getOrNull(centeredIndex)
    val centeredItem = items.getOrNull(centeredIndex)

    fun goToStart() { centeredIndex = 0 }

    // The D-pad itself no longer moves between waves (Left/Up escape to the
    // nav rail like everywhere else, and the up-next rail only ever goes
    // forward), so going back to a previous wave needs its own explicit,
    // intentional control - the action bar's Back button.
    fun goPrev() { if (centeredIndex > 0) centeredIndex -= 1 }

    fun goNext() {
        when {
            centeredIndex < items.lastIndex -> centeredIndex += 1
            !hasMore -> goToStart()
            // else: at the loaded edge but more pages exist - the near-end
            // effect below is already fetching them; nothing to do yet.
        }
    }

    // Fetch more once within 5 of the end of what's currently loaded -
    // mirrors a typical infinite-scroll threshold so the next page is
    // usually ready before the user actually reaches it.
    LaunchedEffect(centeredIndex, items.size, hasMore) {
        if (hasMore && centeredIndex >= items.size - 5) viewModel.loadMoreWaves()
    }

    LaunchedEffect(centeredWave?.id) {
        centeredWave?.id?.let {
            viewModel.trackWaveView(it)
            viewModel.loadPulseMoments(it)
        }
    }
    val nextWave = rawWaves.getOrNull(centeredIndex + 1)
    LaunchedEffect(nextWave?.id) {
        nextWave?.id?.let { viewModel.loadPulseMoments(it) }
    }

    val slotA = remember { WaveSlot(PlayerFactory.create(context)) }
    val slotB = remember { WaveSlot(PlayerFactory.create(context)) }
    var activeIsA by remember { mutableStateOf(true) }
    val active = if (activeIsA) slotA else slotB
    val standby = if (activeIsA) slotB else slotA
    // The listeners below are only ever set up once (DisposableEffect keyed
    // on the slot objects, which never change identity) - without routing
    // through rememberUpdatedState, they'd keep checking "is this slot
    // active" against whatever activeIsA was at that first setup, silently
    // going stale the moment roles swap on the very first handoff.
    val activeIsAState = rememberUpdatedState(activeIsA)
    val currentOnAdvance = rememberUpdatedState({ if (autoplayEnabled) goNext() })
    // A stuck/broken wave (network error, unplayable stream) should never
    // just sit there forever, whether or not Autoplay is on - Autoplay only
    // gates advancing after a wave finishes normally.
    val currentGoNext = rememberUpdatedState({ goNext() })

    DisposableEffect(slotA, slotB) {
        val listeners = listOf(slotA, slotB).map { slot ->
            val isThisSlotActive = { slot === (if (activeIsAState.value) slotA else slotB) }
            val listener = object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) slot.isReady = true
                    if (playbackState == Player.STATE_ENDED && isThisSlotActive()) currentOnAdvance.value()
                }

                override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) {
                    if (reason == Player.DISCONTINUITY_REASON_AUTO_TRANSITION && isThisSlotActive()) {
                        slot.waveId?.let { viewModel.trackWaveView(it) }
                    }
                }

                // Previously unhandled entirely - a network hiccup or
                // unplayable stream left the player frozen on that wave
                // indefinitely with nothing retrying or moving on, which is
                // exactly what "stuck there" on a weak connection looks
                // like. Retry twice (covers a transient blip), then skip
                // the wave instead of leaving the screen dead.
                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    if (!isThisSlotActive()) return
                    if (slot.errorRetries < 2) {
                        slot.errorRetries++
                        slot.player.prepare()
                    } else {
                        currentGoNext.value()
                    }
                }
            }
            slot.player.addListener(listener)
            slot.player.volume = 0f
            slot to listener
        }
        onDispose {
            listeners.forEach { (slot, listener) -> slot.player.removeListener(listener) }
            slotA.player.release()
            slotB.player.release()
        }
    }

    LaunchedEffect(viewModel.settings.defaultQuality) {
        PlayerFactory.applyQualityCap(slotA.player, context, viewModel.settings.defaultQuality)
        PlayerFactory.applyQualityCap(slotB.player, context, viewModel.settings.defaultQuality)
    }
    LaunchedEffect(playbackSpeed) {
        slotA.player.setPlaybackSpeed(playbackSpeed)
        slotB.player.setPlaybackSpeed(playbackSpeed)
    }
    LaunchedEffect(autoplayEnabled) {
        val mode = if (autoplayEnabled) Player.REPEAT_MODE_OFF else Player.REPEAT_MODE_ONE
        slotA.player.repeatMode = mode
        slotB.player.repeatMode = mode
    }

    // The core handoff: promote an already-prepared standby instead of
    // cold-starting whenever possible, THEN preload the wave after next
    // into whatever is standby afterward - both steps live in one effect
    // now. They used to be two separate LaunchedEffects that each
    // independently recomputed `active`/`standby` from `activeIsA` at the
    // top of this composable - both fire in the same recomposition when
    // centeredWave AND nextWave change together (which is every normal
    // advance), and the second one's `standby` was a STALE snapshot from
    // before the first one's promotion, pointing at the exact same physical
    // player the first effect had just promoted to active. It would then
    // immediately mute it, pause it, and swap its media item out for the
    // wave after next - silencing audio, desyncing the EKG (still showing
    // the promoted wave's duration/moments against now-different playing
    // content), and effectively skipping a wave, all in the same instant.
    LaunchedEffect(centeredWave?.id, nextWave?.id) {
        val wave = centeredWave ?: return@LaunchedEffect
        val newStandby: WaveSlot
        when {
            standby.waveId == wave.id -> {
                standby.setAudioEnabled(true)
                standby.player.volume = 1f
                standby.player.playWhenReady = true
                active.player.playWhenReady = false
                active.player.volume = 0f
                active.setAudioEnabled(false)
                newStandby = active
                activeIsA = !activeIsA
            }
            active.waveId != wave.id -> {
                val url = wave.streamUrl
                if (!url.isNullOrBlank()) {
                    active.isReady = false
                    active.errorRetries = 0
                    active.waveId = wave.id
                    active.setAudioEnabled(true)
                    active.player.setMediaItem(MediaItem.fromUri(url))
                    active.player.prepare()
                    active.player.playWhenReady = true
                    active.player.volume = 1f
                }
                newStandby = standby
            }
            else -> {
                newStandby = standby
            }
        }

        val target = nextWave
        if (target != null && newStandby.waveId != target.id) {
            val url = target.streamUrl
            if (!url.isNullOrBlank()) {
                newStandby.isReady = false
                newStandby.errorRetries = 0
                newStandby.waveId = target.id
                newStandby.setAudioEnabled(false)
                newStandby.player.volume = 0f
                newStandby.player.playWhenReady = false
                newStandby.player.setMediaItem(MediaItem.fromUri(url))
                newStandby.player.prepare()
            }
        }
    }

    var positionMs by remember { mutableLongStateOf(0L) }
    LaunchedEffect(active) {
        while (isActive) {
            if (active.isReady) positionMs = active.player.currentPosition
            delay(250)
        }
    }

    // OK/Enter on the now-focusable Now Playing panel pauses/resumes -
    // reset whenever the wave changes so a freshly promoted/loaded wave
    // always starts playing rather than inheriting a stale pause from
    // whatever was centered before.
    var manuallyPaused by remember { mutableStateOf(false) }
    LaunchedEffect(centeredWave?.id) { manuallyPaused = false }
    LaunchedEffect(manuallyPaused, active) {
        active.player.playWhenReady = !manuallyPaused
    }

    val pulseMoments = centeredWave?.id?.let { viewModel.pulseMomentsByWaveId[it] } ?: emptyList()

    // Pulse's floating "+1" feedback belongs on the video itself (the thing
    // being marked), not on the action bar icon that triggered it - lifted
    // here so both WaveActionBar (which adds one per tap) and
    // NowPlayingPanel (which renders and clears them) share the same list.
    val floatingBolts = remember(centeredWave?.id) { mutableStateListOf<Long>() }

    // The up-next rail only ever shows items with index > centeredIndex
    // (see itemsIndexed below), so the instant a focused up-next card is
    // promoted to "now playing" (onFocused sets centeredIndex = its own
    // index), that same card's index no longer passes the filter and its
    // composable is torn down on the very next recomposition - while it
    // still held focus. Compose then hands focus to whatever's nearest in
    // the tree, which in practice was the nav rail - reading as "every new
    // wave jumps to the main menu." The fix isn't removing the rail, it's
    // making sure focus lands somewhere real before the old card
    // disappears - the new first up-next card, or the action bar's first
    // button if the rail is temporarily/permanently empty (e.g. only one
    // wave loaded, or waiting on the next page).
    //
    // Giving that new card focus programmatically fires the exact same
    // onFocused callback a real D-pad move would - which promotes whatever
    // gets focused to "now playing". Left unguarded, every programmatic
    // refocus after an autoplay-driven advance would itself trigger another
    // advance, cascading through the whole rail in one frame (autoplay
    // "selecting" every wave up to the last one instantly). suppressNextPromote
    // marks a focus change as ours, not the user's, so it's consumed
    // silently instead of re-triggering centeredIndex.
    val upNextFocusRequesters = remember(items.size) { List(items.size) { FocusRequester() } }
    val actionBarFallbackFocusRequester = remember { FocusRequester() }
    val suppressNextPromote = remember { mutableStateOf(false) }
    var hasAdvancedOnce by remember { mutableStateOf(false) }
    // The Back/Forward action-bar buttons also change centeredIndex, but
    // they're never at risk of being disposed the way an up-next card is
    // (they're fixed buttons, not filtered out of any list) - stealing
    // focus onto the rail after a deliberate Back/Forward tap was the exact
    // bug reported: pressing Back repeatedly stopped landing on Back after
    // the first tap, since focus silently hopped onto the rail (or the
    // action bar's first button) underneath the user's thumb. This flag
    // marks "this particular index change came from a button, don't touch
    // focus" - set right before the button mutates centeredIndex, consumed
    // (without rescuing) on the very next effect run.
    val suppressFocusFollow = remember { mutableStateOf(false) }
    fun goPrevFromButton() { suppressFocusFollow.value = true; goPrev() }
    fun goNextFromButton() { suppressFocusFollow.value = true; goNext() }
    LaunchedEffect(centeredIndex) {
        if (hasAdvancedOnce && !suppressFocusFollow.value) {
            val nextIdx = centeredIndex + 1
            val requester = upNextFocusRequesters.getOrNull(nextIdx)
            suppressNextPromote.value = true
            if (requester != null) {
                runCatching { requester.requestFocus() }
            } else {
                runCatching { actionBarFallbackFocusRequester.requestFocus() }
            }
        }
        suppressFocusFollow.value = false
        hasAdvancedOnce = true
    }

    Column(modifier = modifier.fillMaxSize()) {
        // Fills whatever real vertical space is actually left on this
        // device - a hardcoded height here (620dp, from an earlier pass)
        // assumed a taller screen than some real TVs have, which pushed the
        // Up Next rail and action bar off-screen/cropped. Since the
        // quick-access rows now live inside this same Row (not stacked
        // above it in the outer Column), nothing here varies the panel's
        // size anymore, so weight(1f) is safe again.
        Row(
            modifier = Modifier.fillMaxWidth().weight(1f),
            horizontalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            if (centeredItem != null) {
                NowPlayingPanel(
                    item = centeredItem,
                    slot = active,
                    positionMs = positionMs,
                    pulseMoments = pulseMoments,
                    floatingBolts = floatingBolts,
                    onBoltFinished = { floatingBolts.remove(it) },
                    isPaused = manuallyPaused,
                    onTogglePause = { manuallyPaused = !manuallyPaused },
                    modifier = Modifier.fillMaxHeight().padding(start = 60.dp)
                )
            }

            // Quick-access rows sit above "Up next" in this right-hand
            // column only - they must never affect NowPlayingPanel's size
            // or position.
            Column(modifier = Modifier.weight(1f).fillMaxHeight()) {
                if (recentChannels.isNotEmpty()) {
                    CompactRail(
                        title = "Recently watched",
                        items = recentChannels,
                        onClick = { viewModel.playChannel(it) },
                        autoSlide = true
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 16.dp, bottom = 16.dp)
                            .height(1.dp)
                            .background(LocalNocturne.current.gold.copy(alpha = 0.45f))
                    )
                }
                if (continueWatching.isNotEmpty()) {
                    CompactRail(
                        title = "Continue watching",
                        items = continueWatching,
                        onClick = { viewModel.play(it.toPlayerMedia()) }
                    )
                } else {
                    Text(
                        text = "Continue watching",
                        color = LocalNocturne.current.text,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 10.dp)
                    )
                    CompactPlaceholderRow(note = "Items you didn't complete from Movies & Series will appear here.")
                }
                // Fills the remaining leftover space above "Up next" (which
                // stays pinned to the bottom via the Spacer below,
                // regardless of how tall this card ends up) - a quick guide
                // to what each action-bar icon does, for anyone new to a
                // social feed on a TV remote.
                WaveKeyMapCard(modifier = Modifier.padding(top = 18.dp))
                // Only the two quick-access rows above belong up here -
                // this spacer absorbs whatever vertical space they don't
                // use, so "Up next" and its rail always sit at the very
                // bottom of this column, bottoms flush with NowPlayingPanel.
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = "Up next",
                    color = LocalNocturne.current.text,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 10.dp)
                )
                // itemsIndexed used to run over the FULL `items` list with an
                // early `return@itemsIndexed` to skip already-passed waves -
                // that only skips rendering their CONTENT, it doesn't remove
                // them as slots in the row, so spacedBy(16.dp) kept adding a
                // gap around every invisible passed-wave slot. The gap grew
                // by one card-width each time centeredIndex advanced, which
                // is exactly the widening space reported between the player
                // and the real up-next cards. Filtering the list up front
                // means passed waves are never in the row at all.
                val upcoming = remember(items, centeredIndex) {
                    items.mapIndexedNotNull { index, wave -> if (index > centeredIndex) index to wave else null }
                }
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    contentPadding = PaddingValues(end = 60.dp)
                ) {
                    itemsIndexed(upcoming, key = { _, pair -> "${pair.first}-${pair.second.id}" }) { _, pair ->
                        val (index, wave) = pair
                        val isUpNext = index == centeredIndex + 1
                        val isLast = index == items.lastIndex
                        UpNextCard(
                            item = wave,
                            isUpNext = isUpNext,
                            focusRequester = upNextFocusRequesters.getOrNull(index),
                            onFocused = {
                                if (suppressNextPromote.value) {
                                    suppressNextPromote.value = false
                                } else {
                                    centeredIndex = index
                                }
                            },
                            onWrapKey = if (isLast) {
                                { direction -> if (!hasMore && direction > 0) { goToStart(); true } else false }
                            } else null
                        )
                    }
                }
            }
        }

        if (centeredItem != null) {
            WaveActionBar(
                viewModel = viewModel,
                item = centeredItem,
                wave = centeredWave,
                positionMs = positionMs,
                autoplayEnabled = autoplayEnabled,
                onToggleAutoplay = { autoplayEnabled = !autoplayEnabled },
                playbackSpeed = playbackSpeed,
                onCyclePlaybackSpeed = {
                    val i = PLAYBACK_SPEEDS.indexOf(playbackSpeed)
                    playbackSpeed = PLAYBACK_SPEEDS[(i + 1) % PLAYBACK_SPEEDS.size]
                },
                firstButtonFocusRequester = actionBarFallbackFocusRequester,
                onPulseTap = { boltId -> floatingBolts.add(boltId) },
                canGoBack = centeredIndex > 0,
                onGoBack = ::goPrevFromButton,
                onGoForward = ::goNextFromButton,
                isPaused = manuallyPaused,
                onTogglePlayPause = { manuallyPaused = !manuallyPaused },
                modifier = Modifier.fillMaxWidth().height(ACTION_BAR_HEIGHT).padding(horizontal = 60.dp, vertical = 12.dp)
            )
        }
    }
}

@Composable
private fun NowPlayingPanel(
    item: MediaCard,
    slot: WaveSlot,
    positionMs: Long,
    pulseMoments: List<WavePulseMoment>,
    floatingBolts: List<Long>,
    onBoltFinished: (Long) -> Unit,
    isPaused: Boolean,
    onTogglePause: () -> Unit,
    modifier: Modifier = Modifier
) {
    val nocturne = LocalNocturne.current

    // Now Playing was never itself a focusable stop - it's the leftmost
    // element in the row, so navigating Left toward it from the first
    // up-next card had nowhere valid to land. Compose's spatial focus
    // search then skipped straight past it looking for the next real
    // candidate, which was the nav rail - reading as "focus jumps to menu
    // the moment you try to reach the currently playing wave," and every
    // up-next card the search passed through on the way fired its own
    // onFocused (promoting each one) before finally escaping. Making this
    // panel a real focus target gives Left somewhere real to stop - and now
    // that it's reachable, OK/Enter on it pauses/resumes the wave in place.
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()

    Box(
        modifier = modifier
            .aspectRatio(NOW_PLAYING_ASPECT, matchHeightConstraintsFirst = true)
            .clip(RoundedCornerShape(18.dp))
            .background(nocturne.surface)
            .border(if (focused) 3.dp else 2.dp, nocturne.gold, RoundedCornerShape(18.dp))
            .onKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                when (event.key) {
                    Key.DirectionCenter, Key.Enter, Key.NumPadEnter -> { onTogglePause(); true }
                    else -> false
                }
            }
            .focusable(interactionSource = interactionSource)
    ) {
        // Thumbnail is always the base layer, faded out once the live video
        // is ready - previously this panel showed *only* the video view, so
        // the moment a wave became "now playing" the screen went blank
        // until it buffered in, which read as a slow/broken load.
        if (!item.imageUrl.isNullOrBlank()) {
            AsyncImage(
                model = rememberCacheableImageRequest(item.imageUrl),
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Brush.linearGradient(listOf(nocturne.surface, nocturne.surfaceRaised, nocturne.background)))
            )
        }

        // Mounted once, permanently - only `.player` and alpha change from
        // here on, never the AndroidView itself. Recreating the native
        // PlayerView per wave (the previous approach) is what caused
        // playback to freeze after the very first swap.
        AndroidView(
            factory = {
                PlayerView(it).apply {
                    useController = false
                    setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
                }
            },
            update = {
                it.player = slot.player
                it.alpha = if (slot.isReady) 1f else 0f
            },
            modifier = Modifier.fillMaxSize()
        )

        LabelPill(text = "NOW PLAYING", modifier = Modifier.align(Alignment.TopCenter).padding(top = 14.dp))

        if (isPaused) {
            Icon(
                painter = painterResource(R.drawable.ic_ph_play),
                contentDescription = "Paused - press OK to resume",
                tint = Color.White,
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(64.dp)
                    .background(Color.Black.copy(alpha = 0.4f), RoundedCornerShape(50))
                    .padding(14.dp)
            )
        }

        // Rises through the body of the video, not up near the "NOW
        // PLAYING" pill at the very top - that's chrome, not where anyone
        // is actually looking when they tap Pulse.
        floatingBolts.forEach { boltId ->
            FloatingBolt(key = boltId, onFinished = { onBoltFinished(boltId) })
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomStart)
                .background(Brush.verticalGradient(0f to Color.Transparent, 1f to nocturne.background.copy(alpha = 0.95f)))
                .padding(16.dp)
        ) {
            Text(text = item.title, color = nocturne.text, fontSize = 19.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (item.subtitle.isNotBlank()) {
                Text(text = item.subtitle, color = nocturne.textFaint, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            // The backend's stored duration comes from whatever the
            // uploader reported at upload time - it can be 0 or just wrong
            // for a given wave, which is exactly what made the EKG finish
            // early (or never show at all, since 0 fails this check) while
            // the real video kept playing. The player itself always knows
            // the true duration of whatever's actually loaded, once it's
            // buffered enough to know - use that as the source of truth
            // and only fall back to the backend's number before that.
            val realDurationMs = slot.player.duration
                .takeIf { it > 0 && it != androidx.media3.common.C.TIME_UNSET }
                ?: item.duration
            // The EKG IS this wave's timeline/scrubber (replacing a plain
            // progress bar, the way similar short-form feeds have one) -
            // it's always present, not something that only shows up once a
            // wave has pulses. A wave with no pulses yet still needs its
            // timeline, just as a flat trace; the trace only rises at
            // points where viewers tapped Pulse. Gating the whole thing on
            // pulseMoments.isNotEmpty() was hiding it entirely for any wave
            // with zero pulses so far - that's what "missing on some waves"
            // actually was.
            if (realDurationMs > 0) {
                EkgTimeline(
                    moments = pulseMoments,
                    durationMs = realDurationMs,
                    positionMs = positionMs,
                    modifier = Modifier.padding(top = 10.dp)
                )
            }
        }
    }
}

// The "ECG pulse" scrubber mobile shows under the video: a heartbeat-style
// line whose spikes mark seconds where viewers tapped Pulse to mark a
// favorite moment, built from the same GET .../pulses/moments data. Display-
// only with a live progress marker - no drag-to-seek yet.
@Composable
private fun EkgTimeline(moments: List<WavePulseMoment>, durationMs: Long, positionMs: Long, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    val durationSec = (durationMs / 1000L).toInt().coerceAtLeast(1)
    val bysecond = remember(moments) { moments.associateBy { it.second } }
    val maxIntensity = remember(moments) { (moments.maxOfOrNull { it.intensitySum } ?: 0).coerceAtLeast(1) }
    val progressFraction = (positionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
    val lineColor = nocturne.gold

    Canvas(modifier = modifier.fillMaxWidth().height(24.dp)) {
        val stepX = size.width / durationSec
        val midY = size.height / 2f
        val path = Path().apply { moveTo(0f, midY) }
        for (sec in 0..durationSec) {
            val intensity = bysecond[sec]?.intensitySum ?: 0
            val normalized = intensity.toFloat() / maxIntensity
            val x = sec * stepX
            val y = midY - normalized * midY * 0.9f
            path.lineTo(x, y)
        }
        drawPath(path, color = lineColor, style = Stroke(width = 2.dp.toPx()))

        val progressX = progressFraction * size.width
        drawLine(
            color = Color.White,
            start = Offset(progressX, 0f),
            end = Offset(progressX, size.height),
            strokeWidth = 2.dp.toPx()
        )
    }
}

@Composable
private fun UpNextCard(
    item: MediaCard,
    isUpNext: Boolean,
    focusRequester: FocusRequester?,
    onFocused: () -> Unit,
    onWrapKey: ((Int) -> Boolean)?
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) { TvSoundManager.play("move"); onFocused() } }

    val infiniteTransition = rememberInfiniteTransition(label = "upNextPulse")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900), repeatMode = RepeatMode.Reverse),
        label = "upNextPulseAlpha"
    )

    val borderColor = if (isUpNext) nocturne.gold.copy(alpha = pulseAlpha) else nocturne.borderCard

    Box(
        modifier = Modifier
            .width(UP_NEXT_WIDTH)
            .height(UP_NEXT_HEIGHT)
            .clip(RoundedCornerShape(14.dp))
            .background(nocturne.surface)
            .border(if (isUpNext) 2.dp else 1.dp, borderColor, RoundedCornerShape(14.dp))
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .then(
                if (onWrapKey != null) {
                    Modifier.onKeyEvent { event ->
                        if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                        if (event.key == Key.DirectionRight) onWrapKey(1) else false
                    }
                } else Modifier
            )
            .clickable(interactionSource = interactionSource, indication = null, onClick = onFocused)
    ) {
        if (!item.imageUrl.isNullOrBlank()) {
            AsyncImage(
                model = rememberCacheableImageRequest(item.imageUrl),
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Brush.linearGradient(listOf(nocturne.surface, nocturne.surfaceRaised, nocturne.background)))
            )
        }
        if (isUpNext) {
            LabelPill(text = "UP NEXT", modifier = Modifier.align(Alignment.TopCenter).padding(top = 10.dp), alpha = pulseAlpha)
        }
    }
}

@Composable
private fun LabelPill(text: String, modifier: Modifier = Modifier, alpha: Float = 1f) {
    val nocturne = LocalNocturne.current
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(nocturne.background.copy(alpha = 0.75f))
            .border(1.dp, nocturne.gold.copy(alpha = alpha), RoundedCornerShape(999.dp))
            .padding(horizontal = 12.dp, vertical = 5.dp)
    ) {
        Text(text = text, color = nocturne.gold.copy(alpha = alpha), fontSize = 11.sp, letterSpacing = 1.sp)
    }
}

// Full-width action bar pinned to the bottom of the screen - every icon
// here acts on whichever wave is currently centered/playing. AfroVision
// doesn't have a heart icon on Waves anywhere (mobile's reaction is a
// lightning bolt/"Pulse"), and a TV needs large, obviously-focusable
// horizontal targets for a remote rather than small stacked icons down one
// edge. No chat (TV has no text-entry flow worth building for comments) and
// no share (nothing meaningful to share to from a TV) - playback speed
// takes their place instead.
@Composable
private fun WaveActionBar(
    viewModel: TvViewModel,
    item: MediaCard,
    wave: Wave?,
    positionMs: Long,
    autoplayEnabled: Boolean,
    onToggleAutoplay: () -> Unit,
    playbackSpeed: Float,
    onCyclePlaybackSpeed: () -> Unit,
    firstButtonFocusRequester: FocusRequester? = null,
    onPulseTap: (Long) -> Unit,
    canGoBack: Boolean,
    onGoBack: () -> Unit,
    onGoForward: () -> Unit,
    isPaused: Boolean,
    onTogglePlayPause: () -> Unit,
    modifier: Modifier = Modifier
) {
    val nocturne = LocalNocturne.current
    var bookmarked by remember(wave?.id) { mutableStateOf(wave?.isBookmarked ?: false) }
    // Pulse is not a one-shot "like" - mobile lets viewers tap repeatedly to
    // mark favorite moments on the wave's own timeline, capped server-side
    // per wave per day. localPulseCount is an optimistic counter on top of
    // the server's last-known count; limitReached freezes it once the
    // server says so instead of pretending taps still work.
    var localPulseCount by remember(wave?.id) { mutableStateOf(0) }
    var limitReached by remember(wave?.id) { mutableStateOf(false) }
    var lastPulseTapAt by remember(wave?.id) { mutableLongStateOf(0L) }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(18.dp))
            // Darker, richer blue than the surrounding screen, with a gold
            // rim - this is the primary interactive surface on the screen,
            // it should read as more premium/deliberate than a plain panel.
            .background(
                Brush.horizontalGradient(
                    listOf(Color(0xFF060A22), Color(0xFF0A1030), Color(0xFF060A22))
                )
            )
            .border(2.dp, nocturne.gold, RoundedCornerShape(18.dp))
            .padding(horizontal = 24.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // The D-pad can't step back through waves any more (Left/Up escape
        // to the nav rail like every other screen), so Back/Next are the
        // explicit, intentional way to move between waves from here -
        // Pause sits between them (previous / pause / next) since OK on the
        // video itself does the same thing but isn't obvious to a first-
        // time viewer of a feature this new to television.
        WaveActionButton(
            iconRes = R.drawable.ic_ph_caret_left,
            label = "Back",
            highlighted = false,
            onClick = { TvSoundManager.play("toggle"); onGoBack() },
            enabled = canGoBack,
            modifier = if (firstButtonFocusRequester != null) Modifier.focusRequester(firstButtonFocusRequester) else Modifier
        )
        WaveActionButton(
            iconRes = if (isPaused) R.drawable.ic_ph_play else R.drawable.ic_ph_pause,
            label = if (isPaused) "Play" else "Pause",
            highlighted = isPaused,
            onClick = { TvSoundManager.play("toggle"); onTogglePlayPause() }
        )
        WaveActionButton(
            iconRes = R.drawable.ic_ph_caret_right,
            label = "Next",
            highlighted = false,
            onClick = { TvSoundManager.play("toggle"); onGoForward() }
        )
        // Reverted to the original icon/label pair (checkmark when on,
        // repeat when off) - a brief attempt to match mobile's repeat/pause
        // pairing here would have collided visually with the new dedicated
        // Pause button above.
        WaveActionButton(
            iconRes = if (autoplayEnabled) R.drawable.ic_ph_check_circle else R.drawable.ic_ph_repeat,
            label = if (autoplayEnabled) "Autoplay on" else "Autoplay off",
            highlighted = autoplayEnabled,
            onClick = { TvSoundManager.play("toggle"); onToggleAutoplay() }
        )

        WaveActionButton(
            iconRes = R.drawable.ic_ph_lightning_fill,
            label = if (limitReached) "Pulse · limit reached" else "Pulse · ${formatWaveCount((wave?.pulseCount ?: 0) + localPulseCount)}",
            highlighted = localPulseCount > 0,
            onClick = {
                val now = System.currentTimeMillis()
                if (limitReached || now - lastPulseTapAt < PULSE_TAP_COOLDOWN_MS) return@WaveActionButton
                lastPulseTapAt = now
                TvSoundManager.play("like")
                onPulseTap(now)
                wave?.id?.let { id ->
                    viewModel.addWavePulse(id, positionMs / 1000L) { reachedLimit ->
                        if (reachedLimit) {
                            limitReached = true
                        } else {
                            localPulseCount += 1
                        }
                    }
                }
            }
        )

        WaveActionButton(
            iconRes = R.drawable.ic_ph_gauge,
            label = "Speed · ${formatPlaybackSpeed(playbackSpeed)}",
            highlighted = playbackSpeed != 1f,
            onClick = { TvSoundManager.play("toggle"); onCyclePlaybackSpeed() }
        )
        WaveActionButton(
            iconRes = R.drawable.ic_ph_bookmark_simple,
            label = if (bookmarked) "Saved" else "Save",
            highlighted = bookmarked,
            onClick = {
                TvSoundManager.play("toggle")
                wave?.id?.let { id ->
                    viewModel.toggleWaveBookmark(id) { newState -> bookmarked = newState }
                }
            }
        )
        WaveActionButton(
            iconRes = R.drawable.ic_ph_arrows_out_cardinal,
            label = "Fullscreen",
            onClick = { TvSoundManager.play("select"); viewModel.play(item.toPlayerMedia()) }
        )
    }
}

// A single "+⚡" that rises and fades over the Pulse button, one per tap -
// this is the "floating bolts" feedback mobile gives on every Pulse tap
// (not just the first), since Pulse is a repeatable favorite-moment marker,
// not a one-time like.
@Composable
private fun androidx.compose.foundation.layout.BoxScope.FloatingBolt(key: Long, onFinished: () -> Unit) {
    val nocturne = LocalNocturne.current
    val progress = remember(key) { androidx.compose.animation.core.Animatable(0f) }
    LaunchedEffect(key) {
        progress.animateTo(1f, animationSpec = tween(900, easing = FastOutSlowInEasing))
        onFinished()
    }
    // Rises through the middle of the video body (not the top chrome) -
    // starts a little below center, ends a little above it.
    Text(
        text = "⚡+1",
        color = nocturne.gold,
        fontSize = 26.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .align(Alignment.Center)
            .graphicsLayer {
                translationY = 50f - progress.value * 110f
                alpha = 1f - progress.value
            }
    )
}

@Composable
private fun WaveActionButton(
    iconRes: Int,
    label: String,
    highlighted: Boolean = false,
    enabled: Boolean = true,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }

    val restingColor = if (enabled) nocturne.text else nocturne.textFaint

    // Back/Next (and every other button here) had no protection against a
    // single OK press registering as two clicks - some remotes send a
    // repeat event faster than a human can distinguish from one press,
    // which is exactly what "skips one wave in either direction" looks
    // like from a single tap. Pulse already had this exact guard for the
    // same reason; every button gets it now.
    var lastClickAt by remember { mutableLongStateOf(0L) }
    val debouncedOnClick = {
        val now = System.currentTimeMillis()
        if (now - lastClickAt >= 350L) {
            lastClickAt = now
            onClick()
        }
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .border(
                if (focused) 2.dp else 1.dp,
                if (focused) nocturne.gold else if (highlighted) nocturne.accent700 else Color.Transparent,
                RoundedCornerShape(14.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null, enabled = enabled, onClick = debouncedOnClick)
            .padding(horizontal = 18.dp, vertical = 10.dp)
    ) {
        // Plain, muted icons read as decoration rather than controls on a
        // brand-new-to-TV social feature - brighter at rest (not just on
        // focus/highlight) and a bolder, larger label make clear these are
        // real buttons with a specific job each, which matters most for
        // first-time users who've never seen this pattern on a TV before.
        Icon(
            painter = painterResource(iconRes),
            contentDescription = label,
            tint = if (!enabled) restingColor else if (focused) nocturne.gold else if (highlighted) nocturne.accentLight else restingColor,
            modifier = Modifier.size(26.dp)
        )
        Text(
            text = label,
            color = if (!enabled) restingColor else if (focused) nocturne.goldLight else if (highlighted) nocturne.accentLight else restingColor,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 6.dp)
        )
    }
}

private fun formatPlaybackSpeed(speed: Float): String =
    if (speed == speed.toInt().toFloat()) "${speed.toInt()}x" else "${speed}x"

private fun formatWaveCount(count: Long): String = when {
    count >= 1_000_000 -> "%.1fM".format(count / 1_000_000.0)
    count >= 1_000 -> "%.1fk".format(count / 1_000.0)
    else -> count.toString()
}
