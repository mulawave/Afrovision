package com.afrovision.tv.ui.navigation

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.R
import com.afrovision.tv.ui.theme.LocalNocturne

private data class Rail(
    val screen: Screen,
    val label: String,
    val icon: ImageVector
)

private val mainRails = listOf(
    Rail(Screen.CatchUp, "Catch Up", Icons.Filled.PlayArrow),
    Rail(Screen.Search, "Search", Icons.Filled.Search),
    Rail(Screen.Home, "Home", Icons.Filled.Home),
    Rail(Screen.LiveTv, "Live TV", Icons.Filled.PlayArrow),
    Rail(Screen.Waves, "Waves", Icons.Filled.Info),
    Rail(Screen.MoviesSeries, "Movies & Series", Icons.Filled.Favorite),
    Rail(Screen.Library, "Library", Icons.AutoMirrored.Filled.List),
    Rail(Screen.Exclusive, "Exclusive", Icons.Filled.Star),
    Rail(Screen.Feed, "Feed", Icons.Filled.Menu),
    Rail(Screen.Messages, "Messages", Icons.Filled.MailOutline),
    Rail(Screen.Downloads, "Downloads", Icons.Filled.Favorite),
    Rail(Screen.Profile, "Profile", Icons.Filled.Person)
)

private val settingsRail = Rail(Screen.Settings, "Settings", Icons.Filled.Settings)

@Composable
fun NavRail(
    currentScreen: Screen,
    unreadMessages: Int,
    onSelect: (Screen) -> Unit,
    modifier: Modifier = Modifier
) {
    val nocturne = LocalNocturne.current
    val firstFocus = remember { FocusRequester() }

    Column(
        modifier = modifier
            .width(118.dp)
            .fillMaxHeight()
            .background(nocturne.surfaceRail)
            .padding(horizontal = 12.dp, vertical = 16.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(9.dp)
    ) {
        Box(
            modifier = Modifier
                .padding(vertical = 8.dp)
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

        mainRails.forEachIndexed { index, rail ->
            val focusRequester = if (index == 0) firstFocus else remember { FocusRequester() }
            NavRailItem(
                rail = rail,
                selected = currentScreen == rail.screen,
                badgeCount = if (rail.screen == Screen.Messages) unreadMessages else 0,
                onClick = { onSelect(rail.screen) },
                focusRequester = focusRequester
            )
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
}

@Composable
private fun NavRailItem(
    rail: Rail,
    selected: Boolean,
    badgeCount: Int,
    onClick: () -> Unit,
    focusRequester: FocusRequester
) {
    var focused by remember { mutableStateOf(false) }
    val nocturne = LocalNocturne.current
    val scale by animateFloatAsState(if (focused) 1.06f else 1f, label = "railScale")
    val background by animateColorAsState(
        targetValue = if (selected) nocturne.accent900 else if (focused) nocturne.goldWash else nocturne.background,
        label = "railBg"
    )
    val contentColor by animateColorAsState(
        targetValue = if (selected) nocturne.accentLight else if (focused) nocturne.accent else nocturne.textMuted,
        label = "railColor"
    )
    val borderColor by animateColorAsState(
        targetValue = if (focused) nocturne.gold else nocturne.borderCard,
        label = "railBorder"
    )
    val glow = if (focused) {
        Modifier.shadow(
            elevation = 8.dp,
            shape = RoundedCornerShape(13.dp),
            ambientColor = nocturne.gold,
            spotColor = nocturne.gold
        )
    } else Modifier

    Box(
        modifier = Modifier
            .width(84.dp)
            .height(if (rail.screen == Screen.MoviesSeries) 72.dp else 60.dp)
            .focusRequester(focusRequester)
            .focusable(true)
            .onFocusChanged { focused = it.isFocused }
            .scale(scale)
            .then(glow)
            .border(
                BorderStroke(
                    if (focused) 2.dp else 1.dp,
                    borderColor
                ),
                RoundedCornerShape(13.dp)
            )
            .clickable(onClick = onClick)
            .background(background, RoundedCornerShape(13.dp))
            .padding(horizontal = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(contentAlignment = Alignment.TopEnd) {
                Icon(
                    imageVector = rail.icon,
                    contentDescription = rail.label,
                    tint = contentColor,
                    modifier = Modifier.size(24.dp)
                )
                if (badgeCount > 0) {
                    Box(
                        modifier = Modifier
                            .offset(x = 10.dp, y = (-6).dp)
                            .size(20.dp)
                            .background(nocturne.accent700, RoundedCornerShape(10.dp))
                            .padding(horizontal = 2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (badgeCount > 9) "9+" else badgeCount.toString(),
                            color = nocturne.accent100,
                            fontSize = 10.sp
                        )
                    }
                }
            }
            Text(
                text = rail.label,
                color = contentColor,
                fontSize = 9.sp,
                lineHeight = 12.sp,
                textAlign = TextAlign.Center,
                softWrap = false,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
