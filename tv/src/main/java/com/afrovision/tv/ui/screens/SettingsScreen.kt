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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
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
fun SettingsScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val settings = viewModel.settings
    val userName = viewModel.userName.collectAsState("").value

    LaunchedEffect(Unit) { viewModel.loadSettings() }

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
                    Text(text = "Settings", color = nocturne.text, fontSize = 42.sp, modifier = Modifier.padding(bottom = 24.dp))
                }
                item {
                    SettingRow(label = "Default quality", value = settings.defaultQuality) { viewModel.setDefaultQuality(cycle(settings.defaultQuality)) }
                    Spacer(modifier = Modifier.height(12.dp))
                    SettingRow(label = "Subtitles", value = if (settings.subtitlesOn) "On" else "Off") { viewModel.setSubtitles(!settings.subtitlesOn) }
                    Spacer(modifier = Modifier.height(12.dp))
                    SettingRow(label = "Autoplay next", value = if (settings.autoplay) "On" else "Off") { viewModel.setAutoplay(!settings.autoplay) }
                    Spacer(modifier = Modifier.height(12.dp))
                    SettingRow(label = "App version", value = viewModel.appVersion) {}
                }
            }
        }
    }
}

@Composable
private fun SettingRow(label: String, value: String, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    var focused by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

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
            .focusRequester(focusRequester)
            .focusable(true)
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 28.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, color = nocturne.text, fontSize = 22.sp)
        Text(text = value, color = nocturne.accentLight, fontSize = 22.sp, fontWeight = FontWeight.Medium)
    }
}

private fun cycle(quality: String): String = when (quality) {
    "auto" -> "720p"
    "720p" -> "1080p"
    "1080p" -> "480p"
    else -> "auto"
}
