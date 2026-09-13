package com.afrovision.tv.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.util.Log
import android.view.KeyEvent
import coil.compose.AsyncImage
import com.afrovision.tv.R
import com.afrovision.tv.TV_APP_TAG
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.MediaCard
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.toMediaCard
import com.afrovision.tv.data.toPlayerMedia
import com.afrovision.tv.ui.components.rememberCacheableImageRequest
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay

private const val COLUMNS = 5
private const val ROWS_PER_PAGE = 3
private const val PAGE_SIZE = COLUMNS * ROWS_PER_PAGE

@Composable
fun LiveTvScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val channels = viewModel.liveChannels
    var selectedFilter by remember { mutableStateOf("All") }
    var page by remember { mutableIntStateOf(0) }
    var dialBuffer by remember { mutableStateOf("") }

    // Not just Loading - see WavesScreen.kt for why: loadAll() fires this
    // eagerly at app startup, possibly before the network/token is ready, so
    // a stuck LoadState.Error from that first attempt would otherwise never
    // retry on its own when this screen is visited.
    LaunchedEffect(Unit) { if (channels !is LoadState.Success) viewModel.loadLiveChannels() }

    val allChannels = (channels as? LoadState.Success)?.data ?: emptyList()

    LaunchedEffect(dialBuffer) {
        if (dialBuffer.isNotEmpty()) {
            delay(1500)
            val number = dialBuffer.toIntOrNull()
            val match = number?.let { n -> allChannels.firstOrNull { it.channelNumber == n } }
            dialBuffer = ""
            if (match != null) {
                TvSoundManager.play("chan")
                viewModel.play(match.toMediaCard().toPlayerMedia())
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(nocturne.primaryGradient)
            .onKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                val digit = event.nativeKeyEvent.keyCode.let { code ->
                    if (code in KeyEvent.KEYCODE_0..KeyEvent.KEYCODE_9) code - KeyEvent.KEYCODE_0 else null
                }
                if (digit != null) {
                    dialBuffer = (dialBuffer + digit).takeLast(4)
                    true
                } else false
            }
    ) {
        when (channels) {
            is LoadState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = nocturne.gold, modifier = Modifier.width(48.dp))
                }
            }
            is LoadState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(60.dp), contentAlignment = Alignment.Center) {
                    com.afrovision.tv.ui.components.ConnectionErrorCard(
                        message = channels.message,
                        onRetry = { viewModel.loadLiveChannels() }
                    )
                }
            }
            is LoadState.Success -> {
                val all = channels.data
                val categories = listOf("All") + all.mapNotNull { it.category?.trim()?.ifBlank { null } }.distinct().sorted()
                val filtered = if (selectedFilter == "All") all else all.filter { it.category == selectedFilter }
                val items = filtered.map { it.toMediaCard() }
                val pageCount = if (items.isEmpty()) 1 else (items.size + PAGE_SIZE - 1) / PAGE_SIZE
                val clampedPage = page.coerceIn(0, pageCount - 1)
                val pageItems = items.drop(clampedPage * PAGE_SIZE).take(PAGE_SIZE)

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                ) {
                    Column(modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 60.dp)) {
                        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                            Text(text = "Live TV", color = nocturne.text, fontSize = 52.sp)
                            Text(
                                text = "${filtered.size} live channels",
                                color = nocturne.textHint,
                                fontSize = 20.sp
                            )
                        }
                        Spacer26()
                        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            categories.forEach { filter ->
                                FilterChip(
                                    label = filter,
                                    selected = filter == selectedFilter,
                                    onClick = { selectedFilter = filter; page = 0 }
                                )
                            }
                        }
                    }

                    if (pageItems.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize().padding(60.dp), contentAlignment = Alignment.Center) {
                            Text(text = "No live channels available.", color = nocturne.textFaint, fontSize = 22.sp)
                        }
                    } else {
                        Column(
                            modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 32.dp),
                            verticalArrangement = Arrangement.spacedBy(28.dp)
                        ) {
                            pageItems.chunked(COLUMNS).forEach { rowItems ->
                                Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                                    rowItems.forEach { channel ->
                                        LiveChannelCard(
                                            item = channel,
                                            onClick = { viewModel.play(channel.toPlayerMedia()) }
                                        )
                                    }
                                }
                            }
                        }

                        if (pageCount > 1) {
                            PaginationRow(
                                page = clampedPage,
                                pageCount = pageCount,
                                onPageChange = { page = it }
                            )
                        }
                    }

                    val onNow = all.firstOrNull { it.isLive } ?: all.firstOrNull()
                    if (onNow != null) {
                        TonightSchedule(channelName = onNow.name)
                    }
                }
            }
        }

        if (dialBuffer.isNotEmpty()) {
            ChannelDialHud(buffer = dialBuffer, modifier = Modifier.align(Alignment.TopEnd).padding(top = 60.dp, end = 60.dp))
        }
    }
}

@Composable
private fun ChannelDialHud(buffer: String, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF0A0B12).copy(alpha = 0.85f))
            .border(2.dp, nocturne.gold, RoundedCornerShape(12.dp))
            .padding(horizontal = 28.dp, vertical = 16.dp)
    ) {
        Text(text = buffer, color = nocturne.goldLight, fontSize = 32.sp)
    }
}

@Composable
private fun LiveChannelCard(item: MediaCard, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    val scale by animateFloatAsState(if (focused) 1.05f else 1f, label = "liveChanScale")
    val borderColor by animateColorAsState(
        targetValue = if (focused) nocturne.gold else nocturne.borderCard,
        label = "liveChanBorder"
    )
    val glow = if (focused) {
        Modifier.shadow(
            elevation = 18.dp,
            shape = RoundedCornerShape(14.dp),
            ambientColor = nocturne.gold,
            spotColor = nocturne.gold
        )
    } else Modifier
    val isLive = item.badge.equals("LIVE", ignoreCase = true)

    Column(horizontalAlignment = Alignment.Start) {
        Box(
            modifier = Modifier
                .width(336.dp)
                .height(182.dp)
                .scale(scale)
                .then(glow)
                .clip(RoundedCornerShape(14.dp))
                .background(nocturne.surface, RoundedCornerShape(14.dp))
                .border(
                    BorderStroke(if (focused) 2.dp else 1.dp, borderColor),
                    RoundedCornerShape(14.dp)
                )
                .clickable(
                    interactionSource = interactionSource,
                    indication = null,
                    onClick = { TvSoundManager.play("select"); onClick() }
                )
        ) {
            if (!item.imageUrl.isNullOrBlank()) {
                AsyncImage(
                    model = rememberCacheableImageRequest(item.imageUrl),
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                    onError = { Log.e(TV_APP_TAG, "Live channel image failed: ${item.title}: ${item.imageUrl}", it.result.throwable) }
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.linearGradient(
                                listOf(nocturne.surface, nocturne.surfaceRaised, nocturne.background)
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = item.title.take(2).uppercase(),
                        color = nocturne.text.copy(alpha = 0.1f),
                        fontSize = 40.sp
                    )
                }
            }

            if (isLive) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(12.dp)
                        .clip(RoundedCornerShape(99.dp))
                        .background(nocturne.background.copy(alpha = 0.7f))
                        .border(1.dp, nocturne.gold, RoundedCornerShape(99.dp))
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(nocturne.green)
                        )
                        Text(text = "LIVE", color = nocturne.goldLight, fontSize = 12.sp)
                    }
                }
            }

            // Title only - no description/subtitle text on this screen, it
            // made every card visually noisy and hard to tell apart at a
            // glance while browsing dozens (soon thousands) of channels.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomStart)
                    .background(
                        Brush.verticalGradient(
                            0f to Color.Transparent,
                            1f to nocturne.background.copy(alpha = 0.95f)
                        )
                    )
                    .padding(12.dp)
            ) {
                Text(
                    text = item.title,
                    color = if (focused) nocturne.goldLight else nocturne.text,
                    fontSize = 18.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        item.channelNumber?.let { number ->
            Text(
                text = "Channel $number",
                color = if (focused) nocturne.goldLight else nocturne.textFaint,
                fontSize = 15.sp,
                modifier = Modifier.padding(top = 8.dp, start = 4.dp)
            )
        }
    }
}

@Composable
private fun PaginationRow(page: Int, pageCount: Int, onPageChange: (Int) -> Unit) {
    val nocturne = LocalNocturne.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 60.dp, end = 60.dp, top = 28.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            PageNavButton(
                iconRes = R.drawable.ic_ph_caret_left,
                label = "Previous",
                enabled = page > 0,
                onClick = { TvSoundManager.play("page"); onPageChange(page - 1) }
            )
            (0 until pageCount).forEach { i ->
                PageNumberButton(number = i + 1, selected = i == page, onClick = { TvSoundManager.play("page"); onPageChange(i) })
            }
            PageNavButton(
                iconRes = R.drawable.ic_ph_caret_right,
                label = "Next",
                enabled = page < pageCount - 1,
                onClick = { TvSoundManager.play("page"); onPageChange(page + 1) }
            )
        }
    }
}

@Composable
private fun PageNumberButton(number: Int, selected: Boolean, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .size(52.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) nocturne.accent900 else Color.Transparent)
            .border(
                if (focused) 2.dp else 1.dp,
                if (focused) nocturne.gold else if (selected) nocturne.accent700 else nocturne.borderCard,
                RoundedCornerShape(10.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = number.toString(),
            color = if (focused) nocturne.goldLight else if (selected) nocturne.accentLight else nocturne.textMuted,
            fontSize = 19.sp
        )
    }
}

@Composable
private fun PageNavButton(iconRes: Int, label: String, enabled: Boolean, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused && enabled) TvSoundManager.play("move") }
    val contentColor = when {
        !enabled -> nocturne.textFaint.copy(alpha = 0.4f)
        focused -> nocturne.goldLight
        else -> nocturne.textMuted
    }
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .border(
                if (focused && enabled) 2.dp else 1.dp,
                if (focused && enabled) nocturne.gold else nocturne.borderCard,
                RoundedCornerShape(10.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null, enabled = enabled, onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        if (iconRes == R.drawable.ic_ph_caret_left) {
            Icon(painter = painterResource(iconRes), contentDescription = null, tint = contentColor, modifier = Modifier.size(19.dp))
            Text(text = label, color = contentColor, fontSize = 19.sp)
        } else {
            Text(text = label, color = contentColor, fontSize = 19.sp)
            Icon(painter = painterResource(iconRes), contentDescription = null, tint = contentColor, modifier = Modifier.size(19.dp))
        }
    }
}

@Composable
private fun Spacer26() {
    Box(modifier = Modifier.height(26.dp))
}

@Composable
private fun FilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) nocturne.accent900 else Color.Transparent)
            .border(
                BorderStroke(if (focused) 2.dp else 1.dp, if (focused) nocturne.gold else if (selected) nocturne.accent700 else nocturne.borderCard),
                RoundedCornerShape(999.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 22.dp, vertical = 11.dp)
    ) {
        Text(
            text = label,
            color = if (focused) nocturne.goldLight else if (selected) nocturne.accentLight else nocturne.textMuted,
            fontSize = 19.sp
        )
    }
}

@Composable
private fun TonightSchedule(channelName: String) {
    val nocturne = LocalNocturne.current
    val slots = listOf(
        Triple("12:00", "Afrobeats Top 20", true),
        Triple("13:30", "Nollywood Rewind", false),
        Triple("15:00", "Live: Lagos Nights", false),
        Triple("18:00", "Evening News", false)
    )
    Column(modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 44.dp, bottom = 60.dp)) {
        Text(text = "Tonight on $channelName", color = nocturne.text, fontSize = 28.sp)
        Spacer26()
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            slots.forEachIndexed { index, (time, title, onNow) ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .border(
                            1.dp,
                            if (onNow) nocturne.accent700 else nocturne.borderCard,
                            RoundedCornerShape(8.dp)
                        )
                        .padding(horizontal = 24.dp, vertical = 17.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    Text(
                        text = time,
                        color = if (onNow) nocturne.gold else nocturne.textMuted,
                        fontSize = 19.sp,
                        modifier = Modifier.width(90.dp)
                    )
                    Column {
                        Text(text = title, color = nocturne.text, fontSize = 21.sp)
                        if (onNow) {
                            Text(text = "On now", color = nocturne.textHint, fontSize = 15.sp)
                        }
                    }
                }
            }
        }
    }
}
