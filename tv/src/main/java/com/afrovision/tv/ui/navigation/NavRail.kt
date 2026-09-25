package com.afrovision.tv.ui.navigation

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.R
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

private data class Rail(
    val screen: Screen,
    val label: String,
    val icon: Int
)

private val mainRails = listOf(
    Rail(Screen.CatchUp, "Catch Up", R.drawable.ic_ph_live_tv),
    Rail(Screen.Search, "Search", R.drawable.ic_ph_search),
    Rail(Screen.Home, "Home", R.drawable.ic_ph_home),
    Rail(Screen.LiveTv, "Live TV", R.drawable.ic_ph_live_tv),
    Rail(Screen.Waves, "Waves", R.drawable.ic_ph_waves),
    Rail(Screen.MoviesSeries, "Movies\n& Series", R.drawable.ic_ph_movies_series),
    Rail(Screen.Library, "Library", R.drawable.ic_ph_library),
    Rail(Screen.Exclusive, "Exclusive", R.drawable.ic_ph_exclusive),
    Rail(Screen.Feed, "Feed", R.drawable.ic_ph_feed),
    Rail(Screen.Messages, "Messages", R.drawable.ic_ph_messages),
    Rail(Screen.Downloads, "Downloads", R.drawable.ic_ph_downloads),
    Rail(Screen.Profile, "Profile", R.drawable.ic_ph_profile)
)

private val settingsRail = Rail(Screen.Settings, "Settings", R.drawable.ic_ph_settings)

@Composable
fun NavRail(
    currentScreen: Screen,
    unreadMessages: Int,
    onSelect: (Screen) -> Unit,
    modifier: Modifier = Modifier,
    // Bump to pull focus onto the selected rail item (used by TvApp's Back
    // handling). Starts at 0, which never triggers.
    focusTrigger: Int = 0,
    onRailFocusChanged: (Boolean) -> Unit = {}
) {
    val nocturne = LocalNocturne.current
    val firstFocus = remember { FocusRequester() }
    var placed by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .width(146.dp)
            .fillMaxHeight()
            // Darker, richer navy than the plain surfaceRail fade used
            // before (which faded almost to transparent by its right edge,
            // reading as washed-out rather than a deliberate panel) -
            // matches the same deep-blue family as the Waves action bar,
            // staying rich all the way across instead of thinning out.
            .background(
                Brush.horizontalGradient(
                    listOf(Color(0xFF03040C), Color(0xFF080B22))
                )
            )
            .padding(top = 34.dp, bottom = 28.dp)
            .verticalScroll(rememberScrollState())
            .onFocusChanged { onRailFocusChanged(it.hasFocus) }
            .focusGroup()
            .onGloballyPositioned { placed = true },
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(46.dp)
                .background(nocturne.accent900, RoundedCornerShape(13.dp))
                .border(1.dp, nocturne.accent700, RoundedCornerShape(13.dp)),
            contentAlignment = Alignment.Center
        ) {
            Image(
                painter = painterResource(R.drawable.logo_dark),
                contentDescription = "AfroVision",
                modifier = Modifier.size(40.dp)
            )
        }

        Spacer(modifier = Modifier.height(26.dp))

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(9.dp)
        ) {
        val selectedIndex = mainRails.indexOfFirst { it.screen == currentScreen }.coerceAtLeast(0)
        val railFocusRequesters = remember { List(mainRails.size) { FocusRequester() } }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(9.dp)
        ) {
            mainRails.forEachIndexed { index, rail ->
                val focusRequester = if (index == selectedIndex) firstFocus else railFocusRequesters[index]
                NavRailItem(
                    rail = rail,
                    selected = currentScreen == rail.screen,
                    badgeCount = if (rail.screen == Screen.Messages) unreadMessages else 0,
                    onClick = { onSelect(rail.screen) },
                    focusRequester = focusRequester
                )
            }
        }
        }

        Spacer(modifier = Modifier.weight(1f))

        NavRailItem(
            rail = settingsRail,
            selected = currentScreen == settingsRail.screen,
            badgeCount = 0,
            onClick = { onSelect(settingsRail.screen) },
            focusRequester = remember { FocusRequester() }
        )
    }

    LaunchedEffect(focusTrigger) {
        if (focusTrigger > 0) {
            // Wait a frame so a screen change has recomposed and firstFocus
            // is attached to the newly selected item.
            withFrameNanos { }
            try {
                firstFocus.requestFocus()
            } catch (_: IllegalStateException) {
            }
        }
    }

    LaunchedEffect(placed) {
        // Only request initial focus once onGloballyPositioned has actually
        // fired for the rail, i.e. layout placement is guaranteed done.
        // Requesting focus any earlier (a DisposableEffect(Unit), or even a
        // couple of withFrameNanos() waits) races the framework's own
        // "bring focused item into view" coroutine against placement and
        // throws IllegalStateException("Expected BringIntoViewRequester to
        // not be used before parents are placed.") asynchronously, outside
        // any try/catch here, crashing the app on launch.
        if (placed) {
            kotlinx.coroutines.delay(350)
            try {
                firstFocus.requestFocus()
            } catch (_: IllegalStateException) {
            }
        }
    }
}

@Composable
private fun NavRailItem(
    rail: Rail,
    selected: Boolean,
    badgeCount: Int,
    onClick: () -> Unit,
    focusRequester: FocusRequester
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("rail") }

    val background by animateColorAsState(
        targetValue = when {
            focused -> nocturne.gold.copy(alpha = 0.25f)
            selected -> nocturne.gold.copy(alpha = 0.15f)
            else -> Color.Transparent
        },
        label = "railBg"
    )
    // Resting icons/labels used nocturne.textMuted, which read as blurry/
    // low-contrast against the new darker background - full nocturne.text
    // brightness at rest (gold still reserved for focused/selected) makes
    // every item legible without needing focus first.
    val contentColor by animateColorAsState(
        targetValue = if (focused || selected) nocturne.gold else nocturne.text,
        label = "railColor"
    )
    val borderColor by animateColorAsState(
        targetValue = when {
            focused -> nocturne.gold
            selected -> nocturne.gold.copy(alpha = 0.7f)
            else -> Color.Transparent
        },
        label = "railBorder"
    )
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.05f else 1f,
        label = "railScale"
    )

    val borderWidth = if (focused) 2.dp else if (selected) 1.dp else 0.dp

    Box(
        modifier = Modifier
            .width(114.dp)
            .wrapContentHeight()
            .scale(scale)
            .clip(RoundedCornerShape(13.dp))
            .background(background, RoundedCornerShape(13.dp))
            .border(BorderStroke(borderWidth, borderColor), RoundedCornerShape(13.dp))
            .padding(top = 7.dp, bottom = 6.dp)
            .focusRequester(focusRequester)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = { TvSoundManager.play("select"); onClick() }
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Box(contentAlignment = Alignment.TopEnd) {
                Icon(
                    painter = painterResource(rail.icon),
                    contentDescription = rail.label,
                    tint = contentColor,
                    modifier = Modifier.size(27.dp)
                )
                if (badgeCount > 0) {
                    Box(
                        modifier = Modifier
                            .offset(x = 6.dp, y = (-6).dp)
                            .size(20.dp)
                            .background(nocturne.accent700, RoundedCornerShape(10.dp))
                            .padding(horizontal = 2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (badgeCount > 9) "9+" else badgeCount.toString(),
                            color = nocturne.accent100,
                            fontSize = 13.sp,
                            lineHeight = 13.sp
                        )
                    }
                }
            }
            Text(
                text = rail.label,
                color = contentColor,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                lineHeight = 16.sp,
                textAlign = TextAlign.Center,
                softWrap = false,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
