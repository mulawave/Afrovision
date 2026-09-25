package com.afrovision.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.toMediaCard
import com.afrovision.tv.ui.components.RailRow
import com.afrovision.tv.ui.components.TopChrome
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun SearchScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val search = viewModel.search
    val userName = viewModel.userName.collectAsState("").value

    // Seeded from the view model so leaving and returning to Search keeps
    // the last query and its results.
    var query by remember { mutableStateOf(TextFieldValue(viewModel.searchQuery)) }
    val focusManager = LocalFocusManager.current
    var focused by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }
    var placed by remember { mutableStateOf(false) }

    LaunchedEffect(placed) {
        if (placed) {
            kotlinx.coroutines.delay(350)
            try { focusRequester.requestFocus() } catch (_: IllegalStateException) { }
        }
    }

    // Debounce keystrokes so typing on the on-screen keyboard doesn't fire a
    // search per character.
    LaunchedEffect(query.text) {
        if (query.text == viewModel.searchQuery) return@LaunchedEffect
        kotlinx.coroutines.delay(350)
        viewModel.search(query.text)
    }

    val results = when (search) {
        is LoadState.Success -> search.data
        else -> emptyList()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(nocturne.background)
            .onGloballyPositioned { if (!placed) placed = true }
    ) {
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
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(60.dp),
                verticalArrangement = Arrangement.spacedBy(28.dp)
            ) {
                item {
                    Text(text = "Search", color = nocturne.text, fontSize = 42.sp)
                }
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(64.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .border(
                                2.dp,
                                if (focused) nocturne.accent else nocturne.borderCard,
                                RoundedCornerShape(12.dp)
                            )
                            .background(nocturne.surface)
                            .padding(horizontal = 24.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Icon(imageVector = Icons.Filled.Search, contentDescription = null, tint = nocturne.textMuted, modifier = Modifier.size(28.dp))
                        BasicTextField(
                            value = query,
                            onValueChange = { query = it },
                            singleLine = true,
                            textStyle = TextStyle(color = nocturne.text, fontSize = 22.sp),
                            cursorBrush = SolidColor(nocturne.accent),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                            keyboardActions = KeyboardActions(onSearch = {
                                // Run immediately (skip the debounce) and hand
                                // D-pad focus to the results row.
                                viewModel.search(query.text)
                                focusManager.moveFocus(FocusDirection.Down)
                            }),
                            modifier = Modifier
                                .fillMaxWidth()
                                .focusRequester(focusRequester)
                                .onFocusChanged { focused = it.isFocused },
                            decorationBox = { inner ->
                                Box(contentAlignment = Alignment.CenterStart) {
                                    if (query.text.isEmpty()) {
                                        Text(text = "Search channels, movies, series, waves…", color = nocturne.textFaint, fontSize = 22.sp)
                                    }
                                    inner()
                                }
                            }
                        )
                    }
                }
                if (results.isNotEmpty()) {
                    item {
                        RailRow(title = "Results", subtitle = "", items = results, viewModel = viewModel, aspect = 2f to 3f)
                    }
                } else if (query.text.isNotBlank()) {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().height(240.dp), contentAlignment = Alignment.Center) {
                            Text(
                                text = when (search) {
                                    is LoadState.Loading -> "Searching…"
                                    is LoadState.Error -> search.message
                                    else -> "No results"
                                },
                                color = nocturne.textFaint,
                                fontSize = 22.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
