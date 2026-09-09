package com.afrovision.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.CircularProgressIndicator
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
import com.afrovision.tv.ui.components.FocusCard
import com.afrovision.tv.ui.components.TopChrome
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun LiveTvScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val channels = viewModel.liveChannels
    val userName = viewModel.userName.collectAsState("").value

    LaunchedEffect(Unit) { if (channels is LoadState.Loading) viewModel.loadLiveChannels() }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier.fillMaxWidth().height(64.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                TopChrome(userName = userName, userAvatar = userName, modifier = Modifier.fillMaxSize())
            }

            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (channels) {
                    is LoadState.Loading -> {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = nocturne.gold, modifier = Modifier.width(48.dp))
                        }
                    }
                    is LoadState.Error -> {
                        Box(
                            modifier = Modifier.fillMaxSize().padding(60.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Live channels unavailable: ${(channels as LoadState.Error).message}",
                                color = nocturne.textFaint,
                                fontSize = 22.sp
                            )
                        }
                    }
                    is LoadState.Success -> {
                        val items = (channels as LoadState.Success<List<com.afrovision.tv.data.api.model.Channel>>).data.map { it.toMediaCard() }
                        if (items.isEmpty()) {
                            Box(
                                modifier = Modifier.fillMaxSize().padding(60.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "No live channels available.",
                                    color = nocturne.textFaint,
                                    fontSize = 22.sp
                                )
                            }
                        } else {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(60.dp)
                            ) {
                                item {
                                    Text(
                                        text = "Live channels",
                                        color = nocturne.text,
                                        fontSize = 42.sp,
                                        modifier = Modifier.padding(bottom = 24.dp)
                                    )
                                }
                                itemsIndexed(
                                    items.chunked(4),
                                    key = { index, _ -> "row_$index" }
                                ) { index, row ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(bottom = if (index < items.chunked(4).size - 1) 24.dp else 0.dp),
                                        horizontalArrangement = Arrangement.spacedBy(24.dp)
                                    ) {
                                        row.forEach { channel ->
                                            FocusCard(
                                                item = channel,
                                                onClick = { viewModel.play(channel.toPlayerMedia()) },
                                                aspect = 16f to 9f,
                                                modifier = Modifier.weight(1f)
                                            )
                                        }
                                        repeat(4 - row.size) {
                                            Spacer(modifier = Modifier.weight(1f))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
