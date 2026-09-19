package com.afrovision.tv.ui.screens

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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.MediaCard
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.api.model.Movie
import com.afrovision.tv.data.api.model.Series
import com.afrovision.tv.data.toMediaCard
import com.afrovision.tv.data.toPlayerMedia
import com.afrovision.tv.ui.components.PosterCard
import com.afrovision.tv.ui.components.RailRow
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

private enum class MsTab { Movies, Series }

private const val NEW_THIS_WEEK_WINDOW_MS = 7L * 24 * 60 * 60 * 1000

/**
 * Mirrors the real structure of mobile's Media Center Movies/Series tabs
 * (media_center_screen.dart) - public content only. Exclusive content never
 * appears here at all on TV; it lives entirely in ExclusiveScreen instead of
 * being interleaved the way mobile does it, so there's no Renew card / non-
 * member card / exclusive-vs-public sorting to reproduce on this screen.
 */
@Composable
fun MoviesSeriesScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val ms = viewModel.moviesSeries
    var tab by remember { mutableStateOf(MsTab.Movies) }
    var sortChip by remember { mutableStateOf("All") }

    // Unconditional reload on every visit re-fetched from the network (and
    // re-downloaded every poster) even when nothing had changed - the exact
    // "data consuming, disturbs traffic and cloud costs" complaint. Every
    // other screen in this app only loads when it doesn't already have real
    // data; this one was the one exception.
    LaunchedEffect(Unit) {
        if (ms.movies !is LoadState.Success || ms.series !is LoadState.Success) viewModel.loadMoviesSeries()
    }
    LaunchedEffect(tab) { sortChip = "All" }

    val movies = when (ms.movies) {
        is LoadState.Success -> ms.movies.data
        else -> emptyList()
    }
    val series = when (ms.series) {
        is LoadState.Success -> ms.series.data
        else -> emptyList()
    }
    val total = movies.size + series.size

    val continueWatching = (viewModel.homeState.continueWatching as? LoadState.Success)?.data.orEmpty()
    val continueWatchingMovies = continueWatching.filter { it.mediaType == "movie" }
    val continueWatchingSeries = continueWatching.filter { it.mediaType == "series" }
    val moviesById = movies.associateBy { it.id }
    val seriesById = series.associateBy { it.id }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)) {
        LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 60.dp)) {
            item {
                Column(modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 60.dp)) {
                    Text(text = "Movies & Series", color = nocturne.text, fontSize = 52.sp)
                    Text(
                        text = "$total titles on demand",
                        color = nocturne.textHint,
                        fontSize = 20.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                    Row(
                        modifier = Modifier
                            .padding(top = 22.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(nocturne.surface)
                            .padding(4.dp)
                    ) {
                        listOf(MsTab.Movies to "Movies", MsTab.Series to "Series").forEach { (value, label) ->
                            MsTabPill(label = label, selected = tab == value, onClick = { tab = value })
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(top = 18.dp)) {
                        // Series has no view-count field on the backend, so
                        // Trending only means anything for movies - matches
                        // mobile, which never sorts series by trending either.
                        val chips = if (tab == MsTab.Movies) listOf("All", "New", "Trending") else listOf("All", "New")
                        chips.forEach { chip ->
                            MoviesSeriesFilterChip(label = chip, selected = sortChip == chip, onClick = { sortChip = chip })
                        }
                    }
                }
            }

            when (tab) {
                MsTab.Movies -> movieRails(
                    viewModel = viewModel,
                    movies = movies,
                    sortChip = sortChip,
                    continueWatching = continueWatchingMovies,
                    isLoading = ms.movies !is LoadState.Success && ms.movies !is LoadState.Error,
                    error = (ms.movies as? LoadState.Error)?.message,
                    moviesById = moviesById
                )
                MsTab.Series -> seriesRails(
                    viewModel = viewModel,
                    series = series,
                    sortChip = sortChip,
                    continueWatching = continueWatchingSeries,
                    isLoading = ms.series !is LoadState.Success && ms.series !is LoadState.Error,
                    error = (ms.series as? LoadState.Error)?.message,
                    seriesById = seriesById
                )
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
        viewModel.selectedSeries?.let { series ->
            MediaDetailOverlay(
                title = series.title,
                imageUrl = series.posterUrl,
                meta = "${series.seasons.size} season${if (series.seasons.size == 1) "" else "s"}",
                description = series.description ?: "",
                playLabel = "Play S1E1",
                canPlay = firstEpisodePlayerMedia(series) != null,
                onPlay = {
                    firstEpisodePlayerMedia(series)?.let { viewModel.play(it) }
                    viewModel.clearSelectedSeries()
                },
                onDismiss = { viewModel.clearSelectedSeries() }
            )
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.movieRails(
    viewModel: TvViewModel,
    movies: List<Movie>,
    sortChip: String,
    continueWatching: List<MediaCard>,
    isLoading: Boolean,
    error: String?,
    moviesById: Map<String, Movie>
) {
    fun onOpenMovie(card: MediaCard) { moviesById[card.id]?.let { viewModel.selectMovie(it) } }
    val shaped = when (sortChip) {
        "New" -> movies.sortedByDescending { it.publishedAt ?: it.createdAt ?: 0L }
        "Trending" -> movies.sortedByDescending { it.totalViews }
        else -> movies
    }
    val now = System.currentTimeMillis()
    val newThisWeek = movies.filter { (it.publishedAt ?: it.createdAt ?: 0L).let { ts -> ts > 0 && now - ts <= NEW_THIS_WEEK_WINDOW_MS } }
        .sortedByDescending { it.publishedAt ?: it.createdAt ?: 0L }

    // Mirrors mobile's simple heuristic exactly: seed is the most recently
    // continue-watched movie, items are the rest of the catalogue by view
    // count. Not a real content-based recommendation - matching mobile means
    // matching what it actually does, not inventing something smarter.
    val seed = continueWatching.firstOrNull()
    val becauseItems = if (seed != null && movies.size > 1) {
        movies.filter { it.id != seed.id }.sortedByDescending { it.totalViews }.take(6)
    } else emptyList()

    if (continueWatching.isNotEmpty()) {
        item {
            RailRow(
                title = "Continue watching",
                items = continueWatching,
                cardContent = { item -> PosterCard(item = item, onClick = { viewModel.play(item.toPlayerMedia()) }) }
            )
        }
    }
    if (newThisWeek.isNotEmpty()) {
        item {
            RailRow(
                title = "New this week",
                subtitle = "${newThisWeek.size} titles",
                items = newThisWeek.map { it.toMediaCard() },
                cardContent = { item -> PosterCard(item = item, onClick = { onOpenMovie(item) }) }
            )
        }
    }
    if (becauseItems.isNotEmpty() && seed != null) {
        item {
            RailRow(
                title = "Because you watched ${seed.title}",
                subtitle = "${becauseItems.size} titles",
                items = becauseItems.map { it.toMediaCard() },
                cardContent = { item -> PosterCard(item = item, onClick = { onOpenMovie(item) }) }
            )
        }
    }
    if (shaped.isNotEmpty()) {
        item {
            RailRow(
                title = when (sortChip) { "New" -> "New movies"; "Trending" -> "Trending movies"; else -> "Popular on AfroVision" },
                subtitle = "${shaped.size} titles",
                items = shaped.map { it.toMediaCard() },
                cardContent = { item -> PosterCard(item = item, onClick = { onOpenMovie(item) }) }
            )
        }
    }
    emptyOrLoadingState(isLoading, error, movies.isEmpty(), "movies", onRetry = { viewModel.loadMoviesSeries() })
}

private fun androidx.compose.foundation.lazy.LazyListScope.seriesRails(
    viewModel: TvViewModel,
    series: List<Series>,
    sortChip: String,
    continueWatching: List<MediaCard>,
    isLoading: Boolean,
    error: String?,
    seriesById: Map<String, Series>
) {
    fun onOpenSeries(card: MediaCard) { seriesById[card.id]?.let { viewModel.selectSeries(it) } }
    val shaped = if (sortChip == "New") series.sortedByDescending { it.publishedAt ?: it.createdAt ?: 0L } else series
    val now = System.currentTimeMillis()
    val newThisWeek = series.filter { (it.publishedAt ?: it.createdAt ?: 0L).let { ts -> ts > 0 && now - ts <= NEW_THIS_WEEK_WINDOW_MS } }
        .sortedByDescending { it.publishedAt ?: it.createdAt ?: 0L }

    if (continueWatching.isNotEmpty()) {
        item {
            RailRow(
                title = "Continue watching",
                items = continueWatching,
                cardContent = { item -> PosterCard(item = item, onClick = { viewModel.play(item.toPlayerMedia()) }) }
            )
        }
    }
    if (newThisWeek.isNotEmpty()) {
        item {
            RailRow(
                title = "New this week",
                subtitle = "${newThisWeek.size} titles",
                items = newThisWeek.map { it.toMediaCard() },
                cardContent = { item -> PosterCard(item = item, onClick = { onOpenSeries(item) }) }
            )
        }
    }
    if (shaped.isNotEmpty()) {
        item {
            RailRow(
                title = if (sortChip == "New") "New series" else "Series for you",
                subtitle = "${shaped.size} titles",
                items = shaped.map { it.toMediaCard() },
                cardContent = { item -> PosterCard(item = item, onClick = { onOpenSeries(item) }) }
            )
        }
    }
    emptyOrLoadingState(isLoading, error, series.isEmpty(), "series", onRetry = { viewModel.loadMoviesSeries() })
}

private fun androidx.compose.foundation.lazy.LazyListScope.emptyOrLoadingState(
    isLoading: Boolean,
    error: String?,
    isEmpty: Boolean,
    kind: String,
    onRetry: () -> Unit
) {
    if (!isEmpty) return
    item {
        Box(modifier = Modifier.fillMaxWidth().height(240.dp), contentAlignment = Alignment.Center) {
            when {
                error != null -> com.afrovision.tv.ui.components.ConnectionErrorCard(message = error, onRetry = onRetry)
                isLoading -> Text(text = "Loading $kind…", color = LocalNocturne.current.textFaint, fontSize = 22.sp)
                else -> Text(text = "No $kind yet", color = LocalNocturne.current.textFaint, fontSize = 22.sp)
            }
        }
    }
}

@Composable
private fun MsTabPill(label: String, selected: Boolean, onClick: () -> Unit) {
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

@Composable
private fun MoviesSeriesFilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
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
