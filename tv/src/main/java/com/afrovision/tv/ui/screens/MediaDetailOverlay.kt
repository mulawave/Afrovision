package com.afrovision.tv.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.afrovision.tv.R
import com.afrovision.tv.data.PlayerMedia
import com.afrovision.tv.ui.components.rememberCacheableImageRequest
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

/**
 * A poster tap on mobile opens a details screen (poster, synopsis, Play
 * button) - it never starts playback directly. This mirrors that as a
 * full-screen overlay (same pattern CatchUpDetailOverlay already uses on
 * this app) instead of jumping straight into the player.
 */
@Composable
fun MediaDetailOverlay(
    title: String,
    imageUrl: String?,
    meta: String,
    description: String,
    playLabel: String,
    canPlay: Boolean,
    onPlay: () -> Unit,
    onDismiss: () -> Unit
) {
    val nocturne = LocalNocturne.current
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        BackHandler { TvSoundManager.play("back"); onDismiss() }
        Box(
            modifier = Modifier.fillMaxSize().background(nocturne.background.copy(alpha = 0.96f)),
            contentAlignment = Alignment.Center
        ) {
            Row(
                modifier = Modifier.fillMaxSize().padding(horizontal = 60.dp, vertical = 48.dp),
                horizontalArrangement = Arrangement.spacedBy(48.dp)
            ) {
                Box(
                    modifier = Modifier
                        .width(420.dp)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(14.dp))
                        .background(nocturne.surfaceRaised)
                ) {
                    if (!imageUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = rememberCacheableImageRequest(imageUrl),
                            contentDescription = title,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }

                Column(
                    modifier = Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = title,
                        color = nocturne.text,
                        fontSize = 52.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (meta.isNotBlank()) {
                        Text(text = meta, color = nocturne.textFaint, fontSize = 20.sp)
                    }
                    if (description.isNotBlank()) {
                        Text(
                            text = description,
                            color = nocturne.textMuted,
                            fontSize = 20.sp,
                            lineHeight = 28.sp,
                            maxLines = 8,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(20.dp),
                        modifier = Modifier.padding(top = 12.dp)
                    ) {
                        DetailOverlayButton(label = playLabel, accent = true, enabled = canPlay, iconRes = R.drawable.ic_ph_play, onClick = onPlay)
                        DetailOverlayButton(label = "Close", accent = false, enabled = true, iconRes = null, onClick = onDismiss)
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailOverlayButton(label: String, accent: Boolean, enabled: Boolean, iconRes: Int?, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val bg = when {
        focused -> nocturne.gold
        accent -> nocturne.accent900
        else -> Color.Transparent
    }
    val fg = when {
        focused -> nocturne.background
        accent -> nocturne.accentLight
        else -> nocturne.textMuted
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .clickable(interactionSource = interactionSource, indication = null, enabled = enabled, onClick = { TvSoundManager.play("select"); onClick() })
            .padding(horizontal = 28.dp, vertical = 14.dp)
    ) {
        if (iconRes != null) {
            Icon(painter = painterResource(iconRes), contentDescription = null, tint = fg, modifier = Modifier)
        }
        Text(text = label, color = if (enabled) fg else nocturne.textFaint, fontSize = 20.sp, fontWeight = FontWeight.Medium)
    }
}

fun formatMovieDuration(minutes: Int?): String {
    if (minutes == null || minutes <= 0) return ""
    val h = minutes / 60
    val m = minutes % 60
    return if (h > 0) "${h}h ${m.toString().padStart(2, '0')}m" else "${m}m"
}

/** First episode of the first season, if any - used for a series' Play button since there is no "play the whole series" concept. */
fun firstEpisodePlayerMedia(series: com.afrovision.tv.data.api.model.Series): PlayerMedia? {
    val episode = series.seasons.firstOrNull()?.episodes?.firstOrNull() ?: return null
    val url = episode.streamUrl
    if (url.isNullOrBlank()) return null
    return PlayerMedia(
        id = episode.id,
        title = episode.title.ifBlank { series.title },
        streamUrl = url,
        externalUrl = episode.externalUrl,
        isLive = false,
        progress = 0,
        duration = (episode.duration ?: 0).toLong() * 1000L,
        // "episode" (not "series") so the player records watch progress
        // under the type the backend accepts.
        mediaType = "episode",
        channelId = series.channelId,
        seriesId = series.id
    )
}
