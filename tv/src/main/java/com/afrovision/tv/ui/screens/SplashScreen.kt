package com.afrovision.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun SplashScreen() {
    val nocturne = LocalNocturne.current
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(Color(0xFF262A60), Color(0xFF1A1C2C), Color(0xFF0F1018)),
                    radius = 1600f
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .clip(RoundedCornerShape(26.dp))
                    .border(1.dp, Color(0xFF796CBF), RoundedCornerShape(26.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "A", color = Color(0xFFE7E5FE), fontSize = 46.sp, fontWeight = FontWeight.Medium)
            }
            Spacer(modifier = Modifier.height(28.dp))
            Text(text = "AfroVision", color = nocturne.text, fontSize = 36.sp, fontWeight = FontWeight.Medium)
            Spacer(modifier = Modifier.height(36.dp))
            CircularProgressIndicator(color = nocturne.accent, strokeWidth = 3.dp, modifier = Modifier.size(32.dp))
        }
    }
}
