package com.afrovision.tv.ui.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.toMediaCard
import com.afrovision.tv.data.toPlayerMedia
import com.afrovision.tv.ui.components.ContinueWatchingCard
import com.afrovision.tv.ui.components.ChannelCard
import com.afrovision.tv.ui.components.FeaturedChannelSlide
import com.afrovision.tv.ui.components.PosterCard
import com.afrovision.tv.ui.components.WaveCard
import com.afrovision.tv.ui.components.LibraryCard
import com.afrovision.tv.ui.components.OpenAllTile
import com.afrovision.tv.ui.components.HeroBanner
import com.afrovision.tv.ui.components.RailRow
import com.afrovision.tv.ui.navigation.Screen
import com.afrovision.tv.ui.theme.LocalNocturne
import android.util.Log
import com.afrovision.tv.TV_APP_TAG

@Composable
fun HomeScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val home = viewModel.homeState
    var heroIndex by remember { mutableStateOf(0) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    val continueWatching = home.continueWatching
    val continueItems = when (continueWatching) {
        is LoadState.Success -> continueWatching.data
        else -> emptyList()
    }
    val recent = home.recentChannels
    val recentItems = when (recent) {
        is LoadState.Success -> recent.data
        else -> emptyList()
    }
    val featured = home.featuredChannels
    val featuredItems = when (featured) {
        is LoadState.Success -> featured.data
        else -> emptyList()
    }
    val movies = home.newMovies
    val movieItems = when (movies) {
        is LoadState.Success -> movies.data.map { it.toMediaCard() }
        else -> emptyList()
    }
    val series = home.newSeries
    val seriesItems = when (series) {
        is LoadState.Success -> series.data.map { it.toMediaCard() }
        else -> emptyList()
    }
    val waves = home.waves
    val waveItems = when (waves) {
        is LoadState.Success -> waves.data.map { it.toMediaCard() }
        else -> emptyList()
    }
    val library = home.library
    val rawLibraryItems = when (library) {
        is LoadState.Success -> library.data
        else -> emptyList()
    }
    val libraryItems = rawLibraryItems.map { it.toMediaCard() }
    val rawLibraryById = rawLibraryItems.associateBy { it.id }

    Log.d(TV_APP_TAG, "HomeScreen render: recent=${recentItems.size} featured=${featuredItems.size} continue=${continueItems.size} movies=${movieItems.size} series=${seriesItems.size} waves=${waveItems.size} library=${libraryItems.size}")

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 140.dp)
        ) {
            item {
                HeroBanner(
                    slides = home.heroSlides,
                    autoRotateMs = home.heroAutoRotateMs,
                    onPlay = {
                        val slide = home.heroSlides.getOrNull(heroIndex)
                        if (slide?.href.isNullOrBlank().not()) {
                            viewModel.playHero(slide!!)
                        } else {
                            val live = (home.liveChannels as? LoadState.Success)?.data?.firstOrNull()
                            if (live != null) viewModel.playChannel(live.toMediaCard())
                        }
                    },
                    onIndexChange = { heroIndex = it },
                    // The Play/Info buttons inside the hero are real focus
                    // targets, and LazyColumn's default "bring focused child
                    // into view" scroll only reveals the button - it clips
                    // the hero's top half above it, and since the hero is
                    // item 0 there's nothing further up to press Up toward
                    // to recover, so it stays clipped until you leave and
                    // come back. Force a snap back to the top the instant
                    // anything inside the hero gets focus, overriding that
                    // partial auto-scroll.
                    onFocusWithin = { scope.launch { listState.animateScrollToItem(0) } }
                )
            }

            var isFirstRail = true

            // Recently viewed channels
            if (recentItems.isNotEmpty()) {
                item {
                    RailRow(
                        title = "Recently viewed",
                        subtitle = "${recentItems.size} channels",
                        items = recentItems,
                        cardContent = { item ->
                            ChannelCard(item = item, onClick = { viewModel.playChannel(item) })
                        },
                        topPadding = if (isFirstRail) 44.dp else 28.dp
                    )
                    isFirstRail = false
                }
            }

            // Featured channels (auto-sliding)
            if (featuredItems.isNotEmpty()) {
                item {
                    FeaturedChannelSlide(
                        items = featuredItems,
                        onPlay = { item ->
                            val card = com.afrovision.tv.data.MediaCard(
                                id = item.channelId.ifBlank { item.id },
                                title = item.name,
                                subtitle = item.category,
                                imageUrl = item.logoUrl?.let { com.afrovision.tv.data.resolveAssetUrl(it) },
                                badge = if (item.isLive) "LIVE" else "",
                                mediaType = "channel"
                            )
                            viewModel.playChannel(card)
                        },
                        topPadding = if (isFirstRail) 44.dp else 28.dp
                    )
                    isFirstRail = false
                }
            }

            // Continue watching
            if (continueItems.isNotEmpty()) {
                item {
                    RailRow(
                        title = "Continue watching",
                        subtitle = "${continueItems.size} items",
                        items = continueItems,
                        cardContent = { item ->
                            ContinueWatchingCard(item = item, onClick = { viewModel.play(item.toPlayerMedia()) })
                        },
                        trailingTile = { OpenAllTile(label = "Open all", onClick = { viewModel.navigateTo(Screen.Library) }) },
                        topPadding = if (isFirstRail) 44.dp else 28.dp
                    )
                    isFirstRail = false
                }
            }

            // Newly added movies
            if (movieItems.isNotEmpty()) {
                item {
                    RailRow(
                        title = "Newly added",
                        subtitle = "VOD",
                        items = movieItems,
                        cardContent = { item ->
                            PosterCard(item = item, onClick = { viewModel.play(item.toPlayerMedia()) })
                        },
                        trailingTile = { OpenAllTile(label = "Open all", onClick = { viewModel.navigateTo(Screen.MoviesSeries) }) },
                        topPadding = if (isFirstRail) 44.dp else 28.dp
                    )
                    isFirstRail = false
                }
            }

            // New series
            if (seriesItems.isNotEmpty()) {
                item {
                    RailRow(
                        title = "New series",
                        subtitle = "",
                        items = seriesItems,
                        cardContent = { item ->
                            PosterCard(item = item, onClick = { viewModel.play(item.toPlayerMedia()) })
                        },
                        trailingTile = { OpenAllTile(label = "Open all", onClick = { viewModel.navigateTo(Screen.MoviesSeries) }) },
                        topPadding = if (isFirstRail) 44.dp else 28.dp
                    )
                    isFirstRail = false
                }
            }

            // Waves
            if (waveItems.isNotEmpty()) {
                item {
                    RailRow(
                        title = "Waves",
                        subtitle = "",
                        items = waveItems,
                        cardContent = { item ->
                            WaveCard(item = item, onClick = { viewModel.play(item.toPlayerMedia()) })
                        },
                        trailingTile = { OpenAllTile(label = "Open feed", onClick = { viewModel.navigateTo(Screen.Feed) }) },
                        topPadding = if (isFirstRail) 44.dp else 28.dp
                    )
                    isFirstRail = false
                }
            }

            // Library
            if (libraryItems.isNotEmpty()) {
                item {
                    RailRow(
                        title = "From your library",
                        subtitle = "",
                        items = libraryItems,
                        cardContent = { item ->
                            val raw = rawLibraryById[item.id]
                            LibraryCard(
                                item = item,
                                onClick = {
                                    if (raw != null) viewModel.openReaderScreen(raw.channelId, raw.id)
                                    else viewModel.navigateTo(Screen.Library)
                                }
                            )
                        },
                        trailingTile = { OpenAllTile(label = "Open library", onClick = { viewModel.navigateTo(Screen.Library) }) },
                        topPadding = if (isFirstRail) 44.dp else 28.dp
                    )
                    isFirstRail = false
                }
            }

            if (recentItems.isEmpty() && featuredItems.isEmpty() && continueItems.isEmpty() && movieItems.isEmpty() && seriesItems.isEmpty() && waveItems.isEmpty() && libraryItems.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(240.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Loading home\u2026",
                            color = nocturne.textFaint,
                            fontSize = 22.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}
