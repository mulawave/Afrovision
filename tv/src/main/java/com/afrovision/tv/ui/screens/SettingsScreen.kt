package com.afrovision.tv.ui.screens

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.afrovision.tv.R
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.ui.components.NetworkStatus
import com.afrovision.tv.ui.components.SignalBars
import com.afrovision.tv.ui.components.readNetworkStatus
import com.afrovision.tv.ui.navigation.Screen
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay

@Composable
fun SettingsScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val settings = viewModel.settings
    val context = LocalContext.current

    LaunchedEffect(Unit) { viewModel.loadSettings() }

    var network by remember { mutableStateOf(readNetworkStatus(context)) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(9000)
            network = readNetworkStatus(context)
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 60.dp, end = 60.dp, top = 60.dp, bottom = 60.dp)
        ) {
            item {
                Text(text = "Settings", color = nocturne.text, fontSize = 52.sp)
            }

            item { NetworkStatusCard(network = network, modifier = Modifier.padding(top = 28.dp)) }

            item {
                Column(
                    modifier = Modifier.padding(top = 32.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SettingRow(
                        icon = R.drawable.ic_ph_wifi_high,
                        label = "Network & streaming",
                        subtitle = "Adaptive HLS, buffer size, data saver · ${settings.defaultQuality}"
                    ) { viewModel.setDefaultQuality(cycle(settings.defaultQuality)); TvSoundManager.play("toggle") }

                    SettingRow(
                        icon = R.drawable.ic_ph_television_simple,
                        label = "Channel sources",
                        subtitle = "Live channels available on this device"
                    ) { viewModel.navigateTo(Screen.LiveTv) }

                    SettingRow(
                        icon = R.drawable.ic_ph_waves,
                        label = "Waves",
                        subtitle = "Autoplay, feed topics, creator notifications · autoplay ${if (settings.autoplay) "on" else "off"}"
                    ) { viewModel.setAutoplay(!settings.autoplay); TvSoundManager.play("toggle") }

                    SettingRow(
                        icon = R.drawable.ic_ph_book_open,
                        label = "Reading",
                        subtitle = "Your reading progress syncs automatically across devices"
                    ) { viewModel.navigateTo(Screen.Library) }

                    SettingRow(
                        icon = R.drawable.ic_ph_profile,
                        label = "Profiles & parental controls",
                        subtitle = "Add or switch between household profiles"
                    ) { viewModel.navigateTo(Screen.Profile) }

                    SettingRow(
                        icon = R.drawable.ic_ph_shield_check,
                        label = "Device activation & setup",
                        subtitle = "Run the first-time setup — your details and activation code",
                        highlighted = true
                    ) { viewModel.navigateTo(Screen.Pairing) }

                    SettingRow(
                        icon = R.drawable.ic_ph_speaker_high,
                        label = "Sound effects",
                        subtitle = "Navigation ticks, focus and select cues · ${if (settings.soundEffects) "on" else "off"}, ${(settings.soundVolume * 100).toInt()}%"
                    ) { viewModel.setSoundEffects(!settings.soundEffects); TvSoundManager.play("toggle") }

                    SettingRow(
                        icon = R.drawable.ic_ph_info,
                        label = "About",
                        subtitle = "AfroVision TV ${viewModel.appVersion}"
                    ) {}
                }
            }
        }
    }
}

@Composable
private fun NetworkStatusCard(network: NetworkStatus, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    val ratings = listOf("Weak", "Poor", "Steady", "Excellent")

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(nocturne.background.copy(alpha = 0.42f))
            .padding(horizontal = 26.dp, vertical = 22.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Icon(
            painter = painterResource(R.drawable.ic_ph_wifi_high),
            contentDescription = null,
            tint = nocturne.accentSoft,
            modifier = Modifier.size(34.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(text = "${network.label} · connected", color = nocturne.text, fontSize = 22.sp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 6.dp)) {
                if (network.speed > 0) {
                    Text(text = "${network.speed} Mbps down · ", color = nocturne.textHint, fontSize = 18.sp)
                }
                Text(text = "rating ", color = nocturne.textHint, fontSize = 18.sp)
                Text(text = network.levelLabel, color = nocturne.accentLight, fontSize = 18.sp)
                SignalBars(level = network.level)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            ratings.forEach { rating ->
                val active = rating == network.levelLabel
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (active) nocturne.accent900 else androidx.compose.ui.graphics.Color.Transparent)
                        .border(1.dp, if (active) nocturne.accent else nocturne.borderCard, RoundedCornerShape(999.dp))
                        .padding(horizontal = 12.dp, vertical = 5.dp)
                ) {
                    Text(text = rating, color = if (active) nocturne.accentLight else nocturne.textFaint, fontSize = 16.sp)
                }
            }
        }
    }
}

@Composable
private fun SettingRow(
    icon: Int,
    label: String,
    subtitle: String,
    highlighted: Boolean = false,
    onClick: () -> Unit
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (highlighted) nocturne.accent900.copy(alpha = 0.3f) else androidx.compose.ui.graphics.Color.Transparent)
            .border(
                if (focused) 2.dp else 1.dp,
                if (focused) nocturne.gold else if (highlighted) nocturne.accent700 else nocturne.borderCard,
                RoundedCornerShape(12.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null, onClick = { TvSoundManager.play("select"); onClick() })
            .padding(horizontal = 24.dp, vertical = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(22.dp)
    ) {
        Icon(
            painter = painterResource(icon),
            contentDescription = null,
            tint = if (focused) nocturne.gold else if (highlighted) nocturne.accentSoft else nocturne.textMuted,
            modifier = Modifier.size(28.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(text = label, color = nocturne.text, fontSize = 22.sp)
            Text(text = subtitle, color = nocturne.textHint, fontSize = 17.sp, modifier = Modifier.padding(top = 4.dp))
        }
        Icon(
            painter = painterResource(R.drawable.ic_ph_caret_right),
            contentDescription = null,
            tint = nocturne.textMuted,
            modifier = Modifier.size(24.dp)
        )
    }
}

private fun cycle(quality: String): String = when (quality) {
    "auto" -> "720p"
    "720p" -> "1080p"
    "1080p" -> "480p"
    else -> "auto"
}
