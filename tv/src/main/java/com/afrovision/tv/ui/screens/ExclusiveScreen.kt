package com.afrovision.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.R
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.api.model.Channel
import com.afrovision.tv.data.api.model.ChannelSubscription
import com.afrovision.tv.data.toMediaCard
import com.afrovision.tv.data.toPlayerMedia
import com.afrovision.tv.ui.components.LibraryCard
import com.afrovision.tv.ui.components.PosterCard
import com.afrovision.tv.ui.components.RailRow
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

private enum class ExclusiveTab { Movies, Series, Library }

/**
 * Mirrors mobile's exclusive-membership surfaces from Media Center, but
 * consolidated into one screen with all exclusive content moved OUT of the
 * public Movies/Series/Library screens entirely (per plan: TV separates
 * exclusive from public rather than interleaving them the way mobile does).
 * Three tabs, each showing only that content type from channels the account
 * has active exclusive access to - plus the Renew and Request/Purchase
 * membership cards mobile shows, both handed off to the phone via QR since
 * TV never handles payment in-app.
 */
@Composable
fun ExclusiveScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val moviesState = viewModel.exclusiveMovies
    val seriesState = viewModel.exclusiveSeries
    val libraryState = viewModel.exclusiveLibrary
    val accessState = viewModel.exclusiveAccess
    val channelsState = viewModel.exclusiveChannels
    val subsState = viewModel.channelSubscriptions
    var tab by remember { mutableStateOf(ExclusiveTab.Movies) }

    LaunchedEffect(Unit) {
        if (moviesState !is LoadState.Success) viewModel.loadExclusiveContent()
        if (accessState !is LoadState.Success) viewModel.loadExclusiveAccess()
        if (subsState !is LoadState.Success) viewModel.loadChannelSubscriptions()
    }

    val movies = (moviesState as? LoadState.Success)?.data.orEmpty()
    val series = (seriesState as? LoadState.Success)?.data.orEmpty()
    val library = (libraryState as? LoadState.Success)?.data.orEmpty()
    val libraryById = library.associateBy { it.id }
    val totalCount = movies.size + series.size + library.size
    val stillLoading = moviesState is LoadState.Loading || seriesState is LoadState.Loading || libraryState is LoadState.Loading

    val accesses = (accessState as? LoadState.Success)?.data?.accesses.orEmpty()
    val exclusiveChannels = (channelsState as? LoadState.Success)?.data.orEmpty()
    val subs = (subsState as? LoadState.Success)?.data.orEmpty()

    // A channel this account has ANY membership record for (active or
    // expired) already gets its own surface (shelf or Renew card) - the
    // non-member "request/purchase" card would only duplicate that, exactly
    // like mobile's `coveredIds` guard.
    val accessedChannelIds = accesses.map { it.channelId }.toSet()
    val subscribedChannelIds = subs.map { it.channelId }.toSet()
    val expiredFeeBasedSubs = subs.filter { !it.isActive && (it.amount > 0 || it.isPremium) }
    val nonMemberChannels = exclusiveChannels.filter { it.id !in accessedChannelIds && it.id !in subscribedChannelIds }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)) {
        LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 60.dp)) {
            item {
                Column(modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 60.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Icon(
                            painter = painterResource(R.drawable.ic_ph_exclusive),
                            contentDescription = null,
                            tint = nocturne.gold,
                            modifier = Modifier.size(36.dp)
                        )
                        Text(text = "Exclusive", color = nocturne.text, fontSize = 52.sp)
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(nocturne.accent900)
                                .border(1.dp, nocturne.accent700, RoundedCornerShape(999.dp))
                                .padding(horizontal = 14.dp, vertical = 6.dp)
                        ) {
                            Text(text = "MEMBERS ONLY", color = nocturne.accentLight, fontSize = 14.sp)
                        }
                    }
                    Text(
                        text = if (stillLoading) "Loading your exclusive access…" else "$totalCount titles across your exclusive channels",
                        color = nocturne.textHint,
                        fontSize = 18.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                    Row(
                        modifier = Modifier
                            .padding(top = 22.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(nocturne.surface)
                            .padding(4.dp)
                    ) {
                        listOf(
                            ExclusiveTab.Movies to "Movies",
                            ExclusiveTab.Series to "Series",
                            ExclusiveTab.Library to "Library"
                        ).forEach { (value, label) ->
                            ExclusiveTabPill(label = label, selected = tab == value, onClick = { tab = value })
                        }
                    }
                }
            }

            if (expiredFeeBasedSubs.isNotEmpty()) {
                items(expiredFeeBasedSubs, key = { "renew-${it.channelId}" }) { sub ->
                    RenewCard(sub)
                }
            }
            if (nonMemberChannels.isNotEmpty()) {
                items(nonMemberChannels, key = { "nonmember-${it.id}" }) { channel ->
                    NonMemberInfoCard(channel)
                }
            }

            when (tab) {
                ExclusiveTab.Movies -> if (movies.isNotEmpty()) {
                    val moviesById = movies.associateBy { it.id }
                    item {
                        RailRow(
                            title = "Exclusive movies",
                            subtitle = "${movies.size} titles",
                            items = movies.map { it.toMediaCard() },
                            cardContent = { card -> PosterCard(item = card, onClick = { moviesById[card.id]?.let { viewModel.selectMovie(it) } }) }
                        )
                    }
                }
                ExclusiveTab.Series -> if (series.isNotEmpty()) {
                    val seriesById = series.associateBy { it.id }
                    item {
                        RailRow(
                            title = "Exclusive series",
                            subtitle = "${series.size} titles",
                            items = series.map { it.toMediaCard() },
                            cardContent = { card -> PosterCard(item = card, onClick = { seriesById[card.id]?.let { viewModel.selectSeries(it) } }) }
                        )
                    }
                }
                ExclusiveTab.Library -> if (library.isNotEmpty()) {
                    item {
                        RailRow(
                            title = "Exclusive library",
                            subtitle = "${library.size} titles",
                            items = library.map { it.toMediaCard() },
                            cardContent = { card ->
                                val raw = libraryById[card.id]
                                LibraryCard(
                                    item = card,
                                    onClick = { if (raw != null) viewModel.openReaderScreen(raw.channelId, raw.id) }
                                )
                            }
                        )
                    }
                }
            }

            val tabIsEmpty = when (tab) {
                ExclusiveTab.Movies -> movies.isEmpty()
                ExclusiveTab.Series -> series.isEmpty()
                ExclusiveTab.Library -> library.isEmpty()
            }
            if (!stillLoading && tabIsEmpty && expiredFeeBasedSubs.isEmpty() && nonMemberChannels.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                        Text(
                            text = "No exclusive ${tab.name.lowercase()} yet.",
                            color = nocturne.textFaint,
                            fontSize = 22.sp
                        )
                    }
                }
            }
        }

        viewModel.selectedMovie?.let { movie ->
            MediaDetailOverlay(
                title = movie.title,
                imageUrl = movie.posterUrl,
                meta = formatMovieDuration(movie.duration),
                description = movie.description ?: "",
                playLabel = "Play",
                canPlay = !movie.streamUrl.isNullOrBlank(),
                onPlay = { viewModel.play(movie.toMediaCard().toPlayerMedia()); viewModel.clearSelectedMovie() },
                onDismiss = { viewModel.clearSelectedMovie() }
            )
        }
        viewModel.selectedSeries?.let { s ->
            MediaDetailOverlay(
                title = s.title,
                imageUrl = s.posterUrl,
                meta = "${s.seasons.size} season${if (s.seasons.size == 1) "" else "s"}",
                description = s.description ?: "",
                playLabel = "Play S1E1",
                canPlay = firstEpisodePlayerMedia(s) != null,
                onPlay = {
                    firstEpisodePlayerMedia(s)?.let { viewModel.play(it) }
                    viewModel.clearSelectedSeries()
                },
                onDismiss = { viewModel.clearSelectedSeries() }
            )
        }
    }
}

@Composable
private fun ExclusiveTabPill(label: String, selected: Boolean, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) nocturne.accent900 else androidx.compose.ui.graphics.Color.Transparent)
            .border(
                if (focused) 2.dp else if (selected) 1.dp else 0.dp,
                if (focused) nocturne.gold else nocturne.accent700,
                RoundedCornerShape(999.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 26.dp, vertical = 11.dp)
    ) {
        Text(
            text = label,
            color = if (focused) nocturne.goldLight else if (selected) nocturne.accentLight else nocturne.textMuted,
            fontSize = 18.sp
        )
    }
}

// Renew and Request/Purchase both hand off to the phone via QR (scanning
// opens the real paywall there) rather than attempting in-app payment on a
// TV remote - same pattern this screen already used for its QR card.
@Composable
private fun RenewCard(sub: ChannelSubscription) {
    val nocturne = LocalNocturne.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 60.dp, end = 60.dp, top = 20.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(androidx.compose.ui.graphics.Color(0xFF17224A))
            .border(1.dp, androidx.compose.ui.graphics.Color(0xFFA8761F), RoundedCornerShape(14.dp))
            .padding(20.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = "MEMBERSHIP EXPIRED", color = nocturne.goldSoft, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text(text = sub.channelName, color = nocturne.text, fontSize = 22.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 2.dp))
            Text(
                text = "Renew to get back exclusive movies, series and your saved library on ${sub.channelName}.",
                color = nocturne.goldLight,
                fontSize = 15.sp,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
        ExclusiveQrPrompt(label = "Scan to renew on your phone")
    }
}

@Composable
private fun NonMemberInfoCard(channel: Channel) {
    val nocturne = LocalNocturne.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 60.dp, end = 60.dp, top = 20.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(nocturne.surfaceRaised)
            .border(1.dp, androidx.compose.ui.graphics.Color(0xFF4A3A1A), RoundedCornerShape(14.dp))
            .padding(20.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(
                    painter = painterResource(R.drawable.ic_ph_lock_simple),
                    contentDescription = null,
                    tint = nocturne.goldSoft,
                    modifier = Modifier.size(18.dp)
                )
                Text(text = "PREMIUM · PRIVATE MEMBERSHIP", color = nocturne.gold, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            }
            Text(text = channel.name, color = nocturne.text, fontSize = 22.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 4.dp))
            Text(
                text = "${channel.name} is an Exclusive Channel with Private Membership. Only members can access its content.",
                color = nocturne.textMuted,
                fontSize = 15.sp,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
        ExclusiveQrPrompt(label = "Scan to request access")
    }
}

@Composable
private fun ExclusiveQrPrompt(label: String) {
    val nocturne = LocalNocturne.current
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(100.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(androidx.compose.ui.graphics.Color.White)
                .padding(8.dp),
            contentAlignment = Alignment.Center
        ) {
            androidx.compose.foundation.Image(
                bitmap = generateQrBitmap("https://afrovision.online/pricing", 200).asImageBitmap(),
                contentDescription = label,
                modifier = Modifier.fillMaxSize()
            )
        }
        Text(text = label, color = nocturne.textFaint, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp).width(120.dp))
    }
}
