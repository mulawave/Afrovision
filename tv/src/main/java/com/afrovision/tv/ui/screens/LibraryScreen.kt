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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.ui.components.LibraryShelf
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun LibraryScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val library = viewModel.library

    LaunchedEffect(Unit) { if (library !is LoadState.Success) viewModel.loadLibrary() }
    LaunchedEffect(Unit) { viewModel.loadContinueReading() }

    val items = (library as? LoadState.Success)?.data.orEmpty()
    val continueReading = (viewModel.continueReading as? LoadState.Success)?.data.orEmpty()

    Box(modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)) {
        LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 60.dp)) {
            item(key = "header") {
                Column(modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 52.dp)) {
                    Text(text = "Library", color = nocturne.text, fontSize = 48.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        text = if (library is LoadState.Success) "${items.size} titles · comics, magazines & books" else "Books, comics & magazines",
                        color = nocturne.textHint,
                        fontSize = 18.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }
            }
            item(key = "shelf") {
                if (library is LoadState.Error && items.isEmpty()) {
                    Box(modifier = Modifier.fillMaxWidth().height(240.dp), contentAlignment = Alignment.Center) {
                        com.afrovision.tv.ui.components.ConnectionErrorCard(
                            message = library.message,
                            onRetry = { viewModel.loadLibrary() }
                        )
                    }
                } else {
                    LibraryShelf(
                        library = items,
                        loading = library is LoadState.Loading,
                        continueReading = continueReading,
                        emptyText = "Nothing in the library yet",
                        onOpen = { viewModel.openReaderScreen(it.channelId, it.id) }
                    )
                }
            }
        }
    }
}
