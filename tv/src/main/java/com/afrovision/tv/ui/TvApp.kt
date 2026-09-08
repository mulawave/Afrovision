package com.afrovision.tv.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.ui.navigation.NavRail
import com.afrovision.tv.ui.navigation.Screen
import com.afrovision.tv.ui.screens.ActivationScreen
import com.afrovision.tv.ui.screens.CatchUpScreen
import com.afrovision.tv.ui.screens.DisabledScreen
import com.afrovision.tv.ui.screens.DownloadsScreen
import com.afrovision.tv.ui.screens.ExclusiveScreen
import com.afrovision.tv.ui.screens.FeedScreen
import com.afrovision.tv.ui.screens.HomeScreen
import com.afrovision.tv.ui.screens.LibraryScreen
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

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(nocturne.background)
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
        } else if (currentScreen == Screen.MovieDetail || currentScreen == Screen.SeriesDetail) {
            // Detail screens can be built into MoviesSeriesScreen via selection for now.
            MoviesSeriesScreen(viewModel)
        } else {
            Row(modifier = Modifier.fillMaxSize()) {
                NavRail(
                    currentScreen = currentScreen,
                    unreadMessages = viewModel.unreadMessages,
                    onSelect = { viewModel.navigateTo(it) }
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
        }
    }
}
