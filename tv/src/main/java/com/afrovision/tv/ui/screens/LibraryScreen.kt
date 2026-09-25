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
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.toMediaCard
import com.afrovision.tv.ui.components.LibraryCard
import com.afrovision.tv.ui.components.RailRow
import com.afrovision.tv.ui.theme.LocalNocturne

// Matches the backend's real contentType enum exactly (library.model.js:
// contentTypes = ['book','comic','magazine','other']) - "Reading now" is a
// TV-only convenience filter (not a backend contentType) that swaps in the
// continue-reading rail instead of the content-type-filtered grid.
private val libraryFilters = listOf("All", "Books", "Comics", "Magazines", "Other", "Reading now")

@Composable
fun LibraryScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val library = viewModel.library
    var selectedFilter by remember { mutableStateOf("All") }

    LaunchedEffect(Unit) { if (library !is LoadState.Success) viewModel.loadLibrary() }

    val allRawItems = when (library) {
        is LoadState.Success -> library.data
        else -> emptyList()
    }

    val continueReadingState = viewModel.continueReading
    LaunchedEffect(Unit) { viewModel.loadContinueReading() }
    val continueReadingItems = when (continueReadingState) {
        is LoadState.Success -> continueReadingState.data.filter { it.item != null }
        else -> emptyList()
    }

    val rawItems = when (selectedFilter) {
        "Books" -> allRawItems.filter { it.contentType == "book" }
        "Comics" -> allRawItems.filter { it.contentType == "comic" }
        "Magazines" -> allRawItems.filter { it.contentType == "magazine" }
        "Other" -> allRawItems.filter { it.contentType == "other" }
        "Reading now" -> emptyList()
        else -> allRawItems
    }
    val items = rawItems.map { it.toMediaCard() }
    val rawById = rawItems.associateBy { it.id }
    val showContinueReading = selectedFilter == "All" || selectedFilter == "Reading now"

    Box(modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)) {
        LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 60.dp)) {
            item {
                Column(modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 60.dp)) {
                    Text(text = "Library", color = nocturne.text, fontSize = 52.sp)
                    Text(
                        text = if (selectedFilter == "Reading now") {
                            "${continueReadingItems.size} in progress"
                        } else {
                            "${items.size} titles · books, comics & magazines"
                        },
                        color = nocturne.textHint,
                        fontSize = 20.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(top = 26.dp)) {
                        libraryFilters.forEach { filter ->
                            LibraryFilterChip(
                                label = filter,
                                selected = filter == selectedFilter,
                                onClick = { selectedFilter = filter }
                            )
                        }
                    }
                }
            }
            if (continueReadingItems.isNotEmpty() && showContinueReading) {
                item {
                    RailRow(
                        title = "Continue reading",
                        subtitle = "",
                        items = continueReadingItems.mapNotNull { it.item?.toMediaCard() },
                        cardContent = { card ->
                            val record = continueReadingItems.first { it.item?.id == card.id }
                            LibraryCard(item = card, onClick = { viewModel.openReaderScreen(record.channelId, record.itemId) })
                        }
                    )
                }
            }
            if (items.isNotEmpty()) {
                item {
                    RailRow(
                        title = "Your library",
                        subtitle = "",
                        items = items,
                        cardContent = { card ->
                            val raw = rawById[card.id]
                            LibraryCard(
                                item = card,
                                onClick = { if (raw != null) viewModel.openReaderScreen(raw.channelId, raw.id) }
                            )
                        }
                    )
                }
            } else {
                item {
                    Box(modifier = Modifier.fillMaxWidth().height(240.dp), contentAlignment = Alignment.Center) {
                        // Loading and a real failure used to render as the
                        // exact same message forever - see Movies & Series'
                        // identical fix; a stuck "Loading…" almost always
                        // means the request already failed silently, not
                        // that it's still in flight.
                        when (library) {
                            is LoadState.Error -> com.afrovision.tv.ui.components.ConnectionErrorCard(
                                message = (library as LoadState.Error).message,
                                onRetry = { viewModel.loadLibrary() }
                            )
                            // Loaded, but this category has nothing in it.
                            // Showing "Loading…" here made every empty
                            // category look stuck forever.
                            is LoadState.Success -> Text(
                                text = when (selectedFilter) {
                                    "All" -> "Nothing in the library yet"
                                    "Reading now" -> if (continueReadingItems.isEmpty()) "Nothing in progress yet" else ""
                                    else -> "No ${selectedFilter.lowercase()} yet"
                                },
                                color = nocturne.textFaint,
                                fontSize = 22.sp
                            )
                            else -> Text(text = "Loading library…", color = nocturne.textFaint, fontSize = 22.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LibraryFilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) com.afrovision.tv.ui.sound.TvSoundManager.play("move") }
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
