package com.afrovision.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
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

    val items = when (channels) {
        is LoadState.Success -> channels.data.map { it.toMediaCard() }
        else -> emptyList()
    }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.background)) {
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    0f to nocturne.accent900.copy(alpha = 0.3f),
                    0.5f to nocturne.background,
                    1f to nocturne.background
                )
            )
        )
        Column(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.fillMaxWidth().height(64.dp), contentAlignment = Alignment.CenterEnd) {
                TopChrome(userName = userName, userAvatar = userName, modifier = Modifier.fillMaxSize())
            }
            LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(60.dp)) {
                item {
                    Text(
                        text = "Live channels",
                        color = nocturne.text,
                        fontSize = 42.sp,
                        modifier = Modifier.padding(bottom = 24.dp)
                    )
                }
                if (items.isNotEmpty()) {
                    item {
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(4),
                            horizontalArrangement = Arrangement.spacedBy(24.dp),
                            verticalArrangement = Arrangement.spacedBy(24.dp),
                            modifier = Modifier.height(((items.size / 4 + 1) * 180).dp)
                        ) {
                            items(items, key = { it.id }) { channel ->
                                FocusCard(
                                    item = channel,
                                    onClick = { viewModel.play(channel.toPlayerMedia()) },
                                    aspect = 16f to 9f
                                )
                            }
                        }
                    }
                } else {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().height(240.dp), contentAlignment = Alignment.Center) {
                            Text(text = "Loading live channels…", color = nocturne.textFaint, fontSize = 22.sp)
                        }
                    }
                }
            }
        }
    }
}
