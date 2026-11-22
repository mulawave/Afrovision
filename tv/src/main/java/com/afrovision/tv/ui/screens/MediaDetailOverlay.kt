package com.afrovision.tv.ui.screens

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
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
import com.afrovision.tv.data.DownloadItem
import com.afrovision.tv.data.MediaCard
import com.afrovision.tv.data.PlayerMedia
import com.afrovision.tv.data.api.model.CatchUpItem
import com.afrovision.tv.data.api.model.Episode
import com.afrovision.tv.data.api.model.Series
import com.afrovision.tv.ui.components.PosterCard
import com.afrovision.tv.ui.components.rememberCacheableImageRequest
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

/**
 * Full-screen TV details experience for Movies & Series (Public and Exclusive):
 * - Widescreen TMDB backdrop hero + poster + rating/year/genres/runtime
 * - Non-wrapping horizontal action row (Stream/Resume/Offline, Download/Pause/Resume/Cancel/Delete, Close)
 * - Full D-pad navigable Cast & Crew row (every member focusable, left/right scrollable)
 * - Season tabs + Episode list with per-episode Resume progress & Download/Pause/Cancel controls
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
    onDismiss: () -> Unit,
    series: Series? = null,
    onPlayEpisode: ((PlayerMedia) -> Unit)? = null,
    resumeProgressMs: Long = 0L,
    tmdb: CatchUpItem? = null,
    downloadItem: DownloadItem? = null,
    onDownload: (() -> Unit)? = null,
    onPauseDownload: ((String) -> Unit)? = null,
    onResumeDownload: ((String) -> Unit)? = null,
    onDeleteDownload: (() -> Unit)? = null,
    downloads: List<DownloadItem> = emptyList(),
    onDownloadEpisode: ((Episode) -> Unit)? = null,
    onDeleteEpisodeDownload: ((String) -> Unit)? = null,
    continueWatching: List<MediaCard> = emptyList(),
    similarItems: List<MediaCard> = emptyList(),
    onOpenSimilar: ((MediaCard) -> Unit)? = null,
    seriesDetailLoading: Boolean = false,
    seriesDetailError: String? = null,
    onRetrySeries: (() -> Unit)? = null
) {
    val nocturne = LocalNocturne.current
    var selectedSeasonIdx by remember(series?.id) { mutableIntStateOf(0) }
    val primaryFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        runCatching { primaryFocus.requestFocus() }
    }

    val effectivePlayLabel = when {
        downloadItem?.completed == true && series == null -> "Play Offline"
        resumeProgressMs > 5_000L && series == null -> "Resume"
        else -> playLabel
    }

    val tmdbMetaParts = remember(meta, tmdb) {
        buildList {
            if (meta.isNotBlank()) add(meta)
            val rating = tmdb?.rating ?: 0.0
            if (rating > 0.0) add("★ ${"%.1f".format(rating)}")
            val year = tmdb?.releaseDate?.take(4)
            if (!year.isNullOrBlank()) add(year)
            if (tmdb != null && tmdb.genres.isNotEmpty()) add(tmdb.genres.take(3).joinToString(" · "))
        }.joinToString("   •   ")
    }
    val effectiveDescription = description.ifBlank { tmdb?.overview.orEmpty() }
    val heroBannerUrl = tmdb?.backdropUrl?.takeIf { it.isNotBlank() } ?: imageUrl
    val episodeProgressById = remember(continueWatching) {
        continueWatching.filter { it.mediaType == "episode" }.associateBy { it.id }
    }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        BackHandler { TvSoundManager.play("back"); onDismiss() }
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(nocturne.primaryGradient)
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 56.dp)
            ) {
                item(key = "hero") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(340.dp)
                    ) {
                        if (!heroBannerUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = rememberCacheableImageRequest(heroBannerUrl),
                                contentDescription = title,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        0f to nocturne.background.copy(alpha = 0.28f),
                                        0.6f to nocturne.background.copy(alpha = 0.72f),
                                        1f to nocturne.background
                                    )
                                )
                        )
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 60.dp, vertical = 28.dp),
                            verticalAlignment = Alignment.Bottom,
                            horizontalArrangement = Arrangement.spacedBy(32.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .width(175.dp)
                                    .height(256.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(nocturne.surfaceRaised)
                                    .border(1.dp, nocturne.borderCard, RoundedCornerShape(14.dp))
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
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text(
                                    text = title,
                                    color = nocturne.text,
                                    fontSize = 44.sp,
                                    lineHeight = 50.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                                if (tmdbMetaParts.isNotBlank()) {
                                    Text(
                                        text = tmdbMetaParts,
                                        color = nocturne.goldLight,
                                        fontSize = 18.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                }

                item(key = "actions") {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 60.dp, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            DetailOverlayButton(
                                label = effectivePlayLabel,
                                accent = true,
                                enabled = canPlay,
                                iconRes = R.drawable.ic_ph_play,
                                modifier = Modifier.focusRequester(primaryFocus),
                                onClick = onPlay
                            )

                            if (onDownload != null && series == null) {
                                when {
                                    downloadItem == null -> {
                                        DetailOverlayButton(
                                            label = "Download",
                                            accent = false,
                                            enabled = canPlay,
                                            iconRes = R.drawable.ic_ph_downloads,
                                            onClick = onDownload
                                        )
                                    }
                                    downloadItem.status == "downloading" -> {
                                        DetailOverlayButton(
                                            label = "Pause",
                                            accent = false,
                                            enabled = true,
                                            iconRes = R.drawable.ic_ph_pause,
                                            onClick = { onPauseDownload?.invoke(downloadItem.id) }
                                        )
                                        DetailOverlayButton(
                                            label = "Cancel",
                                            accent = false,
                                            enabled = true,
                                            iconRes = null,
                                            onClick = { onDeleteDownload?.invoke() }
                                        )
                                    }
                                    downloadItem.status == "paused" || downloadItem.status == "failed" -> {
                                        DetailOverlayButton(
                                            label = if (downloadItem.status == "failed") "Retry" else "Resume DL",
                                            accent = false,
                                            enabled = true,
                                            iconRes = R.drawable.ic_ph_play,
                                            onClick = { onResumeDownload?.invoke(downloadItem.id) }
                                        )
                                        DetailOverlayButton(
                                            label = "Cancel",
                                            accent = false,
                                            enabled = true,
                                            iconRes = null,
                                            onClick = { onDeleteDownload?.invoke() }
                                        )
                                    }
                                    downloadItem.completed -> {
                                        DetailOverlayButton(
                                            label = "Delete Offline",
                                            accent = false,
                                            enabled = true,
                                            iconRes = null,
                                            onClick = { onDeleteDownload?.invoke() }
                                        )
                                    }
                                }
                            }

                            DetailOverlayButton(
                                label = "Close",
                                accent = false,
                                enabled = true,
                                iconRes = null,
                                onClick = onDismiss
                            )
                        }

                        if (downloadItem != null && !downloadItem.completed) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(nocturne.surface)
                                    .padding(horizontal = 16.dp, vertical = 10.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                val pct = (downloadItem.progress * 100).toInt()
                                val statusMsg = when (downloadItem.status) {
                                    "paused" -> "Download paused at $pct%"
                                    "failed" -> "Download failed — select Retry or Cancel"
                                    else -> "Downloading offline copy… $pct%"
                                }
                                Text(
                                    text = statusMsg,
                                    color = if (downloadItem.status == "failed") Color(0xFFFF6B6B) else nocturne.goldLight,
                                    fontSize = 15.sp
                                )
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp))
                                        .background(nocturne.borderCard)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth(downloadItem.progress.coerceIn(0f, 1f))
                                            .fillMaxHeight()
                                            .background(if (downloadItem.status == "paused") nocturne.gold else nocturne.accent)
                                    )
                                }
                            }
                        }

                        if (effectiveDescription.isNotBlank()) {
                            Text(
                                text = effectiveDescription,
                                color = nocturne.textMuted,
                                fontSize = 19.sp,
                                lineHeight = 27.sp,
                                maxLines = 4,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }

                if (tmdb != null && tmdb.cast.isNotEmpty()) {
                    item(key = "cast-header") {
                        Text(
                            text = "Cast & Crew",
                            color = nocturne.text,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 12.dp, bottom = 10.dp)
                        )
                    }
                    item(key = "cast-row") {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 60.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            itemsIndexed(tmdb.cast.take(15)) { _, person ->
                                val castInteraction = remember { MutableInteractionSource() }
                                val castFocused by castInteraction.collectIsFocusedAsState()
                                LaunchedEffect(castFocused) { if (castFocused) TvSoundManager.play("move") }
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(999.dp))
                                        .background(if (castFocused) nocturne.gold.copy(alpha = 0.2f) else nocturne.surface)
                                        .border(
                                            if (castFocused) 2.dp else 1.dp,
                                            if (castFocused) nocturne.gold else nocturne.borderCard,
                                            RoundedCornerShape(999.dp)
                                        )
                                        .focusable(interactionSource = castInteraction)
                                        .padding(start = 8.dp, end = 18.dp, top = 8.dp, bottom = 8.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(44.dp)
                                            .clip(CircleShape)
                                            .background(nocturne.surfaceRaised)
                                    ) {
                                        if (!person.profileUrl.isNullOrBlank()) {
                                            AsyncImage(
                                                model = rememberCacheableImageRequest(person.profileUrl),
                                                contentDescription = person.name,
                                                contentScale = ContentScale.Crop,
                                                modifier = Modifier.fillMaxSize()
                                            )
                                        }
                                    }
                                    Column {
                                        Text(
                                            text = person.name,
                                            color = if (castFocused) nocturne.goldLight else nocturne.text,
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Medium,
                                            maxLines = 1,
                                            softWrap = false
                                        )
                                        val roleLabel = person.character?.takeIf { it.isNotBlank() } ?: person.job.orEmpty()
                                        if (roleLabel.isNotBlank()) {
                                            Text(
                                                text = roleLabel,
                                                color = nocturne.textFaint,
                                                fontSize = 13.sp,
                                                maxLines = 1,
                                                softWrap = false
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (series != null && series.seasons.isNotEmpty() && onPlayEpisode != null) {
                    val seasons = series.seasons
                    val safeIdx = selectedSeasonIdx.coerceIn(0, seasons.lastIndex)
                    val activeSeason = seasons[safeIdx]

                    item(key = "seasons-header") {
                        Column(modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 20.dp)) {
                            Text(
                                text = "Seasons (${seasons.size})",
                                color = nocturne.text,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(bottom = 10.dp)
                            )
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                itemsIndexed(seasons) { idx, season ->
                                    val sNum = if (season.number > 0) season.number else (idx + 1)
                                    val label = "Season $sNum (${season.episodes.size})"
                                    SeasonPill(
                                        label = label,
                                        selected = idx == safeIdx,
                                        onClick = { selectedSeasonIdx = idx }
                                    )
                                }
                            }
                            Text(
                                text = "Episodes (${activeSeason.episodes.size})",
                                color = nocturne.text,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(top = 18.dp, bottom = 10.dp)
                            )
                        }
                    }

                    itemsIndexed(
                        activeSeason.episodes,
                        key = { idx, ep -> "${activeSeason.id}-${ep.id}-$idx" }
                    ) { idx, ep ->
                        val epDownload = downloads.firstOrNull { it.id == ep.id }
                        val cw = episodeProgressById[ep.id]
                        val savedMs = cw?.let { (it.progress * it.duration).toLong() } ?: 0L
                        Box(modifier = Modifier.padding(horizontal = 60.dp, vertical = 5.dp)) {
                            EpisodeRowCard(
                                episode = ep,
                                fallbackNumber = idx + 1,
                                progressFraction = cw?.progress ?: 0f,
                                downloadItem = epDownload,
                                onDownload = onDownloadEpisode?.let { cb -> { cb(ep) } },
                                onPauseDownload = onPauseDownload?.let { cb -> { cb(ep.id) } },
                                onResumeDownload = onResumeDownload?.let { cb -> { cb(ep.id) } },
                                onDeleteDownload = onDeleteEpisodeDownload?.let { cb -> { cb(ep.id) } },
                                onClick = {
                                    episodeToPlayerMedia(series, ep)?.let { pm ->
                                        onPlayEpisode(pm.copy(progress = savedMs))
                                    }
                                }
                            )
                        }
                    }
                } else if (series != null) {
                    item(key = "seasons-status") {
                        Row(
                            modifier = Modifier.padding(horizontal = 60.dp, vertical = 20.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Text(
                                text = when {
                                    seriesDetailLoading -> "Loading seasons & episodes…"
                                    seriesDetailError != null -> seriesDetailError
                                    else -> "No seasons published yet."
                                },
                                color = if (seriesDetailError != null) Color(0xFFFF6B6B) else nocturne.textFaint,
                                fontSize = 18.sp
                            )
                            if (!seriesDetailLoading && onRetrySeries != null) {
                                EpisodeSmallButton("Retry", onRetrySeries)
                            }
                        }
                    }
                }

                if (similarItems.isNotEmpty() && onOpenSimilar != null) {
                    item(key = "more-like-this-header") {
                        Text(
                            text = "More like this",
                            color = nocturne.text,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 24.dp, bottom = 12.dp)
                        )
                    }
                    item(key = "more-like-this-row") {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 60.dp),
                            horizontalArrangement = Arrangement.spacedBy(20.dp)
                        ) {
                            itemsIndexed(similarItems.take(12), key = { _, item -> "sim-${item.id}" }) { _, item ->
                                PosterCard(item = item, onClick = { onOpenSimilar(item) })
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SeasonPill(label: String, selected: Boolean, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(
                when {
                    focused -> nocturne.gold
                    selected -> nocturne.accent900
                    else -> nocturne.surface
                }
            )
            .border(
                if (focused) 2.dp else 1.dp,
                if (focused) nocturne.goldLight else nocturne.borderCard,
                RoundedCornerShape(999.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null) {
                TvSoundManager.play("select")
                onClick()
            }
            .padding(horizontal = 22.dp, vertical = 10.dp)
    ) {
        Text(
            text = label,
            color = if (focused) nocturne.background else if (selected) nocturne.accentLight else nocturne.textMuted,
            fontSize = 18.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            softWrap = false
        )
    }
}

@Composable
private fun EpisodeRowCard(
    episode: Episode,
    fallbackNumber: Int,
    progressFraction: Float = 0f,
    downloadItem: DownloadItem? = null,
    onDownload: (() -> Unit)? = null,
    onPauseDownload: (() -> Unit)? = null,
    onResumeDownload: (() -> Unit)? = null,
    onDeleteDownload: (() -> Unit)? = null,
    onClick: () -> Unit
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    val epNum = if (episode.number > 0) episode.number else fallbackNumber
    val playable = !episode.streamUrl.isNullOrBlank() || !episode.externalUrl.isNullOrBlank() || downloadItem?.completed == true

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (focused) nocturne.gold.copy(alpha = 0.14f) else nocturne.surface)
            .border(
                if (focused) 2.dp else 1.dp,
                if (focused) nocturne.gold else nocturne.borderCard,
                RoundedCornerShape(12.dp)
            )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier
                    .weight(1f)
                    .clickable(
                        interactionSource = interactionSource,
                        indication = null,
                        enabled = playable
                    ) {
                        TvSoundManager.play("select")
                        onClick()
                    },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "E$epNum",
                    color = if (focused) nocturne.goldLight else nocturne.accentSoft,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = episode.title.ifBlank { "Episode $epNum" },
                        color = if (focused) nocturne.goldLight else nocturne.text,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    val dur = formatMovieDuration(episode.duration?.let { it / 60 })
                    val sub = buildList {
                        if (dur.isNotBlank()) add(dur)
                        if (progressFraction > 0.02f) add("${(progressFraction * 100).toInt()}% watched")
                    }.joinToString(" · ")
                    if (sub.isNotBlank()) {
                        Text(text = sub, color = nocturne.textFaint, fontSize = 14.sp)
                    }
                }
                Text(
                    text = when {
                        !playable -> "Unavailable"
                        downloadItem?.completed == true -> "Play Offline"
                        progressFraction > 0.02f -> "Resume"
                        else -> "Stream"
                    },
                    color = if (focused) nocturne.goldLight else if (playable) nocturne.accentLight else nocturne.textFaint,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    softWrap = false
                )
            }

            if (playable && onDownload != null) {
                when {
                    downloadItem == null -> {
                        EpisodeSmallButton("Download", onDownload)
                    }
                    downloadItem.status == "downloading" -> {
                        EpisodeSmallButton("${(downloadItem.progress * 100).toInt()}% · Pause") {
                            onPauseDownload?.invoke()
                        }
                        EpisodeSmallButton("Cancel") { onDeleteDownload?.invoke() }
                    }
                    downloadItem.status == "paused" || downloadItem.status == "failed" -> {
                        EpisodeSmallButton(if (downloadItem.status == "failed") "Retry" else "Resume") {
                            onResumeDownload?.invoke()
                        }
                        EpisodeSmallButton("Cancel") { onDeleteDownload?.invoke() }
                    }
                    downloadItem.completed -> {
                        EpisodeSmallButton("Offline ✓ (Del)") { onDeleteDownload?.invoke() }
                    }
                }
            }
        }
        if (progressFraction > 0.02f) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(3.dp)
                    .background(nocturne.borderCard)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(progressFraction.coerceIn(0f, 1f))
                        .fillMaxHeight()
                        .background(nocturne.gold)
                )
            }
        }
    }
}

@Composable
private fun EpisodeSmallButton(label: String, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (focused) nocturne.gold else nocturne.surfaceRaised)
            .border(1.dp, if (focused) nocturne.goldLight else nocturne.borderCard, RoundedCornerShape(8.dp))
            .clickable(interactionSource = interactionSource, indication = null) {
                TvSoundManager.play("select")
                onClick()
            }
            .padding(horizontal = 12.dp, vertical = 7.dp)
    ) {
        Text(
            text = label,
            color = if (focused) nocturne.background else nocturne.accentLight,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            softWrap = false
        )
    }
}

@Composable
private fun DetailOverlayButton(
    label: String,
    accent: Boolean,
    enabled: Boolean,
    iconRes: Int?,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
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
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(
                if (focused) 2.dp else 1.dp,
                if (focused) nocturne.goldLight else if (accent) nocturne.accent700 else nocturne.borderCard,
                RoundedCornerShape(10.dp)
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                enabled = true,
                onClick = {
                    if (enabled) {
                        TvSoundManager.play("select")
                        onClick()
                    }
                }
            )
            .padding(horizontal = 24.dp, vertical = 13.dp)
    ) {
        if (iconRes != null) {
            Icon(
                painter = painterResource(iconRes),
                contentDescription = null,
                tint = fg,
                modifier = Modifier.size(18.dp)
            )
        }
        Text(
            text = label,
            color = if (enabled) fg else nocturne.textFaint,
            fontSize = 19.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            softWrap = false
        )
    }
}

fun formatMovieDuration(minutes: Int?): String {
    if (minutes == null || minutes <= 0) return ""
    val h = minutes / 60
    val m = minutes % 60
    return if (h > 0) "${h}h ${m.toString().padStart(2, '0')}m" else "${m}m"
}

fun episodeToPlayerMedia(series: Series, episode: Episode): PlayerMedia? {
    val url = episode.streamUrl?.takeIf { it.isNotBlank() } ?: episode.externalUrl?.takeIf { it.isNotBlank() } ?: return null
    return PlayerMedia(
        id = episode.id,
        title = "${series.title} - ${episode.title.ifBlank { "Episode ${if (episode.number > 0) episode.number else 1}" }}",
        streamUrl = url,
        externalUrl = episode.externalUrl,
        isLive = false,
        progress = 0,
        duration = (episode.duration ?: 0).toLong() * 1000L,
        mediaType = "episode",
        channelId = series.channelId,
        seriesId = series.id
    )
}

/** First episode of the first season, if any - used for a series' Play button. */
fun firstEpisodePlayerMedia(series: Series): PlayerMedia? {
    val episode = series.seasons.firstOrNull()?.episodes?.firstOrNull() ?: return null
    return episodeToPlayerMedia(series, episode)
}
