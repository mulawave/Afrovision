package com.afrovision.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.toMediaCard
import com.afrovision.tv.ui.components.RailRow
import com.afrovision.tv.ui.components.TopChrome
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun ExclusiveScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val exclusive = viewModel.exclusive
    val userName = viewModel.userName.collectAsState("").value

    LaunchedEffect(Unit) { if (exclusive is LoadState.Loading) viewModel.loadExclusive() }

    val items = when (exclusive) {
        is LoadState.Success -> exclusive.data
        else -> emptyList()
    }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.background)) {
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    0f to nocturne.gold.copy(alpha = 0.12f),
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
                    Text(text = "Exclusive", color = nocturne.text, fontSize = 42.sp, modifier = Modifier.padding(bottom = 24.dp))
                }
                if (items.isNotEmpty()) {
                    item { RailRow(title = "Exclusive content", subtitle = "", items = items, viewModel = viewModel, aspect = 2f to 3f) }
                } else {
                    item {
                        val message = when (exclusive) {
                            is LoadState.Loading -> "Loading exclusive…"
                            is LoadState.Error -> "Couldn't load exclusive content. ${exclusive.message}"
                            else -> "No exclusive channels yet. Unlock one in the AfroVision app and it will appear here."
                        }
                        Box(modifier = Modifier.fillMaxWidth().height(240.dp), contentAlignment = Alignment.Center) {
                            Text(text = message, color = nocturne.textFaint, fontSize = 22.sp)
                        }
                    }
                }
            }
        }
    }
}
