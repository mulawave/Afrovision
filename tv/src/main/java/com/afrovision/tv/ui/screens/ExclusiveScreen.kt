package com.afrovision.tv.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.afrovision.tv.R
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.api.model.ChannelSubscription
import com.afrovision.tv.data.api.model.ContinueReadingRecord
import com.afrovision.tv.data.api.model.LibraryFeedItem
import com.afrovision.tv.data.toMediaCard
import com.afrovision.tv.data.toPlayerMedia
import com.afrovision.tv.ui.components.LibraryShelf
import com.afrovision.tv.ui.components.PosterCard
import com.afrovision.tv.ui.components.ShelfPill
import com.afrovision.tv.ui.components.RailRow
import com.afrovision.tv.ui.components.rememberCacheableImageRequest
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

private enum class ExclusiveTab(val label: String) { Movies("Movies"), Series("Series"), Library("Library"), Waves("Waves") }

/**
 * Everything exclusive lives here and nowhere else: movies, series, library
 * and waves from the exclusive channels this account owns or is a member of
 * (the menu item itself is hidden from everyone else - see NavRail).
 */
@Composable
fun ExclusiveScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val moviesState = viewModel.exclusiveMovies
    val seriesState = viewModel.exclusiveSeries
    val libraryState = viewModel.exclusiveLibrary
    val wavesState = viewModel.exclusiveWaves
    val subsState = viewModel.channelSubscriptions
    var tab by remember { mutableStateOf(ExclusiveTab.Movies) }

    LaunchedEffect(Unit) {
        if (moviesState !is LoadState.Success) viewModel.loadExclusiveContent()
        if (subsState !is LoadState.Success) viewModel.loadChannelSubscriptions()
        viewModel.loadExclusiveContinueReading()
    }

    val movies = (moviesState as? LoadState.Success)?.data.orEmpty()
    val series = (seriesState as? LoadState.Success)?.data.orEmpty()
    val library = (libraryState as? LoadState.Success)?.data.orEmpty()
    val waves = (wavesState as? LoadState.Success)?.data.orEmpty()
    val totalCount = movies.size + series.size + library.size + waves.size
    val stillLoading = moviesState is LoadState.Loading || seriesState is LoadState.Loading ||
        libraryState is LoadState.Loading || wavesState is LoadState.Loading

    val subs = (subsState as? LoadState.Success)?.data.orEmpty()
    val expiredFeeBasedSubs = subs.filter { !it.isActive && (it.amount > 0 || it.isPremium) }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)) {
        Column(modifier = Modifier.fillMaxSize()) {
            ExclusiveHeader(
                subtitle = if (stillLoading) "Loading your exclusive content…" else "$totalCount titles across your exclusive channels",
                tab = tab,
                onTab = { tab = it }
            )

            if (tab == ExclusiveTab.Waves) {
                if (waves.isEmpty()) {
                    EmptyTabMessage(
                        text = if (wavesState is LoadState.Loading) "Loading exclusive waves…" else "No exclusive waves yet.",
                        modifier = Modifier.weight(1f)
                    )
                } else {
                    WaveCarousel(
                        viewModel = viewModel,
                        rawWaves = waves,
                        paginated = false,
                        recentChannels = emptyList(),
                        continueWatching = emptyList(),
                        modifier = Modifier.weight(1f).padding(top = 18.dp)
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    contentPadding = PaddingValues(bottom = 60.dp)
                ) {
                    if (expiredFeeBasedSubs.isNotEmpty()) {
                        items(expiredFeeBasedSubs, key = { "renew-${it.channelId}" }) { sub -> RenewCard(sub) }
                    }
                    when (tab) {
                        ExclusiveTab.Movies -> if (movies.isNotEmpty()) {
                            val moviesById = movies.associateBy { it.id }
                            item(key = "movies") {
                                RailRow(
                                    title = "Exclusive movies",
                                    subtitle = "${movies.size} titles",
                                    items = movies.map { it.toMediaCard() },
                                    cardContent = { card -> PosterCard(item = card, onClick = { moviesById[card.id]?.let { viewModel.selectMovie(it) } }) }
                                )
                            }
                        } else {
                            item(key = "movies-empty") { EmptyTabMessage(if (stillLoading) "Loading…" else "No exclusive movies yet.") }
                        }
                        ExclusiveTab.Series -> if (series.isNotEmpty()) {
                            val seriesById = series.associateBy { it.id }
                            item(key = "series") {
                                RailRow(
                                    title = "Exclusive series",
                                    subtitle = "${series.size} titles",
                                    items = series.map { it.toMediaCard() },
                                    cardContent = { card -> PosterCard(item = card, onClick = { seriesById[card.id]?.let { viewModel.selectSeries(it) } }) }
                                )
                            }
                        } else {
                            item(key = "series-empty") { EmptyTabMessage(if (stillLoading) "Loading…" else "No exclusive series yet.") }
                        }
                        ExclusiveTab.Library -> item(key = "shelf") {
                            LibraryShelf(
                                library = library,
                                loading = libraryState is LoadState.Loading,
                                continueReading = (viewModel.exclusiveContinueReading as? LoadState.Success)?.data.orEmpty(),
                                emptyText = "No exclusive library titles yet.",
                                onOpen = { viewModel.openReaderScreen(it.channelId, it.id) }
                            )
                        }
                        ExclusiveTab.Waves -> Unit
                    }
                }
            }
        }

        viewModel.selectedMovie?.let { movie ->
            MediaDetailOverlay(
                title = movie.title,
                imageUrl = movie.posterUrl,
                meta = formatMovieDuration(movie.duration),
                description = movie.description ?: "",
                playLabel = "Play",
                canPlay = !movie.streamUrl.isNullOrBlank(),
                onPlay = { viewModel.play(movie.toMediaCard().toPlayerMedia()); viewModel.clearSelectedMovie() },
                onDismiss = { viewModel.clearSelectedMovie() }
            )
        }
        viewModel.selectedSeries?.let { s ->
            MediaDetailOverlay(
                title = s.title,
                imageUrl = s.posterUrl,
                meta = "${s.seasons.size} season${if (s.seasons.size == 1) "" else "s"}",
                description = s.description ?: "",
                playLabel = "Play S1E1",
                canPlay = firstEpisodePlayerMedia(s) != null,
                onPlay = {
                    firstEpisodePlayerMedia(s)?.let { viewModel.play(it) }
                    viewModel.clearSelectedSeries()
                },
                onDismiss = { viewModel.clearSelectedSeries() }
            )
        }
    }
}

@Composable
private fun ExclusiveHeader(subtitle: String, tab: ExclusiveTab, onTab: (ExclusiveTab) -> Unit) {
    val nocturne = LocalNocturne.current
    Column(modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 52.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Icon(
                painter = painterResource(R.drawable.ic_ph_exclusive),
                contentDescription = null,
                tint = nocturne.gold,
                modifier = Modifier.size(36.dp)
            )
            Text(text = "Exclusive", color = nocturne.text, fontSize = 48.sp, fontWeight = FontWeight.SemiBold)
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(nocturne.gold.copy(alpha = 0.14f))
                    .border(1.dp, nocturne.gold.copy(alpha = 0.6f), RoundedCornerShape(999.dp))
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            ) {
                Text(text = "MEMBERS ONLY", color = nocturne.goldLight, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)
            }
        }
        Text(text = subtitle, color = nocturne.textHint, fontSize = 18.sp, modifier = Modifier.padding(top = 6.dp))
        Row(
            modifier = Modifier
                .padding(top = 20.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(nocturne.surface)
                .padding(4.dp)
        ) {
            ExclusiveTab.entries.forEach { value ->
                ShelfPill(label = value.label, selected = tab == value, onClick = { onTab(value) })
            }
        }
    }
}

// ── Shared bits ──────────────────────────────────────────────────────────

@Composable
private fun EmptyTabMessage(text: String, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    Box(modifier = modifier.fillMaxWidth().height(220.dp), contentAlignment = Alignment.Center) {
        Text(text = text, color = nocturne.textFaint, fontSize = 22.sp)
    }
}

// Renew hands off to the phone via QR (scanning opens the real paywall
// there) rather than attempting in-app payment on a TV remote.
@Composable
private fun RenewCard(sub: ChannelSubscription) {
    val nocturne = LocalNocturne.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 60.dp, end = 60.dp, top = 20.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFF17224A))
            .border(1.dp, Color(0xFFA8761F), RoundedCornerShape(14.dp))
            .padding(20.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = "MEMBERSHIP EXPIRED", color = nocturne.goldSoft, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text(text = sub.channelName, color = nocturne.text, fontSize = 22.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 2.dp))
            Text(
                text = "Renew to get back exclusive movies, series and your saved library on ${sub.channelName}.",
                color = nocturne.goldLight,
                fontSize = 15.sp,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White)
                    .padding(8.dp),
                contentAlignment = Alignment.Center
            ) {
                androidx.compose.foundation.Image(
                    bitmap = generateQrBitmap("https://afrovision.online/pricing", 200).asImageBitmap(),
                    contentDescription = "Scan to renew on your phone",
                    modifier = Modifier.fillMaxSize()
                )
            }
            Text(text = "Scan to renew on your phone", color = nocturne.textFaint, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp).width(120.dp))
        }
    }
}
