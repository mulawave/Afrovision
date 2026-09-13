package com.afrovision.tv.ui.components

import android.util.Log
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.afrovision.tv.R
import com.afrovision.tv.TV_APP_TAG
import com.afrovision.tv.data.MediaCard
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
private fun BaseRailCard(
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    onFocusChanged: (Boolean) -> Unit = {},
    content: @Composable (isFocused: Boolean) -> Unit
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) {
        if (focused) TvSoundManager.play("move")
        onFocusChanged(focused)
    }
    val scale by animateFloatAsState(if (focused) 1.05f else 1f, label = "cardScale")
    val borderColor by animateColorAsState(
        targetValue = if (focused) nocturne.gold else nocturne.borderCard,
        label = "cardBorder"
    )
    val glow = if (focused) {
        Modifier.shadow(
            elevation = 18.dp,
            shape = RoundedCornerShape(14.dp),
            ambientColor = nocturne.gold,
            spotColor = nocturne.gold
        )
    } else Modifier

    Box(
        modifier = modifier
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
                onClick = onClick
            ),
        contentAlignment = Alignment.BottomStart
    ) {
        content(focused)
    }
}

@Composable
fun ContinueWatchingCard(item: MediaCard, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    BaseRailCard(
        modifier = Modifier.size(width = 392.dp, height = 220.dp),
        onClick = onClick
    ) { isFocused ->
        Box(modifier = Modifier.fillMaxSize()) {
            if (!item.imageUrl.isNullOrBlank()) {
                AsyncImage(
                    model = rememberCacheableImageRequest(item.imageUrl),
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                    onError = { Log.e(TV_APP_TAG, "Continue image failed: ${item.title}: ${item.imageUrl}", it.result.throwable) }
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
                        fontSize = 48.sp
                    )
                }
            }

            Column(
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
                if (item.subtitle.isNotBlank()) {
                    Text(
                        text = item.subtitle,
                        color = nocturne.textFaint,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Text(
                    text = item.title,
                    color = if (isFocused) nocturne.goldLight else nocturne.text,
                    fontSize = 18.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (item.progress > 0f) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp)
                            .height(5.dp)
                            .clip(RoundedCornerShape(2.5.dp))
                            .background(nocturne.text.copy(alpha = 0.2f))
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(item.progress)
                                .fillMaxHeight()
                                .background(nocturne.accent)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ChannelCard(item: MediaCard, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val isLive = item.badge.equals("LIVE", ignoreCase = true)
    BaseRailCard(
        modifier = Modifier.size(width = 336.dp, height = 182.dp),
        onClick = onClick
    ) { focused ->
        Box(modifier = Modifier.fillMaxSize()) {
            if (!item.imageUrl.isNullOrBlank()) {
                AsyncImage(
                    model = rememberCacheableImageRequest(item.imageUrl),
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                    onError = { Log.e(TV_APP_TAG, "Channel image failed: ${item.title}: ${item.imageUrl}", it.result.throwable) }
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
                                .clip(RoundedCornerShape(50))
                                .background(nocturne.green)
                        )
                        Text(
                            text = "LIVE",
                            color = nocturne.goldLight,
                            fontSize = 12.sp,
                            letterSpacing = 0.14.em
                        )
                    }
                }
            }

            Column(
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
                if (item.subtitle.isNotBlank()) {
                    Text(
                        text = item.subtitle,
                        color = nocturne.textFaint,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@Composable
fun PosterCard(item: MediaCard, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    BaseRailCard(
        modifier = Modifier.size(width = 228.dp, height = 342.dp),
        onClick = onClick
    ) { focused ->
        Box(modifier = Modifier.fillMaxSize()) {
            if (!item.imageUrl.isNullOrBlank()) {
                AsyncImage(
                    model = rememberCacheableImageRequest(item.imageUrl),
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                    onError = { Log.e(TV_APP_TAG, "Poster image failed: ${item.title}: ${item.imageUrl}", it.result.throwable) }
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
                        fontSize = 56.sp
                    )
                }
            }

            if (item.badge.isNotBlank()) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(12.dp)
                        .clip(RoundedCornerShape(99.dp))
                        .background(nocturne.background.copy(alpha = 0.7f))
                        .border(1.dp, nocturne.gold, RoundedCornerShape(99.dp))
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = item.badge.uppercase(),
                        color = nocturne.goldLight,
                        fontSize = 12.sp
                    )
                }
            }

            Column(
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
                    fontSize = 16.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                if (item.subtitle.isNotBlank()) {
                    Text(
                        text = item.subtitle,
                        color = nocturne.textFaint,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@Composable
fun WaveCard(item: MediaCard, onClick: () -> Unit, onFocusChanged: (Boolean) -> Unit = {}) {
    val nocturne = LocalNocturne.current
    BaseRailCard(
        modifier = Modifier.size(width = 196.dp, height = 348.dp),
        onClick = onClick,
        onFocusChanged = onFocusChanged
    ) { focused ->
        Box(modifier = Modifier.fillMaxSize()) {
            if (!item.imageUrl.isNullOrBlank()) {
                AsyncImage(
                    model = rememberCacheableImageRequest(item.imageUrl),
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                    onError = { Log.e(TV_APP_TAG, "Wave image failed: ${item.title}: ${item.imageUrl}", it.result.throwable) }
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
                        fontSize = 48.sp
                    )
                }
            }

            if (item.badge.isNotBlank()) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(12.dp)
                        .clip(RoundedCornerShape(99.dp))
                        .background(nocturne.background.copy(alpha = 0.7f))
                        .border(1.dp, nocturne.gold, RoundedCornerShape(99.dp))
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = item.badge.uppercase(),
                        color = nocturne.goldLight,
                        fontSize = 12.sp
                    )
                }
            }

            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(48.dp)
                    .clip(RoundedCornerShape(50))
                    .background(nocturne.accent.copy(alpha = 0.8f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_ph_play_circle),
                    contentDescription = "Play",
                    tint = Color.White,
                    modifier = Modifier.size(28.dp)
                )
            }

            Column(
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
                    fontSize = 15.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (item.subtitle.isNotBlank()) {
                    Text(
                        text = item.subtitle,
                        color = nocturne.textFaint,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@Composable
fun LibraryCard(item: MediaCard, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    BaseRailCard(
        modifier = Modifier.size(width = 212.dp, height = 300.dp),
        onClick = onClick
    ) { focused ->
        Box(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(4.dp)
                    .background(nocturne.gold.copy(alpha = 0.4f))
                    .align(Alignment.CenterStart)
            )

            if (!item.imageUrl.isNullOrBlank()) {
                AsyncImage(
                    model = rememberCacheableImageRequest(item.imageUrl),
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                    onError = { Log.e(TV_APP_TAG, "Library image failed: ${item.title}: ${item.imageUrl}", it.result.throwable) }
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
                        fontSize = 48.sp
                    )
                }
            }

            if (item.badge.isNotBlank()) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(start = 16.dp, top = 12.dp)
                        .clip(RoundedCornerShape(99.dp))
                        .background(nocturne.background.copy(alpha = 0.7f))
                        .border(1.dp, nocturne.gold, RoundedCornerShape(99.dp))
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = item.badge.uppercase(),
                        color = nocturne.goldLight,
                        fontSize = 12.sp
                    )
                }
            }

            Column(
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
                    fontSize = 16.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
fun OpenAllTile(label: String, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    val scale by animateFloatAsState(if (focused) 1.05f else 1f, label = "openAllScale")
    val borderColor by animateColorAsState(
        targetValue = if (focused) nocturne.gold else nocturne.borderCard,
        label = "openAllBorder"
    )
    val glow = if (focused) {
        Modifier.shadow(
            elevation = 18.dp,
            shape = RoundedCornerShape(14.dp),
            ambientColor = nocturne.gold,
            spotColor = nocturne.gold
        )
    } else Modifier

    Box(
        modifier = Modifier
            .size(width = 140.dp, height = 220.dp)
            .scale(scale)
            .then(glow)
            .clip(RoundedCornerShape(14.dp))
            .background(nocturne.background.copy(alpha = 0.55f))
            .border(
                BorderStroke(if (focused) 2.dp else 1.dp, borderColor),
                RoundedCornerShape(14.dp)
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_ph_caret_right),
                contentDescription = null,
                tint = if (focused) nocturne.gold else nocturne.textMuted,
                modifier = Modifier.size(32.dp)
            )
            Text(
                text = label,
                color = if (focused) nocturne.gold else nocturne.textMuted,
                fontSize = 14.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
