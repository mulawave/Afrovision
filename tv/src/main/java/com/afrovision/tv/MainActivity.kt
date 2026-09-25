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

    // Hold the Wi-Fi lock only while the app is visible.
    override fun onStart() {
        super.onStart()
        (application as TvApplication).networkReconnector.acquireWifiLock()
    }

    override fun onStop() {
        (application as TvApplication).networkReconnector.releaseWifiLock()
        super.onStop()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        viewModel.handleDeeplink(intent.data)
    }
}
