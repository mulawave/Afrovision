package com.afrovision.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun DisabledScreen(reason: String, deviceId: String, onRetry: () -> Unit) {
    val nocturne = LocalNocturne.current
    val focus = remember { FocusRequester() }
    var focused by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { focus.requestFocus() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(Color(0xFF3A1E2A), Color(0xFF1A1C2C), Color(0xFF0F1018)),
                    radius = 1600f
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(60.dp)) {
            Box(
                modifier = Modifier
                    .size(84.dp)
                    .clip(CircleShape)
                    .background(Color(0x33FF6B6B))
                    .border(1.dp, Color(0xFFFF6B6B), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "!", color = Color(0xFFFF6B6B), fontSize = 40.sp, fontWeight = FontWeight.Medium)
            }
            Spacer(modifier = Modifier.height(30.dp))
            Text(
                text = "This TV has been disabled",
                color = nocturne.text,
                fontSize = 46.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(18.dp))
            Text(
                text = reason,
                color = Color(0xFFCFD3E5),
                fontSize = 22.sp,
                lineHeight = 34.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.widthIn(max = 760.dp)
            )
            Spacer(modifier = Modifier.height(14.dp))
            Text(
                text = "Device ID · $deviceId",
                color = Color(0xFF9397AB),
                fontSize = 17.sp,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(36.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(nocturne.radiusMd.dp))
                    .background(if (focused) nocturne.accent900 else Color.Transparent)
                    .border(if (focused) 2.dp else 1.dp, nocturne.accent, RoundedCornerShape(nocturne.radiusMd.dp))
                    .focusRequester(focus)
                    .focusable(true)
                    .onFocusChanged { focused = it.isFocused }
                    .clickable(onClick = onRetry)
                    .padding(horizontal = 30.dp, vertical = 17.dp)
            ) {
                Text(text = "Check again", color = Color(0xFFE7E5FE), fontSize = 21.sp)
            }
        }
    }
}
