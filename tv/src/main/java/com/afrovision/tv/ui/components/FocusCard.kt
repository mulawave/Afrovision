package com.afrovision.tv.ui.components

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
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.unit.sp
import android.util.Log
import coil.compose.AsyncImage
import com.afrovision.tv.R
import com.afrovision.tv.TV_APP_TAG
import com.afrovision.tv.data.MediaCard
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun FocusCard(
    item: MediaCard,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    aspect: Pair<Float, Float> = 16f to 9f
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    // collectIsFocusedAsState() (not onFocusChanged) because it reads focus
    // events directly off the same interactionSource already passed to
    // clickable() below - order-independent, unlike onFocusChanged, which
    // only observes a focus target that appears *after* it in the modifier
    // chain. Every custom focus-ring component in this app had
    // onFocusChanged placed *after* clickable/focusable (i.e. observing
    // nothing), which is why D-pad navigation worked but no focus ring ever
    // rendered anywhere, nav rail included.
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    val scale by animateFloatAsState(if (focused) 1.05f else 1f, label = "cardScale")
    val borderColor by animateColorAsState(
        targetValue = if (focused) nocturne.gold else nocturne.borderCard,
        label = "cardBorder"
    )
    val glow = if (focused) {
        Modifier.shadow(
            elevation = 10.dp,
            shape = RoundedCornerShape(14.dp),
            ambientColor = nocturne.gold,
            spotColor = nocturne.gold
        )
    } else Modifier

    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(aspect.first / aspect.second)
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
        if (!item.imageUrl.isNullOrBlank()) {
            AsyncImage(
                model = rememberCacheableImageRequest(item.imageUrl),
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                onError = { Log.e(TV_APP_TAG, "Image load failed for ${item.title}: ${item.imageUrl}", it.result.throwable) }
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

        if (focused) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(nocturne.gold.copy(alpha = 0.15f))
            )
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
                    painter = painterResource(R.drawable.ic_ph_play_circle),
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
                color = if (focused) nocturne.goldLight else nocturne.text,
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

