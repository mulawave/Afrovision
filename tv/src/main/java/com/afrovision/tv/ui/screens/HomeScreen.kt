package com.afrovision.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.toMediaCard
import com.afrovision.tv.data.toPlayerMedia
import com.afrovision.tv.ui.components.HeroBanner
import com.afrovision.tv.ui.components.RailRow
import com.afrovision.tv.ui.components.TopChrome
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun HomeScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val home = viewModel.homeState
    val userName = viewModel.userName.collectAsState("").value

    LaunchedEffect(Unit) {
        if (viewModel.homeState.continueWatching is LoadState.Loading) {
            viewModel.loadHome()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)
        )

        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 0.dp)
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(64.dp),
                    contentAlignment = Alignment.CenterEnd
                ) {
                    TopChrome(
                        userName = userName,
                        userAvatar = userName,
                        modifier = Modifier.fillMaxSize()
                    )
                }

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 60.dp)
                ) {
                    item {
                        HeroBanner(
                            onPlay = {
                                // Play first available hero content if any.
                                val live = (home.liveChannels as? LoadState.Success)?.data?.firstOrNull()
                                if (live != null) viewModel.play(live.toMediaCard().toPlayerMedia())
                            }
                        )
                    }

                    val continueWatching = home.continueWatching
                    val continueItems = when (continueWatching) {
                        is LoadState.Success -> continueWatching.data.map { it.toMediaCard() }
                        else -> emptyList()
                    }
                    if (continueItems.isNotEmpty()) {
                        item {
                            RailRow(
                                title = "Continue watching",
                                subtitle = "${continueItems.size} items",
                                items = continueItems,
                                viewModel = viewModel,
                                aspect = 16f to 9f
                            )
                        }
                    }

                    val live = home.liveChannels
                    val liveItems = when (live) {
                        is LoadState.Success -> live.data.map { it.toMediaCard() }
                        else -> emptyList()
                    }
                    if (liveItems.isNotEmpty()) {
                        item {
                            RailRow(
                                title = "Live channels",
                                subtitle = "${liveItems.size} feeds",
                                items = liveItems,
                                viewModel = viewModel,
                                aspect = 16f to 9f
                            )
                        }
                    }

                    val movies = home.newMovies
                    val movieItems = when (movies) {
                        is LoadState.Success -> movies.data.map { it.toMediaCard() }
                        else -> emptyList()
                    }
                    if (movieItems.isNotEmpty()) {
                        item {
                            RailRow(
                                title = "Newly added",
                                subtitle = "VOD",
                                items = movieItems,
                                viewModel = viewModel,
                                aspect = 2f to 3f
                            )
                        }
                    }

                    val series = home.newSeries
                    val seriesItems = when (series) {
                        is LoadState.Success -> series.data.map { it.toMediaCard() }
                        else -> emptyList()
                    }
                    if (seriesItems.isNotEmpty()) {
                        item {
                            RailRow(
                                title = "New series",
                                subtitle = "",
                                items = seriesItems,
                                viewModel = viewModel,
                                aspect = 2f to 3f
                            )
                        }
                    }

                    val waves = home.waves
                    val waveItems = when (waves) {
                        is LoadState.Success -> waves.data.map { it.toMediaCard() }
                        else -> emptyList()
                    }
                    if (waveItems.isNotEmpty()) {
                        item {
                            RailRow(
                                title = "Waves",
                                subtitle = "",
                                items = waveItems,
                                viewModel = viewModel,
                                aspect = 9f to 16f
                            )
                        }
                    }

                    val library = home.library
                    val libraryItems = when (library) {
                        is LoadState.Success -> library.data.map { it.toMediaCard() }
                        else -> emptyList()
                    }
                    if (libraryItems.isNotEmpty()) {
                        item {
                            RailRow(
                                title = "From your library",
                                subtitle = "",
                                items = libraryItems,
                                viewModel = viewModel,
                                aspect = 2f to 3f
                            )
                        }
                    }

                    if (liveItems.isEmpty() && movieItems.isEmpty() && seriesItems.isEmpty() && waveItems.isEmpty() && libraryItems.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(240.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "Loading home…",
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
    }
}
