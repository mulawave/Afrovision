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

class MainActivity : ComponentActivity() {

    private val viewModel: TvViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        viewModel.handleDeeplink(intent.data)
        setContent {
            AfroVisionTVTheme {
                TvApp(viewModel)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        viewModel.handleDeeplink(intent.data)
    }
}
