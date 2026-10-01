package com.afrovision.tv

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.ui.TvApp
import com.afrovision.tv.ui.theme.AfroVisionTVTheme
import com.afrovision.tv.ui.theme.DesignCanvas

class MainActivity : ComponentActivity() {

    private val viewModel: TvViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        viewModel.handleDeeplink(intent.data)
        setContent {
            DesignCanvas {
                AfroVisionTVTheme {
                    TvApp(viewModel)
                }
            }
        }
    }

    // No Wi-Fi lock (4.11-4.14 held a low-latency one while the app was open).
    // On this class of TV it stopped the system's own Wi-Fi scanning, which
    // is what rejoins the hotspot after a drop, and coincided with heavier
    // buffering. Back to the 4.10 behaviour: the system manages the radio.

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        viewModel.handleDeeplink(intent.data)
    }
}
