package com.afrovision.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
            delay(30_000)
            time = formatTime()
        }
    }

    Row(
        modifier = modifier
            .fillMaxHeight()
            .padding(horizontal = 22.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        NetworkChip()

        Text(
            text = time,
            color = nocturne.textMuted,
            fontSize = 18.sp
        )

        Spacer(modifier = Modifier.weight(1f))

        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(50))
                .background(nocturne.accent900)
                .border(1.dp, nocturne.accent700, RoundedCornerShape(50)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = userAvatar?.take(2)?.uppercase() ?: initials(userName),
                color = nocturne.accentLight,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun NetworkChip() {
    val nocturne = LocalNocturne.current
    Row(
        modifier = Modifier
            .height(52.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(nocturne.surface)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(
            imageVector = Icons.Filled.CheckCircle,
            contentDescription = "Network",
            tint = nocturne.gold,
            modifier = Modifier.size(22.dp)
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Excellent",
                color = nocturne.goldLight,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1
            )
            Text(
                text = "Afrovision Fibre · 86.4 Mbps",
                color = nocturne.textFaint,
                fontSize = 12.sp,
                maxLines = 1
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
