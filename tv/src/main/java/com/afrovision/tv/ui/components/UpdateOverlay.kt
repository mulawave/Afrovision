package com.afrovision.tv.ui.components

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.R
import com.afrovision.tv.data.api.model.AppUpdate
import com.afrovision.tv.ui.focus.autoRequestFocus
import com.afrovision.tv.update.AppUpdater
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay

/**
 * Shows when TvViewModel.appUpdate is non-null (a genuinely newer,
 * downloadable build reported by the real heartbeat endpoint). "Update now"
 * drives a real DownloadManager transfer + package-installer handoff via
 * AppUpdater; "Tonight" and "Not now" dismiss for this session by asking the
 * caller to clear appUpdate (there is no persisted snooze yet - it will
 * re-offer next time the app restarts and heartbeats again).
 */
@Composable
fun UpdateOverlay(
    update: AppUpdate,
    onUpdateLater: () -> Unit,
    onDismiss: () -> Unit
) {
    val nocturne = LocalNocturne.current
    val context = LocalContext.current
    var downloadId by remember { mutableStateOf<Long?>(null) }
    var progress by remember { mutableStateOf(0) }
    var failed by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { TvSoundManager.play("update") }

    // The dialog appearing doesn't itself move D-pad focus - without this,
    // whatever was focused on the screen underneath kept receiving every
    // key press while the dialog just sat on top, unreachable (the exact
    // bug reported: no way to accept/dismiss it except leaving the app).
    // Treating system Back as "Not now" is a second safety net on top of
    // that, since a remote's back button is the one input every user will
    // try on a stuck dialog.
    BackHandler { TvSoundManager.play("close"); onDismiss() }

    val activeDownloadId = downloadId
    if (activeDownloadId != null) {
        LaunchedEffect(activeDownloadId) {
            while (true) {
                val p = AppUpdater.queryProgress(context, activeDownloadId)
                if (p < 0) {
                    failed = true
                    break
                }
                progress = p
                if (AppUpdater.isComplete(context, activeDownloadId)) {
                    AppUpdater.promptInstall(context)
                    break
                }
                delay(500)
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(nocturne.background.copy(alpha = 0.72f)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .width(760.dp)
                .clip(RoundedCornerShape(nocturne.radiusLg.dp))
                .background(nocturne.background)
                .padding(38.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .border(1.dp, nocturne.accent700, RoundedCornerShape(14.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        painter = painterResource(R.drawable.ic_ph_arrow_circle_up),
                        contentDescription = null,
                        tint = nocturne.accentLight,
                        modifier = Modifier.size(26.dp)
                    )
                }
                Column {
                    Text(text = "AfroVision ${update.latestVersionName} is ready", color = nocturne.text, fontSize = 30.sp)
                    Text(text = "A new build is available for this TV", color = nocturne.textHint, fontSize = 18.sp, modifier = Modifier.padding(top = 5.dp))
                }
            }

            if (activeDownloadId == null) {
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(top = 32.dp)) {
                    UpdateButton(label = "Update now", primary = true, autoFocus = true) {
                        val url = update.apkUrl ?: return@UpdateButton
                        downloadId = AppUpdater.startDownload(context, url)
                    }
                    UpdateButton(label = "Tonight, after 2 AM", primary = false, onClick = onUpdateLater)
                    UpdateButton(label = "Not now", primary = false, onClick = { TvSoundManager.play("close"); onDismiss() })
                }
            } else {
                Column(modifier = Modifier.padding(top = 26.dp)) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(5.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(nocturne.text.copy(alpha = 0.14f))
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(progress / 100f)
                                .fillMaxHeight()
                                .background(nocturne.accent)
                        )
                    }
                    Text(
                        text = if (failed) "Download failed. Try again later." else "Downloading… $progress%",
                        color = nocturne.textHint,
                        fontSize = 18.sp,
                        modifier = Modifier.padding(top = 12.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun UpdateButton(label: String, primary: Boolean, autoFocus: Boolean = false, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val focusRequester = remember { FocusRequester() }
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(nocturne.radiusMd.dp))
            .background(if (focused && primary) nocturne.accent900 else androidx.compose.ui.graphics.Color.Transparent)
            .border(
                if (focused) 2.dp else 1.dp,
                if (primary) nocturne.accent else nocturne.borderCard,
                RoundedCornerShape(nocturne.radiusMd.dp)
            )
            .autoRequestFocus(focusRequester, enabled = autoFocus)
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 26.dp, vertical = 15.dp)
    ) {
        Text(text = label, color = if (primary) nocturne.accentLight else nocturne.textMuted, fontSize = 20.sp)
    }
}
