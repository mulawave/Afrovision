package com.afrovision.tv.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.afrovision.tv.R
import com.afrovision.tv.TV_APP_TAG
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay

@OptIn(ExperimentalAnimationApi::class)
@Composable
fun HeroBanner(
    slides: List<HeroSlide> = defaultHeroSlides(),
    autoRotateMs: Long = 8000L,
    onPlay: () -> Unit = {},
    onInfo: () -> Unit = {},
    onIndexChange: (Int) -> Unit = {},
    heroHeight: androidx.compose.ui.unit.Dp = 648.dp,
    imageContentScale: ContentScale = ContentScale.Crop,
    imageAlignment: Alignment = Alignment.Center,
    onFocusWithin: () -> Unit = {}
) {
    val nocturne = LocalNocturne.current
    var index by remember { mutableIntStateOf(0) }
    var lastAutoRotate by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(lastAutoRotate) {
        while (true) {
            delay(autoRotateMs)
            index = (index + 1) % slides.size
            lastAutoRotate = System.currentTimeMillis()
        }
    }

    fun advanceNext() {
        index = (index + 1) % slides.size
        lastAutoRotate = System.currentTimeMillis()
    }

    fun advancePrev() {
        index = (index - 1 + slides.size) % slides.size
        lastAutoRotate = System.currentTimeMillis()
    }

    LaunchedEffect(index) {
        onIndexChange(index)
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(heroHeight)
            .onFocusChanged { if (it.hasFocus) onFocusWithin() }
            .onPreviewKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown) {
                    when (event.key) {
                        Key.DirectionLeft -> { advancePrev(); true }
                        Key.DirectionRight -> { advanceNext(); true }
                        else -> false
                    }
                } else false
            },
        contentAlignment = Alignment.BottomStart
    ) {
        AnimatedContent(targetState = index, label = "hero") { slideIndex ->
            val slide = slides[slideIndex]
            Box(modifier = Modifier.fillMaxSize()) {
                // Always paint the base gradient first - when imageContentScale
                // is Fit (used where the source art must show uncropped rather
                // than fill the box), the letterbox margins land on this
                // gradient instead of a blank/transparent gap.
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(nocturne.headerGradient)
                )
                if (!slide.imageUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = rememberCacheableImageRequest(slide.imageUrl),
                        contentDescription = slide.title,
                        contentScale = imageContentScale,
                        alignment = imageAlignment,
                        modifier = Modifier.fillMaxSize(),
                        onError = { Log.e(TV_APP_TAG, "Hero image load failed for ${slide.title}: ${slide.imageUrl}", it.result.throwable) }
                    )
                }

                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.horizontalGradient(
                                listOf(
                                    Color(0xFF121634).copy(alpha = 0.96f),
                                    Color(0xFF14183A).copy(alpha = 0.82f),
                                    Color(0xFF161826).copy(alpha = 0.34f),
                                    Color(0xFF161826).copy(alpha = 0.60f)
                                )
                            )
                        )
                )

                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .width(2.dp)
                        .offset(x = 600.dp)
                        .graphicsLayer(
                            rotationZ = -14f,
                            transformOrigin = TransformOrigin(0.5f, 0.5f)
                        )
                        .background(
                            Brush.verticalGradient(
                                listOf(
                                    nocturne.divider.copy(alpha = 0.0f),
                                    nocturne.divider.copy(alpha = 0.8f),
                                    nocturne.divider.copy(alpha = 0.0f)
                                )
                            )
                        )
                )
            }
        }

        // Badges/title/subtitle/buttons live outside AnimatedContent, as a
        // single persistent composable that just reads the current slide -
        // only the artwork behind them crossfades. Previously this whole
        // block (buttons included) was recreated by AnimatedContent on every
        // slide change, which disposed whichever button currently had focus;
        // Compose has nothing sensible to hand focus to at that point, so it
        // fell back to the nav rail - "left/right to change slides kicks you
        // back out to the nav icon" was that focus loss. A stable composable
        // that never gets disposed never loses focus in the first place.
        val slide = slides[index]
        Column(
            modifier = Modifier
                .fillMaxHeight()
                .widthIn(max = 820.dp)
                .padding(start = 60.dp)
                .align(Alignment.CenterStart),
            verticalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.Start
        ) {
            HeroBadgeRow(badges = buildBadges(slide))

            Text(
                text = buildTitle(slide.title, slide.titleHighlight, nocturne.goldSoft),
                color = nocturne.text,
                fontSize = 64.sp,
                fontWeight = FontWeight.Medium,
                lineHeight = 68.sp,
                letterSpacing = (-0.025).em,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Text(
                text = slide.subtitle,
                color = nocturne.textMuted,
                fontSize = 23.sp,
                lineHeight = 34.5.sp,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = 660.dp)
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HeroButton(
                    label = slide.primaryLabel,
                    iconRes = slide.primaryIcon,
                    accent = true,
                    onClick = { TvSoundManager.play("select"); onPlay() }
                )

                slide.secondaryLabel?.let { label ->
                    HeroButton(
                        label = label,
                        iconRes = slide.secondaryIcon,
                        accent = false,
                        onClick = { TvSoundManager.play("select"); onInfo() }
                    )
                }

                if (slide.showBookmark) {
                    BookmarkButton()
                }
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(20.dp),
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 60.dp, bottom = 52.dp)
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

private fun buildBadges(slide: HeroSlide): List<HeroBadge> {
    return if (slide.badges.isNotEmpty()) slide.badges
    else if (slide.badge.isNotBlank()) listOf(HeroBadge(slide.badge))
    else emptyList()
}

private fun buildTitle(title: String, highlight: String, highlightColor: androidx.compose.ui.graphics.Color) =
    buildAnnotatedString {
        if (highlight.isEmpty()) {
            append(title)
        } else {
            val start = title.indexOf(highlight)
            if (start >= 0) {
                append(title.substring(0, start))
                withStyle(SpanStyle(color = highlightColor)) {
                    append(highlight)
                }
                append(title.substring(start + highlight.length))
            } else {
                append(title)
            }
        }
    }

@Composable
private fun HeroBadgeRow(badges: List<HeroBadge>) {
    if (badges.isEmpty()) return
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        badges.forEach { badge ->
            HeroBadgePill(badge = badge)
        }
    }
}

@Composable
private fun HeroBadgePill(badge: HeroBadge) {
    val nocturne = LocalNocturne.current
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(99.dp))
            .background(nocturne.background.copy(alpha = 0.62f))
            .border(1.dp, nocturne.accent700, RoundedCornerShape(99.dp))
            .padding(horizontal = 15.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (badge.isLive) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(RoundedCornerShape(50))
                    .background(nocturne.green)
            )
        }
        badge.icon?.let { icon ->
            Icon(
                painter = painterResource(icon),
                contentDescription = null,
                tint = nocturne.goldLight,
                modifier = Modifier.size(18.dp)
            )
        }
        if (badge.icon == null && !badge.emoji.isNullOrBlank()) {
            Text(
                text = badge.emoji,
                fontSize = 18.sp
            )
        }
        Text(
            text = badge.text.uppercase(),
            color = nocturne.goldLight,
            fontSize = 17.sp,
            letterSpacing = 0.14.em,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            softWrap = false
        )
    }
}

@Composable
private fun HeroButton(
    label: String,
    iconRes: Int,
    accent: Boolean,
    onClick: () -> Unit
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }

    val borderColor = if (focused) nocturne.gold else if (accent) nocturne.gold else nocturne.borderCard
    val contentColor = if (accent) nocturne.background else nocturne.text

    val buttonBrush = if (accent) {
        nocturne.goldCta
    } else {
        Brush.horizontalGradient(
            listOf(
                nocturne.background.copy(alpha = 0.55f),
                nocturne.background.copy(alpha = 0.45f)
            )
        )
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(buttonBrush)
            .border(if (focused) 3.dp else 1.dp, borderColor, RoundedCornerShape(8.dp))
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = if (accent) 32.dp else 28.dp, vertical = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(13.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                painter = painterResource(iconRes),
                contentDescription = label,
                tint = contentColor,
                modifier = Modifier.size(21.dp)
            )
            Text(
                text = label,
                color = contentColor,
                fontSize = 22.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun BookmarkButton() {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }

    Box(
        modifier = Modifier
            .size(58.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(nocturne.background.copy(alpha = 0.55f))
            .border(if (focused) 3.dp else 1.dp, if (focused) nocturne.gold else nocturne.borderCard, RoundedCornerShape(8.dp))
            .clickable(interactionSource = interactionSource, indication = null, onClick = { TvSoundManager.play("toggle") }),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            painter = painterResource(R.drawable.ic_ph_bookmark_simple),
            contentDescription = "Bookmark",
            tint = nocturne.text,
            modifier = Modifier.size(23.dp)
        )
    }
}

data class HeroBadge(
    val text: String,
    val icon: Int? = null,
    val emoji: String? = null,
    val isLive: Boolean = false
)

data class HeroSlide(
    val title: String,
    val titleHighlight: String = "",
    val subtitle: String,
    val badges: List<HeroBadge> = emptyList(),
    val badge: String = "",
    val primaryLabel: String = "Watch",
    val primaryIcon: Int = R.drawable.ic_ph_play,
    val secondaryLabel: String? = null,
    val secondaryIcon: Int = R.drawable.ic_ph_info,
    val showBookmark: Boolean = false,
    val imageUrl: String? = null,
    val href: String? = null
)

fun defaultHeroSlides() = listOf(
    HeroSlide(
        title = "Women. Power. Transformation.",
        titleHighlight = "Power.",
        subtitle = "The Afrovision Challenge: a high-intensity reality programme discovering and transforming young African women into elite business leaders.",
        badges = listOf(
            HeroBadge("Auditions opening soon", icon = R.drawable.ic_ph_trophy)
        ),
        primaryLabel = "Watch the trailer",
        primaryIcon = R.drawable.ic_ph_play,
        secondaryLabel = "Learn more",
        showBookmark = true
    ),
    HeroSlide(
        title = "Watch. Earn. Connect.",
        titleHighlight = "Earn.",
        subtitle = "Thousands of creators and viewers on the continent's most vibrant live streaming community — and you earn rewards while you watch.",
        badges = listOf(
            HeroBadge("LIVE", isLive = true),
            HeroBadge("14.9k watching", icon = R.drawable.ic_ph_eye),
            HeroBadge("Afrovision Community", icon = R.drawable.ic_ph_feed)
        ),
        primaryLabel = "Explore channels",
        primaryIcon = R.drawable.ic_ph_broadcast_fill,
        secondaryLabel = "Your rewards",
        secondaryIcon = R.drawable.ic_ph_coins
    ),
    HeroSlide(
        title = "Tech Talk:\nAI in Africa",
        titleHighlight = "AI in Africa",
        subtitle = "Artificial intelligence and its impact on African tech ecosystems — top speakers, real insights, live from Lagos and Nairobi.",
        badges = listOf(
            HeroBadge("LIVE NOW", isLive = true),
            HeroBadge("32.8k watching", icon = R.drawable.ic_ph_eye),
            HeroBadge("Tech Africa", icon = R.drawable.ic_ph_television_simple)
        ),
        primaryLabel = "Watch live now",
        primaryIcon = R.drawable.ic_ph_play,
        secondaryLabel = "Set reminder",
        secondaryIcon = R.drawable.ic_ph_bell_simple
    )
)
