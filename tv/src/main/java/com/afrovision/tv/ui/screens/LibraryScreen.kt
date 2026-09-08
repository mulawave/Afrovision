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
fun LibraryScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val library = viewModel.library
    val userName = viewModel.userName.collectAsState("").value

    LaunchedEffect(Unit) { if (library is LoadState.Loading) viewModel.loadLibrary() }

    val items = when (library) {
        is LoadState.Success -> library.data.map { it.toMediaCard() }
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
                    Text(text = "Library", color = nocturne.text, fontSize = 42.sp, modifier = Modifier.padding(bottom = 24.dp))
                }
                if (items.isNotEmpty()) {
                    item { RailRow(title = "Your library", subtitle = "", items = items, viewModel = viewModel, aspect = 2f to 3f) }
                } else {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().height(240.dp), contentAlignment = Alignment.Center) {
                            Text(text = "Loading library…", color = nocturne.textFaint, fontSize = 22.sp)
                        }
                    }
                }
            }
        }
    }
}
