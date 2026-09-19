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
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.data.DownloadItem
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun DownloadsScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val context = LocalContext.current
    val items = viewModel.downloads
    val completedCount = items.count { it.completed }
    val storage = remember { readDeviceStorage(context) }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 60.dp, end = 60.dp, top = 60.dp, bottom = 60.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Column {
                    Text(text = "Downloads", color = nocturne.text, fontSize = 52.sp)
                    Text(
                        text = "${items.size} items · $completedCount ready to watch offline",
                        color = nocturne.textHint,
                        fontSize = 20.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                    DeviceStorageCard(storage = storage, modifier = Modifier.padding(top = 26.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(top = 20.dp, bottom = 12.dp)) {
                        DownloadsActionChip(label = "Wi-Fi only") {}
                        DownloadsActionChip(label = "Quality: High") {}
                        DownloadsActionChip(label = "Clear watched") {
                            items.filter { it.completed }.forEach { viewModel.removeDownload(it.id) }
                        }
                    }
                }
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

private data class DeviceStorage(val usedBytes: Long, val totalBytes: Long)

private fun readDeviceStorage(context: android.content.Context): DeviceStorage {
    return try {
        val stat = android.os.StatFs(context.filesDir.path)
        val total = stat.blockCountLong * stat.blockSizeLong
        val available = stat.availableBlocksLong * stat.blockSizeLong
        DeviceStorage(usedBytes = (total - available).coerceAtLeast(0L), totalBytes = total.coerceAtLeast(1L))
    } catch (_: Exception) {
        DeviceStorage(0L, 1L)
    }
}

private fun formatGb(bytes: Long): String = "%.1f GB".format(bytes / 1_073_741_824.0)

@Composable
private fun DeviceStorageCard(storage: DeviceStorage, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    val fraction = (storage.usedBytes.toFloat() / storage.totalBytes.toFloat()).coerceIn(0f, 1f)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(nocturne.background.copy(alpha = 0.42f))
            .padding(horizontal = 26.dp, vertical = 22.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(text = "Device storage", color = nocturne.text, fontSize = 21.sp)
            Text(text = "${formatGb(storage.usedBytes)} of ${formatGb(storage.totalBytes)} used", color = nocturne.textHint, fontSize = 18.sp)
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 14.dp)
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(nocturne.borderCard)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fraction)
                    .fillMaxHeight()
                    .background(nocturne.accent)
            )
        }
    }
}

@Composable
private fun DownloadsActionChip(label: String, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) com.afrovision.tv.ui.sound.TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Color.Transparent)
            .border(BorderStroke(if (focused) 2.dp else 1.dp, if (focused) nocturne.gold else nocturne.borderCard), RoundedCornerShape(999.dp))
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 10.dp)
    ) {
        Text(text = label, color = if (focused) nocturne.goldLight else nocturne.textMuted, fontSize = 17.sp)
    }
}

@Composable
private fun DownloadCard(item: DownloadItem, viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(
                if (focused) 2.dp else 1.dp,
                if (focused) nocturne.accent else nocturne.borderCard,
                RoundedCornerShape(12.dp)
            )
            .background(nocturne.surface)
            .clickable(interactionSource = interactionSource, indication = null) { if (item.localPath != null) viewModel.playVideoUrl(item.localPath) }
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(nocturne.accent900),
            contentAlignment = Alignment.Center
        ) {
            Icon(imageVector = Icons.Filled.PlayArrow, contentDescription = null, tint = nocturne.accentLight, modifier = Modifier.size(26.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = item.title, color = nocturne.text, fontSize = 20.sp, fontWeight = FontWeight.Medium)
            Text(
                text = if (item.completed) "Ready to watch offline" else "${(item.progress * 100).toInt()}% · ${item.status}",
                color = nocturne.textFaint,
                fontSize = 15.sp,
                modifier = Modifier.padding(top = 2.dp)
            )
            if (!item.completed) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(nocturne.text.copy(alpha = 0.15f))
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(item.progress.coerceIn(0f, 1f))
                            .fillMaxHeight()
                            .background(nocturne.accent)
                    )
                }
            }
        }
    }
}
