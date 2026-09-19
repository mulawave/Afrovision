package com.afrovision.tv.ui.screens

import com.afrovision.tv.ui.components.rememberCacheableImageRequest
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.api.model.FeedPost
import com.afrovision.tv.ui.theme.LocalNocturne
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.R

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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private fun formatTimestamp(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    val seconds = diff / 1000
    val minutes = seconds / 60
    val hours = minutes / 60
    val days = hours / 24

    return when {
        seconds < 60 -> "Just now"
        minutes < 60 -> "${minutes}m ago"
        hours < 24 -> "${hours}h ago"
        days < 7 -> "${days}d ago"
        else -> {
            val sdf = SimpleDateFormat("MMM d", Locale.getDefault())
            sdf.format(Date(timestamp))
        }
    }
}

private val feedFilters = listOf("Following", "Popular", "Nearby")

@Composable
fun FeedScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val feed = viewModel.feed
    var selectedFilter by remember { mutableStateOf("Following") }

    LaunchedEffect(Unit) { if (feed !is LoadState.Success) viewModel.loadFeed() }

    val items = when (feed) {
        is LoadState.Success -> feed.data
        else -> emptyList()
    }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 60.dp, end = 60.dp, top = 60.dp, bottom = 60.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            item {
                Column {
                    Text(text = "Feed", color = nocturne.text, fontSize = 52.sp)
                    Text(
                        text = "What the Afrovision community is sharing",
                        color = nocturne.textHint,
                        fontSize = 20.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(top = 24.dp)) {
                        ComposeBar()
                        feedFilters.forEach { filter ->
                            FeedFilterChip(
                                label = filter,
                                selected = filter == selectedFilter,
                                onClick = { selectedFilter = filter }
                            )
                        }
                    }
                }
            }
            if (items.isNotEmpty()) {
                items(items, key = { it.id }) { post ->
                    FeedCard(post = post, viewModel = viewModel)
                }
                item {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        FeedFilterChip(label = "Load more", selected = false, onClick = { TvSoundManager.play("more"); viewModel.loadFeed() })
                    }
                }
            } else {
                item {
                    Box(modifier = Modifier.fillMaxWidth().height(240.dp), contentAlignment = Alignment.Center) {
                        Text(text = "Loading feed…", color = nocturne.textFaint, fontSize = 22.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun ComposeBar() {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier
            .width(420.dp)
            .clip(RoundedCornerShape(12.dp))
            .border(if (focused) 2.dp else 1.dp, if (focused) nocturne.gold else nocturne.borderCard, RoundedCornerShape(12.dp))
            .clickable(interactionSource = interactionSource, indication = null, onClick = {})
            .padding(horizontal = 22.dp, vertical = 16.dp)
    ) {
        Icon(
            painter = androidx.compose.ui.res.painterResource(R.drawable.ic_ph_plus_circle),
            contentDescription = null,
            tint = if (focused) nocturne.goldLight else nocturne.textFaint,
            modifier = Modifier.size(24.dp)
        )
        Text(
            text = "Share a photo, link, video or show…",
            color = if (focused) nocturne.text else nocturne.textFaint,
            fontSize = 18.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun FeedFilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) nocturne.accent900 else androidx.compose.ui.graphics.Color.Transparent)
            .border(
                if (focused) 2.dp else 1.dp,
                if (focused) nocturne.gold else if (selected) nocturne.accent700 else nocturne.borderCard,
                RoundedCornerShape(999.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 22.dp, vertical = 11.dp)
    ) {
        Text(text = label, color = if (focused) nocturne.goldLight else if (selected) nocturne.accentLight else nocturne.textMuted, fontSize = 19.sp)
    }
}

@Composable
private fun FeedCard(post: FeedPost, viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(
                2.dp,
                if (focused) nocturne.accent else nocturne.borderCard,
                RoundedCornerShape(12.dp)
            )
            .background(nocturne.surface)
            .clickable(interactionSource = interactionSource, indication = null) {
                post.videoUrl?.let { viewModel.playVideoUrl(it) }
            }
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(50))
                    .background(nocturne.accent900)
                    .border(1.dp, nocturne.accent700, RoundedCornerShape(50)),
                contentAlignment = Alignment.Center
            ) {
                Text(text = post.title.take(2).uppercase(), color = nocturne.accentLight, fontSize = 16.sp)
            }
            Column {
                Text(text = post.title, color = nocturne.text, fontSize = 20.sp, fontWeight = FontWeight.Medium)
                Text(text = formatTimestamp(post.createdAt), color = nocturne.textFaint, fontSize = 15.sp)
            }
        }
        Text(text = post.description ?: "", color = nocturne.text, fontSize = 18.sp, lineHeight = 26.sp)
        if (!post.thumbnailUrl.isNullOrBlank()) {
            AsyncImage(
                model = rememberCacheableImageRequest(post.thumbnailUrl),
                contentDescription = null,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(240.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(nocturne.surfaceRaised)
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(28.dp)) {
            FeedActionIcon(icon = androidx.compose.ui.res.painterResource(com.afrovision.tv.R.drawable.ic_ph_heart), label = "Like")
            FeedActionIcon(icon = androidx.compose.ui.res.painterResource(com.afrovision.tv.R.drawable.ic_ph_chat_circle), label = "Comment")
            FeedActionIcon(icon = androidx.compose.ui.res.painterResource(com.afrovision.tv.R.drawable.ic_ph_repeat), label = "Reshare")
            if (!post.videoUrl.isNullOrBlank()) {
                FeedActionIcon(
                    icon = androidx.compose.ui.res.painterResource(com.afrovision.tv.R.drawable.ic_ph_play_circle),
                    label = "Watch",
                    highlighted = true,
                    onClick = { viewModel.playVideoUrl(post.videoUrl) }
                )
            }
        }
    }
}

@Composable
private fun FeedActionIcon(icon: androidx.compose.ui.graphics.painter.Painter, label: String, highlighted: Boolean = false, onClick: (() -> Unit)? = null) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .border(
                if (focused) 2.dp else 1.dp,
                if (focused) nocturne.gold else if (highlighted) nocturne.accent700 else nocturne.borderCard,
                RoundedCornerShape(999.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null, enabled = onClick != null) { onClick?.invoke() }
            .padding(horizontal = 20.dp, vertical = 11.dp)
    ) {
        Icon(
            painter = icon,
            contentDescription = label,
            tint = if (focused) nocturne.goldLight else if (highlighted) nocturne.accentLight else nocturne.textMuted,
            modifier = Modifier.size(20.dp)
        )
        Text(text = label, color = if (focused) nocturne.goldLight else if (highlighted) nocturne.accentLight else nocturne.textMuted, fontSize = 17.sp)
    }
}
