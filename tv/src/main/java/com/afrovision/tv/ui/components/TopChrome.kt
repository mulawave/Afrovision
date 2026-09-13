package com.afrovision.tv.ui.components

import android.content.Context
import android.net.ConnectivityManager
import android.net.wifi.WifiManager
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.afrovision.tv.R
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun TopChrome(
    userName: String,
    userAvatar: String?,
    modifier: Modifier = Modifier
) {
    val nocturne = LocalNocturne.current
    var time by remember { mutableStateOf(formatTime()) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(20_000)
            time = formatTime()
        }
    }

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        NetworkChip()

        Text(
            text = time,
            color = nocturne.textMuted,
            fontSize = 21.sp,
            fontFamily = FontFamily.Monospace
        )

        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(50))
                .background(nocturne.gold.copy(alpha = 0.12f))
                .border(1.dp, nocturne.gold, RoundedCornerShape(50)),
            contentAlignment = Alignment.Center
        ) {
            // userAvatar used to be fed the display name (not an image URL)
            // and this box just showed initials from it - the "avatar"
            // chip never actually rendered a real profile picture at all.
            if (!userAvatar.isNullOrBlank()) {
                coil.compose.AsyncImage(
                    model = rememberCacheableImageRequest(userAvatar),
                    contentDescription = null,
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                    modifier = Modifier.size(40.dp).clip(RoundedCornerShape(50))
                )
            } else {
                Text(
                    text = initials(userName),
                    color = nocturne.gold,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

data class NetworkStatus(
    val label: String,
    val speed: Int,
    val level: Int,
    val levelLabel: String
)

@Composable
private fun NetworkChip() {
    val nocturne = LocalNocturne.current
    val context = LocalContext.current
    var status by remember { mutableStateOf(readNetworkStatus(context)) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(9000)
            status = readNetworkStatus(context)
        }
    }

    val contentColor = if (status.level >= 3) nocturne.gold else nocturne.textMuted

    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(nocturne.background.copy(alpha = 0.6f))
            .padding(horizontal = 16.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Icon(
            painter = painterResource(R.drawable.ic_ph_wifi_high),
            contentDescription = "Network",
            tint = contentColor,
            modifier = Modifier.size(24.dp)
        )

        Column(
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp)
            ) {
                Text(
                    text = status.levelLabel,
                    color = contentColor,
                    fontSize = 17.sp,
                    letterSpacing = 0.08.em,
                    fontWeight = FontWeight.Medium
                )

                SignalBars(level = status.level)
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = status.label,
                    color = nocturne.textMuted,
                    fontSize = 15.sp
                )
                if (status.speed > 0) {
                    Text(
                        text = "\u00B7",
                        color = nocturne.textFaint,
                        fontSize = 15.sp
                    )
                    Text(
                        text = "${status.speed} Mbps",
                        color = nocturne.textMuted,
                        fontSize = 15.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}

fun readNetworkStatus(context: Context): NetworkStatus {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    val wm = context.getSystemService(Context.WIFI_SERVICE) as? WifiManager
    val active = try { cm?.activeNetworkInfo } catch (_: Exception) { null }

    val safeSsid = { raw: String? ->
        raw?.removeSurrounding("\"")
            ?.takeIf { it.isNotBlank() && !it.equals("<unknown ssid>", ignoreCase = true) }
            ?: "Wi-Fi"
    }

    return when (active?.type) {
        ConnectivityManager.TYPE_WIFI -> {
            val wifiInfo = try { wm?.connectionInfo } catch (_: Exception) { null }
            val ssid = if (wifiInfo?.ssid != null) safeSsid(wifiInfo.ssid) else active.extraInfo?.takeIf { it.isNotBlank() } ?: "Wi-Fi"
            val rssi = wifiInfo?.rssi ?: -100
            val level = WifiManager.calculateSignalLevel(rssi, 5)
            val speed = wifiInfo?.linkSpeed?.coerceAtLeast(0) ?: 0
            val label = listOf("No Signal", "Poor", "Fair", "Good", "Excellent")[level]
            NetworkStatus(ssid, speed, level, label)
        }
        ConnectivityManager.TYPE_ETHERNET -> {
            NetworkStatus("Ethernet", 0, 4, "Excellent")
        }
        null -> {
            NetworkStatus("Offline", 0, 0, "No Signal")
        }
        else -> {
            NetworkStatus(active.typeName?.replaceFirstChar { it.uppercase() } ?: "Mobile", 0, 3, "Good")
        }
    }
}

@Composable
fun SignalBars(level: Int) {
    val nocturne = LocalNocturne.current
    val barHeights = listOf(5.dp, 8.dp, 11.dp, 14.dp)
    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        barHeights.forEachIndexed { i, h ->
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(h)
                    .clip(RoundedCornerShape(1.dp))
                    .background(if (i < level) nocturne.gold else nocturne.border)
            )
        }
    }
}

private fun formatTime(): String {
    return SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date())
}

private fun initials(name: String): String {
    return name.split(" ").mapNotNull { it.firstOrNull() }.take(2).joinToString("").uppercase().ifBlank { "AV" }
}
