package com.afrovision.tv.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.MediaCard
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.api.model.CatchUpCredit
import com.afrovision.tv.data.api.model.CatchUpHome
import com.afrovision.tv.data.api.model.CatchUpItem
import com.afrovision.tv.data.api.model.CatchUpPerson
import com.afrovision.tv.ui.components.FocusCard
import com.afrovision.tv.ui.components.HeroBanner
import com.afrovision.tv.ui.components.HeroSlide
import com.afrovision.tv.ui.components.TopChrome
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay

@Composable
fun CatchUpScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val catchUp = viewModel.catchUp
    val selected = viewModel.selectedCatchUpItem
    var heroIndex by remember { androidx.compose.runtime.mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        viewModel.loadCatchUp()
        while (true) {
            delay(10 * 60 * 1000L)
            viewModel.loadCatchUp()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)
        )

        Column(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                TopChrome(
                    userName = viewModel.userName.collectAsState().value,
                    userAvatar = viewModel.userName.collectAsState().value,
                    modifier = Modifier.fillMaxSize()
                )
            }

            when (catchUp) {
                is LoadState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Loading Catch Up…",
                            color = nocturne.textFaint,
                            fontSize = 22.sp
                        )
                    }
                }
                is LoadState.Error -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Catch Up unavailable: ${(catchUp as LoadState.Error).message}",
                            color = nocturne.textFaint,
                            fontSize = 22.sp
                        )
                    }
                }
                is LoadState.Success -> {
                    val home = (catchUp as LoadState.Success<CatchUpHome>).data
                    CatchUpFeed(viewModel, home, heroIndex) { heroIndex = it }
                }
            }
        }

        selected?.let {
            CatchUpDetailOverlay(viewModel, it)
        }
    }
}

@Composable
private fun CatchUpFeed(
    viewModel: TvViewModel,
    home: CatchUpHome,
    heroIndex: Int,
    onHeroIndexChange: (Int) -> Unit
) {
    val nocturne = LocalNocturne.current
    val heroSlides = home.hero.map { it.toHeroSlide() }
    val spotlight = home.episodeSpotlight

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 60.dp)
    ) {
        if (heroSlides.isNotEmpty()) {
            item {
                HeroBanner(
                    slides = heroSlides,
                    onPlay = { viewModel.playCatchUpTrailer(home.hero[heroIndex]) },
                    onInfo = { viewModel.selectCatchUpItem(home.hero[heroIndex]) },
                    onIndexChange = onHeroIndexChange
                )
            }
        }

        if (spotlight != null) {
            item {
                CatchUpRailRow(
                    title = "Episode Spotlight",
                    items = listOf(spotlight),
                    viewModel = viewModel,
                    aspect = 16f to 9f,
                    cardWidth = 300
                )
            }
        }

        if (home.trendingPeople.isNotEmpty()) {
            item {
                PeopleRailRow(
                    title = "Trending People",
                    people = home.trendingPeople,
                    viewModel = viewModel
                )
            }
        }

        home.rails.forEach { rail ->
            if (rail.items.isNotEmpty()) {
                item {
                    CatchUpRailRow(
                        title = rail.title,
                        items = rail.items,
                        viewModel = viewModel,
                        aspect = 2f to 3f,
                        cardWidth = 180
                    )
                }
            }
        }

        if (home.rails.isEmpty() && home.hero.isEmpty() && home.trendingPeople.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(240.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Catch Up feed is empty.",
                        color = nocturne.textFaint,
                        fontSize = 22.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun CatchUpRailRow(
    title: String,
    items: List<CatchUpItem>,
    viewModel: TvViewModel,
    aspect: Pair<Float, Float>,
    cardWidth: Int
) {
    val nocturne = LocalNocturne.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 24.dp)
    ) {
        Text(
            text = title,
            color = nocturne.text,
            fontSize = 28.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 60.dp, vertical = 12.dp)
        )

        LazyRow(
            contentPadding = PaddingValues(horizontal = 60.dp),
            horizontalArrangement = Arrangement.spacedBy(22.dp)
        ) {
            itemsIndexed(items, key = { _, item -> item.id }) { _, item ->
                val card = item.toMediaCard()
                FocusCard(
                    item = card,
                    aspect = aspect,
                    onClick = { viewModel.selectCatchUpItem(item) },
                    modifier = Modifier.width(cardWidth.dp)
                )
            }
        }
    }
}

@Composable
private fun PeopleRailRow(
    title: String,
    people: List<CatchUpPerson>,
    viewModel: TvViewModel
) {
    val nocturne = LocalNocturne.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 24.dp)
    ) {
        Text(
            text = title,
            color = nocturne.text,
            fontSize = 28.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 60.dp, vertical = 12.dp)
        )

        LazyRow(
            contentPadding = PaddingValues(horizontal = 60.dp),
            horizontalArrangement = Arrangement.spacedBy(22.dp)
        ) {
            itemsIndexed(people, key = { _, p -> p.id }) { _, person ->
                val card = person.toMediaCard()
                FocusCard(
                    item = card,
                    aspect = 1f to 1f,
                    onClick = { },
                    modifier = Modifier.width(180.dp)
                )
            }
        }
    }
}

@Composable
private fun CatchUpDetailOverlay(viewModel: TvViewModel, initialItem: CatchUpItem) {
    val nocturne = LocalNocturne.current
    val detail = viewModel.catchUpDetail
    val item = (detail as? LoadState.Success)?.data ?: initialItem

    BackHandler { viewModel.clearCatchUpDetail() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(nocturne.background.copy(alpha = 0.96f)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 60.dp, vertical = 48.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().weight(1f),
                horizontalArrangement = Arrangement.spacedBy(48.dp)
            ) {
                Box(
                    modifier = Modifier
                        .width(420.dp)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(14.dp))
                        .background(nocturne.surfaceRaised)
                ) {
                    if (!item.posterUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = item.posterUrl,
                            contentDescription = item.title,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = item.title,
                        color = nocturne.text,
                        fontSize = 56.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )

                    Text(
                        text = buildMetaLine(item),
                        color = nocturne.textFaint,
                        fontSize = 22.sp
                    )

                    Text(
                        text = item.overview,
                        color = nocturne.textMuted,
                        fontSize = 22.sp,
                        lineHeight = 30.sp,
                        maxLines = 8,
                        overflow = TextOverflow.Ellipsis
                    )

                    if (detail is LoadState.Loading) {
                        Text(
                            text = "Loading full details…",
                            color = nocturne.textFaint,
                            fontSize = 20.sp
                        )
                    }

                    if (item.cast.isNotEmpty()) {
                        CreditChips("Cast", item.cast)
                    }

                    if (item.directors.isNotEmpty()) {
                        CreditChips("Directors", item.directors)
                    }

                    if (item.genres.isNotEmpty()) {
                        GenresRow(item.genres)
                    }

                    if (item.recommendations.isNotEmpty()) {
                        Text(
                            text = "More like this",
                            color = nocturne.text,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(top = 12.dp)
                        )
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(18.dp),
                            modifier = Modifier.padding(top = 12.dp)
                        ) {
                            itemsIndexed(item.recommendations, key = { _, r -> r.id }) { _, rec ->
                                val card = rec.toMediaCard()
                                var focused by remember { mutableStateOf(false) }
                                val scale by androidx.compose.animation.core.animateFloatAsState(
                                    if (focused) 1.06f else 1f,
                                    label = "recScale"
                                )
                                FocusCard(
                                    item = card,
                                    aspect = 2f to 3f,
                                    onClick = { viewModel.selectCatchUpItem(rec) },
                                    modifier = Modifier
                                        .width(140.dp)
                                        .scale(scale)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(20.dp)
                    ) {
                        if (!item.trailerUrl.isNullOrBlank()) {
                            DetailButton(
                                label = "Watch Trailer",
                                icon = Icons.Filled.PlayArrow,
                                accent = true,
                                onClick = { viewModel.playCatchUpTrailer(item) }
                            )
                        }
                        DetailButton(
                            label = "Close",
                            icon = Icons.Filled.Info,
                            accent = false,
                            onClick = { viewModel.clearCatchUpDetail() }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CreditChips(label: String, credits: List<CatchUpCredit>) {
    val nocturne = LocalNocturne.current
    Column {
        Text(
            text = label,
            color = nocturne.text,
            fontSize = 22.sp,
            fontWeight = FontWeight.Medium
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier.padding(top = 10.dp)
        ) {
            credits.take(6).forEach { credit ->
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.width(96.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(RoundedCornerShape(99.dp))
                            .background(nocturne.surfaceRaised)
                    ) {
                        if (!credit.profileUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = credit.profileUrl,
                                contentDescription = credit.name,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }
                    Text(
                        text = credit.name,
                        color = nocturne.text,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                    val role = credit.character ?: credit.job
                    if (!role.isNullOrBlank()) {
                        Text(
                            text = role,
                            color = nocturne.textFaint,
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun GenresRow(genres: List<String>) {
    val nocturne = LocalNocturne.current
    Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.padding(top = 8.dp)
    ) {
        genres.forEach { genre ->
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(99.dp))
                    .background(nocturne.surfaceRaised)
                    .border(1.dp, nocturne.borderCard, RoundedCornerShape(99.dp))
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text(
                    text = genre,
                    color = nocturne.text,
                    fontSize = 16.sp
                )
            }
        }
    }
}

@Composable
private fun DetailButton(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accent: Boolean,
    onClick: () -> Unit
) {
    val nocturne = LocalNocturne.current
    var focused by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }
    if (accent) {
        LaunchedEffect(Unit) { focusRequester.requestFocus() }
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .border(
                2.dp,
                if (focused) nocturne.accent else if (accent) nocturne.accent else nocturne.borderCard,
                RoundedCornerShape(10.dp)
            )
            .background(if (accent) nocturne.accent900 else nocturne.background.copy(alpha = 0.5f))
            .focusRequester(focusRequester)
            .focusable(true)
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 28.dp, vertical = 16.dp)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(imageVector = icon, contentDescription = label, tint = nocturne.accentLight, modifier = Modifier.size(26.dp))
            Text(
                text = label,
                color = if (accent) nocturne.accentLight else nocturne.text,
                fontSize = 22.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

private fun buildMetaLine(item: CatchUpItem): String {
    val parts = mutableListOf<String>()
    if (item.rating > 0) parts.add("${item.rating} ★")
    if (!item.certification.isNullOrBlank()) parts.add(item.certification)
    if (item.runtime != null && item.runtime > 0) parts.add("${item.runtime}m")
    if (!item.releaseDate.isNullOrBlank()) parts.add(item.releaseDate)
    return parts.joinToString(" · ")
}

private fun CatchUpItem.toHeroSlide(): HeroSlide {
    val badge = if (certification.isNullOrBlank().not()) certification!!
        else if (rating > 0) "${rating} ★"
        else ""
    return HeroSlide(
        title = title,
        subtitle = overview,
        badge = badge,
        primaryLabel = if (!trailerUrl.isNullOrBlank()) "Watch Trailer" else "Details",
        imageUrl = backdropUrl ?: posterUrl
    )
}

private fun CatchUpItem.toMediaCard(): MediaCard {
    val badge = if (certification.isNullOrBlank().not()) certification!!
        else if (rating > 0) "${rating} ★"
        else ""
    val subtitle = if (releaseDate.isNullOrBlank()) overview.take(40) else releaseDate
    return MediaCard(
        id = id,
        title = title,
        subtitle = subtitle,
        imageUrl = posterUrl ?: backdropUrl,
        badge = badge,
        mediaType = "catchup",
        streamUrl = null,
        externalUrl = null,
        duration = 0L
    )
}

private fun CatchUpPerson.toMediaCard(): MediaCard {
    return MediaCard(
        id = id,
        title = name,
        subtitle = knownFor.take(2).joinToString(", "),
        imageUrl = profileUrl,
        mediaType = "person"
    )
}
