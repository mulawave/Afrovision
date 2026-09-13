package com.afrovision.tv.ui.theme

import android.util.Log
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.afrovision.tv.TV_APP_TAG

/**
 * Every dimension in the TV screens is transcribed 1:1 from
 * `tv_design/Afrovision TV.dc.html`'s 1920x1080 px layout (e.g. `146px` rail
 * width becomes `146.dp`). That only matches the design if 1 design-dp maps
 * to exactly screenWidthPx/1920 real pixels. Without this, a device whose
 * reported density differs from what a typical Google TV panel reports (as
 * seen on cheap set-top boxes with a minimal Android build) renders every
 * screen at the wrong scale even though the code matches the HTML
 * numerically - which is why screens can look "nothing like the design" on
 * real hardware. This pins the whole app to a fixed 1920x1080 logical
 * canvas, matching the plan's Part 0 spec, regardless of device density.
 */
@Composable
fun DesignCanvas(content: @Composable () -> Unit) {
    val configuration = LocalConfiguration.current
    val baseDensity = LocalDensity.current
    val screenWidthPx = with(baseDensity) { configuration.screenWidthDp.dp.toPx() }
    val scale = (screenWidthPx / 1920f).coerceIn(0.4f, 3f)
    val scaledDensity = Density(
        density = baseDensity.density * scale,
        fontScale = baseDensity.fontScale
    )
    Log.d(
        TV_APP_TAG,
        "DesignCanvas: screenWidthPx=$screenWidthPx baseDensity=${baseDensity.density} scale=$scale scaledDensity=${scaledDensity.density}"
    )
    CompositionLocalProvider(LocalDensity provides scaledDensity) {
        Box(modifier = Modifier.fillMaxSize()) {
            content()
        }
    }
}
