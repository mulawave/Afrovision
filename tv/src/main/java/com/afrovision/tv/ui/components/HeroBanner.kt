package com.afrovision.tv.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextOverflow
import coil.compose.AsyncImage
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay

@OptIn(ExperimentalAnimationApi::class)
@Composable
fun HeroBanner(
    slides: List<HeroSlide> = defaultHeroSlides(),
    onPlay: () -> Unit = {},
    onInfo: () -> Unit = {},
    onIndexChange: (Int) -> Unit = {}
) {
    val nocturne = LocalNocturne.current
    var index by remember { mutableIntStateOf(0) }
    var focused by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        while (true) {
            delay(8000)
            index = (index + 1) % slides.size
        }
    }

    LaunchedEffect(index) {
        onIndexChange(index)
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(520.dp)
            .padding(horizontal = 60.dp, vertical = 24.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(nocturne.surfaceRaised)
            .focusRequester(focusRequester)
            .focusable(true)
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onPlay),
        contentAlignment = Alignment.BottomStart
    ) {
        AnimatedContent(targetState = index, label = "hero") { slideIndex ->
            val slide = slides[slideIndex]
            Box(modifier = Modifier.fillMaxSize()) {
                if (!slide.imageUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = slide.imageUrl,
                        contentDescription = slide.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.linearGradient(
                                listOf(
                                    nocturne.background.copy(alpha = 0.1f),
                                    nocturne.background.copy(alpha = 0.55f),
                                    nocturne.background.copy(alpha = 0.95f)
                                )
                            )
                        )
                )
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(48.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.Start
                ) {
                    if (slide.badges.isNotEmpty()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            slide.badges.forEach { badge -> HeroBadgePill(badge) }
                        }
                    } else if (slide.badge.isNotBlank()) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(99.dp))
                                .background(nocturne.background.copy(alpha = 0.6f))
                                .border(1.dp, nocturne.gold, RoundedCornerShape(99.dp))
                                .padding(horizontal = 16.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = slide.badge.uppercase(),
                                color = nocturne.accentLight,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                    Text(
                        text = slide.title,
                        color = nocturne.text,
                        fontSize = 72.sp,
                        fontWeight = FontWeight.Medium,
                        lineHeight = 76.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 22.dp)
                    )
                    Text(
                        text = slide.subtitle.orEmpty(),
                        color = nocturne.textMuted,
                        fontSize = 23.sp,
                        lineHeight = 30.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 18.dp)
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(top = 32.dp)
                    ) {
                        HeroButton(
                            label = slide.primaryLabel,
                            icon = Icons.Filled.PlayArrow,
                            accent = true,
                            onClick = onPlay,
                            focused = focused
                        )
                        HeroButton(
                            label = "Learn more",
                            icon = Icons.Filled.Info,
                            accent = false,
                            onClick = onInfo,
                            focused = focused
                        )
                    }
                }
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(20.dp),
            modifier = Modifier.padding(48.dp)
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                slides.forEachIndexed { i, _ ->
                    Box(
                        modifier = Modifier
                            .width(if (i == index) 44.dp else 26.dp)
                            .height(6.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(if (i == index) nocturne.accent else nocturne.borderCard)
                    )
                }
            }
            Text(
                text = "${(index + 1).toString().padStart(2, '0')} / ${slides.size.toString().padStart(2, '0')}",
                color = nocturne.textFaint,
                fontSize = 16.sp
            )
        }
    }
}

@Composable
private fun HeroBadgePill(badge: HeroBadge) {
    val nocturne = LocalNocturne.current
    val outline = if (badge.isLive) nocturne.accent else nocturne.gold
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(99.dp))
            .background(nocturne.background.copy(alpha = 0.6f))
            .border(1.dp, outline, RoundedCornerShape(99.dp))
            .padding(horizontal = 16.dp, vertical = 6.dp)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (badge.icon != null) {
                Icon(
                    painter = painterResource(id = badge.icon),
                    contentDescription = null,
                    tint = nocturne.accentLight,
                    modifier = Modifier.size(17.dp)
                )
            } else if (!badge.emoji.isNullOrBlank()) {
                Text(text = badge.emoji, fontSize = 15.sp)
            }
            Text(
                text = badge.label.uppercase(),
                color = nocturne.accentLight,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun HeroButton(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accent: Boolean,
    onClick: () -> Unit,
    focused: Boolean
) {
    val nocturne = LocalNocturne.current
    val border = if (accent) nocturne.accent else nocturne.borderCard
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .border(
                1.dp,
                if (focused) nocturne.accent else border,
                RoundedCornerShape(8.dp)
            )
            .background(if (accent) nocturne.accent900 else nocturne.background.copy(alpha = 0.5f))
            .clickable(onClick = onClick)
            .padding(horizontal = 28.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(imageVector = icon, contentDescription = label, tint = nocturne.accentLight, modifier = Modifier.size(21.dp))
            Text(text = label, color = if (accent) nocturne.accentLight else nocturne.text, fontSize = 20.sp, fontWeight = FontWeight.Medium)
        }
    }
}

data class HeroSlide(
    val title: String,
    val subtitle: String?,
    val badge: String = "",
    val primaryLabel: String = "Watch",
    val imageUrl: String? = null,
    val titleHighlight: String = "",
    val badges: List<HeroBadge> = emptyList(),
    val primaryIcon: Int? = null,
    val secondaryLabel: String? = null,
    val secondaryIcon: Int? = null,
    val showBookmark: Boolean = false,
    val href: String? = null
)

/// A pill shown above the hero title. `icon` is a drawable resource id;
/// `emoji` is the fallback when the backend sends an icon name with no
/// local drawable mapped to it.
data class HeroBadge(
    val label: String,
    val icon: Int? = null,
    val emoji: String? = null,
    val isLive: Boolean = false
)

fun defaultHeroSlides() = listOf(
    HeroSlide(
        title = "Women. Power. Transformation.",
        subtitle = "The Afrovision Challenge: a high-intensity reality programme discovering and transforming young African women into elite business leaders.",
        badge = "Auditions opening soon",
        primaryLabel = "Watch the trailer"
    ),
    HeroSlide(
        title = "Watch. Earn. Connect.",
        subtitle = "Thousands of creators and viewers on the continent's most vibrant live streaming community — and you earn rewards while you watch.",
        badge = "LIVE",
        primaryLabel = "Explore channels"
    ),
    HeroSlide(
        title = "Tech Talk: AI in Africa",
        subtitle = "Artificial intelligence and its impact on African tech ecosystems — top speakers, real insights, live from Lagos and Nairobi.",
        badge = "LIVE NOW",
        primaryLabel = "Watch live now"
    )
)
