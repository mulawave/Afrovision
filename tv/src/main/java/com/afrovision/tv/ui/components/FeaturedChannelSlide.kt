package com.afrovision.tv.ui.components

import android.util.Log
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import coil.compose.AsyncImage
import com.afrovision.tv.TV_APP_TAG
import com.afrovision.tv.data.api.model.HomepageFeaturedItem
import com.afrovision.tv.data.resolveAssetUrl
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay

private fun formatViewers(count: Int): String {
    return when {
        count >= 1_000_000 -> String.format("%.1fM", count / 1_000_000.0)
        count >= 1_000 -> String.format("%.1fK", count / 1_000.0)
        else -> count.toString()
    }
}

@Composable
fun FeaturedChannelSlide(
    items: List<HomepageFeaturedItem>,
    onPlay: (HomepageFeaturedItem) -> Unit,
    topPadding: androidx.compose.ui.unit.Dp = 28.dp
) {
    val nocturne = LocalNocturne.current
    val listState = rememberLazyListState()
    var autoScrollEnabled by remember { mutableStateOf(true) }

    // Auto-scroll every 4 seconds
    LaunchedEffect(items.size, autoScrollEnabled) {
        if (items.size < 2 || !autoScrollEnabled) return@LaunchedEffect
        while (autoScrollEnabled) {
            delay(4000)
            val firstVisible = listState.firstVisibleItemIndex
            val next = (firstVisible + 1) % items.size
            listState.animateScrollToItem(next)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 60.dp, top = topPadding, bottom = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Featured Channels",
                color = nocturne.text,
                fontSize = 31.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "${items.size} channels",
                color = nocturne.textHint,
                fontSize = 18.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        LazyRow(
            state = listState,
            contentPadding = PaddingValues(start = 6.dp, top = 12.dp, end = 60.dp, bottom = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            itemsIndexed(items, key = { _, item -> item.id.ifBlank { item.channelId } }) { _, item ->
                FeaturedChannelCard(
                    item = item,
                    onClick = {
                        autoScrollEnabled = false
                        onPlay(item)
                    }
                )
            }
        }
    }
}

@Composable
private fun FeaturedChannelCard(
    item: HomepageFeaturedItem,
    onClick: () -> Unit
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    val scale by animateFloatAsState(if (focused) 1.05f else 1f, label = "featScale")
    val borderColor by animateColorAsState(
        targetValue = if (focused) nocturne.gold else if (item.isPremiumChannel) nocturne.goldSoft.copy(alpha = 0.5f) else nocturne.borderCard,
        label = "featBorder"
    )
    val glow = if (focused) {
        Modifier.shadow(
            elevation = 18.dp,
            shape = RoundedCornerShape(14.dp),
            ambientColor = nocturne.gold,
            spotColor = nocturne.gold
        )
    } else Modifier

    val bannerUrl = item.bannerUrl?.let { resolveAssetUrl(it) }
    val logoUrl = item.logoUrl?.let { resolveAssetUrl(it) }
    val initials = item.name.split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(2).joinToString("")

    Box(
        modifier = Modifier
            .width(320.dp)
            .height(220.dp)
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
        // Banner fills the entire card - matches Recently Viewed's ChannelCard,
        // no separate below-image info strip left blank when text is short.
        if (!bannerUrl.isNullOrBlank()) {
            AsyncImage(
                model = rememberCacheableImageRequest(bannerUrl),
                contentDescription = item.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                onError = { Log.e(TV_APP_TAG, "Featured banner failed: ${item.name}: $bannerUrl", it.result.throwable) }
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.linearGradient(
                            listOf(nocturne.surfaceRaised, nocturne.surface, nocturne.background)
                        )
                    )
            )
        }

        // Live badge
        if (item.isLive) {
            Row(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(12.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xFFE5484D).copy(alpha = 0.9f))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(Color.White)
                )
                Text(
                    text = "LIVE",
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // Viewer count
        if (item.viewers > 0) {
            Row(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(12.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.Black.copy(alpha = 0.4f))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "\uD83D\uDC41",
                    fontSize = 10.sp
                )
                Text(
                    text = formatViewers(item.viewers),
                    color = nocturne.goldSoft,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        // Bottom gradient + name/category, overlaid directly on the image
        // (like ChannelCard) instead of reserved as separate space below it.
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomStart)
                .background(
                    Brush.verticalGradient(
                        0f to Color.Transparent,
                        1f to nocturne.background.copy(alpha = 0.95f)
                    )
                )
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(nocturne.gold, nocturne.goldSoft)
                        )
                    )
                    .border(2.dp, nocturne.surface, RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center
            ) {
                if (!logoUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = rememberCacheableImageRequest(logoUrl),
                        contentDescription = item.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                        onError = { Log.e(TV_APP_TAG, "Featured logo failed: ${item.name}: $logoUrl", it.result.throwable) }
                    )
                } else {
                    Text(
                        text = initials,
                        color = nocturne.background,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            Column {
                Text(
                    text = item.name,
                    color = if (focused) nocturne.goldLight else nocturne.text,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = item.category,
                    color = nocturne.goldSoft,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
