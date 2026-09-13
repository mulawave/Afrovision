package com.afrovision.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.R
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

/**
 * Shown wherever a screen's data failed to load. The message here always
 * comes from Throwable.toUserFacingMessage() upstream (see TvViewModel.kt) -
 * never a raw exception message - so it never contains the backend's
 * hostname or URL, which is what used to leak onto screen during a real
 * network drop.
 */
@Composable
fun ConnectionErrorCard(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    Column(
        modifier = modifier.fillMaxWidth().padding(48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Icon(
            painter = painterResource(R.drawable.ic_ph_broadcast_fill),
            contentDescription = null,
            tint = nocturne.textFaint,
            modifier = Modifier.size(40.dp)
        )
        Text(text = message, color = nocturne.textHint, fontSize = 20.sp)
        RetryButton(onClick = onRetry)
    }
}

@Composable
private fun RetryButton(onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (focused) nocturne.accent900 else androidx.compose.ui.graphics.Color.Transparent)
            .border(
                if (focused) 2.dp else 1.dp,
                if (focused) nocturne.gold else nocturne.borderCard,
                RoundedCornerShape(10.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null, onClick = { TvSoundManager.play("select"); onClick() })
            .padding(horizontal = 24.dp, vertical = 14.dp)
    ) {
        Text(text = "Retry", color = if (focused) nocturne.goldLight else nocturne.text, fontSize = 18.sp)
    }
}
