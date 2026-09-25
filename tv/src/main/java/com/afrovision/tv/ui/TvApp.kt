package com.afrovision.tv.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.ui.navigation.NavRail
import com.afrovision.tv.ui.navigation.Screen
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.components.TopChrome
import com.afrovision.tv.ui.components.UpdateOverlay
import com.afrovision.tv.ui.screens.ActivationScreen
import com.afrovision.tv.ui.screens.CatchUpScreen
import com.afrovision.tv.ui.screens.DisabledScreen
import com.afrovision.tv.ui.screens.DownloadsScreen
import com.afrovision.tv.ui.screens.ExclusiveScreen
import com.afrovision.tv.ui.screens.FeedScreen
import com.afrovision.tv.ui.screens.HomeScreen
import com.afrovision.tv.ui.screens.LibraryScreen
import com.afrovision.tv.ui.screens.LibraryReaderScreen
import com.afrovision.tv.ui.screens.LiveTvScreen
import com.afrovision.tv.ui.screens.MessagesScreen
import com.afrovision.tv.ui.screens.MoviesSeriesScreen
import com.afrovision.tv.ui.screens.PlayerScreen
import com.afrovision.tv.ui.screens.ProfileScreen
import com.afrovision.tv.ui.screens.SearchScreen
import com.afrovision.tv.ui.screens.SettingsScreen
import com.afrovision.tv.ui.screens.SplashScreen
import com.afrovision.tv.ui.screens.WavesScreen
import com.afrovision.tv.ui.theme.LocalNocturne

@OptIn(ExperimentalAnimationApi::class)
@Composable
fun TvApp(viewModel: TvViewModel = viewModel()) {
    val nocturne = LocalNocturne.current
    val currentScreen = viewModel.currentScreen
    val isPaired by viewModel.isPaired.collectAsState()
    val isReady by viewModel.isReady.collectAsState()
    val disabledReason = viewModel.deviceDisabledReason
    var updateSnoozedUntil by remember { mutableStateOf(0L) }
    var updateDismissed by remember { mutableStateOf(false) }

    LaunchedEffect(viewModel.settings) {
        TvSoundManager.enabled = viewModel.settings.soundEffects
        TvSoundManager.volume = viewModel.settings.soundVolume
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(nocturne.primaryGradient)
    ) {
        if (!isReady) {
            SplashScreen()
        } else if (!isPaired || currentScreen == Screen.Pairing) {
            ActivationScreen(viewModel)
        } else if (disabledReason != null) {
            DisabledScreen(
                reason = disabledReason,
                deviceId = viewModel.deviceId,
                onRetry = { viewModel.retryHeartbeat() }
            )
        } else if (currentScreen == Screen.Player) {
            PlayerScreen(viewModel)
        } else if (currentScreen == Screen.Reader) {
            LibraryReaderScreen(viewModel)
        } else {
            val update = viewModel.appUpdate
            val snoozed = System.currentTimeMillis() < updateSnoozedUntil
            val updateShowing = update != null && !updateDismissed && !snoozed

            // Back used to exit the app from every top-level screen (no
            // handler here), which fails Google TV app-quality review. Now:
            // Back in content -> focus the nav rail; Back on the rail -> go
            // Home; Back on the rail while already Home -> fall through to
            // the system and exit. Screen-level overlays (detail sheets,
            // CatchUp detail, the update dialog) register their own
            // BackHandlers later, so they still take priority over this one.
            var railHasFocus by remember { mutableStateOf(false) }
            var railFocusTrigger by remember { mutableIntStateOf(0) }
            BackHandler(enabled = !railHasFocus || currentScreen != Screen.Home) {
                TvSoundManager.play("back")
                if (railHasFocus) viewModel.navigateTo(Screen.Home)
                railFocusTrigger++
            }

            Row(
                modifier = Modifier
                    .fillMaxSize()
                    // The update overlay renders on top of this Row visually,
                    // but Compose focus/key routing doesn't know about z-order
                    // by itself - without this, whatever was already focused
                    // in the nav rail/content kept receiving every D-pad press
                    // while the dialog just sat there unreachable, with no way
                    // to accept/dismiss it short of leaving the app. Swallow
                    // key events aimed at the background entirely while the
                    // dialog is up; UpdateOverlay grabs real focus onto its
                    // own first button so D-pad still works inside it.
                    .then(if (updateShowing) Modifier.onPreviewKeyEvent { true } else Modifier)
            ) {
                NavRail(
                    currentScreen = currentScreen,
                    unreadMessages = viewModel.unreadMessages,
                    onSelect = { viewModel.navigateTo(it) },
                    modifier = Modifier.width(146.dp),
                    focusTrigger = railFocusTrigger,
                    onRailFocusChanged = { railHasFocus = it }
                )
                AnimatedContent(
                    targetState = currentScreen,
                    label = "tvScreen",
                    modifier = Modifier.weight(1f)
                ) { screen ->
                    when (screen) {
                        Screen.CatchUp -> CatchUpScreen(viewModel)
                        Screen.Home -> HomeScreen(viewModel)
                        Screen.Search -> SearchScreen(viewModel)
                        Screen.LiveTv -> LiveTvScreen(viewModel)
                        Screen.Waves -> WavesScreen(viewModel)
                        Screen.MoviesSeries -> MoviesSeriesScreen(viewModel)
                        Screen.Library -> LibraryScreen(viewModel)
                        Screen.Exclusive -> ExclusiveScreen(viewModel)
                        Screen.Feed -> FeedScreen(viewModel)
                        Screen.Messages -> MessagesScreen(viewModel)
                        Screen.Downloads -> DownloadsScreen(viewModel)
                        Screen.Profile -> ProfileScreen(viewModel)
                        Screen.Settings -> SettingsScreen(viewModel)
                        else -> HomeScreen(viewModel)
                    }
                }
            }

            TopChrome(
                userName = viewModel.userName.collectAsState("").value,
                userAvatar = viewModel.profile.avatar,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 40.dp, end = 64.dp)
            )

            if (updateShowing) {
                UpdateOverlay(
                    update = update!!,
                    onUpdateLater = { updateSnoozedUntil = nextTwoAmMillis() },
                    onDismiss = { updateDismissed = true }
                )
            }
        }
    }
}

/** Epoch millis for the next 2 AM local time (today if it hasn't passed yet, else tomorrow). */
private fun nextTwoAmMillis(): Long {
    val calendar = java.util.Calendar.getInstance()
    calendar.set(java.util.Calendar.HOUR_OF_DAY, 2)
    calendar.set(java.util.Calendar.MINUTE, 0)
    calendar.set(java.util.Calendar.SECOND, 0)
    calendar.set(java.util.Calendar.MILLISECOND, 0)
    if (calendar.timeInMillis <= System.currentTimeMillis()) {
        calendar.add(java.util.Calendar.DAY_OF_YEAR, 1)
    }
    return calendar.timeInMillis
}
