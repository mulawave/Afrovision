package com.afrovision.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.ui.components.TopChrome
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun DownloadsScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val items = viewModel.downloads
    val userName = viewModel.userName.collectAsState("").value

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
            LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(60.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                item {
                    Text(text = "Downloads", color = nocturne.text, fontSize = 42.sp, modifier = Modifier.padding(bottom = 24.dp))
                }
                if (items.isNotEmpty()) {
                    items(items, key = { it.id }) { item ->
                        DownloadCard(item = item, viewModel = viewModel)
                    }
                } else {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().height(240.dp), contentAlignment = Alignment.Center) {
                            Text(text = "No downloads", color = nocturne.textFaint, fontSize = 22.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DownloadCard(item: com.afrovision.tv.data.DownloadItem, viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    var focused by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(80.dp)
            .clip(RoundedCornerShape(12.dp))
            .border(
                2.dp,
                if (focused) nocturne.accent else nocturne.borderCard,
                RoundedCornerShape(12.dp)
            )
            .background(nocturne.surface)
            .focusRequester(focusRequester)
            .focusable(true)
            .onFocusChanged { focused = it.isFocused }
            .clickable { if (item.localPath != null) viewModel.playVideoUrl(item.localPath) }
            .padding(horizontal = 24.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(50))
                .background(nocturne.accent900),
            contentAlignment = Alignment.Center
        ) {
            Icon(imageVector = Icons.Filled.PlayArrow, contentDescription = null, tint = nocturne.accentLight, modifier = Modifier.size(28.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = item.title, color = nocturne.text, fontSize = 20.sp, fontWeight = FontWeight.Medium)
            Text(text = "${item.progress}% · ${item.status}", color = nocturne.textFaint, fontSize = 16.sp)
        }
    }
}
