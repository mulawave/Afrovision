package com.afrovision.tv.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.R
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun SplashScreen() {
    val nocturne = LocalNocturne.current
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        visible = true
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(nocturne.primaryGradient),
        contentAlignment = Alignment.Center
    ) {
        AnimatedVisibility(
            visible = visible,
            enter = fadeIn(animationSpec = tween(durationMillis = 1500)) +
                    scaleIn(
                        initialScale = 0.8f,
                        animationSpec = tween(durationMillis = 1500)
                    )
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .clip(RectangleShape)
                        .background(nocturne.goldWash),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(R.drawable.logo_dark),
                        contentDescription = "AfroVision",
                        modifier = Modifier.size(96.dp)
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "AFROVISION",
                    color = nocturne.text,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 4.sp
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "Africa's Digital Playground",
                    color = nocturne.gold,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 2.sp
                )
                Spacer(modifier = Modifier.height(36.dp))
                CircularProgressIndicator(
                    color = nocturne.gold,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(24.dp)
                )
            }
        }
    }
}
