package com.afrovision.tv.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.afrovision.tv.data.MediaCard
import com.afrovision.tv.data.PlayerMedia
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun FocusCard(
    item: MediaCard,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null,
    aspect: Pair<Float, Float> = 16f to 9f
) {
    var focused by remember { mutableStateOf(false) }
    val nocturne = LocalNocturne.current
    val scale by animateFloatAsState(if (focused) 1.06f else 1f, label = "cardScale")
    val borderColor by animateColorAsState(
        targetValue = if (focused) nocturne.accent else nocturne.borderCard,
        label = "cardBorder"
    )
    val containerHeight = (aspect.second / aspect.first * 392.dp.value).dp

    Box(
        modifier = modifier
            .height(containerHeight)
            .scale(scale)
            .clip(RoundedCornerShape(14.dp))
            .border(
                BorderStroke(if (focused) 2.dp else 1.dp, borderColor),
                RoundedCornerShape(14.dp)
            )
            .focusRequester(focusRequester ?: remember { FocusRequester() })
            .focusable(true)
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .background(nocturne.surface, RoundedCornerShape(14.dp)),
        contentAlignment = Alignment.BottomStart
    ) {
        if (!item.imageUrl.isNullOrBlank()) {
            AsyncImage(
                model = item.imageUrl,
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.linearGradient(
                            listOf(
                                nocturne.surface,
                                nocturne.surfaceRaised,
                                nocturne.background
                            )
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
                    .border(1.dp, nocturne.accent700, RoundedCornerShape(99.dp))
                    .padding(horizontal = 12.dp, vertical = 4.dp)
            ) {
                Text(
                    text = item.badge.uppercase(),
                    color = nocturne.accentLight,
                    fontSize = 12.sp
                )
            }
        }

        if (item.mediaType == "channel" && item.streamUrl != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(48.dp)
                    .clip(RoundedCornerShape(50))
                    .background(nocturne.accent.copy(alpha = 0.8f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.PlayArrow,
                    contentDescription = "Play",
                    tint = Color.White,
                    modifier = Modifier.size(28.dp)
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
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
                color = if (focused) nocturne.accentLight else nocturne.text,
                fontSize = 18.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (item.progress > 0f) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp)
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
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

