package com.afrovision.tv.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.afrovision.tv.R
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

private val SPLASH_STEPS = listOf(
    "Checking your network…",
    "Loading live channels…",
    "Syncing your library…",
    "Ready"
)

@Composable
fun SplashScreen() {
    val nocturne = LocalNocturne.current
    var shown by remember { mutableStateOf(false) }
    var stepIndex by remember { mutableStateOf(0) }

    LaunchedEffect(Unit) {
        shown = true
        TvSoundManager.play("boot")
    }

    LaunchedEffect(Unit) {
        while (stepIndex < SPLASH_STEPS.lastIndex) {
            kotlinx.coroutines.delay(700)
            stepIndex += 1
        }
    }

    val infiniteTransition = rememberInfiniteTransition(label = "splash")

    val scanY by infiniteTransition.animateFloat(
        initialValue = -0.4f,
        targetValue = 1.4f,
        animationSpec = infiniteRepeatable(
            animation = tween(3400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "scan"
    )

    val ring1Scale by infiniteTransition.animateFloat(
        initialValue = 0.55f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(2400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "ring1Scale"
    )
    val ring1Alpha by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 0.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(2400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "ring1Alpha"
    )
    val ring2Scale by infiniteTransition.animateFloat(
        initialValue = 0.55f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(2400, 800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "ring2Scale"
    )
    val ring2Alpha by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 0.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(2400, 800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "ring2Alpha"
    )

    val bar1 by infiniteTransition.animateFloat(
        initialValue = 0.22f, targetValue = 1.0f,
        animationSpec = infiniteRepeatable(tween(1000, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "bar1"
    )
    val bar2 by infiniteTransition.animateFloat(
        initialValue = 0.32f, targetValue = 0.95f,
        animationSpec = infiniteRepeatable(tween(1000, 120, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "bar2"
    )
    val bar3 by infiniteTransition.animateFloat(
        initialValue = 0.28f, targetValue = 1.0f,
        animationSpec = infiniteRepeatable(tween(1000, 240, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "bar3"
    )
    val bar4 by infiniteTransition.animateFloat(
        initialValue = 0.18f, targetValue = 0.88f,
        animationSpec = infiniteRepeatable(tween(1000, 360, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "bar4"
    )
    val bar5 by infiniteTransition.animateFloat(
        initialValue = 0.26f, targetValue = 0.98f,
        animationSpec = infiniteRepeatable(tween(1000, 480, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "bar5"
    )

    val fill by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "fill"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colorStops = arrayOf(
                        0.0f to Color(0xFF262A60),
                        0.55f to Color(0xFF191B2C),
                        1.0f to Color(0xFF0D0E17)
                    )
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        // Scan line overlay
        Box(
            modifier = Modifier
                .fillMaxSize()
                .alpha(0.3f)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(0.38f)
                    .offset(y = (scanY * 1000).dp)
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                Color.Transparent,
                                Color(0xFF9184D9).copy(alpha = 0.16f),
                                Color.Transparent
                            )
                        )
                    )
            )
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            AnimatedVisibility(
                visible = shown,
                enter = fadeIn(tween(700, easing = FastOutSlowInEasing)) +
                        scaleIn(
                            initialScale = 0.5f,
                            animationSpec = tween(700, easing = FastOutSlowInEasing)
                        )
            ) {
                Box(
                    modifier = Modifier.size(200.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .scale(ring1Scale)
                            .alpha(ring1Alpha)
                            .clip(CircleShape)
                            .border(2.5.dp, nocturne.gold, CircleShape)
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .scale(ring2Scale)
                            .alpha(ring2Alpha)
                            .clip(CircleShape)
                            .border(2.5.dp, nocturne.gold, CircleShape)
                    )

                    Box(
                        modifier = Modifier
                            .size(112.dp)
                            .clip(RoundedCornerShape(30.dp))
                            .background(nocturne.background.copy(alpha = 0.5f))
                            .border(1.dp, nocturne.gold.copy(alpha = 0.6f), RoundedCornerShape(30.dp))
                            .background(
                                Brush.radialGradient(
                                    listOf(
                                        nocturne.gold.copy(alpha = 0.12f),
                                        Color.Transparent
                                    )
                                )
                            )
                            .background(nocturne.gold.copy(alpha = 0.06f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            painter = painterResource(R.drawable.logo_dark),
                            contentDescription = "AfroVision",
                            modifier = Modifier.size(56.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(38.dp))

            AnimatedVisibility(
                visible = shown,
                enter = fadeIn(tween(800, 220, easing = FastOutSlowInEasing)) +
                        scaleIn(
                            initialScale = 0.9f,
                            animationSpec = tween(800, 220, easing = FastOutSlowInEasing)
                        )
            ) {
                Text(
                    text = "Afrovision",
                    color = nocturne.text,
                    fontSize = 46.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.24.em
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            AnimatedVisibility(
                visible = shown,
                enter = fadeIn(tween(800, 380, easing = FastOutSlowInEasing)) +
                        scaleIn(
                            initialScale = 0.9f,
                            animationSpec = tween(800, 380, easing = FastOutSlowInEasing)
                        )
            ) {
                Text(
                    text = "Africa's Digital Playground",
                    color = nocturne.textMuted,
                    fontSize = 21.sp,
                    letterSpacing = 0.02.em
                )
            }

            Spacer(modifier = Modifier.height(44.dp))

            AnimatedVisibility(
                visible = shown,
                enter = fadeIn(tween(600, 500, easing = FastOutSlowInEasing))
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                    verticalAlignment = Alignment.Bottom,
                    modifier = Modifier.height(44.dp)
                ) {
                    AudioBar(bar1, nocturne.gold.copy(alpha = 0.6f))
                    AudioBar(bar2, nocturne.gold.copy(alpha = 0.5f))
                    AudioBar(bar3, nocturne.gold)
                    AudioBar(bar4, nocturne.gold.copy(alpha = 0.5f))
                    AudioBar(bar5, nocturne.gold.copy(alpha = 0.6f))
                }
            }

            Spacer(modifier = Modifier.height(40.dp))

            AnimatedVisibility(
                visible = shown,
                enter = fadeIn(tween(600, 620, easing = FastOutSlowInEasing))
            ) {
                Box(
                    modifier = Modifier
                        .width(420.dp)
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(nocturne.text.copy(alpha = 0.14f))
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fill)
                            .fillMaxHeight()
                            .background(nocturne.gold)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            AnimatedVisibility(
                visible = shown,
                enter = fadeIn(tween(600, 740, easing = FastOutSlowInEasing))
            ) {
                Text(
                    text = SPLASH_STEPS[stepIndex],
                    color = nocturne.textFaint,
                    fontSize = 18.sp,
                    letterSpacing = 0.08.em
                )
            }
        }
    }
}

@Composable
private fun AudioBar(fraction: Float, color: Color) {
    Box(
        modifier = Modifier
            .width(6.dp)
            .fillMaxHeight(fraction)
            .clip(RoundedCornerShape(3.dp))
            .background(color)
    )
}
